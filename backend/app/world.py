"""Public facility geometry. The server supplies the same walls to every client."""

import math

WIDTH, HEIGHT = 2048, 1940
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
    {"name": "Records Annex", "x": 64, "y": 1450, "w": 440, "h": 410, "tint": 0x675d47},
    {"name": "Break Room", "x": 544, "y": 1450, "w": 440, "h": 410, "tint": 0x566e60},
    {"name": "Service Tunnel", "x": 1024, "y": 1450, "w": 440, "h": 410, "tint": 0x405665},
    {"name": "Glasshouse", "x": 1504, "y": 1450, "w": 480, "h": 410, "tint": 0x526d55},
]

# Center x/y, width, height. Doorways are real gaps in these segments.
WALLS = [(1024, 48, 1960, 18), (1024, 1900, 1960, 18),
         (40, 974, 18, 1870), (2008, 974, 18, 1870),
         (490, 1350, 900, 18), (1520, 1350, 976, 18)]
for y in (486, 878):
    WALLS.extend((x, y, width, 16) for x, width in
                 ((250, 420), (575, 130), (850, 280), (1172, 286),
                  (1515, 210), (1830, 310)))
for x in (632, 1392):
    WALLS.extend((x, y, 16, height) for y, height in
                 ((205, 250), (420, 100), (605, 180), (820, 100)))
for x in (382, 718, 1054, 1450):
    WALLS.extend(((x, 980, 16, 165), (x, 1245, 16, 165)))
for x in (524, 1004, 1484):
    WALLS.append((x, 1660, 16, 420))
for x, width in ((64, 440), (544, 440), (1024, 440), (1504, 480)):
    half = (width - 100) / 2
    WALLS.extend(((x + half / 2, 1430, half, 16), (x + width - half / 2, 1430, half, 16)))


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
    vx += (dx / length * SPEED - vx) * blend
    vy += (dy / length * SPEED - vy) * blend
    if abs(vx) < 0.1:
        vx = 0.0
    if abs(vy) < 0.1:
        vy = 0.0
    width, height = (geometry["width"], geometry["height"]) if geometry else (WIDTH, HEIGHT)
    walls = geometry["walls"] if geometry else WALLS
    next_x = min(max(x + vx * dt, 32), width - 32)
    if not blocked(next_x, y, walls):
        x = next_x
    else:
        vx = 0.0
    next_y = min(max(y + vy * dt, 32), height - 32)
    if not blocked(x, next_y, walls):
        y = next_y
    else:
        vy = 0.0
    return x, y, vx, vy
