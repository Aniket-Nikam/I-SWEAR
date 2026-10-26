"""A three-minute rehearsal driven only by scripted waypoints and public records."""

import math
import time

from .models import RoomPhase

PLANS = {
    1: [(1200, 740, None), (1350, 740, None), (1350, 940, None),
        (1390, 1060, "server_panel"), (1390, 1110, None), (500, 1110, None),
        (268, 1110, None), (268, 1035, "storage_locker")],
    2: [(770, 740, None), (480, 740, None), (480, 950, None),
        (610, 1050, "security_terminal"), (610, 1110, None),
        (1692, 1110, None), (1692, 1042, "archive_cabinet")],
    3: [(1500, 740, None), (1650, 740, None), (1650, 440, None),
        (1668, 286, "lab_c_notebook"), (1650, 440, None),
        (1650, 700, None), (1912, 720, "exit_console")],
}


async def advance_demo(manager, room, dt):
    if not room.solo or room.phase is not RoomPhase.EXPLORING:
        return
    room.demo_elapsed += dt
    bots = [player for player in room.players.values() if player.is_bot]
    for bot in bots:
        route = PLANS[bot.color_index]
        path = route + list(reversed(route[:-1]))
        index = room.demo_navigation.get(bot.id, 0)
        if index >= len(path):
            index = 0
            room.demo_navigation[bot.id] = 0
        x, y, object_id = path[index]
        distance = math.hypot(x - bot.x, y - bot.y)
        if distance < 18:
            if object_id:
                await manager.interact(room, bot, object_id)
            room.demo_navigation[bot.id] = index + 1
            bot.dx = bot.dy = 0.0
        else:
            bot.dx = (x - bot.x) / distance
            bot.dy = (y - bot.y) / distance
        bot.last_input = bot.last_seen = time.monotonic()

    async def once(key, after, action):
        if room.phase is RoomPhase.EXPLORING and room.demo_elapsed >= after and key not in room.demo_steps:
            await action()
            room.demo_steps.add(key)

    async def announcement(text):
        await manager.broadcast(room, {"type": "archivist", "text": text})

    await once("intro", 2, lambda: announcement("SOLO REHEARSAL. Three scripted witnesses are investigating with you. Press M to compare your first memory, then share it. Move left to inspect the badge scanner with E."))
    await once("first_false", 12, lambda: manager.testify(room, bots[0], "memory_1", 50))
    await once("shared_false", 25, lambda: manager.testify(room, bots[1], "memory_1", 25))
    if "testimony_1" in room.testimonies:
        false_id = next((item["id"] for item in room.testimonies.values() if item["player_id"] == bots[0].id), None)
        if false_id:
            await once("follow_one", 30, lambda: manager.respond(room, bots[1], false_id, "BELIEVE", 25))
            await once("follow_two", 42, lambda: manager.respond(room, bots[2], false_id, "BELIEVE", 10))
            await once("challenge", 65, lambda: manager.respond(room, bots[1], false_id, "DOUBT", 10))
    await once("clash", 47, lambda: manager.testify(room, bots[2], "memory_1", 10))
    await once("evidence_hint", 75, lambda: announcement("The witnesses have recovered physical records. Open Reconstruction with Tab. A record can be reliable even when a confident witness disagrees."))
    await once("reconstruct_hint", 100, lambda: announcement("Put six moments in order. Use recovered evidence and public testimony. Drag records, or select a record and choose a position."))

    if room.demo_elapsed >= 120 and "board" not in room.demo_steps:
        sources = {item["event_id"]: item for item in room.evidence.values()}
        for testimony in room.testimonies.values():
            event_id = testimony["memory"]["event_id"]
            if event_id not in sources and not testimony["retracted"]:
                sources[event_id] = {"id": testimony["id"], "claim": testimony["memory"]["claim"]}
        if len(sources) >= 6:
            ordered = sorted(sources.values(), key=lambda item: str(item["claim"]["time"]))
            for slot, source in enumerate(ordered):
                if room.timeline[slot] is None:
                    await manager.edit_timeline(room, bots[0], slot, source["id"], "UNKNOWN", room.timeline_revision)
            room.demo_steps.add("board")
            await announcement("The scripted witnesses have proposed a sequence. You can change any position or replace a false testimony with your badge record. Review it before voting.")
    if all(room.timeline):
        await once("vote_one", 145, lambda: manager.vote_lock(room, bots[0], room.timeline_revision, True))
        await once("vote_two", 150, lambda: manager.vote_lock(room, bots[1], room.timeline_revision, True))
        await once("lock_hint", 153, lambda: announcement("Two witnesses are ready. Open Reconstruction and vote to lock reality, or keep revising. The rehearsal will close its record shortly."))
        await once("vote_three", 178, lambda: manager.vote_lock(room, bots[2], room.timeline_revision, True))
