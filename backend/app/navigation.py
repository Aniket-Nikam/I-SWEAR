"""Deterministic walking routes for scripted witnesses on authored maps."""
from functools import lru_cache
import heapq
import math
from .maps import map_data
from .world import blocked, RADIUS

STEP = 8

@lru_cache(maxsize=3)
def walkable(map_id):
    world = map_data(map_id)
    cells={(x,y) for x in range(4,world["width"]//STEP-3) for y in range(4,world["height"]//STEP-3)}
    # Rasterize expanded walls once, with four extra pixels of turning clearance.
    for x,y,w,h in world.get("collision", world["walls"]):
        clearance = RADIUS + 4
        for gx in range(math.floor((x-w/2-clearance)/STEP)+1,math.ceil((x+w/2+clearance)/STEP)):
            for gy in range(math.floor((y-h/2-clearance)/STEP)+1,math.ceil((y+h/2+clearance)/STEP)):
                cells.discard((gx,gy))
    return frozenset(cells)

def walking_path(map_id, start, destination):
    cells=walkable(map_id)
    def nearest(point):
        cx,cy=round(point[0]/STEP),round(point[1]/STEP)
        # Targets are normally on a floor or within a small evidence prop.
        # Search local rings instead of scanning the entire expanded map per leg.
        candidates=[]
        for radius in range(33):
            for dx in range(-radius,radius+1):
                for dy in ({-radius,radius} if abs(dx)<radius else range(-radius,radius+1)):
                    cell=cx+dx,cy+dy
                    if cell in cells:candidates.append(cell)
            if candidates:
                return min(candidates,key=lambda cell:(cell[0]*STEP-point[0])**2+(cell[1]*STEP-point[1])**2)
        return min(cells,key=lambda cell:(cell[0]*STEP-point[0])**2+(cell[1]*STEP-point[1])**2)
    origin,goal=nearest(start),nearest(destination)
    frontier=[(0,origin)]; cost={origin:0}; previous={origin:None}
    while frontier:
        _,current=heapq.heappop(frontier)
        if current==goal: break
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nxt=(current[0]+dx,current[1]+dy); score=cost[current]+1
            if nxt in cells and score<cost.get(nxt,10**9):
                cost[nxt]=score;previous[nxt]=current
                heapq.heappush(frontier,(score+abs(nxt[0]-goal[0])+abs(nxt[1]-goal[1]),nxt))
    if goal not in previous: raise ValueError(f"Unreachable map destination on {map_id}")
    route=[];node=goal
    while node is not None:
        route.append((node[0]*STEP,node[1]*STEP));node=previous[node]
    route.reverse()
    # Keep turns and endpoints; every segment remains on the validated grid path.
    return [point for i,point in enumerate(route) if i in (0,len(route)-1)
            or (point[0]-route[i-1][0],point[1]-route[i-1][1]) != (route[i+1][0]-point[0],route[i+1][1]-point[1])]

@lru_cache(maxsize=9)
def demo_route(map_id, witness_index):
    world=map_data(map_id)
    ids={1:("server_panel","storage_locker"),2:("security_terminal","archive_cabinet"),3:("lab_c_notebook","exit_console")}[witness_index]
    position=world["spawns"][witness_index]; route=[]
    for object_id in ids:
        obj=next(item for item in world["objects"] if item["id"]==object_id)
        leg=walking_path(map_id,position,(obj["x"],obj["y"]))
        route.extend((x,y,None) for x,y in leg[:-1])
        x,y=leg[-1];route.append((x,y,object_id));position=(x,y)
    return route


@lru_cache(maxsize=9)
def demo_case_route(map_id, witness_index):
    world = map_data(map_id)
    extra = {1: "breakroom_tape", 2: "tunnel_meter", 3: "glasshouse_log"}[witness_index] if map_id == "campus" else f"{map_id}_extra_{witness_index}"
    ids = {1: ("server_panel", "storage_locker"), 2: ("security_terminal", "archive_cabinet"), 3: ("lab_c_notebook", "exit_console")}[witness_index] + (extra,)
    position, route = world["spawns"][witness_index], []
    for object_id in ids:
        obj = next(item for item in world["objects"] if item["id"] == object_id)
        leg = walking_path(map_id, position, (obj["x"], obj["y"]))
        route.extend((x, y, None) for x, y in leg[:-1])
        x, y = leg[-1]
        route.append((x, y, object_id))
        position = (x, y)
    return route
