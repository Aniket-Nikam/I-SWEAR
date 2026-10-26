import asyncio
import time

from app.models import RoomPhase
from app.room_manager import RoomManager
from tests.test_movement import Socket


def test_solo_script_completes_every_core_system_without_an_llm():
    async def run():
        manager = RoomManager()
        room, human = manager.create_solo("Judge")
        await manager.connect(room, human, Socket())
        assert room.phase is RoomPhase.EXPLORING
        assert len(room.players) == 4
        assert sum(player.is_bot for player in room.players.values()) == 3
        for _ in range(3650):
            await manager.tick(0.05)
            if room.phase is RoomPhase.REVEAL:
                break
        assert room.demo_elapsed < 181
        assert room.clashes
        assert room.instability_used
        assert len(room.evidence) >= 5
        assert all(room.timeline)
        assert room.phase is RoomPhase.REVEAL
        assert room.result["reality_recovered"] < 100
        assert room.result["consensus_mistakes"] == 1
        assert room.result["corrupted_memories"]
        room.reveal_started_at = time.time() - 27
        await manager.tick()
        assert room.phase is RoomPhase.RESULTS
        await manager.rematch(room, human)
        assert room.phase is RoomPhase.LOBBY
        assert human.id == room.host_id
        await manager.set_ready(room, human, True)
        assert room.phase is RoomPhase.EXPLORING
        assert room.demo_elapsed == 0
        assert room.scenario.id != "blackout_001"
        for _ in range(3650):
            await manager.tick(0.05)
            if room.phase is RoomPhase.REVEAL:
                break
        assert room.phase is RoomPhase.REVEAL
        assert room.result["replay_code"].endswith("-2")
        assert len(room.evidence) >= 5
    asyncio.run(run())


def test_demo_clock_uses_elapsed_time_but_stalls_cannot_teleport_players():
    async def run():
        manager = RoomManager()
        room, human = manager.create_solo("Judge")
        await manager.connect(room, human, Socket())
        x = human.x
        await manager.move(room, human, 1, 0, 0)
        await manager.tick(3)
        assert room.demo_elapsed == 3
        assert 0 < human.x - x <= 23
    asyncio.run(run())
