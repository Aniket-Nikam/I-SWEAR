"""SQLAlchemy repository with SQLite development defaults and portable JSON records."""

from dataclasses import asdict
from datetime import datetime, timezone
from hashlib import sha256
import asyncio
import json

from sqlalchemy import JSON, DateTime, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class SavedRoom(Base):
    __tablename__ = "rooms"
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    state: Mapped[dict] = mapped_column(JSON)


class SavedMatch(Base):
    __tablename__ = "matches"
    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_key: Mapped[str] = mapped_column(String(64), index=True)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Repository:
    def __init__(self, url: str):
        options = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
        if not url.startswith("sqlite"):
            options.update(pool_pre_ping=True, pool_size=2, max_overflow=2, pool_recycle=300)
        if url in ("sqlite://", "sqlite:///:memory:"):
            options["poolclass"] = StaticPool
        self.engine = create_engine(url, **options)
        self._write_lock = asyncio.Lock()
        Base.metadata.create_all(self.engine)

    def save_match(self, result: dict, names: list[str]) -> dict:
        group_key = sha256("|".join(sorted(name.casefold() for name in names)).encode()).hexdigest()
        with Session(self.engine) as session:
            prior = session.scalars(select(SavedMatch).where(SavedMatch.group_key == group_key)).all()
            best = max([result["reality_recovered"]] + [match.result["reality_recovered"] for match in prior])
            result = {**result, "best_score": best}
            session.merge(SavedMatch(code=result["replay_code"], group_key=group_key, result=result))
            session.commit()
        return result

    def replay(self, code: str) -> dict | None:
        with Session(self.engine) as session:
            match = session.get(SavedMatch, code)
            return match.result if match else None

    async def acomplete_match(self, result, names, account_ids):
        async with self._write_lock:
            return await asyncio.to_thread(self.complete_match, result, names, account_ids)

    def complete_match(self, result, names, account_ids):
        """One atomic, idempotent transaction for replay and account statistics."""
        from .accounts import Account
        group_key = sha256("|".join(sorted(name.casefold() for name in names)).encode()).hexdigest()
        with Session(self.engine) as session:
            existing = session.get(SavedMatch, result["replay_code"])
            if existing:
                return existing.result
            prior = session.scalars(select(SavedMatch).where(SavedMatch.group_key == group_key)).all()
            best = max([result["reality_recovered"]] + [match.result["reality_recovered"] for match in prior])
            saved = {**result, "best_score": best}
            session.add(SavedMatch(code=result["replay_code"], group_key=group_key, result=saved))
            for account_id in set(account_ids):
                account = session.get(Account, account_id)
                if account:
                    account.rounds += 1
                    account.best_score = max(account.best_score, result["reality_recovered"])
            session.commit()
            return saved

    def save_rooms(self, rooms):
        self.save_states([serialize_room(room) for room in rooms])

    def save_states(self, states):
        with Session(self.engine) as session:
            for state in states:
                session.merge(SavedRoom(code=state["code"], state=state))
            session.commit()

    async def apersist_rooms(self, rooms):
        # Snapshot mutable dictionaries on the simulation loop before crossing a thread.
        states = json.loads(json.dumps([serialize_room(room) for room in rooms]))
        if not states:
            return
        async with self._write_lock:
            await asyncio.to_thread(self.save_states, states)

    def load_rooms(self):
        from .models import RoomPhase
        with Session(self.engine) as session:
            rooms = [restore_room(saved.state) for saved in session.scalars(select(SavedRoom)).all()]
            codes = [f"{room.code}-{room.round_number}" for room in rooms]
            matches = {match.code: match.result for match in session.scalars(select(SavedMatch).where(SavedMatch.code.in_(codes))).all()} if codes else {}
            for room in rooms:
                result = matches.get(f"{room.code}-{room.round_number}")
                if result and room.phase is not RoomPhase.LOBBY:
                    # A crash between the replay commit and room checkpoint must
                    # never reopen or re-score an already completed incident.
                    room.result = result
                    if room.phase is RoomPhase.EXPLORING:
                        room.phase = RoomPhase.RESULTS
            return rooms

    def delete_room(self, code):
        with Session(self.engine) as session:
            record = session.get(SavedRoom, code)
            if record:
                session.delete(record)
                session.commit()

    async def adelete_room(self, code):
        async with self._write_lock:
            await asyncio.to_thread(self.delete_room, code)


