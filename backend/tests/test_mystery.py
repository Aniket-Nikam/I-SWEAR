import asyncio
from contextlib import ExitStack
from dataclasses import FrozenInstanceError, asdict, replace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import RoomPhase
from app.mystery import (BLACKOUT, Corruption, Scenario, assign_memories,
                         contradictions, corrupt, validate_scenario)
from app.room_manager import RoomError, RoomManager, manager
from tests.test_movement import Socket


def test_canonical_truth_is_immutable_and_validated():
    validate_scenario(BLACKOUT)
    with pytest.raises(FrozenInstanceError):
        BLACKOUT.events[0].location = "Lab B"
    with pytest.raises(ValueError, match="unique"):
        validate_scenario(Scenario("bad", (BLACKOUT.events[0],) * 6))
    invalid = replace(BLACKOUT.events[0], time="25:00")
    with pytest.raises(ValueError):
        validate_scenario(Scenario("bad", (invalid,) + BLACKOUT.events[1:]))


@pytest.mark.parametrize("kind", list(Corruption))
def test_all_corruptions_are_controlled_and_leave_truth_unchanged(kind):
    event = BLACKOUT.events[1]
    before = asdict(event)
    claim = corrupt(event, kind)
    expected = before.copy()
    expected.pop("id")
    assert claim != expected
    assert asdict(event) == before


def test_private_projections_hide_truth_and_share_one_false_memory():
    assigned = [assign_memories(BLACKOUT, index, "JUDGE") for index in range(4)]
    assert assigned[1][0].claim == assigned[2][0].claim
    assert assigned[0][0].state == "TRUE"
    assert assigned[1][0].state == "SHARED_FALSE_MEMORY"
    for memories in assigned:
        assert len(memories) == 5
        assert len({memory.event_id for memory in memories}) < len(BLACKOUT.events)
        for memory in memories:
            assert not {"state", "corruption", "canonical", "truth"}.intersection(memory.private())
    assert assigned[0] == assign_memories(BLACKOUT, 0, "JUDGE")
    assert any(memory.confidence == "CLEAR" and memory.state != "TRUE"
               for memories in assigned for memory in memories)


def test_rematches_change_facts_deterministically_before_truth_is_frozen():
    from app.mystery import scenario_for_round
    assert scenario_for_round("JUDGE", 1) is BLACKOUT
    variant = scenario_for_round("JUDGE", 2)
    assert variant == scenario_for_round("JUDGE", 2)
    assert variant.events != BLACKOUT.events
    assert {event.id for event in variant.events} == {event.id for event in BLACKOUT.events}
    for round_number in range(2, 30):
        scenario = scenario_for_round("JUDGE", round_number)
        validate_scenario(scenario)
        memories = [assign_memories(scenario, index, "same-seed") for index in range(4)]
        assert memories[1][0].claim == memories[2][0].claim
        assert contradictions(memories[0][0].private(), memories[1][0].private()) == ["location"]


def test_clash_requires_same_incident_and_incompatible_known_facts():
    true = assign_memories(BLACKOUT, 0, "JUDGE")[0].private()
    false = assign_memories(BLACKOUT, 1, "JUDGE")[0].private()
    assert contradictions(true, false) == ["location"]
    assert contradictions(true, true) == []
    assert contradictions(true, {**false, "event_id": "different"}) == []
    assert contradictions(true, {**true, "claim": {"location": "Lab C"}}) == []


def test_testimony_retraction_response_and_clash_deduplication():
    async def run():
        rooms = RoomManager()
        room, host = rooms.create("Aniket")
        for name in ("Riya", "Mina", "Omar"):
            rooms.join(room.code, name)
        players = list(room.players.values())
        for player in players:
            await rooms.connect(room, player, Socket())
            await rooms.set_ready(room, player, True)
        await rooms.start(room, host)
        assert room.scenario is BLACKOUT
        await rooms.testify(room, players[0], "memory_1", 50)
        await rooms.testify(room, players[1], "memory_1", 25)
        assert len(room.clashes) == 1
        assert room.clashes[0]["fields"] == ["location"]
        await rooms.testify(room, players[1], "memory_1", 50)
        assert len(room.clashes) == 1
        await rooms.respond(room, players[2], "testimony_2", "BELIEVE", 25)
        assert room.testimonies["testimony_2"]["responses"][players[2].id]["stake"] == 25
        with pytest.raises(RoomError, match="Only the witness"):
            await rooms.retract(room, players[0], "testimony_2")
        await rooms.retract(room, players[1], "testimony_2")
        assert room.testimonies["testimony_2"]["retracted"]
        with pytest.raises(RoomError, match="does not belong"):
            await rooms.testify(room, players[0], "forged_memory", 50)
        public = room.snapshot()
        assert "scenario" not in public
        assert "memories" not in public["players"][0]
        assert room.phase is RoomPhase.EXPLORING
    asyncio.run(run())


def receive_type(socket, expected):
    for _ in range(30):
        message = socket.receive_json()
        if message["type"] == expected:
            return message
    raise AssertionError(f"Missing {expected} event")


def test_four_real_websocket_clients_receive_only_their_private_memories():
    manager.rooms.clear()
    with TestClient(app) as client, ExitStack() as stack:
        sessions = [client.post("/api/rooms", json={"name": "Aniket"}).json()]
        code = sessions[0]["room_code"]
        sessions += [client.post(f"/api/rooms/{code}/join", json={"name": name}).json()
                     for name in ("Riya", "Mina", "Omar")]
        sockets = [stack.enter_context(client.websocket_connect(
            f"/ws/rooms/{code}?player_id={session['player_id']}&token={session['reconnect_token']}"))
            for session in sessions]
        for socket in sockets:
            receive_type(socket, "snapshot")
            socket.send_json({"type": "ready", "ready": True})
        for socket in sockets:
            # Each socket's own ready change is an acknowledgement of its action.
            while True:
                event = receive_type(socket, "ready_changed")
                if event["player_id"] == sessions[sockets.index(socket)]["player_id"]:
                    break
        sockets[0].send_json({"type": "start"})
        private = [receive_type(socket, "memories")["memories"] for socket in sockets]
        assert private[0][0]["claim"]["location"] == "Lab C"
        assert private[1][0]["claim"]["location"] == "Lab B"
        assert private[2][0]["claim"]["location"] == "Lab B"
        for index, socket in enumerate(sockets):
            receive_type(socket, "phase_changed")
        sockets[0].send_json({"type": "testify", "memory_id": "memory_1", "stake": 50})
        receive_type(sockets[0], "testimony")
        sockets[1].send_json({"type": "testify", "memory_id": "memory_1", "stake": 25})
        clash = receive_type(sockets[3], "clash")
        assert clash["clash"]["fields"] == ["location"]
        snapshot = client.get(f"/api/rooms/{code}").json()
        assert len(snapshot["testimonies"]) == 2
        assert "scenario" not in snapshot
        assert all("memories" not in player for player in snapshot["players"])
