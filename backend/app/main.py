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
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("i-swear")
action_adapter = TypeAdapter(ClientAction)
allowed_origins = {value.strip().rstrip("/") for value in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5187,http://127.0.0.1:5187"
).split(",") if value.strip()}
admissions: dict[str, deque] = defaultdict(deque)

@asynccontextmanager
async def lifespan(app: FastAPI):
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
                manager.repository.save_rooms(list(manager.rooms.values()))
                last_save = time.monotonic()
    task = asyncio.create_task(simulate())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        for presentation in list(manager.presentation_tasks):
            presentation.cancel()
        if manager.presentation_tasks:
            await asyncio.gather(*manager.presentation_tasks, return_exceptions=True)
        manager.repository.save_rooms(list(manager.rooms.values()))
        manager.repository.engine.dispose()
        manager.repository = None


app = FastAPI(title="I SWEAR game server", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def request_guard(request: Request, call_next):
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
async def create_room(payload: CreateRoomRequest) -> SessionResponse:
    room, player = manager.create(payload.name)
    if manager.repository:
        manager.repository.save_rooms([room])
    return SessionResponse(
        room_code=room.code,
        player_id=player.id,
        reconnect_token=player.token,
        share_url=f"/?room={room.code}",
    )


@app.post("/api/rooms/{code}/join", response_model=SessionResponse)
async def join_room(code: str, payload: JoinRoomRequest) -> SessionResponse:
    try:
        room, player = manager.join(code, payload.name)
    except RoomError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if manager.repository:
        manager.repository.save_rooms([room])
    return SessionResponse(
        room_code=room.code,
        player_id=player.id,
        reconnect_token=player.token,
        share_url=f"/?room={room.code}",
    )


@app.post("/api/rooms/solo", response_model=SessionResponse, status_code=201)
async def create_solo(payload: CreateRoomRequest) -> SessionResponse:
    room, player = manager.create_solo(payload.name)
    if manager.repository:
        manager.repository.save_rooms([room])
    return SessionResponse(room_code=room.code, player_id=player.id,
                           reconnect_token=player.token, share_url=f"/?room={room.code}")


@app.get("/api/rooms/{code}")
async def room_status(code: str) -> dict:
    room = manager.rooms.get(code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.snapshot()


@app.get("/api/replays/{code}")
async def replay(code: str) -> dict:
    result = manager.repository.replay(code) if manager.repository else None
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
    try:
        await manager.connect(room, player, websocket)
        while True:
            raw = await websocket.receive_text()
            if player.websocket is not websocket:
                break
            if not manager.check_rate(player):
                await websocket.close(code=4008, reason="Too many actions")
                break
            if len(raw) > 2048:
                await websocket.send_json({"type": "error", "message": "Message too large"})
                continue
            try:
                action = action_adapter.validate_json(raw)
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
                elif action.type == "lock_vote":
                    await manager.vote_lock(room, player, action.revision, action.vote)
                elif action.type == "rematch":
                    await manager.rematch(room, player)
                else:
                    await websocket.send_json({"type": "pong"})
                if action.type not in ("move", "ping") and manager.repository:
                    manager.repository.save_rooms([room])
            except (ValidationError, json.JSONDecodeError):
                logger.warning("Rejected invalid action from %s", player.id)
                await websocket.send_json({"type": "error", "message": "Invalid action"})
            except RoomError as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(room, player, websocket)


static_dir = Path(os.getenv("STATIC_DIR", str(Path(__file__).resolve().parents[2] / "frontend" / "dist")))
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="game")
