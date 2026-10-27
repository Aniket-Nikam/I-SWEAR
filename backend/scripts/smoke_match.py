"""Play a real four-client match against a running server, using only public APIs.

Run from backend: python scripts/smoke_match.py --url http://127.0.0.1:8017
The script creates a disposable QA room; it never changes existing rooms.
"""

import argparse
import asyncio
import json
import math
import sys
import time
from pathlib import Path

import httpx
from websockets.asyncio.client import connect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.mystery import BLACKOUT


async def until(predicate, timeout=8):
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise AssertionError("Timed out waiting for a server event")
        await asyncio.sleep(0.05)


async def room_when(api, code, predicate, timeout=8):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        snapshot = (await api.get(f"/api/rooms/{code}")).json()
        if predicate(snapshot):
            return snapshot
        await asyncio.sleep(0.5)
    raise AssertionError("Timed out waiting for room state")


class Witness:
    def __init__(self, session):
        self.session = session
        self.players = {}
        self.memories = []
        self.events = []
        self.sequence = 0

    async def open(self, url):
        query = f"player_id={self.session['player_id']}&token={self.session['reconnect_token']}"
        self.socket = await connect(f"{url.replace('http', 'ws', 1)}/ws/rooms/{self.session['room_code']}?{query}")
        self.reader = asyncio.create_task(self.read())
        self.heartbeat = asyncio.create_task(self.keepalive())
        await until(lambda: bool(self.players))

    async def read(self):
        async for raw in self.socket:
            message = json.loads(raw)
            self.events.append(message)
            if message["type"] in ("snapshot", "positions"):
                for player in message["players"]:
                    self.players[player["id"]] = player
            if message["type"] == "memories":
                self.memories = message["memories"]

    async def send(self, kind, **payload):
        await self.socket.send(json.dumps({"type": kind, **payload}))

    async def keepalive(self):
        try:
            while True:
                await self.send("ping")
                await asyncio.sleep(2)
        except Exception:
            return

    async def walk(self, route):
        for x, y, object_id in route:
            deadline = time.monotonic() + 15
            while True:
                player = self.players[self.session["player_id"]]
                dx, dy = x - player["x"], y - player["y"]
                distance = math.hypot(dx, dy)
                if distance < 18:
                    break
                assert time.monotonic() < deadline, f"Witness stuck approaching {x},{y}"
                await self.send("move", dx=dx / distance, dy=dy / distance, sequence=self.sequence)
                self.sequence += 1
                await asyncio.sleep(0.075)
            await self.send("move", dx=0, dy=0, sequence=self.sequence)
            self.sequence += 1
            if object_id:
                await self.send("interact", interactable_id=object_id)

    async def close(self):
        self.heartbeat.cancel()
        await self.socket.close()
        await self.reader


