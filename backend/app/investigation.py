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
BINDINGS.update({
    "annex_ledger": ("collection", "ANNEX / TRANSFER LEDGER"),
    "breakroom_tape": ("camera", "SERVICE MEMO / SIGNED COPY"),
    "tunnel_meter": ("power", "BACKUP METER / AUDIT"),
    "glasshouse_log": ("archive", "COURIER / DUPLICATE RECEIPT"),
    **{f"{map_id}_extra_{index}": (event, label) for map_id in ("observatory", "ferry")
       for index, (event, label) in enumerate((("collection", "DUPLICATE TRANSFER SHEET"), ("camera", "INDEPENDENT SERVICE LOG"), ("power", "BACKUP POWER AUDIT"), ("archive", "COURIER RECEIPT")))},
})


EXPANSION_BINDINGS = {}
for map_id,count in (("campus",3),("observatory",2),("ferry",2)):
    for index in range(count):
        EXPANSION_BINDINGS[f"{map_id}_expansion_{index}"]=(("collection","camera","power")[index],"EXTENDED GROUNDS / INDEPENDENT COPY")

CASE_BINDINGS = {**BINDINGS, "hall_footprints": ("exit", "THRESHOLD / INDEPENDENT TRACE"), **EXPANSION_BINDINGS}
BINDINGS.update(EXPANSION_BINDINGS)
SECONDARY_RECORDS = {"cctv_terminal", "lab_c_notebook", "hall_footprints", "annex_ledger", "breakroom_tape", "tunnel_meter", "glasshouse_log"}
SECONDARY_RECORDS.update(f"{map_id}_extra_{index}" for map_id in ("observatory", "ferry") for index in range(4))
SECONDARY_RECORDS.update(f"{m}_expansion_{i}" for m,n in (("campus",3),("observatory",2),("ferry",2)) for i in range(n))
FACT_FIELDS = ("actor", "location", "time", "object", "action")


def fact_text(claim):
    if all(field in claim for field in FACT_FIELDS):
        return phrase(claim)
    labels = {"actor": "Person", "location": "Location", "time": "Time", "object": "Object", "action": "Action"}
    return " · ".join(f"{labels[field]}: {claim[field]}" for field in FACT_FIELDS if field in claim) + ". Other details are not established by this record."


def recover_evidence(scenario: Scenario, object_id: str, partial=False) -> dict | None:
    binding = (CASE_BINDINGS if partial else BINDINGS).get(object_id)
    if not binding:
        return None
    event = next(event for event in scenario.events if event.id == binding[0])
    # Cause and ordering are not inferred by evidence. Only logged facts are exposed.
    fields = (("actor", "object", "time") if object_id in SECONDARY_RECORDS else ("location", "time", "action")) if partial else FACT_FIELDS
    claim = {key: getattr(event, key) for key in fields}
    return {"id": f"evidence_{object_id}", "object_id": object_id,
            "event_id": event.id, "label": binding[1], "claim": claim,
            "text": fact_text(claim), "timestamp": event.time, "partial": partial,
            "recorded_fields": list(fields)}


def resolve_sources(room, source_ids):
    ids = list(dict.fromkeys(source_ids))
    if not ids or len(ids) > 4:
        raise ValueError("A deduction can link one to four sources.")
    sources = [resolve_source(room, source_id) for source_id in ids]
    if any(source is None for source in sources):
        raise ValueError("A source is unavailable or retracted. Remove it from this deduction.")
    if len({source["event_id"] for source in sources}) != 1:
        raise ValueError("These records describe different moments. Put them in separate positions.")
    claim, verified, conflicts = {}, [], []
    for field in FACT_FIELDS:
        physical = [source["claim"][field] for source in sources if source["kind"] == "evidence" and field in source["claim"]]
        spoken = [source["claim"][field] for source in sources if source["kind"] == "testimony" and field in source["claim"]]
        if physical:
            claim[field] = physical[0]
            verified.append(field)
        elif spoken:
            claim[field] = spoken[0]
        if len(set(physical + spoken)) > 1:
            conflicts.append(field)
    return {"source_id": ids[0], "source_ids": ids, "kind": "deduction" if len(ids) > 1 else sources[0]["kind"],
            "event_id": sources[0]["event_id"], "claim": claim, "text": fact_text(claim),
            "label": " + ".join(source["label"] for source in sources),
            "verified_fields": verified, "conflicts": conflicts,
            "sources": [{"id": source["source_id"], "label": source["label"], "kind": source["kind"]} for source in sources]}


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
