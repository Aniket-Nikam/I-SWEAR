import asyncio
import copy
import math
import pytest
from app import paced_solo,horror
from app.casefile import case_public
from app.models import RoomPhase
from app.navigation import walking_path
from app.maps import map_data
from app.persistence import serialize_room,restore_room
from app.room_manager import RoomManager,RoomError
from tests.test_movement import Socket
from tests.test_casefile import fill_records,fill_board

async def setup(map_id="campus"):
 manager=RoomManager();room,player=manager.create_solo("Learner",map_id,paced=True)
 await manager.connect(room,player,Socket())
 return manager,room,player

async def first_record(manager,room,player):
 item=next(i for i in map_data(room.map_id)["objects"] if i["id"]=="atrium_badge")
 player.x,player.y=walking_path(room.map_id,(player.x,player.y),(item["x"],item["y"]))[-1]
 await manager.interact(room,player,item["id"])


def test_waits_for_the_human_and_never_runs_a_clock_or_script():
 async def run():
  manager,room,player=await setup();before={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  await paced_solo.reading(manager,room,player,False)
  for _ in range(2200):await manager.tick(.1)
  assert room.phase is RoomPhase.EXPLORING and room.case_elapsed==room.demo_elapsed==0
  assert not room.evidence and not room.testimonies and not any(room.timeline)
  assert before=={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  with pytest.raises(RoomError):await paced_solo.request_search(manager,room,player)
  assert case_public(room)["untimed"] and not case_public(room)["solo"]["first_clue"]
 asyncio.run(run())

@pytest.mark.parametrize("map_id",("campus","observatory","ferry"))
def test_one_requested_witness_one_clue_slow_movement_and_reading_pause(map_id):
 async def run():
  manager,room,player=await setup(map_id);await first_record(manager,room,player)
  await paced_solo.reading(manager,room,player,False)
  await paced_solo.request_search(manager,room,player)
  active=room.solo_search["bot"];count=len(room.evidence)
  for _ in range(30):await manager.tick(.05)
  assert math.hypot(room.players[active].vx,room.players[active].vy)<=90.1
  assert sum(math.hypot(p.vx,p.vy)>0 for p in room.players.values() if p.is_bot)<=1
  await paced_solo.reading(manager,room,player,True)
  before={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  for _ in range(50):await manager.tick(.1)
  assert before=={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  await paced_solo.reading(manager,room,player,False)
  await manager.disconnect(room,player,player.websocket)
  paused={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  for _ in range(20):await manager.tick(.1)
  assert paused=={p.id:(p.x,p.y) for p in room.players.values() if p.is_bot}
  await manager.connect(room,player,Socket());assert room.solo_reading
  await paced_solo.reading(manager,room,player,False)
  for _ in range(2400):
   await manager.tick(.05)
   if not room.solo_search:break
  assert not room.solo_search and len(room.evidence)==count+1
  assert len(room.testimonies)<=1 and not any(room.timeline) and not room.lock_votes
  for _ in range(300):await manager.tick(.1)
  assert len(room.evidence)==count+1 and room.phase is RoomPhase.EXPLORING
 asyncio.run(run())


def test_mode_search_and_human_authority_survive_checkpoint_and_rematch():
 async def run():
  manager,room,player=await setup();await first_record(manager,room,player)
  await paced_solo.reading(manager,room,player,False);await paced_solo.request_search(manager,room,player)
  restored=restore_room(serialize_room(room));assert restored.solo_paced and restored.solo_reading
  assert restored.solo_search==room.solo_search
  fill_records(room);await fill_board(manager,room,player);await manager.advance_case(room,.05)
  assert room.case_elapsed==75 and not room.first_theory
  await manager.vote_lock(room,player,room.timeline_revision,True)
  assert room.phase is RoomPhase.REVEAL
  room.phase=RoomPhase.RESULTS;await manager.rematch(room,player)
  assert room.solo_paced and room.solo_reading and not room.solo_search
 asyncio.run(run())


def test_reading_pauses_solo_horror_but_cannot_control_a_multiplayer_room():
 async def run():
  manager,room,player=await setup();room.horror_enabled=True
  room.haunt_state.update(phase="warning",remaining=9,target_id=player.id)
  await horror.advance(manager,room,.1);assert room.haunt_state["remaining"]==9
  room.solo=False;room.solo_paced=False;room.solo_reading=False
  await paced_solo.reading(manager,room,player,True);assert not room.solo_reading
  with pytest.raises(RoomError):await paced_solo.request_search(manager,room,player)
 asyncio.run(run())
