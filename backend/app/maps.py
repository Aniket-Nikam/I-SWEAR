"""Authored maps, public metadata, and incident translations. No private facts in map data."""
from copy import deepcopy
from dataclasses import replace

from .world import WIDTH, HEIGHT, ROOMS, WALLS
from .mystery import Scenario, scenario_for_round, validate_scenario
from .layout import campus_layout

CAMPUS_OBJECTS = [
    {"id": "atrium_badge", "kind": "badge_scanner", "label": "Badge scanner", "room": "Central Atrium", "x": 824, "y": 662, "detail": "The status lamp pulses amber. Its audit buffer survived the outage."},
    {"id": "lab_a_chamber", "kind": "experiment_chamber", "label": "Experiment chamber", "room": "Lab A", "x": 322, "y": 278, "detail": "Condensation rings the sealed chamber. Something inside was moved recently."},
    {"id": "lab_b_glass", "kind": "broken_glass", "label": "Broken glass", "room": "Lab B", "x": 985, "y": 280, "detail": "The fragments lie inward, away from the corridor."},
    {"id": "lab_c_notebook", "kind": "notebook", "label": "Open notebook", "room": "Lab C", "x": 1668, "y": 286, "detail": "Several lines are pressed hard enough to mark the next page."},
    {"id": "storage_locker", "kind": "locker", "label": "Locker 14", "room": "Storage", "x": 268, "y": 1035, "detail": "The door is latched, but a silver fiber catches on the hinge."},
    {"id": "security_terminal", "kind": "security_log", "label": "Security log", "room": "Security Office", "x": 610, "y": 1050, "detail": "Local records show three badge requests during the blackout."},
    {"id": "cctv_terminal", "kind": "cctv_terminal", "label": "CCTV terminal", "room": "CCTV Room", "x": 985, "y": 1060, "detail": "Camera 03 lost twelve seconds. Camera 04 did not."},
    {"id": "server_panel", "kind": "power_panel", "label": "Power distribution", "room": "Server Room", "x": 1390, "y": 1060, "detail": "One breaker was reset manually after the automatic restart."},
    {"id": "archive_cabinet", "kind": "storage_cabinet", "label": "Archive cabinet", "room": "Archive Room", "x": 1692, "y": 1042, "detail": "The index skips from case 41 to case 43."},
    {"id": "exit_console", "kind": "emergency_console", "label": "Emergency console", "room": "Emergency Exit", "x": 1912, "y": 720, "detail": "The crash bar logged one partial press at 22:41."},
    {"id": "hall_id", "kind": "id_card", "label": "Dropped ID card", "room": "Central Atrium", "x": 1245, "y": 640, "detail": "The photo is scratched. The magnetic strip is still warm."},
    {"id": "hall_footprints", "kind": "footprints", "label": "Dusty footprints", "room": "Emergency Exit", "x": 1458, "y": 760, "detail": "The prints stop abruptly under the sodium light."},
]

CAMPUS_OBJECTS += [
    {"id": "annex_ledger", "kind": "notebook", "label": "Transfer ledger", "room": "Records Annex", "x": 290, "y": 1640, "detail": "A carbon copy survived in a different filing system."},
    {"id": "breakroom_tape", "kind": "security_log", "label": "Service memo", "room": "Break Room", "x": 760, "y": 1650, "detail": "Someone left a signed maintenance memo beside a cold cup."},
    {"id": "tunnel_meter", "kind": "power_panel", "label": "Backup meter", "room": "Service Tunnel", "x": 1240, "y": 1640, "detail": "An independent meter recorded the manual intervention."},
    {"id": "glasshouse_log", "kind": "storage_cabinet", "label": "Courier log", "room": "Glasshouse", "x": 1750, "y": 1640, "detail": "The night courier kept a duplicate of the deposit receipt."},
]
for _id,_room,_x,_kind,_label in (
    ("campus_expansion_0","Evidence Lab",354,"notebook","Chain-of-custody copy"),
    ("campus_expansion_1","Dispatch Office",994,"security_log","Dispatcher's duplicate"),
    ("campus_expansion_2","Cooling Plant",1664,"power_panel","Cooling circuit audit"),
):
    CAMPUS_OBJECTS.append(dict(id=_id,room=_room,x=_x,y=2180,kind=_kind,label=_label,detail="An independent physical source from the south wing."))
