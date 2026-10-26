"""Deterministic walking routes for scripted witnesses on authored maps."""
from functools import lru_cache
import heapq
import math
from .maps import map_data
from .world import blocked

STEP = 8

@lru_cache(maxsize=3)
def walkable(map_id):
    world = map_data(map_id)
    cells={(x,y) for x in range(4,world["width"]//STEP-3) for y in range(4,world["height"]//STEP-3)}
    # Rasterize expanded walls once, with four extra pixels of turning clearance.
    for x,y,w,h in world["walls"]:
        for gx in range(math.floor((x-w/2-16)/STEP)+1,math.ceil((x+w/2+16)/STEP)):
            for gy in range(math.floor((y-h/2-16)/STEP)+1,math.ceil((y+h/2+16)/STEP)):
                cells.discard((gx,gy))
    return frozenset(cells)

def walking_path(map_id, start, destination):
    cells=walkable(map_id)
    nearest=lambda point:min(cells,key=lambda cell:(cell[0]*STEP-point[0])**2+(cell[1]*STEP-point[1])**2)
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
