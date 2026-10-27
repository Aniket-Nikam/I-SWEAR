import asyncio

import pytest

from app.investigation import BINDINGS, recover_evidence
from app.mystery import BLACKOUT
from app.room_manager import RoomManager, RoomError
from tests.test_movement import Socket


async def investigation_room(rules_version=1):
    manager = RoomManager()
    room, host = manager.create("Aniket")
    room.rules_version = rules_version
    for name in ("Riya", "Mina", "Omar"):
        manager.join(room.code, name)
    for player in room.players.values():
        await manager.connect(room, player, Socket())
        player.ready = True
    await manager.start(room, host)
    return manager, room, list(room.players.values())


def test_every_record_is_derived_from_canonical_facts():
    event_ids = set()
    for object_id in BINDINGS:
        evidence = recover_evidence(BLACKOUT, object_id)
        event = next(event for event in BLACKOUT.events if event.id == evidence["event_id"])
        assert all(getattr(event, key) == value for key, value in evidence["claim"].items())
        assert "order" not in evidence["claim"]
        event_ids.add(event.id)
    assert event_ids == {event.id for event in BLACKOUT.events}
    assert recover_evidence(BLACKOUT, "hall_id") is None


def test_evidence_requires_physical_proximity_and_distributed_badges():
    async def run():
        manager, room, players = await investigation_room()
        host, second = players[:2]
        assert room.snapshot()["evidence"] == []
        host.x, host.y = 824, 662
        await manager.interact(room, host, "atrium_badge")
        assert len(room.evidence) == 1
        assert all(any(message["type"] == "evidence" for message in player.websocket.messages) for player in players)
        host.x, host.y = 268, 1035
        await manager.interact(room, host, "storage_locker")
        assert len(room.evidence) == 1
        assert "Riya" in host.websocket.messages[-1]["interactable"]["detail"]
        with pytest.raises(RoomError, match="Move closer"):
            await manager.interact(room, second, "storage_locker")
        second.x, second.y = 268, 1035
        await manager.interact(room, second, "storage_locker")
        assert len(room.evidence) == 2
    asyncio.run(run())


def test_timeline_sources_revisions_uniqueness_and_votes():
    async def run():
        manager, room, players = await investigation_room()
        host = players[0]
        with pytest.raises(RoomError, match="Share the memory"):
            await manager.edit_timeline(room, host, 0, "forged_source", "CONFIRMED", 0)
        for object_id in BINDINGS:
            evidence = recover_evidence(BLACKOUT, object_id)
            room.evidence[evidence["id"]] = evidence
        unique = {item["event_id"]: item for item in room.evidence.values()}
        for slot, event in enumerate(BLACKOUT.events):
            await manager.edit_timeline(room, host, slot, unique[event.id]["id"], "CONFIRMED", room.timeline_revision)
        assert all(room.timeline)
        with pytest.raises(RoomError, match="Another witness"):
            await manager.edit_timeline(room, host, 0, None, "UNKNOWN", 0)
        await manager.vote_lock(room, host, room.timeline_revision, True)
        assert host.id in room.lock_votes
        await manager.edit_timeline(room, host, 1, unique["collection"]["id"], "DISPUTED", room.timeline_revision)
        assert room.timeline[0] is None
        assert not room.lock_votes
        assert room.timeline[1]["event_id"] == "collection"
        assert "correct" not in room.snapshot()["timeline"]
    asyncio.run(run())
