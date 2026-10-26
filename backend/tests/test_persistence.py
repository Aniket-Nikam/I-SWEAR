import asyncio
import json

from app.persistence import Repository, serialize_room
from app.room_manager import RoomManager
from app.scoring import compute_results
from tests.test_endgame import filled_room
from tests.test_movement import Socket


def test_sqlalchemy_room_roundtrip_preserves_private_memories_and_hashed_credentials():
    async def run():
        manager, room, players = await filled_room()
        await manager.testify(room, players[1], "memory_1", 50)
        await manager.respond(room, players[2], "testimony_1", "BELIEVE", 25)
        repository = Repository("sqlite:///:memory:")
        repository.save_rooms([room])
        stored = json.dumps(serialize_room(room))
        assert players[0].token not in stored
        restored = repository.load_rooms()[0]
        other = RoomManager()
        other.rooms[restored.code] = restored
        _, identity = other.authenticate(room.code, players[0].id, players[0].token)
        assert identity.memories == players[0].memories
        assert identity.x == players[0].x
        assert not identity.connected
        assert restored.testimonies == room.testimonies
        assert restored.timeline == room.timeline
        await other.connect(restored, identity, Socket())
        assert identity.connected
        repository.engine.dispose()
    asyncio.run(run())


def test_finished_results_and_group_best_survive_rematch():
    async def run():
        _, room, players = await filled_room()
        repository = Repository("sqlite:///:memory:")
        result = repository.save_match(compute_results(room), [player.name for player in players])
        assert result["best_score"] == 100
        worse = {**result, "replay_code": f"{room.code}-2", "reality_recovered": 50}
        assert repository.save_match(worse, [player.name for player in players])["best_score"] == 100
        assert repository.replay(result["replay_code"])["reality_recovered"] == 100
        assert repository.replay("missing") is None
        repository.engine.dispose()
    asyncio.run(run())


def test_rematch_canonical_variant_is_saved_exactly():
    from app.mystery import scenario_for_round
    from app.models import RoomPhase
    manager = RoomManager()
    room, _ = manager.create("Judge")
    room.round_number = 2
    room.phase = RoomPhase.EXPLORING
    room.scenario = scenario_for_round(room.code, 2)
    repository = Repository("sqlite:///:memory:")
    repository.save_rooms([room])
    restored = repository.load_rooms()[0]
    assert restored.scenario == room.scenario
    repository.engine.dispose()
