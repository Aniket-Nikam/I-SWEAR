import asyncio
from collections import deque
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import admissions, app
from app.room_manager import RoomManager
from tests.test_movement import Socket


def test_room_admission_limit_and_security_headers():
    with TestClient(app) as client:
        admissions["testclient"] = deque([time.monotonic()] * 60)
        response = client.post("/api/rooms", json={"name": "Witness"})
        assert response.status_code == 429
        admissions.clear()
        response = client.post("/api/rooms", content="x" * 2049)
        assert response.status_code == 413
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.headers["X-Content-Type-Options"] == "nosniff"
        assert health.headers["Cache-Control"] == "no-store"
    admissions.clear()


def test_websocket_rejects_an_unrelated_browser_origin():
    with TestClient(app) as client:
        session = client.post("/api/rooms", json={"name": "Witness"}).json()
        path = f"/ws/rooms/{session['room_code']}?player_id={session['player_id']}&token={session['reconnect_token']}"
        with pytest.raises(WebSocketDisconnect) as error:
            with client.websocket_connect(path, headers={"origin": "https://unrelated.invalid"}):
                pass
        assert error.value.code == 1008


def test_failed_host_socket_migrates_host_and_removes_its_vote():
    class BrokenSocket(Socket):
        async def send_json(self, message):
            raise OSError("Disconnected")

    async def run():
        manager = RoomManager()
        room, host = manager.create("Host")
        _, other = manager.join(room.code, "Other")
        await manager.connect(room, host, Socket())
        await manager.connect(room, other, Socket())
        room.lock_votes.add(host.id)
        host.websocket = BrokenSocket()
        await manager.broadcast(room, {"type": "pong"})
        assert room.host_id == other.id
        assert not host.connected
        assert host.id not in room.lock_votes
    asyncio.run(run())
