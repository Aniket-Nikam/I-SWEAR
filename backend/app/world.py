"""Public facility geometry. The server supplies the same walls to every client."""

import math

WIDTH, HEIGHT = 2048, 1400
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

# Center x/y, width, height. Doorways are real gaps in these segments.
WALLS = [(1024, 48, 1960, 18), (1024, 1350, 1960, 18),
         (40, 699, 18, 1320), (2008, 699, 18, 1320)]
for y in (486, 878):
    WALLS.extend((x, y, width, 16) for x, width in
                 ((250, 420), (575, 130), (850, 280), (1172, 286),
                  (1515, 210), (1830, 310)))
for x in (632, 1392):
    WALLS.extend((x, y, 16, height) for y, height in
                 ((205, 250), (420, 100), (605, 180), (820, 100)))
for x in (382, 718, 1054, 1450):
    WALLS.extend(((x, 980, 16, 165), (x, 1245, 16, 165)))


def blocked(x: float, y: float) -> bool:
    return any(abs(x - wx) < width / 2 + RADIUS and
               abs(y - wy) < height / 2 + RADIUS
               for wx, wy, width, height in WALLS)


def integrate(x: float, y: float, vx: float, vy: float, dx: float, dy: float,
              dt: float) -> tuple[float, float, float, float]:
    """Acceleration, normalized diagonals, and axis-separated wall sliding."""
    length = max(1.0, math.hypot(dx, dy))
    blend = 1 - math.exp(-dt / 0.065)
    vx += (dx / length * SPEED - vx) * blend
    vy += (dy / length * SPEED - vy) * blend
    if abs(vx) < 0.1:
        vx = 0.0
    if abs(vy) < 0.1:
        vy = 0.0
    next_x = min(max(x + vx * dt, 32), WIDTH - 32)
    if not blocked(next_x, y):
        x = next_x
    else:
        vx = 0.0
    next_y = min(max(y + vy * dt, 32), HEIGHT - 32)
    if not blocked(x, next_y):
        y = next_y
    else:
        vy = 0.0
    return x, y, vx, vy
