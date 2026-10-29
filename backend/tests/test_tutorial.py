import asyncio
import copy
import pytest

from app.casefile import case_public
from app.demo import advance_demo
from app.models import RoomPhase
from app.persistence import serialize_room, restore_room
from app.room_manager import RoomError, RoomManager
from app.world import integrate
from app.maps import map_data
from tests.test_casefile import fill_records
from tests.test_movement import Socket


async def lesson():
    manager = RoomManager()
    room, player = manager.create_solo("Learner", tutorial=True)
    await manager.connect(room, player, Socket())
    assert room.phase is RoomPhase.EXPLORING
    return manager, room, player


def test_lesson_never_times_out_or_plays_the_board_for_the_learner():
    async def run():
        manager, room, player = await lesson()
        for _ in range(3):
            await manager.advance_case(room, 1000)
            await advance_demo(manager, room, 1000)
        assert room.case_elapsed == 0
        assert room.phase is RoomPhase.EXPLORING
        assert room.timeline == [None] * 6 and not room.lock_votes
        assert case_public(room)["untimed"] is True
        restored = restore_room(serialize_room(room))
        assert restored.tutorial and restored.solo
        await manager.advance_case(restored, 1000)
        assert restored.case_elapsed == 0
    asyncio.run(run())


def test_tutorial_draft_preserves_learner_work_and_uses_only_public_sources():
    async def run():
        manager, room, player = await lesson()
        with pytest.raises(RoomError, match="Place one source"):
            await manager.tutorial_action(room, player, "draft")
        with pytest.raises(RoomError, match="Record your first theory"):
            await manager.tutorial_action(room, player, "leads")
        await manager.testify(room, player, "memory_1", 10)
        source = next(iter(room.testimonies))
        await manager.edit_timeline(room, player, 2, source, "DISPUTED", room.timeline_revision)
        kept = copy.deepcopy(room.timeline[2])
        await manager.tutorial_action(room, player, "draft")
        assert room.timeline[2] == kept and all(room.timeline)
        assert len({item["event_id"] for item in room.timeline}) == 6
        assert all(item["source_id"] in room.testimonies or item["source_id"] in room.evidence for item in room.timeline)
        assert not room.first_theory and room.case_elapsed == 55
        await manager.vote_theory(room, player, room.timeline_revision, True)
        assert room.first_theory["method"] == "majority"
        saved = copy.deepcopy(room.first_theory)
        await manager.tutorial_action(room, player, "leads")
        assert room.case_elapsed == 75 and case_public(room)["lead_available"]
        await manager.advance_case(room, 10000)
        assert room.case_elapsed == 75 and room.first_theory == saved
        fill_records(room)
        await manager.vote_lock(room, player, room.timeline_revision, True)
        assert room.phase is RoomPhase.REVEAL and room.result
        assert not room.deadline_used
    asyncio.run(run())


def test_multiplayer_cannot_use_tutorial_helpers_or_bypass_its_quorum():
    async def run():
        manager = RoomManager()
        room, player = manager.create_solo("Timed rehearsal")
        await manager.connect(room, player, Socket())
        with pytest.raises(RoomError, match="only available"):
            await manager.tutorial_action(room, player, "draft")
        assert not room.tutorial and not case_public(room)["untimed"]
        await manager.advance_case(room, .1)
        assert room.case_elapsed > 0
    asyncio.run(run())


def test_exact_acceleration_has_the_same_free_space_stopping_distance_at_every_tick_rate():
    geometry = {"width": 3000, "height": 3000, "walls": []}
    def run(fps):
        state = (1000., 1000., 0., 0.)
        for direction in (1, 0):
            for _ in range(fps):
                state = integrate(*state, direction, 0, 1/fps, geometry)
        return state
    coarse, fine = run(20), run(144)
    assert abs(coarse[0]-fine[0]) < .02
    assert coarse[2] == fine[2] == 0


def test_campus_training_entrances_have_turning_room_for_a_witness():
    doors = [door for door in map_data("campus")["doors"] if door["y"] in (486, 878) and door["axis"] == "x"]
    assert len(doors) >= 8
    assert min(door["width"] for door in doors) >= 96
