import asyncio
import pytest
from app.maps import MAP_INFO, map_data, map_scenario
from app.navigation import walking_path
from app.world import blocked, line_clear
from app.mystery import assign_memories
from app.room_manager import RoomManager
from app.models import RoomPhase
from app.persistence import serialize_room, restore_room
from tests.test_movement import Socket

@pytest.mark.parametrize("map_id", MAP_INFO)
def test_every_physical_object_is_reachable_and_incident_locations_exist(map_id):
    world=map_data(map_id)
    assert len(world["rooms"])>=13
    assert len({room["name"] for room in world["rooms"]})==len(world["rooms"])
    spawn=world["spawns"][0]
    for obj in world["objects"]:
        assert 0<obj["x"]<world["width"] and 0<obj["y"]<world["height"]
        assert not blocked(obj["x"],obj["y"],world["walls"])
        path=walking_path(map_id,spawn,(obj["x"],obj["y"]))
        assert path
        assert all(line_clear(*left,*right,world["walls"]) for left,right in zip(path,path[1:]))
    for round_number in (1,2,3):
        scenario=map_scenario("MAPQA",round_number,map_id)
        locations={room["name"] for room in world["rooms"]}
        assert all(event.location in locations for event in scenario.events)
        memories=assign_memories(scenario,1,"QA",tuple(locations) if map_id!="campus" else ())
        assert memories[0].state=="SHARED_FALSE_MEMORY"
        assert all(dict(memory.claim)["location"] in locations for memory in memories)

@pytest.mark.parametrize("map_id", MAP_INFO)
def test_map_selection_survives_checkpoint_and_solo_completes_on_real_geometry(map_id):
    async def run():
        manager=RoomManager();room,human=manager.create_solo("Map Check",map_id)
        await manager.connect(room,human,Socket())
        snapshot=room.snapshot()
        assert snapshot["room"]["map_id"]==map_id
        assert all("detail" not in obj for obj in snapshot["interactables"])
        restored=restore_room(serialize_room(room))
        assert restored.map_id==map_id
        assert restored.snapshot()["world"]==snapshot["world"]
        for _ in range(3650):
            await manager.tick(.05)
            if room.phase is RoomPhase.REVEAL: break
        assert room.phase is RoomPhase.REVEAL, [(p.name,round(p.x),round(p.y)) for p in room.players.values()]
        assert len(room.evidence)>=5
        assert all(room.timeline)
        assert room.result["map"]["id"]==map_id
    asyncio.run(run())

def test_wall_sight_and_inspection_do_not_cross_solid_walls():
    walls=[(100,40,12,80),(100,160,12,80)]
    assert not line_clear(40,40,160,40,walls)
    assert line_clear(40,100,160,100,walls)
