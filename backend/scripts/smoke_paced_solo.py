"""Real self-paced solo acceptance using only public actions and physical movement."""
import argparse,asyncio,json,math,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.smoke_casefile import QAClient,CaseWitness
from scripts.smoke_match import room_when,until

async def play(url,map_id):
 began=time.monotonic();w=None
 async with QAClient(base_url=url,timeout=60) as api:
  r=await api.post("/api/rooms/solo",json={"name":"Quiet QA","map_id":map_id,"paced_solo":True});r.raise_for_status();session=r.json();code=session["room_code"]
  print(json.dumps({"room":code,"map":map_id,"stage":"started"}),flush=True)
  try:
   w=CaseWitness(session);await w.open(url)
   await until(lambda:bool(w.memories))
   async def state():return (await api.get(f"/api/rooms/{code}")).json()
   async def reading(value):
    await w.send("solo_reading",reading=value)
    return await room_when(api,code,lambda s:s["case"]["solo"]["paused"]==value)
   s=await reading(False);assert s["room"]["solo_paced"] and s["case"]["untimed"]
   before={p["id"]:(p["x"],p["y"]) for p in s["players"] if p["is_bot"]}
   await asyncio.sleep(3);s=await state()
   assert before=={p["id"]:(p["x"],p["y"]) for p in s["players"] if p["is_bot"]} and not s["evidence"] and not s["testimonies"]
   await w.visit(map_id,[next(i for i in s["interactables"] if i["id"]=="atrium_badge")])
   s=await room_when(api,code,lambda s:bool(s["evidence"]));assert len(s["evidence"])==1
   await w.send("solo_step")
   await room_when(api,code,lambda s:bool(s["case"]["solo"]["searching"]))
   await asyncio.sleep(.6);s=await reading(True)
   before={p["id"]:(p["x"],p["y"]) for p in s["players"] if p["is_bot"]}
   await asyncio.sleep(2);s=await state();assert before=={p["id"]:(p["x"],p["y"]) for p in s["players"] if p["is_bot"]}
   await w.close();await asyncio.sleep(1);s=await state();assert before=={p["id"]:(p["x"],p["y"]) for p in s["players"] if p["is_bot"]}
   await w.open(url);s=await state();assert s["case"]["solo"]["paused"]
   await reading(False)
   s=await room_when(api,code,lambda s:not s["case"]["solo"]["searching"],timeout=90)
   assert len(s["evidence"])==2 and len(s["testimonies"])<=1 and not any(s["timeline"]["slots"])
   print(json.dumps({"room":code,"stage":"first clue, reading pause, disconnect/reconnect, one search passed"}),flush=True)
   searches=1
   while s["case"]["solo"]["available"]:
    before=len(s["evidence"]);await w.send("solo_step")
    await room_when(api,code,lambda s:bool(s["case"]["solo"]["searching"]))
    s=await room_when(api,code,lambda s:not s["case"]["solo"]["searching"] and len(s["evidence"])>before,timeout=100)
    assert len(s["evidence"])==before+1;searches+=1;assert searches<=20
   own=[i for i in s["interactables"] if i.get("clearance")==0 and not any(r["object_id"]==i["id"] for r in s["evidence"])]
   await w.visit(map_id,own);s=await state();assert not any(s["timeline"]["slots"]) and not s["timeline"]["votes"]
   print(json.dumps({"room":code,"stage":"all clues recovered, no automatic answer or votes","records":len(s["evidence"]),"searches":searches}),flush=True)
   for e in w.events:
    if e["type"]=="positions":
     for p in e["players"]:
      if p.get("is_bot"):assert math.hypot(p.get("vx",0),p.get("vy",0))<=90.5
   groups={}
   for record in s["evidence"]:groups.setdefault(record["event_id"],[]).append(record)
   ordered=sorted(groups.values(),key=lambda records:str(next(r["claim"]["time"] for r in records if "time" in r["claim"])))
   assert len(ordered)==6
   async def edit(kind,**payload):
    current=await state();revision=current["timeline"]["revision"]
    await w.send(kind,revision=revision,**payload)
    return await room_when(api,code,lambda s:s["timeline"]["revision"]>revision)
   for slot,records in enumerate(ordered):
    await edit("timeline",slot=slot,source_id=records[0]["id"],status="UNKNOWN")
    for record in records[1:4]:await edit("link_source",slot=slot,source_id=record["id"],remove=False)
   s=await state();await w.send("lock_vote",revision=s["timeline"]["revision"],vote=True)
   result=(await room_when(api,code,lambda s:s["result"] is not None))["result"]
   assert result["reality_recovered"]==100
   await until(lambda:any(e["type"]=="result_saved" for e in w.events),timeout=25)
   replay=await api.get(f"/api/replays/{result['replay_code']}");replay.raise_for_status()
   await room_when(api,code,lambda s:s["room"]["phase"]=="results",timeout=35)
   await w.send("rematch");s=await room_when(api,code,lambda s:s["room"]["phase"]=="lobby")
   assert s["room"]["solo_paced"] and not s["case"]["solo"]["searching"]
   print(json.dumps({"room":code,"map":map_id,"score":result["reality_recovered"],"replay":result["replay_code"],"searches":searches,"reading_pause":"passed","reconnect":"passed","no_autopilot":"passed","manual_submit":"passed","rematch":"passed","network_reconnects":w.network_reconnects,"seconds":round(time.monotonic()-began)}),flush=True)
  finally:
   if w:await w.close()

if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--url",default="http://127.0.0.1:8028");p.add_argument("--map",choices=("campus","observatory","ferry"),default="campus");a=p.parse_args();asyncio.run(play(a.url.rstrip("/"),a.map))
