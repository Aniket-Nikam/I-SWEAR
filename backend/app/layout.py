"""Public physical scenery: one layout feeds art, collision and navigation."""
from collections import defaultdict


def doorways(walls):
    groups = defaultdict(list)
    for x, y, w, h in walls:
        axis = "x" if w > h else "y"
        groups[(axis, y if axis == "x" else x)].append(
            (x-w/2, x+w/2) if axis == "x" else (y-h/2, y+h/2))
    doors = []
    for (axis, line), spans in groups.items():
        spans.sort()
        end = spans[0][1]
        for low, high in spans[1:]:
            gap = low-end
            if 36 <= gap <= 180:
                middle = (end+low)/2
                doors.append({"x": middle if axis == "x" else line,
                              "y": line if axis == "x" else middle,
                              "width": gap, "axis": axis})
            end = max(end, high)
    # Collinear spans can straddle a perpendicular wall. That gap is not an entrance.
    return [door for door in doors if not any(
        abs(door['x']-x)<w/2+12 and abs(door['y']-y)<h/2+12
        for x,y,w,h in walls)]


def campus_layout(rooms, walls, objects, spawns):
    doors = doorways(walls)
    furniture = []
    def add(kind, x, y, width, depth, seed=0):
        # Keep a wide approach on both sides of every actual opening.
        for door in doors:
            dw, dh = (door["width"]+36, 160) if door["axis"] == "x" else (160, door["width"]+36)
            if abs(x-door["x"]) < (width+dw)/2 and abs(y-door["y"]) < (depth+dh)/2:
                return False
        if any(abs(x-px) < width/2+28 and abs(y-py) < depth/2+28 for px, py in spawns):
            return False
        if any(abs(x-item["x"]) < width/2+48 and abs(y-item["y"]) < depth/2+48 for item in objects):
            return False
        furniture.append({"id": f"furniture_{len(furniture)}", "kind": kind, "x": x, "y": y,
                          "w": width, "d": depth, "seed": seed})
        return True

    for index, room in enumerate(rooms):
        x, y, w, h, name = (room[key] for key in ("x", "y", "w", "h", "name"))
        back = y+22
        if "Lab" in name:
            for i in range(3):
                cx = x+110+i*100
                if cx < x+w-50:
                    add("lab_bench", cx, back, 92, 31)
            add("plant", x+w-42, y+42, 30, 30)
        elif any(label in name for label in ("Archive", "Records", "Storage")):
            add("shelves", x+w/2, back, min(w-65, 300), 30, index)
            add("plant", x+35, y+h-38, 30, 30)
        elif any(label in name for label in ("Server", "CCTV", "Security")):
            for i in range(3):
                add("server_rack", x+48+i*65, back, 50, 38)
        elif "Glasshouse" in name:
            for i in range(5):
                add("plant", x+40+i*(w-80)/4, back+20, 30, 30)
            add("bench", x+w/2, y+h-30, 150, 42)
        else:
            # The lower rooms open from the north: their benches belong at the back.
            rows = (y+h-34, back) if y >= 1400 else (back, y+h-34)
            for row in rows:
                if any(add("bench", cx, row, min(190, w-90), 42)
                       for cx in (x+w/2, x+w*.26, x+w*.74)):
                    break
            add("plant", x+35, back+15, 30, 30)
            add("plant", x+w-35, back+15, 30, 30)
            if "Break" in name:
                add("coffee_station", x+52, y+h-28, 68, 38)

    obstacles = [[item["x"], item["y"]-2 if item["kind"] == "bench" else item["y"], item["w"], item["d"]]
                 for item in furniture]
    for item in objects:
        kind = item["kind"]
        if kind in ("broken_glass", "footprints", "id_card"):
            continue
        width, depth = ((40, 28) if kind == "badge_scanner" else (60, 60) if kind == "experiment_chamber"
                        else (61, 44) if kind == "notebook" else (47, 28) if kind == "power_panel"
                        else (48, 38) if kind in ("locker", "storage_cabinet") else (63, 42))
        obstacles.append([item["x"], item["y"], width, depth])
    return {"furniture": furniture, "obstacles": obstacles, "doors": doors, "layout_version": 2}
