import asyncio
import copy
import json
import time
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.casefile import assign_motive, case_public, private_motive, timing
from app.investigation import CASE_BINDINGS, SECONDARY_RECORDS, FACT_FIELDS, recover_evidence, resolve_sources
from app.maps import MAP_INFO, map_data, map_scenario
from app.models import RoomPhase
from app.persistence import Repository, serialize_room, restore_room
from app.room_manager import RoomError, RoomManager
from tests.test_investigation import investigation_room
from tests.test_movement import Socket


def fill_records(room):
    for item in map_data(room.map_id)["objects"]:
        record = recover_evidence(room.scenario, item["id"], partial=True)
        if record:
            room.evidence[record["id"]] = record


async def fill_board(manager, room, player):
    for slot, event in enumerate(room.scenario.events):
        sources = [item for item in room.evidence.values() if item["event_id"] == event.id]
        await manager.edit_timeline(room, player, slot, sources[0]["id"], "UNKNOWN", room.timeline_revision)
        for item in sources[1:]:
            await manager.link_timeline(room, player, slot, item["id"], room.timeline_revision)


@pytest.mark.parametrize("map_id", MAP_INFO)
def test_partial_records_are_truth_projections_and_complement_each_other(map_id):
    scenario = map_scenario("CASEQA", 1, map_id)
    grouped = {}
    for obj in map_data(map_id)["objects"]:
        record = recover_evidence(scenario, obj["id"], partial=True)
        if not record:
            continue
        event = next(event for event in scenario.events if event.id == record["event_id"])
        assert len(record["claim"]) == 3
        assert set(record["claim"]) == set(record["recorded_fields"])
        assert all(getattr(event, key) == value for key, value in record["claim"].items())
        assert not {"cause", "order", "correct"} & set(record["claim"])
        grouped.setdefault(event.id, set()).update(record["claim"])
    assert len(grouped) == 6
    assert all(set(FACT_FIELDS) == fields for fields in grouped.values())


def test_linked_records_override_false_testimony_and_keep_conflicts_visible():
    async def run():
        manager, room, players = await investigation_room(2)
        fill_records(room)
        await manager.testify(room, players[1], "memory_1", 25)
        testimony = room.testimonies["testimony_1"]
        arrival = next(event for event in room.scenario.events if event.id == "arrival")
        assert testimony["memory"]["claim"]["location"] != arrival.location
        ids = [testimony["id"], "evidence_atrium_badge", "evidence_cctv_terminal"]
        merged = resolve_sources(room, ids)
        assert merged["claim"]["location"] == arrival.location
        assert set(merged["verified_fields"]) == set(FACT_FIELDS)
        assert "location" in merged["conflicts"]
        assert "cause" not in merged["claim"] and "order" not in merged["claim"]
        await manager.edit_timeline(room, players[0], 0, ids[0], "UNKNOWN", 0)
        for source in ids[1:]:
            await manager.link_timeline(room, players[0], 0, source, room.timeline_revision)
        assert room.timeline[0]["source_ids"] == ids
        with pytest.raises(RoomError, match="different moments"):
            await manager.link_timeline(room, players[0], 0, "evidence_storage_locker", room.timeline_revision)
        with pytest.raises(RoomError, match="Another witness"):
            await manager.link_timeline(room, players[0], 0, ids[1], 0)
        with pytest.raises(RoomError, match="Unknown timeline"):
            await manager.link_timeline(room, players[0], 6, ids[1], room.timeline_revision)
        await manager.retract(room, players[1], ids[0])
        room.case_elapsed = 130
        await fill_board(manager, room, players[0])
        # Introduce a withdrawn linked source to exercise final vote validation.
        room.timeline[0]["source_ids"].append(ids[0])
        with pytest.raises(RoomError, match="retracted"):
            await manager.vote_lock(room, players[0], room.timeline_revision, True)
        await manager.link_timeline(room, players[0], 0, ids[0], room.timeline_revision, remove=True)
        assert ids[0] not in room.timeline[0]["source_ids"]
    asyncio.run(run())


