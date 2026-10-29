"""A learner-owned solo pace: one requested search, one clue, no timed script."""
import asyncio
import math
import time
from .investigation import CASE_BINDINGS, SECONDARY_RECORDS
from .maps import map_data
from .models import RoomPhase
from .navigation import walking_path

SPEED=90 / 230

def human(room):
    return next((p for p in room.players.values() if not p.is_bot),None)

def candidates(room):
    known={record["object_id"] for record in room.evidence.values()}
    return [item for item in map_data(room.map_id)["objects"] if item["id"] in CASE_BINDINGS
            and item["id"] not in known and (item["id"] not in SECONDARY_RECORDS or room.case_elapsed>=75)
            and list(CASE_BINDINGS).index(item["id"])%4 != 0]

def public(room):
    if not room.solo_paced:return None
    learner=human(room)
    active=room.solo_search
    bot=room.players.get(active.get("bot"))
    return {"paused":room.solo_reading,"first_clue":bool(learner and learner.evidence_found),
            "searching":bot.name.replace(" (scripted)","") if bot else None,
            "target_id":active.get("target"),"available":bool(candidates(room))}

async def reading(manager,room,player,value):
    if not room.solo_paced or not room.solo or player.is_bot or room.phase is not RoomPhase.EXPLORING:
        return
    if room.solo_reading==value:return
    room.solo_reading=value
    if value:
        for bot in room.players.values():
            if bot.is_bot:bot.dx=bot.dy=bot.vx=bot.vy=0.
        await manager.broadcast(room,{"type":"positions","players":[p.public() for p in room.players.values() if p.is_bot],"at":time.monotonic()*1000})
    await manager.refresh_case(room)

async def request_search(manager,room,player):
    from .room_manager import RoomError
    if not room.solo_paced or not room.solo or player.is_bot or room.phase is not RoomPhase.EXPLORING:
        raise RoomError("This helper is only available in a paced solo case.")
    if not player.evidence_found:raise RoomError("Inspect your gold-marked record first.")
    if room.solo_reading:raise RoomError("Close the open screen before asking a witness to search.")
    if room.solo_search:return
    choices=candidates(room)
    if not choices:raise RoomError("The witnesses have searched their available records.")
    # Public badge access and physical distance choose a source, never its truth.
    item=min(choices,key=lambda item:min(math.hypot(p.x-item["x"],p.y-item["y"]) for p in room.players.values()
        if p.is_bot and p.color_index%4==list(CASE_BINDINGS).index(item["id"])%4))
    bot=next(p for p in room.players.values() if p.is_bot and p.color_index%4==list(CASE_BINDINGS).index(item["id"])%4)
    route=await asyncio.to_thread(walking_path,room.map_id,(bot.x,bot.y),(item["x"],item["y"]))
    if not route:raise RoomError("That witness cannot reach the record. Try another source.")
    room.solo_search={"bot":bot.id,"target":item["id"],"route":route,"index":1 if len(route)>1 else 0,"dwell":0.}
    await manager.refresh_case(room)
    manager.request_checkpoint(room)

async def advance(manager,room,dt):
    for bot in room.players.values():
        if bot.is_bot:bot.dx=bot.dy=0.
    if room.solo_reading or not room.solo_search:
        for bot in room.players.values():
            if bot.is_bot:bot.vx=bot.vy=0.
        return
    search=room.solo_search;bot=room.players[search["bot"]];route=search["route"]
    index=search["index"]
    if index<len(route):
        x,y=route[index];dx,dy=x-bot.x,y-bot.y;distance=math.hypot(dx,dy)
        if distance<3:
            search["index"]+=1;bot.vx=bot.vy=0.
        else:
            divisor=max(distance,25);bot.dx=dx/divisor*SPEED;bot.dy=dy/divisor*SPEED
    else:
        bot.vx=bot.vy=0.;search["dwell"]+=min(.1,max(0,dt))
        if search["dwell"]>=1.5:
            await manager.interact(room,bot,search["target"])
            record=next((r for r in room.evidence.values() if r["object_id"]==search["target"]),None)
            if record:
                memory=next((m for m in bot.memories if m.event_id==record["event_id"]),None)
                if memory:await manager.testify(room,bot,memory.id,10)
            room.solo_search={}
            await manager.refresh_case(room)
            manager.request_checkpoint(room)
    bot.last_input=bot.last_seen=time.monotonic()
