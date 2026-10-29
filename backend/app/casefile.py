"""Public case rhythm and private, pre-incident motives. No incident answers here."""
import math

MOTIVES = (
    ("borrowed_badge", "A borrowed badge", "Before tonight, you borrowed a staff badge without filing the form. You worry an innocent access record will make you look careless.", "Recover two records, then choose to disclose your motive.", "records"),
    ("old_favor", "A favor owed", "One of the staff once covered for you. You want to defend people you trust, but you know loyalty is not proof.", "Share a memory and respond to another witness, then disclose your motive.", "testimony"),
    ("unfinished_audit", "An unfinished audit", "You signed off an audit before checking every source. Another confident mistake would be difficult to explain.", "Link independent records into a deduction, then disclose your motive.", "links"),
    ("public_accusation", "Something to take back", "You blamed someone for an earlier mistake. Admitting that your first explanation was incomplete will feel uncomfortable.", "Revise the board after the first theory is recorded, then disclose your motive.", "revision"),
)


def assign_motive(index):
    key, title, secret, objective, goal = MOTIVES[index % len(MOTIVES)]
    return {"id": key, "title": title, "secret": secret, "objective": objective, "goal": goal}


def timing(room):
    return (55, 75, 150, 200) if room.solo else (90, 125, 300, 360)


def stage(room):
    discussion, lead, final, deadline = timing(room)
    elapsed = room.case_elapsed
    if elapsed < discussion:
        return "search", "Search the records", discussion
    if elapsed < lead:
        return "first_theory", "Compare your first theory", lead
    if elapsed < final:
        return "new_lead", "The backup records are available", final
    return "final_call", "Make your final case", deadline


def case_public(room):
    if room.rules_version < 2:
        return None
    key, title, end = stage(room)
    _, lead, _, deadline = timing(room)
    first = room.first_theory
    return {"version": 2, "untimed": room.tutorial, "elapsed": int(room.case_elapsed), "remaining": max(0, math.ceil(deadline-room.case_elapsed)),
            "duration": deadline, "stage": key, "title": title, "stage_remaining": max(0, math.ceil(end-room.case_elapsed)),
            "lead_available": room.case_elapsed >= lead, "lock_available": room.case_elapsed >= lead,
            "theory_votes": sorted(room.theory_votes),
            "first_theory": {"filled": sum(bool(entry) for entry in first["slots"]), "recorded_at": first["recorded_at"], "method": first["method"]} if first else None,
            "revealed_motives": [{"player_id": player.id, "name": player.name,
                                  "title": player.motive["title"], "secret": player.motive["secret"]}
                                 for player in room.players.values() if player.motive and player.motive_revealed]}


def private_motive(room, player):
    if not player.motive:
        return None
    goal = player.motive["goal"]
    if goal == "records":
        count, required = min(2, len(player.evidence_found)), 2
    elif goal == "testimony":
        shared = any(item["player_id"] == player.id for item in room.testimonies.values())
        responded = any(item["player_id"] == player.id for item in room.response_history)
        count, required = int(shared) + int(responded), 2
    elif goal == "links":
        count, required = min(1, player.linked_records), 1
    else:
        count, required = min(1, player.post_theory_edits), 1
    return {**player.motive, "revealed": player.motive_revealed, "progress": count, "required": required,
            "complete": count >= required and player.motive_revealed}


DISTORTION_REASONS = {
    "ACTOR_SWAP": "You attached a familiar identity to an incomplete view. Recognition felt stronger than the detail you actually saw.",
    "LOCATION_SWAP": "Similar rooms and interrupted attention let a familiar location replace the one in the record.",
    "TIME_SHIFT": "You reconstructed the time after the event. The sequence felt clear even though the timestamp moved.",
    "OBJECT_SWAP": "You filled an uncertain object with one you expected to see.",
    "ORDER_SWAP": "Two nearby moments were remembered in a different order.",
    "CAUSE_SWAP": "You remembered an explanation as though you had observed the cause.",
    "OMISSION": "Part of the moment never became a clear recollection; a missing detail did not mean nothing happened.",
    "FALSE_CERTAINTY": "Familiarity made an inferred explanation feel like a directly witnessed fact.",
}