MAP_INFO = {
    "campus": {"id": "campus", "name": "Orpheus Campus", "case_title": "The Blackout", "subtitle": "An experiment. An outage. A case that moved.", "theme": "campus", "art": "/art/campus-night.svg", "number": "01"},
    "observatory": {"id": "observatory", "name": "Meridian Observatory", "case_title": "The Last Signal", "subtitle": "One missing star plate. Two different skies.", "theme": "observatory", "art": "/art/observatory.svg", "number": "02"},
    "ferry": {"id": "ferry", "name": "Saltwind Terminal", "case_title": "The Night Crossing", "subtitle": "The final ferry left. The manifest didn't.", "theme": "ferry", "art": "/art/ferry.svg", "number": "03"},
}
# x/y/width/height are authored independently for each map.
OBSERVATORY_ROOMS = [
    ("Dome A",64,64,680,450), ("Dome B",784,64,760,450), ("Chart Room",1584,64,750,450),
    ("Staff Hall",64,574,620,500), ("Rotunda",744,574,900,500), ("Telescope Deck",1704,574,630,500),
    ("Equipment Bay",64,1134,420,540), ("Control Room",524,1134,420,540),
    ("Signal Booth",984,1134,420,540), ("Power House",1444,1134,420,540),
    ("Plate Archive",1904,1134,430,540),
    ("Clock Workshop",64,2194,1040,400), ("Weather Station",1164,2194,1170,400),
    ("Darkroom",64,1734,900,380), ("Roof Walk",1024,1734,1310,380),
]
FERRY_ROOMS = [
    ("Ticket Office",64,64,600,430), ("Customs",724,64,650,430), ("Navigation Bridge",1434,64,730,430),
    ("Waiting Hall",64,554,600,540), ("Promenade",724,554,1000,540), ("Boarding Gate",1784,554,380,540),
    ("Cargo Hold",64,1154,450,450), ("Harbour Office",574,1154,470,450),
    ("Radio Room",1104,1154,470,450), ("Engine House",1634,1154,530,450),
    ("Manifest Archive",64,1665,650,480), ("Galley",774,1665,610,480),
    ("Lifeboat Deck",1444,1665,720,480),
    ("Signal Pier",64,2625,1000,400), ("Customs Store",1124,2625,1040,400),
    ("Boiler Annex",64,2205,850,340), ("Freight Hall",974,2205,1190,340),
]

def _walls(rooms, width, height):
    walls = [(width/2,32,width-64,16),(width/2,height-32,width-64,16),(32,height/2,16,height-64),(width-32,height/2,16,height-64)]
    for room in rooms:
        x,y,w,h = (room[k] for k in ("x","y","w","h"))
        # Recess room partitions to keep circulation lanes at least 76px wide:
        # a rotating 40px witness needs turning clearance on both sides.
        x, y, w, h = x+8, y+8, w-16, h-16
        # Four generous doorways per room connect the surrounding circulation lanes.
        for yy in (y,y+h):
            segment=(w-128)/2
            walls.extend(((x+segment/2,yy,segment,12),(x+w-segment/2,yy,segment,12)))
        for xx in (x,x+w):
            segment=(h-128)/2
            walls.extend(((xx,y+segment/2,12,segment),(xx,y+h-segment/2,12,segment)))
    return walls

def _alternate(map_id, specs, width, height, names, positions):
    rooms = [{"name":name,"x":x,"y":y,"w":w,"h":h,"tint":0x405665} for name,x,y,w,h in specs]
    objects=deepcopy(CAMPUS_OBJECTS[:12])
    by_name={r["name"]:r for r in rooms}
    for obj, room_name, position in zip(objects,names,positions):
        room=by_name[room_name]
        obj.update(room=room_name,x=room["x"]+room["w"]*position[0],y=room["y"]+room["h"]*position[1])
    if map_id == "observatory":
        labels=("Entry badge reader","Spectral chamber","Cracked lens","Observer's notebook","Plate locker","Dome maintenance log","Sky camera terminal","Generator panel","Plate archive","Roof safety console","Dropped observer pass","Chalk footprints")
    else:
        labels=("Boarding pass reader","Customs inspection booth","Broken porthole","Harbour notebook","Cargo locker","Harbour duty log","Dock camera terminal","Engine controls","Manifest cabinet","Gangway console","Dropped boarding pass","Saltwater footprints")
    for obj,label in zip(objects,labels):
        obj["label"]=label
        obj["detail"]="The local record survived. Compare its timestamp with what the witnesses remember."
    # Extra rooms contain corroborating physical records, not decorative empty space.
    annex_rooms=("Darkroom","Roof Walk","Power House","Plate Archive") if map_id=="observatory" else ("Galley","Lifeboat Deck","Boiler Annex","Freight Hall")
    for index,name in enumerate(annex_rooms):
        room=by_name[name]
        objects.append({"id":f"{map_id}_extra_{index}","kind":("notebook","security_log","power_panel","storage_cabinet")[index%4],"label":("Duplicate transfer sheet","Independent service log","Backup power audit","Courier receipt")[index%4],"room":name,"x":room["x"]+room["w"]*.55,"y":room["y"]+room["h"]*.55,"detail":"A second record from another department. It can corroborate the shared theory."})
    for index,name in enumerate(("Clock Workshop","Weather Station") if map_id=="observatory" else ("Signal Pier","Customs Store")):
        room=by_name[name]
        objects.append(dict(id=f"{map_id}_expansion_{index}",kind=("notebook","security_log")[index],label=("Independent time sheet","Dispatch duplicate")[index],room=name,x=room["x"]+room["w"]*.5,y=room["y"]+room["h"]*.55,detail="An independent source recovered from the extended grounds."))
    center=by_name["Rotunda" if map_id=="observatory" else "Promenade"]
    cx,cy=center["x"]+center["w"]*.5,center["y"]+center["h"]*.55
    offsets=((-40,-35),(35,-35),(-40,40),(35,40),(-85,0),(80,0),(0,-90),(0,90))
    return {"width":width,"height":height,"rooms":rooms,"walls":_walls(rooms,width,height),"objects":objects,"spawns":[(cx+x,cy+y) for x,y in offsets]}

