"""Disposable Nightmare acceptance using public HTTP/WS and real movement only.
No clock, player-position, canonical answer, or room-state mutations.
"""
import argparse
import asyncio
import json
import math
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.smoke_casefile import CaseWitness, QAClient
from scripts.smoke_match import until, room_when
from app.maps import map_data
from app.world import blocked

FIELDS=("location","actor","time","object","action")

async def play(url,clients,map_id):
 began=time.monotonic();witnesses=[]
 async with QAClient(base_url=url,timeout=60) as api:
  response=await api.post("/api/rooms",json={"name":"Night QA 1","map_id":map_id,"max_players":clients,"horror":True});response.raise_for_status()
  sessions=[response.json()];code=sessions[0]["room_code"]
  print(json.dumps({"room":code,"clients":clients,"map":map_id,"stage":"lobby"}),flush=True)
  try:
   for i in range(1,clients):
    response=await api.post(f"/api/rooms/{code}/join",json={"name":f"Night QA {i+1}"});response.raise_for_status();sessions.append(response.json())
   for session in sessions:
    witness=CaseWitness(session);witnesses.append(witness);await witness.open(url)
   for witness in witnesses:await witness.send("ready",ready=True)
   await room_when(api,code,lambda s:all(p["ready"] for p in s["players"]))
   await witnesses[0].send("start")
   await until(lambda:all(w.memories for w in witnesses),timeout=20)
   snapshot=(await api.get(f"/api/rooms/{code}")).json()
   assert snapshot["room"]["horror"] and snapshot["horror"]["phase"]=="dormant"
   plans=[[] for _ in witnesses]
   for obj in snapshot["interactables"]:
    if "clearance" in obj and not obj["backup"]:plans[obj["clearance"]].append(obj)
   await asyncio.gather(*(w.visit(map_id,plan) for w,plan in zip(witnesses,plans)))
   for witness in witnesses:
    for memory in witness.memories:
     # Await the broadcast acknowledgement, as a person does between selections.
     # Forty simultaneous publications also emit pairwise clashes and intentionally
     # trip the bounded slow-client queue; that is a separate saturation test.
     await witness.send("testify",memory_id=memory["id"],stake=10)
     await until(lambda:any(e["type"]=="testimony" and e["testimony"]["player_id"]==witness.session["player_id"] and e["testimony"]["memory"]["id"]==memory["id"] for e in witness.events))
   snapshot=await room_when(api,code,lambda s:len(s["testimonies"])>=clients*5)
   bad=[];seen=set()
   for testimony in snapshot["testimonies"]:
    claim=testimony["memory"]["claim"];event=testimony["memory"]["event_id"]
    for record in snapshot["evidence"]:
     if record["event_id"]!=event:continue
     mismatch=next((field for field in FIELDS if field in claim and field in record["claim"] and claim[field]!=record["claim"][field]),None)
     if mismatch:
      signature=(event,mismatch,str(claim[mismatch]))
      if signature not in seen:bad.append(testimony);seen.add(signature)
      break
   assert len(bad)>=2,"Need two distinct public-record contradictions"
   async def edit(slot,source,status="UNKNOWN"):
    before=(await api.get(f"/api/rooms/{code}")).json()["timeline"]["revision"]
    await witnesses[0].send("timeline",slot=slot,source_id=source,status=status,revision=before)
    return await room_when(api,code,lambda s:s["timeline"]["revision"]>before)
   print(json.dumps({"room":code,"clients":clients,"stage":"records recovered","records":len(snapshot["evidence"])}),flush=True)
   await edit(1,bad[0]["id"],"CONFIRMED")
   warning=await room_when(api,code,lambda s:s["horror"]["phase"]=="warning")
   await until(lambda:all(any(e["type"]=="horror" and e["horror"]["phase"]=="warning" for e in w.events) for w in witnesses))
   await edit(1,None)
   await room_when(api,code,lambda s:s["horror"]["phase"]=="cooldown")
   await room_when(api,code,lambda s:s["horror"]["phase"]=="dormant",timeout=45)
   await edit(1,bad[1]["id"],"CONFIRMED")
   captured=await room_when(api,code,lambda s:s["horror"]["phase"]=="devouring",timeout=32)
   victim=sessions[0]["player_id"]
   assert captured["horror"]["target_id"]==victim and captured["horror"]["captures"][victim]==1
   # The captured witness is frozen; an unmarked witness remains movable.
   await witnesses[0].send("move",dx=1,dy=0,sequence=10000)
   other=witnesses[-1];start=other.players[other.session["player_id"]]
   await other.send("move",dx=.5,dy=.2,sequence=10000)
   await asyncio.sleep(.18)
   await other.send("move",dx=0,dy=0,sequence=10001)
   assert witnesses[0].players[victim]["dx"]==0
   after=other.players[other.session["player_id"]]
   assert math.dist((start["x"],start["y"]),(after["x"],after["y"]))>1
   recovered=await room_when(api,code,lambda s:s["horror"]["phase"]=="cooldown")
   player=next(p for p in recovered["players"] if p["id"]==victim)
   assert math.dist((player["x"],player["y"]),map_data(map_id)["spawns"][0])<1
   for witness in witnesses:
    for event in witness.events:
     if event["type"]=="positions" and event.get("creature"):
      c=event["creature"];assert not blocked(c["x"],c["y"],map_data(map_id)["collision"])
   await witnesses[0].close();await witnesses[0].open(url)
   snapshot=(await api.get(f"/api/rooms/{code}")).json()
   assert snapshot["horror"]["captures"][victim]==1
   print(json.dumps({"room":code,"stage":"warning cancellation, real pursuit, capture, release, reconnect passed"}),flush=True)
   # Build from recovered public timestamps, deliberately leaving one known false source.
   events={record["event_id"]:record for record in snapshot["evidence"]}
   ordered=sorted(events.values(),key=lambda item:str(item["claim"]["time"]))
   assert len(ordered)==6
   for slot,record in enumerate(ordered):await edit(slot,record["id"])
   wrong_slot=next(i for i,item in enumerate(ordered) if item["event_id"]==bad[0]["memory"]["event_id"])
   await edit(wrong_slot,bad[0]["id"])
   snapshot=await room_when(api,code,lambda s:s["case"]["lock_available"],timeout=130)
   revision=snapshot["timeline"]["revision"]
   for witness in witnesses[:snapshot["timeline"]["required_votes"]]:await witness.send("lock_vote",revision=revision,vote=True)
   result=(await room_when(api,code,lambda s:s["result"] is not None))["result"]
   assert result["nightmare"]["ending"]=="devoured"
   await until(lambda:all(any(e["type"]=="reveal" for e in w.events) for w in witnesses),timeout=15)
   await until(lambda:any(e["type"]=="result_saved" for e in witnesses[0].events),timeout=30)
   replay=await api.get(f"/api/replays/{result['replay_code']}");replay.raise_for_status()
   assert replay.json()["nightmare"]==result["nightmare"]
   snapshot=await room_when(api,code,lambda s:s["room"]["phase"]=="results",timeout=35)
   host=next(w for w in witnesses if w.session["player_id"]==snapshot["room"]["host_id"])
   await host.send("rematch")
   snapshot=await room_when(api,code,lambda s:s["room"]["phase"]=="lobby")
   assert snapshot["room"]["horror"] and snapshot["horror"]["phase"]=="dormant" and not snapshot["horror"]["captures"]
   print(json.dumps({"room":code,"clients":clients,"map":map_id,"warning_cancel":"passed","capture":"passed","other_players_moving":"passed","reconnect":"passed","final_devour":"passed","replay":result["replay_code"],"rematch":"passed","network_reconnects":sum(w.network_reconnects for w in witnesses),"seconds":round(time.monotonic()-began)}),flush=True)
  finally:
   await asyncio.gather(*(w.close() for w in witnesses),return_exceptions=True)

if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("--url",default="http://127.0.0.1:8026");parser.add_argument("--clients",type=int,choices=(4,8),default=8);parser.add_argument("--map",choices=("campus","observatory","ferry"),default="campus")
 args=parser.parse_args();asyncio.run(play(args.url.rstrip("/"),args.clients,args.map))
