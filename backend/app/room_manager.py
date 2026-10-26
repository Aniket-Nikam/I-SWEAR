from __future__ import annotations

import asyncio
import math
import secrets
import time
from hashlib import sha256
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from .models import RoomPhase
from .world import integrate, line_clear
from .maps import MAP_INFO, map_data, map_scenario
from .mystery import Memory, Scenario, assign_memories, contradictions
from .investigation import BINDINGS, recover_evidence, resolve_source, timeline_public
from .scoring import accurate, compute_results
from .demo import advance_demo
from .archivist import Archivist, FALLBACK_INTRO

MIN_PLAYERS = 4
MAX_PLAYERS = 8
INTERACTION_RADIUS = 96.0
# Compatibility exports for local tooling; gameplay always selects the room's map.
SPAWNS = map_data()["spawns"]
INTERACTABLES = map_data()["objects"]
WORLD_WIDTH, WORLD_HEIGHT = map_data()["width"], map_data()["height"]


@dataclass
class Player:
    id: str
    name: str
    token: str
    color_index: int
    x: float
    y: float
    ready: bool = False
    connected: bool = False
    last_seen: float = field(default_factory=time.monotonic)
    last_move: float = field(default_factory=time.monotonic)
    last_sequence: int = -1
    websocket: WebSocket | None = None
    dx: float = 0.0
    dy: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    last_input: float = field(default_factory=time.monotonic)
    afk: bool = False
    action_times: list[float] = field(default_factory=list)
    memories: tuple[Memory, ...] = ()
    last_chat: float = 0.0
    evidence_found: set[str] = field(default_factory=set)
    theory_edits: int = 0
    is_bot: bool = False
    token_hash: str = ""
    avatar_color: int | None = None
    hat: str = "none"
    account_id: str | None = None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "color_index": self.color_index,
            "avatar_color": self.avatar_color if self.avatar_color is not None else self.color_index,
            "hat": self.hat,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "ready": self.ready,
            "connected": self.connected,
            "afk": self.afk,
            "vx": round(self.vx, 2),
            "vy": round(self.vy, 2),
            "dx": self.dx,
            "dy": self.dy,
            "input_sequence": self.last_sequence,
            "is_bot": self.is_bot,
        }


@dataclass
class Room:
    code: str
    host_id: str
    phase: RoomPhase = RoomPhase.LOBBY
    players: dict[str, Player] = field(default_factory=dict)
    created_at: float = field(default_factory=time.monotonic)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    scenario: Scenario | None = None
    testimonies: dict[str, dict] = field(default_factory=dict)
    clashes: list[dict] = field(default_factory=list)
    chat: list[dict] = field(default_factory=list)
    evidence: dict[str, dict] = field(default_factory=dict)
    timeline: list[dict | None] = field(default_factory=lambda: [None] * 6)
    timeline_revision: int = 0
    lock_votes: set[str] = field(default_factory=set)
    theory_changes: int = 0
    round_number: int = 1
    result: dict | None = None
    reveal_started_at: float | None = None
    instability_used: bool = False
    solo: bool = False
    demo_elapsed: float = 0.0
    demo_navigation: dict[str, int] = field(default_factory=dict)
    demo_steps: set[str] = field(default_factory=set)
    consensus_events: set[str] = field(default_factory=set)
    response_history: list[dict] = field(default_factory=list)
    ai_requests: int = 0
    ai_setup_done: bool = False
    ai_recap_done: bool = False
    intro: str = FALLBACK_INTRO
    is_public: bool = False
    max_players: int = MAX_PLAYERS
    map_id: str = "campus"

    def snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "room": {
                "code": self.code,
                "host_id": self.host_id,
                "phase": self.phase.value,
                "min_players": MIN_PLAYERS,
                "max_players": self.max_players,
                "solo": self.solo,
                "is_public": self.is_public,
                "map_id": self.map_id,
                "map": MAP_INFO[self.map_id],
            },
            "players": [player.public() for player in self.players.values()],
            "interactables": [
                {key: value for key, value in item.items() if key != "detail"}
                for item in map_data(self.map_id)["objects"]
            ],
            "world": {key: map_data(self.map_id)[key] for key in ("width", "height", "rooms", "walls")},
            "testimonies": list(self.testimonies.values()),
            "clashes": self.clashes,
            "chat": self.chat,
            "evidence": list(self.evidence.values()),
            "timeline": timeline_public(self),
            "result": self.result if self.phase in (RoomPhase.REVEAL, RoomPhase.RESULTS) else None,
            "reveal_started_at": self.reveal_started_at,
        }


