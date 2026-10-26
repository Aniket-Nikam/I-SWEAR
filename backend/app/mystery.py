"""Immutable incident truth and deterministic witness projections. No AI dependencies."""

from dataclasses import asdict, dataclass, replace
from enum import Enum
from hashlib import sha256
from typing import Any


class Corruption(str, Enum):
    ACTOR_SWAP = "ACTOR_SWAP"
    LOCATION_SWAP = "LOCATION_SWAP"
    TIME_SHIFT = "TIME_SHIFT"
    OBJECT_SWAP = "OBJECT_SWAP"
    ORDER_SWAP = "ORDER_SWAP"
    CAUSE_SWAP = "CAUSE_SWAP"
    OMISSION = "OMISSION"
    FALSE_CERTAINTY = "FALSE_CERTAINTY"


@dataclass(frozen=True)
class Event:
    id: str
    time: str
    actor: str
    location: str
    action: str
    object: str
    cause: str
    order: int


@dataclass(frozen=True)
class Scenario:
    id: str
    events: tuple[Event, ...]


BLACKOUT = Scenario("blackout_001", (
    Event("collection", "22:37", "Riya", "Storage", "collected", "silver case", "scheduled transfer", 0),
    Event("arrival", "22:39", "Riya", "Lab C", "entered carrying", "silver case", "scheduled transfer", 1),
    Event("camera", "22:40", "Mina", "Lab C", "disconnected", "camera 03", "maintenance request", 2),
    Event("power", "22:41", "Omar", "Server Room", "reset", "manual breaker", "automatic fail-safe", 3),
    Event("archive", "22:42", "Riya", "Archive Room", "deposited", "silver case", "secure storage", 4),
    Event("exit", "22:43", "Leena", "Emergency Exit", "tested", "crash bar", "evacuation check", 5),
))