def test_first_theory_quorum_is_immutable_and_edits_reset_votes():
    async def run():
        manager, room, players = await investigation_room(2)
        fill_records(room)
        await fill_board(manager, room, players[0])
        with pytest.raises(RoomError, match="Final voting"):
            await manager.vote_lock(room, players[0], room.timeline_revision, True)
        room.case_elapsed = 95
        await manager.vote_theory(room, players[0], room.timeline_revision, True)
        await manager.vote_theory(room, players[1], room.timeline_revision, True)
        assert room.first_theory is None
        await manager.vote_theory(room, players[2], room.timeline_revision, True)
        frozen = copy.deepcopy(room.first_theory)
        assert frozen["method"] == "majority"
        room.case_elapsed = 130
        await manager.vote_lock(room, players[0], room.timeline_revision, True)
        await manager.link_timeline(room, players[0], 0, room.timeline[0]["source_ids"][-1], room.timeline_revision, remove=True)
        assert not room.lock_votes and not room.theory_votes
        assert room.first_theory == frozen
        assert players[0].post_theory_edits == 1
        await manager.disconnect(room, players[1], players[1].websocket)
        assert players[1].id not in room.lock_votes
    asyncio.run(run())


def test_private_motives_stay_owner_only_until_voluntary_disclosure_or_results():
    async def run():
        manager, room, players = await investigation_room(2)
        for player in players:
            roles = [item for item in player.websocket.messages if item["type"] == "case_role"]
            assert len(roles) == 1
            assert roles[0]["role"]["id"] == player.motive["id"]
            assert "motive" not in player.public()
        assert case_public(room)["revealed_motives"] == []
        assert room.snapshot()["result"] is None
        await manager.reveal_motive(room, players[1])
        assert [item["player_id"] for item in case_public(room)["revealed_motives"]] == [players[1].id]
        reconnect = Socket()
        await manager.connect(room, players[0], reconnect)
        assert any(item["type"] == "case_role" and item["role"]["id"] == players[0].motive["id"] for item in reconnect.messages)
        players[0].motive = assign_motive(0)
        players[0].evidence_found = {"a", "b"}
        assert not private_motive(room, players[0])["complete"]
        await manager.reveal_motive(room, players[0])
        assert private_motive(room, players[0])["complete"]
        await manager.finish_case(room, deadline=True)
        assert len(room.result["case_review"]["motives"]) == 4
    asyncio.run(run())


def test_clock_pauses_without_humans_deadline_closes_partial_board_and_rematch_resets():
    async def run():
        manager, room, players = await investigation_room(2)
        room.case_elapsed = 124.95
        await manager.tick(.1)
        assert room.first_theory is not None
        for player in players:
            await manager.disconnect(room, player, player.websocket)
        elapsed = room.case_elapsed
        await manager.tick(.1)
        assert room.case_elapsed == elapsed
        await manager.connect(room, players[0], Socket())
        room.case_elapsed = timing(room)[3] - .05
        await manager.tick(.1)
        assert room.phase is RoomPhase.REVEAL
        assert room.result["reality_recovered"] == 0
        assert room.result["case_review"]["deadline_used"]
        original = room.result
        await manager.finish_case(room)
        assert room.result is original
        room.reveal_started_at = time.time() - 27
        await manager.tick(.05)
        await manager.rematch(room, players[0])
        assert room.phase is RoomPhase.LOBBY
        assert room.case_elapsed == 0 and room.first_theory is None
        assert all(player.motive is None for player in players)
    asyncio.run(run())


def test_case_checkpoint_preserves_progress_and_defaults_old_rooms_to_legacy():
    async def run():
        manager, room, players = await investigation_room(2)
        room.case_elapsed = 133
        manager.capture_theory(room, "checkpoint")
        players[0].linked_records = 1
        room.theory_votes.add(players[0].id)
        saved = json.loads(json.dumps(serialize_room(room)))
        restored = restore_room(saved)
        assert restored.case_elapsed == 133 and restored.rules_version == 2
        assert restored.first_theory == room.first_theory
        assert restored.players[players[0].id].motive == players[0].motive
        assert restored.players[players[0].id].linked_records == 1
        assert not restored.theory_votes
        saved.pop("rules_version")
        assert restore_room(saved).rules_version == 1
    asyncio.run(run())


def test_backup_records_cannot_be_recovered_before_lead():
    async def run():
        manager, room, players = await investigation_room(2)
        obj = next(item for item in map_data()["objects"] if item["id"] == "cctv_terminal")
        player = players[list(CASE_BINDINGS).index(obj["id"]) % 4]
        player.x, player.y = obj["x"], obj["y"]
        await manager.interact(room, player, obj["id"])
        assert not room.evidence
        assert "recovery" in player.websocket.messages[-1]["interactable"]["detail"].lower()
        room.case_elapsed = 126
        await manager.interact(room, player, obj["id"])
        assert len(room.evidence) == 1
    asyncio.run(run())


