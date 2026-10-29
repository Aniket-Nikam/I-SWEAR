"""The Unsaid: public-evidence danger, server-owned pursuit, no truth oracle."""
import asyncio
import math
import logging
import time
from .maps import map_data
from .models import RoomPhase
from .investigation import resolve_source, resolve_sources
from .navigation import walking_path
from .world import blocked, integrate, line_clear

FIELDS = ("location", "actor", "time", "object", "action")

def initial_state():
    return {"phase":"dormant", "remaining":0., "target_id":None, "reason":None,
            "strikes":0, "captures":{}, "seen":[], "x":0., "y":0., "vx":0., "vy":0., "final":False}

def public(room):
    if not room.horror_enabled or room.tutorial:
        return None
    state = room.haunt_state
    return {key: state[key] for key in ("phase","target_id","reason","strikes","captures","final")} | {"remaining":math.ceil(state["remaining"])}

def pose(room):
    if room.horror_enabled and room.haunt_state["phase"] in ("hunting","devouring"):
        return {key: round(room.haunt_state[key],2) for key in ("x","y","vx","vy")}
    return None

def conflict(room, slot):
    entry = room.timeline[slot]
    if not entry:
        return None
    ids=[key for key in entry.get("source_ids",[entry["source_id"]]) if resolve_source(room,key)]
    if not ids:
        return None
    entry=resolve_sources(room,ids)
    # Only facts already shared as physical records can provoke a mid-case hunt.
    # No scenario, memory truth flags, unrecovered records, or ordering oracle.
    for record in room.evidence.values():
        if record["event_id"] != entry["event_id"]:
            continue
        for field in FIELDS:
            if field in entry["claim"] and field in record["claim"] and entry["claim"][field] != record["claim"][field]:
                return {"slot":slot, "field":field, "claimed":entry["claim"][field], "recorded":record["claim"][field], "record":record["label"]}
    return None

def cancel_path(room):
    task = room.haunt_runtime.get("task")
    if task:
        if task.done():
            try:task.exception()
            except asyncio.CancelledError:pass
        else:task.cancel()
    room.haunt_runtime.clear()

def reset(room):
    cancel_path(room)
    room.haunt_state = initial_state()

async def notify(manager, room, durable=True):
    await manager.broadcast(room, {"type":"horror", "horror":public(room)})
    if durable:
        manager.request_checkpoint(room)

async def commit(manager, room, player, slots):
    if not room.horror_enabled or room.tutorial or player.is_bot or room.phase is not RoomPhase.EXPLORING:
        return
    state = room.haunt_state
    if state["phase"] != "dormant":
        return
    for slot in slots:
        reason = conflict(room,slot)
        if not reason:
            continue
        signature = f"{room.timeline[slot]['event_id']}:{reason['field']}:{reason['claimed']}"
        if signature in state["seen"]:
            continue
        state["seen"].append(signature)
        state.update(phase="warning",remaining=9.,target_id=player.id,reason=reason,final=False,strikes=state["strikes"]+1)
        await notify(manager,room)
        break

async def retreat(manager,room):
    cancel_path(room)
    room.haunt_state.update(phase="cooldown",remaining=40.,vx=0.,vy=0.,final=False)
    await notify(manager,room)

async def capture(manager,room,player):
    cancel_path(room)
    state=room.haunt_state
    state.update(phase="devouring",remaining=3.6,vx=0.,vy=0.)
    state["captures"][player.id]=state["captures"].get(player.id,0)+1
    player.dx=player.dy=player.vx=player.vy=0.
    await manager.broadcast(room,{"type":"positions","players":[player.public()],"at":time.monotonic()*1000})
    await notify(manager,room)

