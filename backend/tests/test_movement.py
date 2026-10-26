import asyncio
import time

import pytest

from app.models import RoomPhase
from app.room_manager import RoomManager, RoomError
from app.world import integrate, blocked


class Socket:
    def __init__(self):
        self.messages = []

    async def send_json(self, message):
        self.messages.append(message)

    async def close(self, **kwargs):
        pass


def test_collision_blocks_walls_and_allows_doorways():
    x, y, vx, vy = 850.0, 530.0, 0.0, 0.0
    for _ in range(60):
        x, y, vx, vy = integrate(x, y, vx, vy, 0, -1, 0.05)
    assert y >= 506
    assert not blocked(x, y)
    x, y, vx, vy = 1009.0, 530.0, 0.0, 0.0
    for _ in range(20):
        x, y, vx, vy = integrate(x, y, vx, vy, 0, -1, 0.05)
    assert y < 460


def test_packet_spam_cannot_increase_movement_speed():
    async def run():
        manager = RoomManager()
        room, player = manager.create("Aniket")
        room.phase = RoomPhase.EXPLORING
        player.connected = True
        player.websocket = Socket()
        start = player.x
        for sequence in range(1000):
            await manager.move(room, player, 1, 0, sequence)
        assert player.x == start
        await manager.tick(0.05)
        assert 0 < player.x - start <= 230 * 0.05
    asyncio.run(run())


def test_reconnect_resets_sequence_and_preserves_position():
    async def run():
        manager = RoomManager()
        room, player = manager.create("Aniket")
        room.phase = RoomPhase.EXPLORING
        socket = Socket()
        await manager.connect(room, player, socket)
        await manager.move(room, player, 1, 0, 999)
        await manager.tick()
        public = player.public()
        assert public["input_sequence"] == 999
        assert (public["dx"], public["dy"]) == (1, 0)
        position = (player.x, player.y)
        await manager.disconnect(room, player, socket)
        replacement = Socket()
        await manager.connect(room, player, replacement)
        assert (player.x, player.y) == position
        await manager.move(room, player, 1, 0, 0)
        await manager.tick()
        assert player.x > position[0]
    asyncio.run(run())


def test_lost_input_stops_and_out_of_range_inspection_is_rejected():
    async def run():
        manager = RoomManager()
        room, player = manager.create("Aniket")
        room.phase = RoomPhase.EXPLORING
        player.connected = True
        player.websocket = Socket()
        await manager.move(room, player, 1, 0, 0)
        player.last_input = time.monotonic() - 1
        await manager.tick()
        assert player.vx == 0
        with pytest.raises(RoomError, match="Move closer"):
            await manager.interact(room, player, "archive_cabinet")
        player.x, player.y = 824, 700
        await manager.interact(room, player, "atrium_badge")
        assert player.websocket.messages[-1]["type"] == "inspection"
    asyncio.run(run())


def test_start_requires_connected_players_and_migrates_host():
    async def run():
        manager = RoomManager()
        room, host = manager.create("Aniket")
        others = [manager.join(room.code, name)[1] for name in ("Riya", "Mina", "Omar")]
        for player in room.players.values():
            player.ready = True
        with pytest.raises(RoomError, match="connected"):
            await manager.start(room, host)
        for player in room.players.values():
            await manager.connect(room, player, Socket())
        await manager.disconnect(room, host, host.websocket)
        assert room.host_id == others[0].id
    asyncio.run(run())