def test_final_result_save_is_atomic_idempotent_and_does_not_block_tick():
    async def run():
        from app.accounts import Account
        repository = Repository("sqlite:///:memory:")
        with Session(repository.engine) as session:
            session.add(Account(id="case-account", username="case_test", display_name="QA", password_hash="unused", avatar_color=0, hat="none", rounds=0, best_score=0))
            session.commit()
        manager, room, players = await investigation_room(2)
        players[0].account_id = "case-account"
        manager.repository = repository
        fill_records(room)
        await fill_board(manager, room, players[0])
        room.case_elapsed = 130
        await asyncio.gather(*(manager.finish_case(room) for _ in range(3)))
        await asyncio.gather(*manager.result_tasks)
        assert manager.checkpoint_task is not None
        await manager.checkpoint_task
        restored = repository.load_rooms()[0]
        assert restored.phase is RoomPhase.REVEAL
        assert restored.result["case_review"] == room.result["case_review"]
        assert room.result["reality_recovered"] == 100
        await repository.acomplete_match(room.result, [player.name for player in players], ["case-account"])
        with Session(repository.engine) as session:
            account = session.get(Account, "case-account")
            assert account.rounds == 1 and account.best_score == 100
        assert repository.replay(room.result["replay_code"])["case_review"] is not None
        repository.engine.dispose()
    asyncio.run(run())


def test_saved_replay_prevents_a_stale_checkpoint_from_reopening_the_incident():
    async def run():
        manager, room, players = await investigation_room(2)
        repository = Repository("sqlite:///:memory:")
        repository.save_rooms([room])  # The last exploration checkpoint.
        await manager.finish_case(room, deadline=True)
        repository.complete_match(room.result, [player.name for player in players], [])
        restored = repository.load_rooms()[0]
        assert restored.phase is RoomPhase.RESULTS
        assert restored.result == repository.replay(room.result["replay_code"])
        assert restored.result["case_review"]["deadline_used"]
        repository.engine.dispose()
    asyncio.run(run())


def test_checkpoint_requests_coalesce_while_slow_database_does_not_block_motion():
    async def run():
        manager, room, players = await investigation_room(2)
        entered, release = asyncio.Event(), asyncio.Event()
        class SlowRepository:
            calls = 0
            async def apersist_rooms(self, rooms):
                self.calls += 1
                entered.set()
                await release.wait()
        repository = SlowRepository(); manager.repository = repository
        manager.request_checkpoint(room)
        await entered.wait()
        for _ in range(100):
            manager.request_checkpoint(room)
        assert len(manager.pending_checkpoints) == 1
        assert repository.calls == 1
        await manager.move(room, players[0], 1, 0, 1)
        await manager.tick(.05)
        assert players[0].last_sequence == 1
        assert room.case_elapsed > 0
        release.set()
        await manager.checkpoint_task
        assert repository.calls == 2 and not manager.pending_checkpoints
    asyncio.run(run())


def test_link_limit_and_multiple_withdrawn_sources_can_be_repaired_together():
    async def run():
        manager, room, players = await investigation_room(2)
        fill_records(room)
        for player in players[:3]:
            await manager.testify(room, player, "memory_1", 10)
        ids = ["evidence_atrium_badge", "evidence_cctv_terminal", "testimony_1", "testimony_2"]
        assert len(resolve_sources(room, ids)["sources"]) == 4
        with pytest.raises(ValueError, match="one to four"):
            resolve_sources(room, ids + ["testimony_3"])
        await manager.edit_timeline(room, players[0], 0, ids[0], "UNKNOWN", room.timeline_revision)
        for source_id in ids[1:]:
            await manager.link_timeline(room, players[0], 0, source_id, room.timeline_revision)
        await manager.retract(room, players[0], "testimony_1")
        await manager.retract(room, players[1], "testimony_2")
        await manager.link_timeline(room, players[0], 0, "testimony_1", room.timeline_revision, remove=True)
        assert room.timeline[0]["source_ids"] == ids[:2]
        assert len(room.timeline[0]["verified_fields"]) == 5
    asyncio.run(run())