def serialize_room(room) -> dict:
    return {"code": room.code, "host_id": room.host_id, "phase": room.phase.value,
            "is_public": room.is_public, "max_players": room.max_players, "map_id": room.map_id,
            "scenario": asdict(room.scenario) if room.scenario else None,
            "round_number": room.round_number, "solo": room.solo, "tutorial": room.tutorial,
            "horror_enabled": room.horror_enabled, "haunt_state": room.haunt_state,
            "rules_version": room.rules_version, "case_elapsed": room.case_elapsed,
            "first_theory": room.first_theory, "theory_votes": sorted(room.theory_votes), "deadline_used": room.deadline_used,
            "result": room.result, "reveal_started_at": room.reveal_started_at,
            "testimonies": room.testimonies, "clashes": room.clashes, "chat": room.chat,
            "evidence": room.evidence, "timeline": room.timeline,
            "timeline_revision": room.timeline_revision, "theory_changes": room.theory_changes,
            "instability_used": room.instability_used, "consensus_events": sorted(room.consensus_events),
            "response_history": room.response_history, "demo_elapsed": room.demo_elapsed,
            "ai_requests": room.ai_requests, "ai_setup_done": room.ai_setup_done,
            "ai_recap_done": room.ai_recap_done, "intro": room.intro,
            "demo_navigation": room.demo_navigation, "demo_steps": sorted(room.demo_steps),
            "players": [{"id": player.id, "name": player.name, "token_hash": player.token_hash,
                         "avatar_color": player.avatar_color, "hat": player.hat, "account_id": player.account_id,
                         "color_index": player.color_index, "x": player.x, "y": player.y,
                         "ready": player.ready, "is_bot": player.is_bot,
                         "motive": player.motive, "motive_revealed": player.motive_revealed,
                         "linked_records": player.linked_records, "post_theory_edits": player.post_theory_edits,
                         "evidence_found": sorted(player.evidence_found), "theory_edits": player.theory_edits,
                         "memories": [asdict(memory) for memory in player.memories]}
                        for player in room.players.values()]}


def restore_room(data):
    from .models import RoomPhase
    from .mystery import Event, Memory, Scenario, scenario_for_round, validate_scenario
    from .room_manager import Player, Room
    room = Room(code=data["code"], host_id=data["host_id"], phase=RoomPhase(data["phase"]))
    for key in ("round_number", "solo", "tutorial", "horror_enabled", "haunt_state", "result", "reveal_started_at", "testimonies", "clashes", "chat", "is_public", "max_players", "map_id",
                "evidence", "timeline", "timeline_revision", "theory_changes", "instability_used",
                "response_history", "demo_elapsed", "demo_navigation", "ai_requests", "ai_setup_done", "ai_recap_done", "intro",
                "rules_version", "case_elapsed", "first_theory", "deadline_used"):
        if key in data:
            setattr(room, key, data[key])
    room.consensus_events = set(data.get("consensus_events", []))
    room.demo_steps = set(data.get("demo_steps", []))
    # Votes require connected witnesses; all human sockets are gone on restore.
    room.theory_votes = set()
    room.lock_votes.clear()
    if room.phase is not RoomPhase.LOBBY:
        saved_scenario = data.get("scenario")
        room.scenario = Scenario(saved_scenario["id"], tuple(Event(**event) for event in saved_scenario["events"])) if saved_scenario else scenario_for_round(room.code, room.round_number)
        validate_scenario(room.scenario)
    for saved in data["players"]:
        player = Player(id=saved["id"], name=saved["name"], token="", color_index=saved["color_index"], x=saved["x"], y=saved["y"])
        player.token_hash = saved["token_hash"]
        player.avatar_color = saved.get("avatar_color")
        player.hat = saved.get("hat", "none")
        player.account_id = saved.get("account_id")
        player.motive = saved.get("motive")
        player.motive_revealed = saved.get("motive_revealed", False)
        player.linked_records = saved.get("linked_records", 0)
        player.post_theory_edits = saved.get("post_theory_edits", 0)
        player.ready = saved["ready"]
        player.is_bot = saved["is_bot"]
        player.connected = player.is_bot
        player.evidence_found = set(saved["evidence_found"])
        player.theory_edits = saved["theory_edits"]
        player.memories = tuple(Memory(**{**memory, "claim": tuple(tuple(pair) for pair in memory["claim"])}) for memory in saved["memories"])
        room.players[player.id] = player
    return room
