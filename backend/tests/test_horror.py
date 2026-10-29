import asyncio
import copy
import math
import pytest
from app import horror
from app.maps import map_data
from app.models import RoomPhase
from app.navigation import walking_path
from app.persistence import serialize_room,restore_room
from app.room_manager import RoomManager
from app.world import blocked
from tests.test_movement import Socket
from tests.test_casefile import fill_records,fill_board

async def encounter(map_id="campus"):
 manager=RoomManager();room,player=manager.create_solo("Marked witness",map_id)
 room.horror_enabled=True
 await manager.connect(room,player,Socket())
 scanner=next(obj for obj in map_data(map_id)["objects"] if obj["id"]=="atrium_badge")
 player.x,player.y=walking_path(map_id,(player.x,player.y),(scanner["x"],scanner["y"]))[-1]
 await manager.interact(room,player,"atrium_badge")
 bot=next(p for p in room.players.values() if p.color_index==1)
 await manager.testify(room,bot,"memory_1",10)
 source=next(t["id"] for t in room.testimonies.values() if t["player_id"]==bot.id)
 await manager.edit_timeline(room,player,1,source,"UNKNOWN",room.timeline_revision)
 return manager,room,player,source

def test_only_a_deliberate_record_contradiction_starts_a_warning():
 async def run():
  manager,room,player,source=await encounter()
  assert horror.public(room)["phase"]=="dormant"
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  state=horror.public(room)
  assert state["phase"]=="warning" and state["target_id"]==player.id
  assert state["reason"]["field"]=="location" and state["remaining"]==9
  assert "scenario" not in state and "seen" not in state and "x" not in state
  # Changing secret truth does not affect the public-record decision.
  saved=room.scenario;room.scenario=None
  assert horror.conflict(room,1)==state["reason"]
  room.scenario=saved
  await manager.edit_timeline(room,player,1,next(iter(room.evidence)),"UNKNOWN",room.timeline_revision)
  await horror.advance(manager,room,.05)
  assert horror.public(room)["phase"]=="cooldown" and not room.haunt_state["captures"]
 asyncio.run(run())

def test_unrecovered_details_and_uncommitted_guesses_do_not_reveal_hidden_answers():
 async def run():
  manager,room,player,source=await encounter()
  records=room.evidence;room.evidence={}
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  assert horror.public(room)["phase"]=="dormant"
  room.evidence=records
  await horror.advance(manager,room,.1)
  assert horror.public(room)["phase"]=="dormant"  # No retroactive punishment.
 asyncio.run(run())

def test_warning_can_be_withdrawn_and_the_same_mistake_cannot_be_spammed():
 async def run():
  manager,room,player,source=await encounter()
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  await manager.edit_timeline(room,player,1,None,"UNKNOWN",room.timeline_revision)
  await horror.advance(manager,room,.05)
  for _ in range(410):await horror.advance(manager,room,.1)
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  assert room.haunt_state["phase"]=="dormant" and room.haunt_state["strikes"]==1
 asyncio.run(run())

@pytest.mark.parametrize("map_id",("campus","observatory","ferry"))
def test_creature_routes_remain_outside_real_collision_and_can_capture_then_release(map_id):
 async def run():
  manager,room,player,source=await encounter(map_id)
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  for _ in range(92):await horror.advance(manager,room,.1)
  assert room.haunt_state["phase"]=="hunting"
  for _ in range(25):
   await horror.advance(manager,room,.05)
   await asyncio.sleep(.002)
   state=room.haunt_state
   assert not blocked(state["x"],state["y"],map_data(map_id)["collision"])
  # Unit contact fixture: exercise capture/freeze/release without waiting on a chase.
  room.haunt_state.update(x=player.x,y=player.y,vx=0,vy=0)
  await horror.advance(manager,room,.05)
  assert room.haunt_state["phase"]=="devouring"
  before=(player.x,player.y)
  await manager.move(room,player,1,0,99)
  assert player.dx==player.vx==0 and (player.x,player.y)==before
  for _ in range(38):await horror.advance(manager,room,.1)
  assert room.haunt_state["phase"]=="cooldown"
  assert (player.x,player.y)==map_data(map_id)["spawns"][player.color_index]
  assert room.haunt_state["captures"][player.id]==1
  assert room.phase is RoomPhase.EXPLORING
  assert not blocked(player.x,player.y,map_data(map_id)["collision"])
 asyncio.run(run())

