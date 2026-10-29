from __future__ import annotations

import json
import logging
import asyncio
import time
import os
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlsplit
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import TypeAdapter, ValidationError

from .models import ClientAction, CreateRoomRequest, JoinRoomRequest, SessionResponse
from .room_manager import RoomError, manager
from .persistence import Repository
from .accounts import router as account_router, session_for_request
from .maps import public_maps
from .voice import voice_hub
from .game_channel import GameChannel
from .logging_utils import protect_connection_logs
from dotenv import load_dotenv

load_dotenv()
protect_connection_logs()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("i-swear")
action_adapter = TypeAdapter(ClientAction)
allowed_origins = {value.strip().rstrip("/") for value in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5187,http://127.0.0.1:5187"
).split(",") if value.strip()}
admissions: dict[str, deque] = defaultdict(deque)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.password_gate = asyncio.Semaphore(2)
    manager.repository = Repository(os.getenv("DATABASE_URL", "sqlite:///./i_swear.db"))
    for room in manager.repository.load_rooms():
        manager.rooms.setdefault(room.code, room)
    async def simulate():
        last_save = time.monotonic()
        last_tick = last_save
        while True:
            await asyncio.sleep(0.05)
            now = time.monotonic()
            await manager.tick(now - last_tick)
            last_tick = now
            if time.monotonic() - last_save >= 5:
                active = [room for room in manager.rooms.values() if room.phase.value == "exploring"
                          and any(player.connected and not player.is_bot for player in room.players.values())]
                for room in list(manager.pending_checkpoints.values()) + active:
                    manager.request_checkpoint(room)
                last_save = time.monotonic()
    task = asyncio.create_task(simulate())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        if manager.checkpoint_task:
            await manager.checkpoint_task
        for presentation in list(manager.presentation_tasks):
            presentation.cancel()
        if manager.presentation_tasks:
            await asyncio.gather(*manager.presentation_tasks, return_exceptions=True)
        if manager.result_tasks:
            await asyncio.gather(*manager.result_tasks, return_exceptions=True)
        await manager.repository.apersist_rooms(list(manager.rooms.values()))
        manager.repository.engine.dispose()
        manager.repository = None


