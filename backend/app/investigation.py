"""Evidence is a projection of frozen truth; timeline choices are public source references."""

from .mystery import Scenario, phrase

BINDINGS = {
    "atrium_badge": ("arrival", "BADGE AUDIT / LOCAL BUFFER"),
    "storage_locker": ("collection", "LOCKER 14 / WEIGHT SENSOR"),
    "security_terminal": ("camera", "MAINTENANCE AUTHORIZATION"),
    "lab_c_notebook": ("camera", "HANDWRITTEN SERVICE NOTE"),
    "cctv_terminal": ("arrival", "CAMERA 04 / RECOVERED FRAME"),
    "server_panel": ("power", "POWER DISTRIBUTION / AUDIT"),
    "archive_cabinet": ("archive", "ARCHIVE DEPOSIT RECORD"),
    "exit_console": ("exit", "EMERGENCY CRASH BAR / TEST LOG"),
}


def recover_evidence(scenario: Scenario, object_id: str) -> dict | None:
    binding = BINDINGS.get(object_id)
    if not binding:
        return None
    event = next(event for event in scenario.events if event.id == binding[0])
    # Cause and ordering are not inferred by evidence. Only logged facts are exposed.
    claim = {key: getattr(event, key) for key in ("actor", "location", "time", "object", "action")}
    return {"id": f"evidence_{object_id}", "object_id": object_id,
            "event_id": event.id, "label": binding[1], "claim": claim,
            "text": phrase(claim), "timestamp": event.time}


def resolve_source(room, source_id: str) -> dict | None:
    if source_id in room.evidence:
        return {"source_id": source_id, "kind": "evidence", **room.evidence[source_id]}
    testimony = room.testimonies.get(source_id)
    if testimony and not testimony["retracted"]:
        return {"source_id": source_id, "kind": "testimony", "label": testimony["name"],
                "event_id": testimony["memory"]["event_id"],
                "claim": testimony["memory"]["claim"], "text": testimony["memory"]["text"]}
    return None


def timeline_public(room) -> dict:
    return {"slots": room.timeline, "revision": room.timeline_revision,
            "votes": sorted(room.lock_votes),
            "required_votes": sum(player.connected for player in room.players.values()) // 2 + 1,
            "theory_changes": room.theory_changes}
