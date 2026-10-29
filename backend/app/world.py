"""Public facility geometry. The server supplies the same walls to every client."""

import math

WIDTH, HEIGHT = 2048, 2460
SPEED = 230.0
RADIUS = 12.0

ROOMS = [
    {"name": "Lab A", "x": 64, "y": 78, "w": 548, "h": 390, "tint": 0x17242C},
    {"name": "Lab B", "x": 652, "y": 78, "w": 720, "h": 390, "tint": 0x18252D},
    {"name": "Lab C", "x": 1412, "y": 78, "w": 572, "h": 390, "tint": 0x19262D},
    {"name": "Main Hall", "x": 64, "y": 505, "w": 548, "h": 355, "tint": 0x18242B},
    {"name": "Central Atrium", "x": 652, "y": 505, "w": 720, "h": 355, "tint": 0x1E2A31},
    {"name": "Emergency Exit", "x": 1412, "y": 505, "w": 572, "h": 355, "tint": 0x18242B},
    {"name": "Storage", "x": 64, "y": 897, "w": 300, "h": 425, "tint": 0x151F27},
    {"name": "Security Office", "x": 400, "y": 897, "w": 300, "h": 425, "tint": 0x17232B},
    {"name": "CCTV Room", "x": 736, "y": 897, "w": 300, "h": 425, "tint": 0x142229},
    {"name": "Server Room", "x": 1072, "y": 897, "w": 360, "h": 425, "tint": 0x14252A},
    {"name": "Archive Room", "x": 1468, "y": 897, "w": 516, "h": 425, "tint": 0x1D2429},
]
ROOMS += [
    {"name": "Evidence Lab", "x": 64, "y": 1980, "w": 580, "h": 400, "tint": 0x62796d},
    {"name": "Dispatch Office", "x": 684, "y": 1980, "w": 620, "h": 400, "tint": 0x8c795d},
    {"name": "Cooling Plant", "x": 1344, "y": 1980, "w": 640, "h": 400, "tint": 0x47636c},
    {"name": "Records Annex", "x": 64, "y": 1450, "w": 440, "h": 410, "tint": 0x675d47},
    {"name": "Break Room", "x": 544, "y": 1450, "w": 440, "h": 410, "tint": 0x566e60},
    {"name": "Service Tunnel", "x": 1024, "y": 1450, "w": 440, "h": 410, "tint": 0x405665},
    {"name": "Glasshouse", "x": 1504, "y": 1450, "w": 480, "h": 410, "tint": 0x526d55},
]

# Center x/y, width, height. Doorways are real gaps in these segments.
WALLS = [(1024, 48, 1960, 18), (1024, 2420, 1960, 18),
         (40, 1234, 18, 2390), (2008, 1234, 18, 2390),
         (490, 1350, 900, 18), (1520, 1350, 976, 18)]
for y in (486, 878):
    # Leave a forgiving approach for diagonal, screen-relative movement. The
    # original 39px opening gave a 24px witness almost no turning clearance.
    WALLS.extend((x, y, width - 60, 16) for x, width in
                 ((250, 420), (575, 130), (850, 280), (1172, 286),
                  (1515, 210), (1830, 310)))
for x in (632, 1392):
    WALLS.extend((x, y, 16, height - 32) for y, height in
                 ((205, 250), (420, 100), (605, 180), (820, 100)))
for x in (382, 718, 1054, 1450):
    WALLS.extend(((x, 980, 16, 165), (x, 1245, 16, 165)))
for x in (524, 1004, 1484):
    WALLS.append((x, 1660, 16, 420))
for x, width in ((64, 440), (544, 440), (1024, 440), (1504, 480)):
    half = (width - 100) / 2
    WALLS.extend(((x + half / 2, 1430, half, 16), (x + width - half / 2, 1430, half, 16)))
    WALLS.extend(((x + half / 2, 1880, half, 16), (x + width - half / 2, 1880, half, 16)))
for x, width in ((64,580),(684,620),(1344,640)):
    half=(width-128)/2
    WALLS.extend(((x+half/2,1960,half,16),(x+width-half/2,1960,half,16)))
for x in (664,1324):
    WALLS.append((x,2180,16,440))


def blocked(x: float, y: float, walls=None) -> bool:
    return any(abs(x - wx) < width / 2 + RADIUS and
               abs(y - wy) < height / 2 + RADIUS
               for wx, wy, width, height in (WALLS if walls is None else walls))


def line_clear(ax, ay, bx, by, walls):
    for cx, cy, width, height in walls:
        enter, leave = 0.0, 1.0
        intersects = True
        for origin, direction, low, high in ((ax,bx-ax,cx-width/2,cx+width/2),(ay,by-ay,cy-height/2,cy+height/2)):
            if abs(direction) < .0001:
                if origin < low or origin > high:
                    intersects = False
                    break
            else:
                one, two = (low-origin)/direction, (high-origin)/direction
                enter, leave = max(enter,min(one,two)), min(leave,max(one,two))
                if enter > leave:
                    intersects = False
                    break
        if intersects and enter < 1 and leave > 0:
            return False
    return True


def integrate(x: float, y: float, vx: float, vy: float, dx: float, dy: float,
              dt: float, geometry=None) -> tuple[float, float, float, float]:
    """Acceleration, normalized diagonals, and axis-separated wall sliding."""
    length = max(1.0, math.hypot(dx, dy))
    blend = 1 - math.exp(-dt / 0.065)
    tx, ty = dx / length * SPEED, dy / length * SPEED
    # Exact exponential displacement matches the client at every frame rate.
    travel_x = tx * dt + (vx - tx) * 0.065 * blend
    travel_y = ty * dt + (vy - ty) * 0.065 * blend
    vx += (tx - vx) * blend
    vy += (ty - vy) * blend
    if abs(vx) < 0.1:
        vx = 0.0
    if abs(vy) < 0.1:
        vy = 0.0
    width, height = (geometry["width"], geometry["height"]) if geometry else (WIDTH, HEIGHT)
    walls = geometry.get("collision", geometry["walls"]) if geometry else WALLS
    next_x = min(max(x + travel_x, 32), width - 32)
    if not blocked(next_x, y, walls):
        x = next_x
    else:
        vx = 0.0
    next_y = min(max(y + travel_y, 32), height - 32)
    if not blocked(x, next_y, walls):
        y = next_y
    else:
        vy = 0.0
    return x, y, vx, vy