app = FastAPI(title="I SWEAR game server", version="0.1.0", lifespan=lifespan)
app.include_router(account_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def request_guard(request: Request, call_next):
    if request.method == "POST" and request.url.path.startswith("/api/auth/"):
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in allowed_origins and urlsplit(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "Request origin not allowed"}, status_code=403)
    if request.method == "POST" and request.url.path.startswith("/api/rooms"):
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        recent = admissions[key]
        while recent and now - recent[0] > 60:
            recent.popleft()
        if len(recent) >= 60:
            return JSONResponse({"detail": "Too many room requests. Try again in a minute."}, status_code=429)
        recent.append(now)
        if len(admissions) > 4096:
            for address in list(admissions):
                if not admissions[address] or now - admissions[address][-1] > 60:
                    del admissions[address]
        declared_size = request.headers.get("content-length", "0")
        if not declared_size.isdecimal() or int(declared_size) > 2048:
            return JSONResponse({"detail": "Request too large"}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/rooms", response_model=SessionResponse, status_code=201)
async def create_room(payload: CreateRoomRequest, request: Request) -> SessionResponse:
    room, player = manager.create(payload.name, payload.map_id)
    room.is_public, room.max_players = payload.is_public, payload.max_players
    await apply_profile(player, payload, request)
    if manager.repository:
        await manager.repository.apersist_rooms([room])
    return SessionResponse(
        room_code=room.code,
        player_id=player.id,
        reconnect_token=player.token,
        share_url=f"/?room={room.code}",
    )


@app.post("/api/rooms/{code}/join", response_model=SessionResponse)
async def join_room(code: str, payload: JoinRoomRequest, request: Request) -> SessionResponse:
    try:
        room, player = manager.join(code, payload.name)
    except RoomError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await apply_profile(player, payload, request)
    if manager.repository:
        await manager.repository.apersist_rooms([room])
    return SessionResponse(
        room_code=room.code,
        player_id=player.id,
        reconnect_token=player.token,
        share_url=f"/?room={room.code}",
    )


@app.post("/api/rooms/solo", response_model=SessionResponse, status_code=201)
async def create_solo(payload: CreateRoomRequest, request: Request) -> SessionResponse:
    room, player = manager.create_solo(payload.name, payload.map_id, tutorial=payload.tutorial)
    await apply_profile(player, payload, request)
    if manager.repository:
        await manager.repository.apersist_rooms([room])
    return SessionResponse(room_code=room.code, player_id=player.id,
                           reconnect_token=player.token, share_url=f"/?room={room.code}")


@app.get("/api/rooms/{code}")
async def room_status(code: str) -> dict:
    room = manager.rooms.get(code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.snapshot()


async def apply_profile(player, payload, request):
    player.avatar_color, player.hat = payload.avatar_color, payload.hat
    account = await asyncio.to_thread(session_for_request, request)
    player.account_id = account["id"] if account else None


@app.get("/api/lobbies")
async def lobbies():
    return {"rooms": [{"code": room.code, "host": room.players[room.host_id].name,
                        "map_id": room.map_id, "players": len(room.players), "max_players": room.max_players}
                       for room in manager.rooms.values()
                       if room.is_public and not room.solo and room.phase.value == "lobby"
                       and any(player.connected for player in room.players.values())]}


@app.get("/api/maps")
async def maps():
    return {"maps": public_maps()}


@app.get("/api/replays/{code}")
async def replay(code: str) -> dict:
    result = await asyncio.to_thread(manager.repository.replay, code) if manager.repository else None
    if not result:
        raise HTTPException(status_code=404, detail="This case record is unavailable")
    return result


@app.websocket("/ws/rooms/{code}")
async def room_socket(websocket: WebSocket, code: str, player_id: str, token: str) -> None:
    origin = websocket.headers.get("origin")
    if origin:
        parsed = urlsplit(origin)
        if origin.rstrip("/") not in allowed_origins and parsed.netloc != websocket.headers.get("host"):
            await websocket.close(code=1008, reason="Origin not allowed")
            return
    try:
        room, player = manager.authenticate(code, player_id, token)
    except RoomError:
        await websocket.accept()
        await websocket.close(code=4003, reason="Invalid session")
        return
    await websocket.accept()
    channel = GameChannel(websocket)
    writer = asyncio.create_task(channel.write())
    try:
        async with room.lock:
            await manager.connect(room, player, channel)
        while True:
            raw = await websocket.receive_text()
            if player.websocket is not channel:
                break
            if not manager.check_rate(player):
                await channel.close(code=4008, reason="Too many actions")
                break
            if len(raw) > 2048:
                await channel.send_json({"type": "error", "message": "Message too large"})
                continue
            try:
                action = action_adapter.validate_json(raw)
                async with room.lock:
                    if player.websocket is not channel:
                        break
                    if action.type == "ready":
                        await manager.set_ready(room, player, action.ready)
                    elif action.type == "start":
                        await manager.start(room, player)
                    elif action.type == "move":
                        await manager.move(room, player, action.dx, action.dy, action.sequence)
                    elif action.type == "interact":
                        await manager.interact(room, player, action.interactable_id)
                    elif action.type == "testify":
                        await manager.testify(room, player, action.memory_id, action.stake)
                    elif action.type == "respond":
                        await manager.respond(room, player, action.testimony_id, action.response, action.stake)
                    elif action.type == "retract":
                        await manager.retract(room, player, action.testimony_id)
                    elif action.type == "chat":
                        await manager.chat_message(room, player, action.text)
                    elif action.type == "timeline":
                        await manager.edit_timeline(room, player, action.slot, action.source_id, action.status, action.revision)
                    elif action.type == "link_source":
                        await manager.link_timeline(room, player, action.slot, action.source_id, action.revision, action.remove)
                    elif action.type == "theory_vote":
                        await manager.vote_theory(room, player, action.revision, action.vote)
                    elif action.type == "reveal_motive":
                        await manager.reveal_motive(room, player)
                    elif action.type == "tutorial":
                        await manager.tutorial_action(room, player, action.action)
                    elif action.type == "lock_vote":
                        await manager.vote_lock(room, player, action.revision, action.vote)
                    elif action.type == "rematch":
                        await manager.rematch(room, player)
                    elif action.type == "appearance":
                        await manager.appearance(room, player, action.avatar_color, action.hat)
                    elif action.type == "leave":
                        await manager.leave(room, player, channel)
                        await channel.close(code=1000)
                        break
                    else:
                        await channel.send_json({"type": "pong"})
                    if action.type not in ("move", "ping"):
                        await manager.refresh_case(room)
                if action.type not in ("move", "ping") and manager.repository:
                    manager.request_checkpoint(room)
            except (ValidationError, json.JSONDecodeError):
                logger.warning("Rejected invalid action from %s", player.id)
                await channel.send_json({"type": "error", "message": "Invalid action"})
            except RoomError as exc:
                await channel.send_json({"type": "error", "message": str(exc)})
    except (WebSocketDisconnect, OSError):
        pass
    finally:
        async with room.lock:
            await manager.disconnect(room, player, channel)
        writer.cancel()
        with suppress(asyncio.CancelledError):
            await writer
        if manager.repository and room.code in manager.rooms:
            manager.request_checkpoint(room)


@app.websocket("/ws/voice/{code}")
async def voice_socket(websocket: WebSocket, code: str, player_id: str, token: str):
    origin = websocket.headers.get("origin")
    if origin and origin.rstrip("/") not in allowed_origins and urlsplit(origin).netloc != websocket.headers.get("host"):
        await websocket.close(code=1008)
        return
    try:
        room, player = manager.authenticate(code, player_id, token)
        if player.is_bot:
            raise RoomError("Scripted witnesses do not use voice")
    except RoomError:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    peer = await voice_hub.connect(room, player, websocket)
    writer = asyncio.create_task(voice_hub.write(peer))
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            frame = message.get("bytes")
            if frame is None or not voice_hub.relay(room, peer, frame):
                await websocket.close(code=1008, reason="Invalid voice frame")
                break
    except (WebSocketDisconnect, RuntimeError, OSError):
        pass
    finally:
        writer.cancel()
        with suppress(asyncio.CancelledError, RuntimeError, OSError):
            await writer
        voice_hub.disconnect(room.code, peer)


static_dir = Path(os.getenv("STATIC_DIR", str(Path(__file__).resolve().parents[2] / "frontend" / "dist")))
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="game")
