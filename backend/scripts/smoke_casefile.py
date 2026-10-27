"""A real 4/8-client case, through HTTP/WebSocket APIs and collision-safe movement.

Creates only disposable QA rooms. No server clock, geometry or player-state mutations.
Run from backend: python scripts/smoke_casefile.py --clients 8 --map ferry --url URL
"""
import argparse
import asyncio
import json
import math
import sys
import time
from pathlib import Path
import httpx
from websockets.exceptions import ConnectionClosed

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.navigation import walking_path
from app.maps import map_scenario
from scripts.smoke_match import Witness, until, room_when


class QAClient(httpx.AsyncClient):
    async def get(self, *args, **kwargs):
        # Only retry idempotent reads after a transport interruption. HTTP error
        # responses and all POST mutations retain their ordinary failure behavior.
        for attempt in range(3):
            try:
                return await super().get(*args, **kwargs)
            except httpx.TransportError:
                if attempt == 2:
                    raise
                print(json.dumps({"qa_read_transport_retry": attempt + 1}), flush=True)
                await asyncio.sleep(.2 * (attempt + 1))


class CaseWitness(Witness):
    def __init__(self, session):
        super().__init__(session)
        self.transport_lock = asyncio.Lock()
        self.network_reconnects = 0
        self.closing = False

    async def open(self, url):
        self.url = url
        self.closing = False
        before = len(self.events)
        await super().open(url)
        await until(lambda: any(item["type"] == "snapshot" for item in self.events[before:]), timeout=15)

    async def send(self, kind, **payload):
        async with self.transport_lock:
            for attempt in range(3):
                try:
                    return await super().send(kind, **payload)
                except ConnectionClosed as error:
                    if self.closing or attempt == 2 or self.network_reconnects >= 4:
                        raise
                    self.network_reconnects += 1
                    print(json.dumps({"client": self.session["player_id"], "transport_reconnect": self.network_reconnects,
                                      "received_close": error.rcvd.code if error.rcvd else None,
                                      "sent_close": error.sent.code if error.sent else None,
                                      "cause": type(error.__cause__).__name__}), flush=True)
                    if self.reader.done():
                        self.reader.exception()  # Observe the interrupted reader before replacing it.
                    if self.heartbeat is not asyncio.current_task():
                        self.heartbeat.cancel()
                    await self.open(self.url)

    async def keepalive(self):
        try:
            while not self.closing and self.heartbeat is asyncio.current_task():
                await self.send("ping")
                await asyncio.sleep(2)
        except Exception:
            return

    async def close(self):
        self.closing = True
        await super().close()

    async def visit(self, map_id, objects):
        for obj in objects:
            start = self.players[self.session["player_id"]]
            route = await asyncio.to_thread(walking_path, map_id, (start["x"], start["y"]), (obj["x"], obj["y"]))
            for x, y in route[1:]:
                deadline = time.monotonic() + 20
                while True:
                    player = self.players[self.session["player_id"]]
                    dx, dy = x-player["x"], y-player["y"]
                    distance = math.hypot(dx, dy)
                    if distance < 4:
                        break
                    assert time.monotonic() < deadline, f"Stuck near {obj['label']} at {round(player['x'])},{round(player['y'])}, target {x},{y}"
                    divisor = max(distance, 70)
                    await self.send("move", dx=dx/divisor, dy=dy/divisor, sequence=self.sequence)
                    self.sequence += 1
                    await asyncio.sleep(.05)
            await self.send("move", dx=0, dy=0, sequence=self.sequence)
            self.sequence += 1
            await self.send("interact", interactable_id=obj["id"])


