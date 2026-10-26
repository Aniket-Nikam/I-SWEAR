import asyncio
import time

import pytest

from app.investigation import BINDINGS, recover_evidence
from app.models import RoomPhase
from app.mystery import BLACKOUT
from app.room_manager import RoomError
from app.scoring import award_titles, compute_results, timeline_score
from tests.test_investigation import investigation_room


async def filled_room():
    manager, room, players = await investigation_room()
    for object_id in BINDINGS:
        evidence = recover_evidence(BLACKOUT, object_id)
        room.evidence[evidence["id"]] = evidence
    unique = {item["event_id"]: item for item in room.evidence.values()}
    for slot, event in enumerate(BLACKOUT.events):
        await manager.edit_timeline(room, players[0], slot, unique[event.id]["id"], "CONFIRMED", room.timeline_revision)
    return manager, room, players


def test_perfect_timeline_scores_100_and_swaps_cost_accuracy():
    async def run():
        _, room, _ = await filled_room()
        assert timeline_score(BLACKOUT, room.timeline)["reality_recovered"] == 100
        room.timeline[0], room.timeline[1] = room.timeline[1], room.timeline[0]
        score = timeline_score(BLACKOUT, room.timeline)
        assert score["timeline_accuracy"] == 67
        assert score["reality_recovered"] < 100
        assert timeline_score(BLACKOUT, [None] * 6)["reality_recovered"] == 0
    asyncio.run(run())


def test_majority_locks_freezes_reveals_and_rematch_resets_everything():
    async def run():
        manager, room, players = await filled_room()
        await manager.testify(room, players[0], "memory_1", 50)
        await manager.testify(room, players[1], "memory_1", 50)
        await manager.respond(room, players[2], "testimony_2", "BELIEVE", 25)
        await manager.respond(room, players[3], "testimony_2", "DOUBT", 25)
        for player in players[:2]:
            await manager.vote_lock(room, player, room.timeline_revision, True)
        assert room.phase is RoomPhase.EXPLORING
        assert room.snapshot()["result"] is None
        await manager.vote_lock(room, players[2], room.timeline_revision, True)
        assert room.phase is RoomPhase.REVEAL
        assert room.result["reality_recovered"] == 100
        by_name = {metric["name"]: metric for metric in room.result["players"]}
        assert by_name["Aniket"]["score"] == 50
        assert by_name["Riya"]["score"] == -50
        assert by_name["Mina"]["score"] == -25
        assert by_name["Omar"]["score"] == 25
        assert by_name["Omar"]["successful_challenges"] == 1
        assert by_name["Riya"]["false_memories_spread"] == 1
        assert len(room.result["comparisons"]) == 6
        position = (players[0].x, players[0].y)
        await manager.move(room, players[0], 1, 0, 0)
        await manager.tick()
        assert (players[0].x, players[0].y) == position
        with pytest.raises(RoomError, match="locked"):
            await manager.edit_timeline(room, players[0], 0, None, "UNKNOWN", room.timeline_revision)
        room.reveal_started_at = time.time() - 27
        await manager.tick()
        assert room.phase is RoomPhase.RESULTS
        await manager.rematch(room, players[0])
        assert room.phase is RoomPhase.LOBBY
        assert room.result is None and room.scenario is None
        assert room.timeline == [None] * 6
        assert not room.evidence and not room.testimonies and not room.clashes
        assert all(not player.memories and not player.ready and not player.evidence_found for player in players)
        assert room.round_number == 2
    asyncio.run(run())


def test_awards_require_actual_nonzero_metrics_and_scoring_is_repeatable():
    async def run():
        _, room, _ = await filled_room()
        first = compute_results(room)
        assert first == compute_results(room)
        assert not any(award["title"] == "Confidently Wrong" for award in first["awards"])
        assert all(award["value"] > 0 for award in first["awards"])
        assert award_titles([]) == []
    asyncio.run(run())


def test_changing_a_belief_does_not_erase_a_false_consensus():
    async def run():
        manager, room, players = await filled_room()
        await manager.testify(room, players[1], "memory_1", 50)
        await manager.respond(room, players[2], "testimony_1", "BELIEVE", 25)
        await manager.respond(room, players[3], "testimony_1", "BELIEVE", 25)
        await manager.respond(room, players[2], "testimony_1", "DOUBT", 25)
        result = compute_results(room)
        assert result["consensus_mistakes"] == 1
        assert result["archetype"] == "THE HIVE MIND"
        assert len(result["belief_spread"][0]["believers"]) == 2
        assert next(player for player in result["players"] if player["name"] == "Riya")["false_memories_spread"] == 2
    asyncio.run(run())


def test_simultaneous_votes_trigger_exactly_one_reveal():
    from tests.test_movement import Socket

    class YieldingSocket(Socket):
        async def send_json(self, message):
            await asyncio.sleep(0)
            self.messages.append(message)

    async def run():
        manager, room, players = await filled_room()
        for player in players:
            player.websocket = YieldingSocket()
        await asyncio.gather(*(manager.vote_lock(room, player, room.timeline_revision, True) for player in players[:3]))
        assert room.phase is RoomPhase.REVEAL
        assert all(sum(message["type"] == "reveal" for message in player.websocket.messages) == 1 for player in players)
    asyncio.run(run())