async def play(url):
    witnesses = []
    async with httpx.AsyncClient(base_url=url, timeout=8) as api:
        response = await api.post("/api/rooms", json={"name": "QA North"})
        response.raise_for_status()
        host = response.json()
        code = host["room_code"]
        sessions = [host]
        for name in ("QA East", "QA South", "QA West"):
            response = await api.post(f"/api/rooms/{code}/join", json={"name": name})
            response.raise_for_status()
            sessions.append(response.json())
        try:
            for session in sessions:
                witness = Witness(session)
                witnesses.append(witness)
                await witness.open(url)
            for witness in witnesses:
                await witness.send("ready", ready=True)
            await room_when(api, code, lambda room: all(p["ready"] for p in room["players"]))
            await witnesses[0].send("start")
            await until(lambda: all(len(w.memories) == 5 for w in witnesses))
            original_arrival = witnesses[0].memories[0]["claim"].copy()
            assert witnesses[0].memories[0]["claim"]["location"] != witnesses[1].memories[0]["claim"]["location"]
            for witness in witnesses:
                for memory in witness.memories:
                    await witness.send("testify", memory_id=memory["id"], stake=25)
            routes = [
                [(824, 700, "atrium_badge")],
                [(1200, 740, None), (1350, 740, None), (1350, 940, None), (1390, 1060, "server_panel")],
                [(770, 740, None), (480, 740, None), (480, 950, None), (610, 1050, "security_terminal")],
                [(1500, 740, None), (1650, 740, None), (1650, 440, None), (1668, 286, "lab_c_notebook")],
            ]
            await asyncio.gather(*(w.walk(route) for w, route in zip(witnesses, routes)))
            snapshot = (await api.get(f"/api/rooms/{code}")).json()
            assert len(snapshot["evidence"]) == 4
            assert snapshot["clashes"]
            assert snapshot["result"] is None
            assert "memories" not in snapshot["players"][0]
            false_id = next(t["id"] for t in snapshot["testimonies"] if t["player_id"] == sessions[1]["player_id"] and t["memory"]["id"] == "memory_1")
            for witness in witnesses[2:]:
                await witness.send("respond", testimony_id=false_id, response="BELIEVE", stake=25)
            await witnesses[2].send("respond", testimony_id=false_id, response="DOUBT", stake=25)
            sources = {}
            for event in BLACKOUT.events:
                matching = [item for item in snapshot["evidence"] if item["event_id"] == event.id]
                if matching:
                    sources[event.id] = matching[0]["id"]
                else:
                    sources[event.id] = next(t["id"] for t in snapshot["testimonies"] if t["memory"]["event_id"] == event.id and all(t["memory"]["claim"][key] == getattr(event, key) for key in ("actor", "location", "time", "object", "action")))
            for slot, event in enumerate(BLACKOUT.events):
                snapshot = (await api.get(f"/api/rooms/{code}")).json()
                revision = snapshot["timeline"]["revision"]
                await witnesses[slot % 4].send("timeline", slot=slot, source_id=sources[event.id], status="CONFIRMED", revision=revision)
                await until(lambda: any(e["type"] == "timeline" and e["timeline"]["revision"] > revision for e in witnesses[0].events))
            snapshot = (await api.get(f"/api/rooms/{code}")).json()
            revision = snapshot["timeline"]["revision"]
            for witness in witnesses[:3]:
                await witness.send("lock_vote", revision=revision, vote=True)
            await until(lambda: any(e["type"] == "reveal" for e in witnesses[0].events))
            snapshot = (await api.get(f"/api/rooms/{code}")).json()
            assert snapshot["room"]["phase"] == "reveal"
            result = snapshot["result"]
            assert result["reality_recovered"] == 100
            assert result["consensus_mistakes"] == 1
            replay = (await api.get(f"/api/replays/{result['replay_code']}")).json()
            assert replay["reality_recovered"] == 100
            await until(lambda: all(any(e["type"] == "phase_changed" and e["phase"] == "results" for e in w.events) for w in witnesses), timeout=32)
            before_rematch = [len(w.events) for w in witnesses]
            await witnesses[0].send("rematch")
            await until(lambda: all(any(e["type"] == "snapshot" and e["room"]["phase"] == "lobby" and not e["testimonies"] for e in w.events[count:]) for w, count in zip(witnesses, before_rematch)))
            await until(lambda: all(not w.memories for w in witnesses))
            for witness in witnesses:
                await witness.send("ready", ready=True)
            await room_when(api, code, lambda room: all(p["ready"] for p in room["players"]))
            await witnesses[0].send("start")
            await until(lambda: all(len(w.memories) == 5 for w in witnesses))
            assert witnesses[0].memories[0]["claim"] != original_arrival
            assert (await api.get(f"/api/replays/{result['replay_code']}")).json()["reality_recovered"] == 100
            print(json.dumps({"room": code, "clients": 4, "physical_records": 4, "recovered": 100, "replay": result["replay_code"], "results_received": 4, "rematch_variant": "passed"}))
        finally:
            await asyncio.gather(*(w.close() for w in witnesses), return_exceptions=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8017")
    from scripts.smoke_casefile import play as play_casefile
    asyncio.run(play_casefile(parser.parse_args().url.rstrip("/"), 4, "campus"))