_MAPS = {
    "campus":{"width":WIDTH,"height":HEIGHT,"rooms":ROOMS,"walls":WALLS,"objects":CAMPUS_OBJECTS,
              "spawns":[(965,700),(1040,700),(965,775),(1040,775),(920,740),(1080,740),(1000,645),(1000,825)]},
    "observatory":_alternate("observatory",OBSERVATORY_ROOMS,2400,2660,
        ("Rotunda","Dome A","Dome B","Chart Room","Equipment Bay","Control Room","Signal Booth","Power House","Plate Archive","Roof Walk","Staff Hall","Telescope Deck"),
        ((.3,.5),(.5,.6),(.5,.6),(.5,.6),(.5,.5),(.5,.5),(.5,.5),(.5,.5),(.5,.5),(.75,.55),(.5,.5),(.5,.5))),
    "ferry":_alternate("ferry",FERRY_ROOMS,2228,3090,
        ("Promenade","Customs","Ticket Office","Navigation Bridge","Cargo Hold","Harbour Office","Radio Room","Engine House","Manifest Archive","Boarding Gate","Waiting Hall","Lifeboat Deck"),
        ((.3,.5),(.5,.6),(.5,.6),(.5,.6),(.5,.5),(.5,.5),(.5,.5),(.5,.5),(.5,.5),(.5,.6),(.5,.5),(.5,.5))),
}

_MAPS["campus"].update(campus_layout(ROOMS, WALLS, CAMPUS_OBJECTS, _MAPS["campus"]["spawns"]))
for _map_id in ("observatory", "ferry"):
    _w=_MAPS[_map_id]
    _w.update(campus_layout(_w["rooms"],_w["walls"],_w["objects"],_w["spawns"],theme=_map_id))
for _world in _MAPS.values():
    _world["collision"] = _world["walls"] + _world["obstacles"]

def map_data(map_id="campus"):
    return _MAPS[map_id]

def public_maps():
    return [{**info,"rooms":len(_MAPS[key]["rooms"])} for key,info in MAP_INFO.items()]

def map_scenario(room_code, round_number, map_id="campus"):
    original=scenario_for_round(room_code,round_number)
    if map_id=="campus":
        return original
    if map_id=="observatory":
        locations={"Storage":"Equipment Bay","Lab A":"Dome B","Lab B":"Chart Room","Lab C":"Dome A","Server Room":"Power House","Archive Room":"Plate Archive","Emergency Exit":"Roof Walk"}
        objects={"silver case":"glass star plate","camera 03":"sky camera","manual breaker":"dome generator","crash bar":"roof safety latch"}
        actions={"camera":"disconnected","power":"restarted","exit":"tested"}
        causes={"scheduled transfer":"scheduled observation","maintenance request":"lens alignment","automatic fail-safe":"storm fail-safe","secure storage":"plate preservation","evacuation check":"roof safety check"}
    else:
        locations={"Storage":"Cargo Hold","Lab A":"Ticket Office","Lab B":"Navigation Bridge","Lab C":"Customs","Server Room":"Engine House","Archive Room":"Manifest Archive","Emergency Exit":"Boarding Gate"}
        objects={"silver case":"sealed transit pouch","camera 03":"dock camera","manual breaker":"auxiliary engine","crash bar":"gangway latch"}
        actions={"camera":"disconnected","power":"restarted","exit":"tested"}
        causes={"scheduled transfer":"final ferry transfer","maintenance request":"harbour service order","automatic fail-safe":"engine fail-safe","secure storage":"manifest reconciliation","evacuation check":"gangway safety check"}
    events=tuple(replace(e,location=locations[e.location],object=objects.get(e.object,"sealed observation crate" if map_id=="observatory" else "copper cargo case"),action=actions.get(e.id,e.action),cause=causes[e.cause]) for e in original.events)
    scenario=Scenario(f"{map_id}_{original.id}",events)
    validate_scenario(scenario)
    return scenario