class RoomError(Exception):
    pass


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.repository = None
        self.archivist = Archivist()
        self.presentation_tasks: set[asyncio.Task] = set()

    def present(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.presentation_tasks.add(task)
        task.add_done_callback(self.presentation_tasks.discard)

    @staticmethod
    def _code() -> str:
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "".join(secrets.choice(alphabet) for _ in range(5))

    @staticmethod
    def _player(name: str, index: int, map_id="campus") -> Player:
        x, y = map_data(map_id)["spawns"][index]
        player = Player(
            id=secrets.token_urlsafe(8),
            name=name,
            token=secrets.token_urlsafe(24),
            color_index=index,
            x=x,
            y=y,
        )
        player.token_hash = sha256(player.token.encode()).hexdigest()
        return player

    def create(self, name: str, map_id="campus") -> tuple[Room, Player]:
        if map_id not in MAP_INFO:
            raise RoomError("Unknown map")
        code = self._code()
        while code in self.rooms:
            code = self._code()
        player = self._player(name, 0, map_id)
        room = Room(code=code, host_id=player.id, players={player.id: player}, map_id=map_id)
        self.rooms[code] = room
        return room, player

    def join(self, code: str, name: str) -> tuple[Room, Player]:
        room = self.rooms.get(code.upper())
        if not room:
            raise RoomError("Room not found")
        if room.solo:
            raise RoomError("This is a private solo rehearsal. Create a multiplayer room to invite friends.")
        if room.phase is not RoomPhase.LOBBY:
            raise RoomError("Investigation already in progress")
        if len(room.players) >= room.max_players:
            raise RoomError("Room is full")
        normalized = name.casefold()
        if any(player.name.casefold() == normalized for player in room.players.values()):
            raise RoomError("That witness name is already in use")
        occupied = {player.color_index for player in room.players.values()}
        player = self._player(name, next(index for index in range(MAX_PLAYERS) if index not in occupied), room.map_id)
        room.players[player.id] = player
        return room, player

    async def appearance(self, room, player, color, hat):
        if room.phase is not RoomPhase.LOBBY:
            raise RoomError("Change your outfit in the lobby.")
        player.avatar_color, player.hat = color, hat
        await self.broadcast(room, {"type": "presence", "player": player.public()})

    async def leave(self, room, player, websocket):
        await self.disconnect(room, player, websocket)
        if room.phase is not RoomPhase.LOBBY:
            return
        room.players.pop(player.id, None)
        if not any(not witness.is_bot for witness in room.players.values()):
            self.rooms.pop(room.code, None)
            if self.repository:
                self.repository.delete_room(room.code)
            return
        await self.broadcast(room, room.snapshot())

    def create_solo(self, name: str, map_id="campus") -> tuple[Room, Player]:
        room, player = self.create(name, map_id)
        player.ready = True
        for index, bot_name in enumerate(("Riya", "Mina", "Omar"), start=1):
            bot = self._player(f"{bot_name} (scripted)", index, map_id)
            bot.is_bot = bot.connected = bot.ready = True
            room.players[bot.id] = bot
        room.solo = True
        return room, player

    def authenticate(self, code: str, player_id: str, token: str) -> tuple[Room, Player]:
        room = self.rooms.get(code.upper())
        if not room or player_id not in room.players:
            raise RoomError("Session not found")
        player = room.players[player_id]
        if not secrets.compare_digest(player.token_hash, sha256(token.encode()).hexdigest()):
            raise RoomError("Invalid reconnect token")
        return room, player

    async def broadcast(self, room: Room, payload: dict[str, Any], exclude: str | None = None) -> None:
        stale: list[tuple[Player, WebSocket]] = []
        for player in list(room.players.values()):
            if player.id == exclude or not player.connected or not player.websocket:
                continue
            try:
                await player.websocket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect, OSError):
                stale.append((player, player.websocket))
        for player, websocket in stale:
            await self.disconnect(room, player, websocket)

    async def connect(self, room: Room, player: Player, websocket: WebSocket) -> None:
        if player.websocket and player.websocket is not websocket:
            try:
                await player.websocket.close(code=4001, reason="Session opened elsewhere")
            except (RuntimeError, WebSocketDisconnect, OSError):
                pass
        player.websocket = websocket
        player.connected = True
        player.last_seen = time.monotonic()
        player.last_move = player.last_seen
        player.last_sequence = -1
        player.dx = player.dy = player.vx = player.vy = 0.0
        player.last_input = player.last_seen
        player.afk = False
        if not any(item.connected and item.id == room.host_id for item in room.players.values()):
            room.host_id = player.id
        await websocket.send_json(room.snapshot())
        if player.memories:
            await websocket.send_json({"type": "memories", "memories": [memory.private() for memory in player.memories]})
        await self.broadcast(room, {"type": "presence", "player": player.public()}, exclude=player.id)
        await self.broadcast(room, {"type": "timeline", "timeline": timeline_public(room)})
        if room.solo and room.phase is RoomPhase.LOBBY and player.ready:
            await self.start(room, player)

    async def disconnect(self, room: Room, player: Player, websocket: WebSocket) -> None:
        if player.websocket is not websocket:
            return
        player.connected = False
        player.dx = player.dy = player.vx = player.vy = 0.0
        player.websocket = None
        player.last_seen = time.monotonic()
        room.lock_votes.discard(player.id)
        await self.broadcast(room, {"type": "presence", "player": player.public()})
        if player.id == room.host_id:
            candidates = [item for item in room.players.values() if item.connected and not item.is_bot]
            if candidates:
                room.host_id = candidates[0].id
                await self.broadcast(room, {"type": "host_changed", "host_id": room.host_id})
        await self.broadcast(room, {"type": "timeline", "timeline": timeline_public(room)})

    async def set_ready(self, room: Room, player: Player, ready: bool) -> None:
        if room.phase is not RoomPhase.LOBBY:
            return
        player.ready = ready
        await self.broadcast(room, {"type": "ready_changed", "player_id": player.id, "ready": ready})
        if room.solo and ready:
            await self.start(room, player)

    async def start(self, room: Room, player: Player) -> None:
        if player.id != room.host_id:
            raise RoomError("Only the host can begin")
        if room.phase is not RoomPhase.LOBBY:
            return
        if len(room.players) < MIN_PLAYERS:
            raise RoomError(f"At least {MIN_PLAYERS} witnesses are required")
        if not all(item.ready and item.connected for item in room.players.values()):
            raise RoomError("Every witness must be connected and ready")
        room.phase = RoomPhase.EXPLORING
        room.scenario = map_scenario(room.code, room.round_number, room.map_id)
        for index, witness in enumerate(room.players.values()):
            witness.memories = assign_memories(room.scenario, index, f"{room.code}-{room.round_number}",
                                               tuple(r["name"] for r in map_data(room.map_id)["rooms"][:3]) if room.map_id != "campus" else ())
            if witness.websocket:
                await witness.websocket.send_json({"type": "memories", "memories": [memory.private() for memory in witness.memories]})
        await self.broadcast(room, {"type": "phase_changed", "phase": room.phase.value})
        self.present(self.archivist.setup(self, room))

    async def testify(self, room: Room, player: Player, memory_id: str, stake: int) -> None:
        if room.phase is not RoomPhase.EXPLORING:
            raise RoomError("The investigation has not begun")
        memory = next((item for item in player.memories if item.id == memory_id), None)
        if not memory:
            raise RoomError("That memory does not belong to you")
        existing = next((item for item in room.testimonies.values()
                         if item["player_id"] == player.id and item["memory"]["id"] == memory_id), None)
        if existing:
            existing.update(stake=stake, retracted=False)
            testimony = existing
        else:
            testimony = {"id": f"testimony_{len(room.testimonies) + 1}", "player_id": player.id,
                         "name": player.name, "memory": memory.private(), "stake": stake,
                         "responses": {}, "retracted": False}
            room.testimonies[testimony["id"]] = testimony
        player.last_seen = time.monotonic()
        await self.broadcast(room, {"type": "testimony", "testimony": testimony})
        for other in list(room.testimonies.values()):
            if other["player_id"] == player.id or other["retracted"]:
                continue
            fields = contradictions(testimony["memory"], other["memory"])
            pair = sorted((testimony["id"], other["id"]))
            if fields and not any(clash["testimony_ids"] == pair for clash in room.clashes):
                clash = {"id": f"clash_{len(room.clashes) + 1}", "testimony_ids": pair,
                         "fields": fields, "names": [testimony["name"], other["name"]]}
                room.clashes.append(clash)
                await self.broadcast(room, {"type": "clash", "clash": clash})

    async def respond(self, room: Room, player: Player, testimony_id: str, response: str, stake: int) -> None:
        if room.phase is not RoomPhase.EXPLORING:
            raise RoomError("The record is locked")
        testimony = room.testimonies.get(testimony_id)
        if not testimony or testimony["retracted"]:
            raise RoomError("Testimony is unavailable")
        if testimony["player_id"] == player.id:
            raise RoomError("Other witnesses respond to your testimony")
        testimony["responses"][player.id] = {"response": response, "stake": stake}
        previous = next((entry for entry in reversed(room.response_history)
                         if entry["player_id"] == player.id and entry["testimony_id"] == testimony_id), None)
        if previous and previous["response"] != response:
            room.theory_changes += 1
        room.response_history.append({"player_id": player.id, "testimony_id": testimony_id,
                                      "response": response, "stake": stake})
        player.last_seen = time.monotonic()
        await self.broadcast(room, {"type": "testimony", "testimony": testimony})
        if not accurate(room.scenario, testimony["memory"]):
            support = 1 + sum(item["response"] == "BELIEVE" for item in testimony["responses"].values())
            if support > len(room.players) // 2:
                room.consensus_events.add(testimony_id)
                if not room.instability_used:
                    room.instability_used = True
                    await self.broadcast(room, {"type": "archivist", "text": "MEMORY INSTABILITY DETECTED. At least one memory accepted by the majority is false."})

    async def retract(self, room: Room, player: Player, testimony_id: str) -> None:
        if room.phase is not RoomPhase.EXPLORING:
            raise RoomError("The record is locked")
        testimony = room.testimonies.get(testimony_id)
        if not testimony or testimony["player_id"] != player.id:
            raise RoomError("Only the witness can retract this testimony")
        testimony["retracted"] = True
        await self.broadcast(room, {"type": "testimony", "testimony": testimony})

    async def chat_message(self, room: Room, player: Player, text: str) -> None:
        now = time.monotonic()
        if now - player.last_chat < 0.7:
            raise RoomError("Give the other witnesses a moment")
        clean = "".join(character for character in text.strip() if character.isprintable())[:280]
        if not clean:
            raise RoomError("Message is empty")
        player.last_chat = player.last_seen = now
        message = {"id": secrets.token_hex(6), "player_id": player.id, "name": player.name, "text": clean}
        room.chat.append(message)
        room.chat = room.chat[-60:]
        await self.broadcast(room, {"type": "chat", "message": message})

    async def move(self, room: Room, player: Player, dx: float, dy: float, sequence: int) -> None:
        if room.phase is not RoomPhase.EXPLORING or sequence <= player.last_sequence:
            return
        player.last_sequence = sequence
        player.dx, player.dy = dx, dy
        player.last_input = time.monotonic()
        if dx or dy:
            player.last_seen = player.last_input
            was_afk = player.afk
            player.afk = False
            if was_afk:
                await self.broadcast(room, {"type": "presence", "player": player.public()})

    async def tick(self, dt: float = 0.05) -> None:
        now = time.monotonic()
        for room in list(self.rooms.values()):
            if any(player.connected and not player.is_bot for player in room.players.values()):
                await advance_demo(self, room, max(0, dt))
            if room.phase is RoomPhase.REVEAL and room.reveal_started_at and time.time() - room.reveal_started_at >= 26:
                room.phase = RoomPhase.RESULTS
                await self.broadcast(room, {"type": "phase_changed", "phase": room.phase.value})
            changed = []
            for player in list(room.players.values()):
                if not player.connected:
                    continue
                is_afk = now - player.last_seen > 90
                if player.afk != is_afk:
                    player.afk = is_afk
                    await self.broadcast(room, {"type": "presence", "player": player.public()})
                if room.phase is not RoomPhase.EXPLORING:
                    continue
                if now - player.last_input > 0.3:
                    player.dx = player.dy = 0.0
                previous = (player.x, player.y, player.vx, player.vy)
                # Keep real-time speed through ordinary scheduler jitter, without
                # allowing a long process stall to jump through walls.
                remaining = min(max(0, dt), 0.1)
                while remaining > 0:
                    step = min(remaining, 0.025)
                    player.x, player.y, player.vx, player.vy = integrate(
                        player.x, player.y, player.vx, player.vy, player.dx, player.dy, step, map_data(room.map_id))
                    remaining = max(0, remaining - step)
                if previous != (player.x, player.y, player.vx, player.vy):
                    changed.append(player.public())
            if changed:
                await self.broadcast(room, {"type": "positions", "players": changed})

    def check_rate(self, player: Player) -> bool:
        now = time.monotonic()
        player.action_times = [stamp for stamp in player.action_times if now - stamp < 1]
        if len(player.action_times) >= 60:
            return False
        player.action_times.append(now)
        return True

    async def interact(self, room: Room, player: Player, interactable_id: str) -> None:
        if room.phase is not RoomPhase.EXPLORING:
            raise RoomError("The investigation has not begun")
        player.last_seen = time.monotonic()
        item = next((value for value in map_data(room.map_id)["objects"] if value["id"] == interactable_id), None)
        if not item:
            raise RoomError("Unknown interactable")
        if math.hypot(player.x - item["x"], player.y - item["y"]) > INTERACTION_RADIUS:
            raise RoomError("Move closer to inspect that object")
        if not line_clear(player.x, player.y, item["x"], item["y"], map_data(room.map_id)["walls"]):
            raise RoomError("Move through the doorway to inspect this object.")
        evidence = recover_evidence(room.scenario, item["id"]) if room.scenario else None
        if evidence and room.map_id != "campus":
            evidence["label"] = item["label"].upper() + " / LOCAL RECORD"
        access_note = None
        if evidence and evidence["id"] not in room.evidence:
            clearance = list(BINDINGS).index(item["id"]) % 4
            if player.color_index % 4 != clearance:
                names = ", ".join(witness.name for witness in room.players.values() if witness.color_index % 4 == clearance)
                access_note = f"This recorder needs a different badge clearance. Ask {names} to inspect it."
                evidence = None
        if evidence:
            player.evidence_found.add(evidence["id"])
            if evidence["id"] not in room.evidence:
                room.evidence[evidence["id"]] = evidence
                await self.broadcast(room, {"type": "evidence", "evidence": evidence,
                                            "finder": player.name})
        detail = access_note or (evidence["text"] if evidence else item["detail"])
        if player.websocket:
            await player.websocket.send_json({"type": "inspection", "interactable": {**item, "detail": detail, "evidence": evidence}})
        await self.broadcast(
            room,
            {"type": "activity", "player_id": player.id, "verb": "inspected", "label": item["label"]},
            exclude=player.id,
        )

    async def edit_timeline(self, room: Room, player: Player, slot: int,
                            source_id: str | None, status: str, revision: int) -> None:
        if room.phase is not RoomPhase.EXPLORING:
            raise RoomError("The timeline is locked")
        if revision != room.timeline_revision:
            raise RoomError("Another witness updated the timeline. Review it and try again.")
        if not 0 <= slot < 6:
            raise RoomError("Unknown timeline slot")
        source = resolve_source(room, source_id) if source_id else None
        if source_id and not source:
            raise RoomError("Share the memory or recover the evidence before placing it")
        if source:
            for index, entry in enumerate(room.timeline):
                if entry and entry["event_id"] == source["event_id"]:
                    room.timeline[index] = None
        room.timeline[slot] = {**source, "status": status} if source else None
        room.timeline_revision += 1
        room.theory_changes += 1
        player.theory_edits += 1
        room.lock_votes.clear()
        player.last_seen = time.monotonic()
        await self.broadcast(room, {"type": "timeline", "timeline": timeline_public(room)})

    async def rematch(self, room: Room, player: Player) -> None:
        if player.id != room.host_id or room.phase is not RoomPhase.RESULTS:
            raise RoomError("The host can rematch after the reveal")
        room.phase = RoomPhase.LOBBY
        room.round_number += 1
        room.scenario = None
        room.result = None
        room.reveal_started_at = None
        room.testimonies.clear()
        room.clashes.clear()
        room.chat.clear()
        room.evidence.clear()
        room.timeline = [None] * 6
        room.timeline_revision = room.theory_changes = 0
        room.lock_votes.clear()
        room.instability_used = False
        room.demo_elapsed = 0.0
        room.demo_navigation.clear()
        room.demo_steps.clear()
        room.consensus_events.clear()
        room.response_history.clear()
        room.ai_requests = 0
        room.ai_setup_done = room.ai_recap_done = False
        room.intro = FALLBACK_INTRO
        for index, witness in enumerate(room.players.values()):
            witness.x, witness.y = map_data(room.map_id)["spawns"][index]
            witness.dx = witness.dy = witness.vx = witness.vy = 0.0
            witness.ready = witness.is_bot
            witness.memories = ()
            witness.evidence_found.clear()
            witness.theory_edits = 0
        for witness in room.players.values():
            if witness.connected and witness.websocket:
                await witness.websocket.send_json(room.snapshot())
                await witness.websocket.send_json({"type": "memories", "memories": []})

    async def vote_lock(self, room: Room, player: Player, revision: int, vote: bool) -> None:
        if room.phase is not RoomPhase.EXPLORING or revision != room.timeline_revision:
            raise RoomError("The timeline changed. Review it before voting.")
        if not all(room.timeline):
            raise RoomError("Fill all six timeline positions before locking reality")
        if len(room.evidence) < 3:
            raise RoomError("Recover at least three physical records before locking reality")
        if any(not resolve_source(room, entry["source_id"]) for entry in room.timeline):
            raise RoomError("A source was retracted. Replace it before voting.")
        if vote:
            room.lock_votes.add(player.id)
        else:
            room.lock_votes.discard(player.id)
        await self.broadcast(room, {"type": "timeline", "timeline": timeline_public(room)})
        required = timeline_public(room)["required_votes"]
        if room.phase is RoomPhase.EXPLORING and len(room.lock_votes) >= required:
            room.result = compute_results(room)
            if self.repository:
                room.result = self.repository.save_match(room.result, [witness.name for witness in room.players.values()])
                from .accounts import record_account_results
                record_account_results(self.repository, room)
            room.phase = RoomPhase.REVEAL
            room.reveal_started_at = time.time()
            for witness in room.players.values():
                witness.dx = witness.dy = witness.vx = witness.vy = 0.0
            await self.broadcast(room, {"type": "reveal", "result": room.result, "started_at": room.reveal_started_at})
            await self.broadcast(room, {"type": "phase_changed", "phase": room.phase.value})
            self.present(self.archivist.recap(self, room))


manager = RoomManager()