def scenario_for_round(room_code: str, round_number: int) -> Scenario:
    """Keep the first authored case; rematches rebuild facts before play starts."""
    if round_number == 1:
        return BLACKOUT
    seed = int(sha256(f"{room_code}-{round_number}-incident".encode()).hexdigest(), 16)
    actors = ("Riya", "Mina", "Omar", "Leena")
    rotation = 1 + seed % 3
    casting = {actor: actors[(index + rotation) % 4] for index, actor in enumerate(actors)}
    lab = ("Lab A", "Lab B", "Lab C")[(seed // 3) % 3]
    case = ("sealed sample crate", "copper transit case", "silver case")[(seed // 9) % 3]
    order = ("collection", "arrival", "power", "camera", "exit", "archive") if seed % 2 else (
        "collection", "arrival", "camera", "power", "archive", "exit")
    events = {event.id: event for event in BLACKOUT.events}
    minute = 20 + (seed // 27) % 16
    result = []
    for index, event_id in enumerate(order):
        event = events[event_id]
        result.append(replace(event, actor=casting[event.actor], order=index,
                              time=f"22:{minute + index + (1 if index else 0):02}",
                              location=lab if event_id in ("arrival", "camera") else event.location,
                              object=case if event.object == "silver case" else event.object))
    scenario = Scenario(f"blackout_{room_code.lower()}_{round_number}", tuple(result))
    validate_scenario(scenario)
    return scenario


def validate_scenario(scenario: Scenario) -> None:
    if len(scenario.events) < 4:
        raise ValueError("An incident needs at least four events")
    ids = [event.id for event in scenario.events]
    if len(set(ids)) != len(ids):
        raise ValueError("Event IDs must be unique")
    if [event.order for event in scenario.events] != list(range(len(ids))):
        raise ValueError("Canonical order must be contiguous")
    if [event.time for event in scenario.events] != sorted(event.time for event in scenario.events):
        raise ValueError("Canonical timestamps must increase")
    for event in scenario.events:
        hour, minute = map(int, event.time.split(":"))
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise ValueError("Invalid event timestamp")
        if not all((event.actor, event.location, event.action, event.object, event.cause)):
            raise ValueError("Missing event facts")


@dataclass(frozen=True)
class Memory:
    id: str
    event_id: str
    claim: tuple[tuple[str, Any], ...]
    category: str
    confidence: str
    sensory: str
    state: str
    corruption: str | None

    def private(self) -> dict:
        # Deliberately excludes truth state, corruption type, and canonical facts.
        claim = dict(self.claim)
        return {"id": self.id, "event_id": self.event_id, "claim": claim,
                "category": self.category, "confidence": self.confidence,
                "sensory": self.sensory, "text": phrase(claim)}


def corrupt(event: Event, kind: Corruption, locations=()) -> dict:
    claim = asdict(event)
    claim.pop("id")
    if kind is Corruption.ACTOR_SWAP:
        claim["actor"] = "Omar" if event.actor != "Omar" else "Mina"
    elif kind is Corruption.LOCATION_SWAP:
        claim["location"] = next((place for place in locations if place != event.location), "Lab B" if event.location != "Lab B" else "Lab C")
    elif kind is Corruption.TIME_SHIFT:
        hour, minute = map(int, event.time.split(":"))
        total = (hour * 60 + minute + 3) % (24 * 60)
        claim["time"] = f"{total // 60:02}:{total % 60:02}"
    elif kind is Corruption.OBJECT_SWAP:
        claim["object"] = "black equipment bag" if event.object != "black equipment bag" else "silver case"
    elif kind is Corruption.ORDER_SWAP:
        claim["order"] = (event.order + 1) % 6
    elif kind in (Corruption.CAUSE_SWAP, Corruption.FALSE_CERTAINTY):
        claim["cause"] = "an unauthorized experiment"
    elif kind is Corruption.OMISSION:
        claim.pop("actor")
        claim.pop("cause")
    return claim


def phrase(claim: dict) -> str:
    actor = claim.get("actor", "Someone")
    if claim["action"] == "entered carrying":
        return (f"{actor} entered {claim['location']} carrying the {claim['object']} "
                f"at {claim['time']}.")
    return (f"{actor} {claim['action']} the {claim['object']} in {claim['location']} "
            f"at {claim['time']}.")


def assign_memories(scenario: Scenario, witness_index: int, seed: str, locations=()) -> tuple[Memory, ...]:
    validate_scenario(scenario)
    # All witnesses remember the arrival; two share its one controlled false location.
    arrival = next(event for event in scenario.events if event.id == "arrival")
    remainder = [event for event in scenario.events if event.id != arrival.id]
    offset = int(sha256(seed.encode()).hexdigest()[:8], 16) % len(remainder)
    omitted = (witness_index + offset) % len(remainder)
    selected = [arrival] + [event for index, event in enumerate(remainder) if index != omitted]
    sensations = (
        "Cold air on my hands. A strip of amber light across the floor.",
        "A metallic click, followed by someone holding their breath.",
        "The corridor smelled of hot dust. I remember looking back.",
        "A monitor flashed once. The rest comes back in pieces.",
        "A shoe scraped the floor just before the lights steadied.",
    )
    memories = []
    for index, event in enumerate(selected):
        kind = None
        state = "TRUE"
        claim = asdict(event)
        claim.pop("id")
        if index == 0 and witness_index in (1, 2):
            kind = Corruption.LOCATION_SWAP
            state = "SHARED_FALSE_MEMORY"
        elif index == 2:
            kind = (Corruption.ACTOR_SWAP, Corruption.TIME_SHIFT,
                    Corruption.OMISSION, Corruption.OBJECT_SWAP)[witness_index % 4]
            state = "OMITTED_CONTEXT" if kind is Corruption.OMISSION else "CORRUPTED"
        if kind:
            claim = corrupt(event, kind, locations)
        memories.append(Memory(
            id=f"memory_{index + 1}", event_id=event.id,
            claim=tuple(claim.items()), category=("VISUAL", "AUDIO", "FRAGMENTED", "EMOTIONAL", "VISUAL")[index],
            confidence=("CLEAR", "FUZZY", "CLEAR", "UNCERTAIN", "VIVID")[(index + witness_index) % 5],
            sensory=sensations[index], state=state, corruption=kind.value if kind else None,
        ))
    return tuple(memories)


def contradictions(left: dict, right: dict) -> list[str]:
    if left.get("event_id") != right.get("event_id"):
        return []
    return [field for field in ("actor", "location", "time", "object", "action", "cause", "order")
            if field in left["claim"] and field in right["claim"]
            and left["claim"][field] != right["claim"][field]]


validate_scenario(BLACKOUT)