def test_disconnected_target_is_not_captured_and_state_survives_checkpoint():
 async def run():
  manager,room,player,source=await encounter()
  await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
  restored=restore_room(serialize_room(room))
  assert restored.horror_enabled and restored.haunt_state==room.haunt_state
  assert not restored.haunt_runtime and restored.snapshot()["horror"]["phase"]=="warning"
  player.connected=False
  # A second connected human keeps the room simulation active.
  other=copy.copy(player);other.id="other";other.connected=True;room.players[other.id]=other
  await horror.advance(manager,room,.1)
  assert room.haunt_state["phase"]=="cooldown" and not room.haunt_state["captures"]
 asyncio.run(run())

def test_calm_and_training_rooms_never_hunt_even_when_a_claim_is_wrong():
 async def run():
  for tutorial,enabled in ((False,False),(True,True)):
   manager,room,player,source=await encounter()
   room.tutorial=tutorial;room.horror_enabled=enabled
   await manager.edit_timeline(room,player,1,source,"CONFIRMED",room.timeline_revision)
   assert horror.public(room) is None and room.haunt_state["phase"]=="dormant"
 asyncio.run(run())

def test_final_false_claim_has_a_devour_ending_but_missing_fields_alone_do_not():
 async def run():
  for wrong in (False,True):
   manager,room,player,source=await encounter()
   fill_records(room);await fill_board(manager,room,player)
   await manager.edit_timeline(room,player,1,None,"UNKNOWN",room.timeline_revision)
   primary=next(record["id"] for record in room.evidence.values() if record["object_id"]=="atrium_badge")
   await manager.edit_timeline(room,player,1,source if wrong else primary,"UNKNOWN",room.timeline_revision)
   await manager.finish_case(room)
   assert room.result["nightmare"]["ending"]==("devoured" if wrong else "escaped")
   assert room.phase is RoomPhase.REVEAL
   if wrong:
    assert room.haunt_state["phase"]=="devouring" and room.haunt_state["final"]
    for _ in range(38):await horror.advance(manager,room,.1)
    assert room.haunt_state["phase"]=="dormant"
   room.phase=RoomPhase.RESULTS
   await manager.rematch(room,player)
   assert room.horror_enabled and room.haunt_state==horror.initial_state()
 asyncio.run(run())


def test_first_theory_needs_a_real_majority_before_it_marks_the_voter():
 async def run():
  from tests.test_investigation import investigation_room
  manager,room,players=await investigation_room(rules_version=2)
  room.horror_enabled=True;room.case_elapsed=90
  fill_records(room)
  await manager.testify(room,players[1],"memory_1",10)
  false_source=next(iter(room.testimonies))
  for slot,event in enumerate(room.scenario.events[:3]):
   source=false_source if event.id=="arrival" else next(item["id"] for item in room.evidence.values() if item["event_id"]==event.id)
   await manager.edit_timeline(room,players[0],slot,source,"UNKNOWN",room.timeline_revision)
  for player in players[:2]:
   await manager.vote_theory(room,player,room.timeline_revision,True)
   assert room.haunt_state["phase"]=="dormant"
  await manager.vote_theory(room,players[2],room.timeline_revision,True)
  assert room.first_theory and room.haunt_state["phase"]=="warning"
  assert room.haunt_state["target_id"]==players[2].id
 asyncio.run(run())


def test_nightmare_solo_requires_the_humans_final_vote_and_deadline_is_not_a_devour():
 async def run():
  manager,room,player,source=await encounter()
  fill_records(room);await fill_board(manager,room,player)
  await manager.edit_timeline(room,player,1,source,"UNKNOWN",room.timeline_revision)
  room.demo_elapsed=179;room.case_elapsed=179
  from app.demo import advance_demo
  await advance_demo(manager,room,.05)
  assert room.phase is RoomPhase.EXPLORING and player.id not in room.lock_votes
  assert len(room.lock_votes)==2
  await manager.finish_case(room,deadline=True)
  assert room.result["nightmare"]["ending"]=="unsealed" and not room.haunt_state["final"]
 asyncio.run(run())
