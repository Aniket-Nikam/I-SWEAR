"""Deterministic scoring. Presentation never determines an outcome."""

from dataclasses import asdict

from .mystery import phrase

FACT_FIELDS = ("actor", "location", "time", "object", "action")


def accurate(scenario, memory):
    actual = next(event for event in scenario.events if event.id == memory["event_id"])
    return all(getattr(actual, field) == value for field, value in memory["claim"].items())


def timeline_score(scenario, slots):
    facts = sum(sum(entry["claim"].get(field) == getattr(event, field) for field in FACT_FIELDS)
                if entry else 0 for event, entry in zip(scenario.events, slots))
    ordered = sum(bool(entry and entry["event_id"] == event.id) for event, entry in zip(scenario.events, slots))
    complete = sum(bool(entry and entry["event_id"] == event.id and
                        all(entry["claim"].get(field) == getattr(event, field) for field in FACT_FIELDS))
                   for event, entry in zip(scenario.events, slots))
    return {"reality_recovered": round(complete / 6 * 100),
            "timeline_accuracy": round(ordered / 6 * 100), "facts_recovered": facts}


def compute_results(room):
    scenario = room.scenario
    metrics = {}
    for player in room.players.values():
        memory_accuracy = round(sum(accurate(scenario, memory.private()) for memory in player.memories) / max(1, len(player.memories)) * 100)
        metrics[player.id] = {"player_id": player.id, "name": player.name, "memory_accuracy": memory_accuracy,
                              "avatar_color": player.avatar_color if player.avatar_color is not None else player.color_index, "hat": player.hat,
                              "score": 0, "successful_challenges": 0, "failed_challenges": 0,
                              "confidence_correct": 0, "confidence_wrong": 0,
                              "false_memories_spread": 0, "truthful_memories_rejected": 0,
                              "evidence_found": len(player.evidence_found), "believes": 0,
                              "doubts": 0, "trusted": 0, "theory_changes": player.theory_edits}
    consensus_mistakes = len(room.consensus_events)
    spread = []
    for testimony in room.testimonies.values():
        correct = accurate(scenario, testimony["memory"])
        author = metrics[testimony["player_id"]]
        historical_believers = {entry["player_id"] for entry in room.response_history
                                if entry["testimony_id"] == testimony["id"] and entry["response"] == "BELIEVE"}
        historical_doubters = {entry["player_id"] for entry in room.response_history
                               if entry["testimony_id"] == testimony["id"] and entry["response"] != "BELIEVE"}
        if not correct and historical_believers:
            author["false_memories_spread"] += len(historical_believers)
            spread.append({"text": testimony["memory"]["text"], "witness": testimony["name"],
                           "believers": [metrics[player_id]["name"] for player_id in sorted(historical_believers)]})
        if correct:
            author["truthful_memories_rejected"] += len(historical_doubters)
        if testimony["retracted"]:
            continue
        author["score"] += testimony["stake"] if correct else -testimony["stake"]
        author["confidence_correct" if correct else "confidence_wrong"] += testimony["stake"]
        believers = []
        for responder, response in testimony["responses"].items():
            metric = metrics[responder]
            believe = response["response"] == "BELIEVE"
            metric["believes" if believe else "doubts"] += 1
            right = believe == correct
            metric["score"] += response["stake"] if right else -response["stake"]
            metric["confidence_correct" if right else "confidence_wrong"] += response["stake"]
            if believe:
                believers.append(metric["name"])
                author["trusted"] += 1
            else:
                metric["successful_challenges" if right else "failed_challenges"] += 1
    for metric in metrics.values():
        total = metric["confidence_correct"] + metric["confidence_wrong"]
        metric["confidence_accuracy"] = round(metric["confidence_correct"] / total * 100) if total else None
    scores = timeline_score(scenario, room.timeline)
    challenges = sum(item["successful_challenges"] for item in metrics.values())
    believes = sum(item["believes"] for item in metrics.values())
    doubts = sum(item["doubts"] for item in metrics.values())
    if consensus_mistakes:
        archetype, description = "THE HIVE MIND", "Once enough people agreed, evidence had to fight to be heard."
    elif scores["reality_recovered"] >= 80 and challenges:
        archetype, description = "PARANOID GENIUSES", "You challenged everything. This time, it worked."
    elif doubts > believes:
        archetype, description = "THE SKEPTICS", "Nobody got a free pass. Not even a confident witness."
    elif scores["reality_recovered"] < 50:
        archetype, description = "CONFIDENTLY WRONG", "The story held together. Reality had other ideas."
    else:
        archetype, description = "THE ANCHORS", "You kept bringing the conversation back to what could be proved."
    awards = award_titles(list(metrics.values()))
    comparisons = []
    for index, event in enumerate(scenario.events):
        entry = room.timeline[index]
        comparisons.append({"event": asdict(event), "actual": phrase(asdict(event)),
                            "believed": entry["text"] if entry else "This moment was left unknown.",
                            "correct": bool(entry and entry["event_id"] == event.id and all(entry["claim"].get(field) == getattr(event, field) for field in FACT_FIELDS))})
    most_spread = max(spread, key=lambda item: len(item["believers"]), default=None)
    recap = (f"{most_spread['witness']} wasn't lying. That is exactly what they remembered."
             if most_spread else "You all remembered the same night. You did not remember the same truth.")
    return {**scores, "replay_code": f"{room.code}-{room.round_number}",
            "archetype": archetype, "description": description, "recap": recap,
            "players": list(metrics.values()), "awards": awards, "comparisons": comparisons,
            "corrupted_memories": [{"name": player.name, "text": memory.private()["text"],
                                    "state": memory.state, "corruption": memory.corruption}
                                   for player in room.players.values() for memory in player.memories if memory.state != "TRUE"],
            "belief_spread": spread, "consensus_mistakes": consensus_mistakes,
            "theory_changes": room.theory_changes, "evidence_found": len(room.evidence)}


def award_titles(metrics):
    rules = (("Most Trusted Witness", "trusted"), ("Most Accurate", "confidence_accuracy"),
             ("Confidently Wrong", "confidence_wrong"), ("Human Lie Detector", "successful_challenges"),
             ("Reality Distorter", "false_memories_spread"), ("The Skeptic", "doubts"),
             ("The Follower", "believes"), ("The Anchor", "evidence_found"), ("Chaos Agent", "theory_changes"))
    awards = []
    for title, key in rules:
        winner = max(metrics, key=lambda item: (item[key] or 0, item["name"]), default=None)
        if winner and winner[key] and winner[key] > 0:
            awards.append({"title": title, "name": winner["name"], "player_id": winner["player_id"],
                           "metric": key, "value": winner[key]})
    return awards