async def advance(manager,room,dt):
    if not room.horror_enabled or room.tutorial:
        return
    if room.solo_paced and room.solo_reading and room.phase is RoomPhase.EXPLORING:return
    state=room.haunt_state
    phase=state["phase"]
    if phase=="dormant":
        return
    dt=min(.1,max(0,dt))
    if phase=="devouring" and state["final"]:
        state["remaining"]=max(0.,state["remaining"]-dt)
        if not state["remaining"]:
            state.update(phase="dormant",final=False,target_id=None)
            await notify(manager,room)
        return
    if room.phase is not RoomPhase.EXPLORING:
        cancel_path(room)
        return
    if not any(p.connected and not p.is_bot for p in room.players.values()):
        return
    player=room.players.get(state["target_id"])
    before_second=math.ceil(state["remaining"])
    state["remaining"]=max(0.,state["remaining"]-dt)
    if phase=="cooldown":
        if not state["remaining"]:
            state.update(phase="dormant",target_id=None,reason=None)
            await notify(manager,room)
        return
    if not player or not player.connected:
        await retreat(manager,room)
        return
    reason=state["reason"]
    if phase in ("warning","hunting") and (not reason or not conflict(room,reason["slot"])):
        await retreat(manager,room)
        return
    if phase=="warning" and not state["remaining"]:
        world=map_data(room.map_id)
        candidates=[(player.x+math.cos(angle)*distance,player.y+math.sin(angle)*distance)
                    for distance in (220,160,100) for angle in (math.pi,0,math.pi/2,-math.pi/2)]
        point=next(((x,y) for x,y in candidates if 32<x<world["width"]-32 and 32<y<world["height"]-32 and not blocked(x,y,world["collision"])),None)
        if not point:
            await retreat(manager,room)
            return
        state.update(phase="hunting",remaining=20.,x=point[0],y=point[1],vx=0.,vy=0.)
        await notify(manager,room)
    elif phase=="hunting":
        if not state["remaining"]:
            await retreat(manager,room)
            return
        world=map_data(room.map_id)
        runtime=room.haunt_runtime
        runtime["elapsed"]=runtime.get("elapsed",0)+dt
        task=runtime.get("task")
        if task and task.done():
            try:
                runtime["path"]=task.result()
            except asyncio.CancelledError:
                runtime["path"]=[]
            except Exception as error:
                logging.getLogger("i-swear").warning("Creature route unavailable (%s)",type(error).__name__)
                runtime["path"]=[]
            runtime.pop("task",None)
        destination=(player.x,player.y)
        path=runtime.setdefault("path",[])
        # At most one bounded navigation job per room, off the simulation loop.
        # Until a valid route arrives, the creature waits rather than walking walls.
        needs_path=not path or math.dist(runtime.get("destination",destination),destination)>80
        if needs_path and not runtime.get("task") and runtime["elapsed"]>=runtime.get("next_path",0):
            runtime["next_path"]=runtime["elapsed"]+1.0
            runtime["destination"]=destination
            runtime["task"]=asyncio.create_task(asyncio.to_thread(walking_path,room.map_id,(state["x"],state["y"]),destination))
        while path and math.dist((state["x"],state["y"]),path[0])<7:
            path.pop(0)
        goal=path[0] if path else destination if line_clear(state["x"],state["y"],*destination,world["collision"]) else (state["x"],state["y"])
        dx,dy=goal[0]-state["x"],goal[1]-state["y"]
        length=max(1.,math.hypot(dx,dy))
        # Fractional input caps the creature at 180px/s; witnesses can outrun it.
        x,y,vx,vy=integrate(state["x"],state["y"],state["vx"],state["vy"],dx/length*180/230,dy/length*180/230,dt,world)
        state.update(x=x,y=y,vx=vx,vy=vy)
        if math.dist((x,y),destination)<40 and line_clear(x,y,*destination,world["walls"]):
            await capture(manager,room,player)
    elif phase=="devouring" and not state["remaining"]:
        world=map_data(room.map_id)
        spawn=world["spawns"][player.color_index]
        player.x,player.y=spawn
        player.dx=player.dy=player.vx=player.vy=0.
        await manager.broadcast(room,{"type":"positions","players":[player.public()],"at":time.monotonic()*1000})
        await retreat(manager,room)
    if before_second!=math.ceil(state["remaining"]):
        await notify(manager,room,durable=False)

def ending(room,result):
    if not room.horror_enabled or room.tutorial:
        return False
    cancel_path(room)
    # Truth is public at the ending. Missing fields alone are not a false claim.
    devoured=not room.deadline_used and any(entry and (entry["event_id"]!=event.id or any(
        field in entry["claim"] and entry["claim"][field]!=getattr(event,field)
        for field in FIELDS)) for entry,event in zip(room.timeline,room.scenario.events))
    result["nightmare"]={"ending":"unsealed" if room.deadline_used else "devoured" if devoured else "escaped", "strikes":room.haunt_state["strikes"],
                         "captures":[{"player_id":key,"count":value} for key,value in room.haunt_state["captures"].items()]}
    room.haunt_state.update(phase="devouring" if devoured else "dormant",remaining=3.6 if devoured else 0.,target_id=None,reason=None,final=devoured)
    return devoured