async def play(url, clients, map_id):
    witnesses = []
    began = time.monotonic()
    async with QAClient(base_url=url, timeout=45) as api:
        response = await api.post("/api/rooms", json={"name":"Case QA 1", "map_id":map_id, "max_players":clients})
        response.raise_for_status()
        host = response.json(); code = host["room_code"]
        sessions = [host]
        for index in range(1, clients):
            response = await api.post(f"/api/rooms/{code}/join", json={"name":f"Case QA {index+1}"})
            response.raise_for_status(); sessions.append(response.json())
        print(json.dumps({"room":code,"clients":clients,"map":map_id,"stage":"lobby"}), flush=True)
        try:
            for session in sessions:
                witness = CaseWitness(session); witnesses.append(witness); await witness.open(url)
            for witness in witnesses:
                await witness.send("ready", ready=True)
            await room_when(api, code, lambda room: all(player["ready"] for player in room["players"]))
            await witnesses[0].send("start")
            await until(lambda: all(witness.memories for witness in witnesses), timeout=20)
            await until(lambda: all(any(event["type"] == "case_role" for event in witness.events) for witness in witnesses))
            roles = [next(event["role"] for event in witness.events if event["type"] == "case_role") for witness in witnesses]
            assert all(len([event for event in witness.events if event["type"] == "case_role"]) == 1 for witness in witnesses)
            for witness in witnesses:
                await witness.send("testify", memory_id="memory_1", stake=10)
            snapshot = await room_when(api, code, lambda room: len(room["testimonies"]) == clients)
            assert not snapshot["case"]["revealed_motives"]
            assert all("motive" not in player and "memories" not in player for player in snapshot["players"])
            assert snapshot["result"] is None
            objects = [item for item in snapshot["interactables"] if "clearance" in item]

            async def search(backup):
                plans = [[] for _ in witnesses]
                for obj in objects:
                    if obj["backup"] != backup:
                        continue
                    index = obj["clearance"] + (4 if backup and clients == 8 else 0)
                    plans[index].append(obj)
                await asyncio.gather(*(witness.visit(map_id, plan) for witness, plan in zip(witnesses, plans)))

            await search(False)
            snapshot = await room_when(api, code, lambda room: len(room["evidence"]) >= 6, timeout=12)
            scenario = map_scenario(code, 1, map_id)

            async def action_revision(witness, kind, **payload):
                snapshot = (await api.get(f"/api/rooms/{code}")).json()
                revision = snapshot["timeline"]["revision"]
                await witness.send(kind, revision=revision, **payload)
                return await room_when(api, code, lambda room: room["timeline"]["revision"] > revision)

            for slot, event in enumerate(scenario.events):
                record = next(item for item in snapshot["evidence"] if item["event_id"] == event.id)
                snapshot = await action_revision(witnesses[slot % clients], "timeline", slot=slot, source_id=record["id"], status="UNKNOWN")
            await witnesses[0].send("lock_vote", revision=snapshot["timeline"]["revision"], vote=True)
            await until(lambda: any(event["type"] == "error" and "Final voting" in event["message"] for event in witnesses[0].events))
            snapshot = await room_when(api, code, lambda room: room["case"]["stage"] == "first_theory", timeout=110)
            for witness in witnesses[:clients//2+1]:
                await witness.send("theory_vote", revision=snapshot["timeline"]["revision"], vote=True)
            snapshot = await room_when(api, code, lambda room: room["case"]["first_theory"] is not None)
            assert snapshot["case"]["first_theory"]["method"] == "majority"
            print(json.dumps({"room":code,"stage":"first theory saved","seconds":round(time.monotonic()-began)}), flush=True)
            snapshot = await room_when(api, code, lambda room: room["case"]["lead_available"], timeout=50)
            await search(True)
            snapshot = await room_when(api, code, lambda room: len(room["evidence"]) == len(objects), timeout=15)
            for slot, entry in enumerate(snapshot["timeline"]["slots"]):
                matching = [item for item in snapshot["evidence"] if item["event_id"] == entry["event_id"] and item["id"] not in entry["source_ids"]]
                for record in matching:
                    snapshot = await action_revision(witnesses[slot % clients], "link_source", slot=slot, source_id=record["id"])
            assert all(len(entry["verified_fields"]) == 5 for entry in snapshot["timeline"]["slots"])
            for witness in witnesses:
                await witness.send("reveal_motive")
            await room_when(api, code, lambda room: len(room["case"]["revealed_motives"]) == clients)
            # A disconnected host cannot retain lock votes or stop host migration.
            await witnesses[0].close()
            snapshot = await room_when(api, code, lambda room: room["room"]["host_id"] != sessions[0]["player_id"])
            await witnesses[0].open(url)
            await until(lambda: len([event for event in witnesses[0].events if event["type"] == "case_role"]) >= 2)
            assert [event["role"]["id"] for event in witnesses[0].events if event["type"] == "case_role"][-1] == roles[0]["id"]
            snapshot = await room_when(api, code, lambda room: all(player["connected"] for player in room["players"]))
            revision = snapshot["timeline"]["revision"]
            # Race two edits: the server must accept one and reject one stale revision.
            await asyncio.gather(*(witness.send("timeline", slot=0, source_id=snapshot["timeline"]["slots"][0]["source_id"], status="CONFIRMED", revision=revision) for witness in witnesses[:2]))
            snapshot = await room_when(api, code, lambda room: room["timeline"]["revision"] == revision+1)
            await until(lambda: any(event["type"] == "error" and "Another witness" in event["message"] for witness in witnesses[:2] for event in witness.events))
            for witness in witnesses[:clients//2+1]:
                await witness.send("lock_vote", revision=snapshot["timeline"]["revision"], vote=True)
            await until(lambda: all(any(event["type"] == "reveal" for event in witness.events) for witness in witnesses), timeout=15)
            snapshot = (await api.get(f"/api/rooms/{code}")).json(); result = snapshot["result"]
            assert result["reality_recovered"] == 100
            assert result["case_review"]["first_recovery"] == 0
            assert result["case_review"]["changed_positions"] == 6
            assert len(result["case_review"]["motives"]) == clients
            assert not result["case_review"]["deadline_used"]
            await until(lambda: any(event["type"] == "result_saved" for event in witnesses[0].events), timeout=30)
            replay = await api.get(f"/api/replays/{result['replay_code']}"); replay.raise_for_status()
            assert replay.json()["reality_recovered"] == 100
            assert replay.json()["case_review"] == result["case_review"]
            await room_when(api, code, lambda room: room["room"]["phase"] == "results", timeout=32)
            host_index = next(index for index, session in enumerate(sessions) if session["player_id"] == snapshot["room"]["host_id"])
            await witnesses[host_index].send("rematch")
            snapshot = await room_when(api, code, lambda room: room["room"]["phase"] == "lobby")
            assert snapshot["case"]["elapsed"] == 0 and not snapshot["case"]["revealed_motives"]
            assert not snapshot["evidence"] and not any(snapshot["timeline"]["slots"])
            assert snapshot["result"] is None
            print(json.dumps({"room":code,"clients":clients,"map":map_id,"records":len(objects),"recovered":100,"replay":result["replay_code"],"reconnect":"passed","network_reconnects":sum(witness.network_reconnects for witness in witnesses),"stale_edit":"passed","rematch":"passed","seconds":round(time.monotonic()-began)}), flush=True)
        finally:
            await asyncio.gather(*(witness.close() for witness in witnesses), return_exceptions=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8019")
    parser.add_argument("--clients", type=int, choices=(4,8), default=4)
    parser.add_argument("--map", choices=("campus","observatory","ferry"), default="campus")
    args = parser.parse_args()
    asyncio.run(play(args.url.rstrip("/"), args.clients, args.map))
