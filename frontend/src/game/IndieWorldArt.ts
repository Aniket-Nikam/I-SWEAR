import type Phaser from "phaser";
import type { RoomSnapshot } from "../types/protocol";

/** The compatibility canvas uses the same physical layout as the 3D scene. */
export function drawPhysicalFacility(scene:Phaser.Scene,world:RoomSnapshot["world"]) {
  const g=scene.add.graphics().setDepth(0);g.fillStyle(0x334a49).fillRect(0,0,world.width,world.height);
  for(const r of world.rooms){
    g.fillStyle(/Break|Archive|Records/.test(r.name)?0x9b8464:0x758577).fillRect(r.x,r.y,r.w,r.h);
    g.lineStyle(1,0x152c33,.15);for(let x=r.x+64;x<r.x+r.w;x+=64)g.lineBetween(x,r.y,x,r.y+r.h);for(let y=r.y+64;y<r.y+r.h;y+=64)g.lineBetween(r.x,y,r.x+r.w,y);
    scene.add.text(r.x+r.w/2,r.y+r.h*.72,r.name.toUpperCase(),{fontFamily:'Space Grotesk',fontSize:'18px',color:'#f2e4c8'}).setOrigin(.5).setAlpha(.65);
  }
  for(const f of world.furniture??[]){g.fillStyle(f.kind==='plant'?0x819574:0xb78d60).fillRoundedRect(f.x-f.w/2,f.y-f.d/2,f.w,f.d,3);g.lineStyle(3,0x152c33).strokeRoundedRect(f.x-f.w/2,f.y-f.d/2,f.w,f.d,3);}
  for(const [x,y,w,h]of world.walls){g.fillStyle(0x45605f).fillRect(x-w/2,y-h/2,w,h);g.lineStyle(3,0x152c33).strokeRect(x-w/2,y-h/2,w,h);}
  for(const d of world.doors??[]){g.fillStyle(0xc5b28d).fillRect(d.x-(d.axis==='x'?d.width/2:12),d.y-(d.axis==='x'?12:d.width/2),d.axis==='x'?d.width:24,d.axis==='x'?24:d.width);}
}

interface RoomGeometry { name: string; x: number; y: number; w: number; h: number; tint: number }
type WallGeometry = readonly [number, number, number, number];
type Graphics = Phaser.GameObjects.Graphics;

const C = {
  ink: 0x101d27, paper: 0xf2e4c8, coral: 0xef805f, straw: 0xecc574,
  sage: 0xb2ceba, storm: 0x405665, glass: 0x87aaa4, steel: 0x718b89,
  wood: 0x745b45, woodLight: 0x96806a, shadow: 0x0c1921,
};

function polygon(g: Graphics, points: number[][], color: number, outline = C.ink, width = 3, alpha = 1) {
  const vertices = points.map(([x, y]) => ({ x, y }));
  g.fillStyle(color, alpha).fillPoints(vertices, true);
  if (width) g.lineStyle(width, outline, alpha).strokePoints(vertices, true);
}

function block(g: Graphics, x: number, y: number, w: number, h: number, color: number, radius = 2) {
  g.fillStyle(C.shadow, 0.35).fillRoundedRect(x + 7, y + 9, w, h, radius);
  g.fillStyle(color).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, C.ink).strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, C.paper, 0.2).lineBetween(x + 4, y + 4, x + w - 4, y + 4);
}

function paper(g: Graphics, x: number, y: number, w = 18, h = 24, angle = 0) {
  polygon(g, [[x, y], [x + w, y + angle], [x + w - angle, y + h], [x - angle, y + h - angle]], C.paper, C.ink, 1.5);
  g.lineStyle(1.5, C.storm, 0.6);
  for (let line = 6; line < h - 3; line += 5) g.lineBetween(x + 4, y + line, x + w - 5, y + line + angle / 2);
}

function pool(g: Graphics, x: number, y: number, w: number, h: number, color = C.straw) {
  for (let layer = 5; layer > 0; layer--) {
    g.fillStyle(color, 0.018 + (5 - layer) * 0.009).fillEllipse(x, y, w * layer / 5, h * layer / 5);
  }
}

function bench(g: Graphics, x: number, y: number, width: number, color = C.steel) {
  block(g, x, y, width, 40, color, 3);
  g.fillStyle(C.ink).fillRect(x + 7, y + 35, 8, 11).fillRect(x + width - 15, y + 35, 8, 11);
  g.lineStyle(2, C.ink, 0.4).lineBetween(x + 10, y + 24, x + width - 10, y + 24);
}

function equipment(g: Graphics, x: number, y: number, width: number) {
  bench(g, x, y, width, 0x8d9b87);
  for (let index = 0; index < Math.floor(width / 70); index++) {
    const px = x + 14 + index * 70;
    block(g, px, y + 6, 35, 24, C.storm);
    g.fillStyle(C.ink).fillRect(px + 5, y + 4, 25, 14);
    g.lineStyle(2, C.sage).lineBetween(px + 10, y + 13, px + 16, y + 8).lineBetween(px + 16, y + 8, px + 24, y + 11);
    g.fillStyle(C.coral).fillCircle(px + 27, y + 22, 2);
    g.lineStyle(2, C.ink).beginPath().moveTo(px + 36, y + 12).lineTo(px + 48, y + 14).lineTo(px + 49, y + 35).strokePath();
  }
}

function chair(g: Graphics, x: number, y: number, color = C.coral) {
  g.fillStyle(C.shadow, 0.4).fillEllipse(x + 3, y + 11, 34, 19);
  g.lineStyle(4, C.ink).lineBetween(x, y + 8, x, y + 20).lineBetween(x - 12, y + 20, x + 12, y + 20);
  block(g, x - 14, y - 8, 28, 23, color, 5);
  g.fillStyle(C.ink).fillRoundedRect(x - 16, y - 13, 32, 8, 3);
}

function plant(g: Graphics, x: number, y: number) {
  g.fillStyle(C.shadow, 0.35).fillEllipse(x + 5, y + 12, 47, 18);
  polygon(g, [[x - 15, y - 3], [x + 15, y - 3], [x + 11, y + 20], [x - 9, y + 20]], 0xac7153);
  g.fillStyle(C.ink).fillEllipse(x, y - 2, 32, 12);
  for (const [dx, dy, width, height] of [[-11, -18, 15, 35], [10, -22, 17, 43], [-1, -32, 14, 48], [19, -9, 19, 26]]) {
    g.fillStyle(0x6c8d6a).fillEllipse(x + dx, y + dy, width, height);
    g.lineStyle(2, C.ink).strokeEllipse(x + dx, y + dy, width, height);
  }
  g.lineStyle(2, C.sage, 0.7).lineBetween(x - 1, y - 48, x, y - 7);
}

function board(g: Graphics, x: number, y: number, w: number, h: number) {
  block(g, x, y, w, h, 0x785d46);
  g.fillStyle(0xb3996c).fillRect(x + 7, y + 7, w - 14, h - 14);
  paper(g, x + 15, y + 14, 24, 30, 2); paper(g, x + 49, y + 23, 29, 23, -2);
  if (w > 110) paper(g, x + 90, y + 12, 23, 33, 2);
  g.lineStyle(2, C.coral).lineBetween(x + 24, y + 19, x + 66, y + 31);
  g.fillStyle(C.coral).fillCircle(x + 24, y + 19, 3).fillCircle(x + 66, y + 31, 3);
}

function arrow(g: Graphics, x: number, y: number, direction: 1 | -1 = 1, color = C.paper) {
  polygon(g, [[x - direction * 24, y - 6], [x + direction * 5, y - 6], [x + direction * 5, y - 15], [x + direction * 27, y], [x + direction * 5, y + 15], [x + direction * 5, y + 6], [x - direction * 24, y + 6]], color, color, 0, 0.38);
}

/** Authored, static level rendering. Collision still belongs to the server geometry. */
export function drawIndieFacility(scene: Phaser.Scene, rooms: readonly RoomGeometry[], walls: readonly WallGeometry[]) {
  const floor = scene.add.graphics().setDepth(0);
  const props = scene.add.graphics().setDepth(3);
  const lighting = scene.add.graphics().setDepth(5);
  const masonry = scene.add.graphics().setDepth(7);
  const southExtent = Math.max(0, ...rooms.map((room) => room.y + room.h));
  const canvasHeight = southExtent > 1400 ? southExtent + 80 : 1400;
  const canvasWidth = Math.max(2048, ...rooms.map((room) => room.x + room.w + 64));
  floor.fillStyle(C.ink).fillRect(0, 0, canvasWidth, canvasHeight);
  if (southExtent > 1400) {
    floor.fillStyle(0x425b60).fillRect(60, 1361, 1928, 80);
    floor.lineStyle(2, C.ink, 0.22).lineBetween(60, 1381, 1988, 1381).lineBetween(60, 1421, 1988, 1421);
    for (let x = 95; x < 1950; x += 96) floor.lineStyle(2, C.paper, 0.12).lineBetween(x, 1365, x, 1373).lineBetween(x, 1429, x, 1436);
  }

  const zones: Record<string, [number, number, number]> = {
    "Lab A": [0x65786a, 0x6b7d6e, C.sage], "Lab B": [0x46616b, 0x4c6872, C.paper],
    "Lab C": [0x796e56, 0x81775e, C.straw], "Main Hall": [0x555f56, 0x5c665b, C.paper],
    "Central Atrium": [0x697261, 0x6d7765, C.straw], "Emergency Exit": [0x655c52, 0x6c6256, C.coral],
    "Storage": [0x626e5f, 0x687566, C.sage], "Security Office": [0x5c665e, 0x657066, C.coral],
    "CCTV Room": [0x3f5960, 0x455f65, C.sage], "Server Room": [0x3f5661, 0x455e68, C.sage],
    "Archive Room": [0x745f48, 0x7b664e, C.straw],
    "Records Annex": [0x78664f, 0x807057, C.straw], "Break Room": [0x7c7961, 0x848168, C.coral],
    "Service Tunnel": [0x405967, 0x47606d, C.straw], "Glasshouse": [0x4b6954, 0x53735c, C.sage],
  };
  const text = (x: number, y: number, content: string, size = 16, color = "#f2e4c8", alpha = 0.7) => {
    return scene.add.text(x, y, content, { fontFamily: '"Barlow Condensed", Bahnschrift, "Arial Narrow", sans-serif', fontSize: `${size}px`, fontStyle: "bold", color, letterSpacing: 1.6 }).setAlpha(alpha).setDepth(2);
  };

  rooms.forEach((room, index) => {
    const [base, alternate, accent] = zones[room.name] ?? [0x50636a, 0x566970, C.paper];
    floor.fillStyle(C.shadow).fillRect(room.x - 8, room.y - 8, room.w + 16, room.h + 16);
    floor.fillStyle(base).fillRect(room.x, room.y, room.w, room.h);
    if (room.name === "Archive Room" || room.name === "Main Hall" || room.name === "Records Annex") {
      for (let y = room.y; y < room.y + room.h; y += 25) {
        floor.fillStyle(Math.floor(y / 25) % 2 ? alternate : base).fillRect(room.x, y, room.w, Math.min(25, room.y + room.h - y));
        floor.lineStyle(2, C.ink, 0.2).lineBetween(room.x, y, room.x + room.w, y);
        for (let x = room.x + (Math.floor(y / 25) % 3) * 56; x < room.x + room.w; x += 166) {
          floor.lineStyle(1, C.ink, 0.22).lineBetween(x, y, x, y + 25);
          floor.lineStyle(1, C.paper, 0.08).lineBetween(x + 16, y + 9, Math.min(x + 109, room.x + room.w), y + 9);
        }
      }
    } else {
      const tile = room.name === "Central Atrium" ? 80 : 48;
      for (let y = room.y; y < room.y + room.h; y += tile) for (let x = room.x; x < room.x + room.w; x += tile) {
        const w = Math.min(tile - 1, room.x + room.w - x), h = Math.min(tile - 1, room.y + room.h - y);
        const parity = (Math.floor((x - room.x) / tile) + Math.floor((y - room.y) / tile)) % 2;
        floor.fillStyle(parity ? alternate : base).fillRect(x, y, w, h);
        floor.lineStyle(1, C.ink, 0.18).lineBetween(x, y, x + w, y).lineBetween(x, y, x, y + h);
        if ((x + y + index * 7) % 5 === 0) floor.lineStyle(1, C.paper, 0.12).lineBetween(x + 7, y + 12, x + 19, y + 10);
      }
    }
    floor.lineStyle(3, C.ink, 0.3).strokeRect(room.x + 7, room.y + 7, room.w - 14, room.h - 14);
    floor.fillStyle(accent, 0.65).fillRect(room.x + 20, room.y + 21, 6, 30);
    text(room.x + 38, room.y + 19, room.name.toUpperCase(), room.w < 400 ? 20 : 25, "#f2e4c8", 0.8).setAngle(-0.7);
    const subtitles: Record<string, string> = { "Lab A": "NEURAL RESPONSE", "Lab B": "PERCEPTION STUDIES", "Lab C": "OPTICAL RESEARCH", "Main Hall": "NIGHT ACCESS", "Central Atrium": "ORPHEUS INSTITUTE", "Archive Room": "PLEASE RETURN THE FILES", "Records Annex": "UNSORTED / KEEP DRY", "Break Room": "PLEASE WASH YOUR MUG", "Service Tunnel": "KEEP THE AISLE CLEAR", "Glasshouse": "AFTER-HOURS BOTANY" };
    if (subtitles[room.name]) text(room.x + 39, room.y + 51, subtitles[room.name], 10, "#101d27", 0.65);
    for (let mark = 0; mark < Math.floor(room.w / 72); mark++) {
      const x = room.x + 20 + ((mark * 137 + index * 29) % (room.w - 45));
      const y = room.y + 90 + ((mark * 83 + index * 17) % (room.h - 115));
      floor.lineStyle(1, C.ink, 0.16).lineBetween(x, y, x + 8, y + 3).lineBetween(x + 13, y + 5, x + 18, y + 4);
    }
  });

  // These are floor inlays and threshold paint, never furniture over the main routes.
  polygon(floor, [[767, 687], [1004, 538], [1264, 685], [1010, 837]], 0x526254, C.ink, 4, 0.6);
  floor.lineStyle(3, C.straw, 0.5).strokeCircle(1010, 686, 119);
  floor.lineStyle(2, C.paper, 0.2).strokeCircle(1010, 686, 99);
  floor.lineStyle(2, C.straw, 0.4).lineBetween(964, 686, 1057, 686).lineBetween(1010, 641, 1010, 732);
  floor.fillStyle(C.straw, 0.45).fillCircle(1010, 686, 8);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const x = 1010 + Math.cos(angle) * 135, y = 686 + Math.sin(angle) * 135;
    floor.lineStyle(3, C.straw, 0.38).lineBetween(x, y, x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
  }
  text(908, 811, "TRUST THE RECORDS.", 14, "#ecc574", 0.5).setAngle(-1);
  floor.fillStyle(C.straw, 0.18).fillRoundedRect(786, 620, 76, 88, 5);
  floor.lineStyle(3, C.ink, 0.4).strokeRoundedRect(786, 620, 76, 88, 5);
  floor.lineStyle(2, C.paper, 0.3).lineBetween(793, 698, 853, 698);
  for (const y of [486, 878]) for (const x of [485, 1009, 1360, 1650]) {
    floor.fillStyle(C.paper, 0.17).fillRect(x - 21, y - 18, 42, 36);
    floor.lineStyle(3, C.straw, 0.6).lineBetween(x - 19, y + 9, x + 19, y + 9);
  }
  arrow(floor, 555, 721); arrow(floor, 1505, 721); arrow(floor, 1730, 721);
  floor.lineStyle(3, C.paper, 0.35).strokeRect(1800, 603, 145, 213);
  floor.fillStyle(C.coral, 0.23).fillRect(1888, 614, 50, 190);
  for (let y = 620; y < 798; y += 22) polygon(floor, [[1939, y], [1958, y - 7], [1958, y + 3], [1939, y + 10]], C.straw, C.straw, 0, 0.45);
  text(1780, 827, "EMERGENCY / TEST ONLY", 10, "#ecc574", 0.7);

  // Laboratory silhouettes are pushed to the room edges. The central experiments stay readable.
  equipment(props, 119, 164, 276); equipment(props, 175, 373, 202);
  plant(props, 561, 143); block(props, 490, 354, 55, 73, C.storm);
  props.fillStyle(C.paper).fillRect(499, 365, 36, 12); props.lineStyle(3, C.ink).lineBetween(504, 386, 529, 386);
  props.fillStyle(C.sage, 0.15).fillCircle(322, 278, 78);
  floor.lineStyle(3, C.sage, 0.4).strokeCircle(322, 278, 76);
  for (let x = 277; x <= 367; x += 30) floor.lineStyle(3, C.ink, 0.4).lineBetween(x, 343, x + 11, 352);
  text(194, 314, "SEALED / DO NOT OPEN", 11, "#f2e4c8", 0.5);

  equipment(props, 736, 158, 250); equipment(props, 1138, 365, 170);
  floor.lineStyle(4, C.straw, 0.5).strokeRoundedRect(893, 226, 195, 113, 7);
  for (let x = 899; x < 1084; x += 16) floor.lineStyle(3, C.ink, 0.35).lineBetween(x, 225, x + 7, 217);
  props.lineStyle(2, C.sage, 0.6).beginPath().moveTo(1006, 179).lineTo(1057, 179).lineTo(1057, 238).lineTo(1038, 250).strokePath();
  board(props, 1192, 110, 120, 67); paper(props, 751, 379, 23, 30, 3);
  text(928, 365, "CALIBRATION FLOOR", 11, "#f2e4c8", 0.52);

  equipment(props, 1498, 160, 270); equipment(props, 1734, 374, 180);
  plant(props, 1921, 144); board(props, 1814, 108, 123, 66);
  floor.fillStyle(C.paper, 0.07).fillRect(1606, 237, 124, 91);
  props.lineStyle(3, C.ink).lineBetween(1534, 249, 1580, 249).lineBetween(1580, 249, 1580, 302);
  props.fillStyle(C.coral).fillCircle(1534, 249, 5);
  paper(props, 1557, 346, 21, 29, 3); text(1553, 338, "CAMERA SERVICE", 11, "#f2e4c8", 0.55);

  // The hall is a waiting area, with an old noticeboard rather than a blank room.
  bench(props, 109, 808, 197, 0x9e7259); chair(props, 331, 819, C.coral);
  block(props, 111, 584, 68, 108, C.storm, 4);
  props.fillStyle(C.ink).fillRect(119, 596, 52, 64);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    props.fillStyle([C.coral, C.straw, C.sage][(column + row) % 3]).fillRoundedRect(124 + column * 15, 605 + row * 17, 10, 12, 2);
  }
  props.fillStyle(C.straw).fillRect(131, 670, 27, 5); board(props, 245, 556, 166, 78);
  plant(props, 551, 562); paper(props, 165, 770, 20, 28, -3);
  text(249, 649, "KEEP YOUR BADGE VISIBLE", 10, "#f2e4c8", 0.5);

  bench(props, 689, 540, 128, 0x98795f); bench(props, 1198, 542, 130, 0x98795f);
  plant(props, 701, 810); plant(props, 1301, 805); paper(props, 1273, 668, 18, 24, 3);
  props.lineStyle(3, C.ink, 0.45).beginPath().moveTo(826, 638).lineTo(826, 587).lineTo(875, 587).strokePath();
  props.fillStyle(C.coral).fillRect(873, 579, 10, 14);
  board(props, 1770, 549, 132, 55);
  block(props, 1945, 603, 20, 194, C.coral, 2);
  props.fillStyle(C.straw).fillRect(1950, 615, 9, 16);

  // South-wing doorways and the common y=1110 route remain free of tall fixtures.
  for (let x = 104; x <= 260; x += 52) {
    block(props, x, 948, 39, 65, 0x899783);
    props.lineStyle(2, C.ink).lineBetween(x + 7, 961, x + 31, 961).lineBetween(x + 7, 966, x + 31, 966);
    props.fillStyle(C.paper).fillRect(x + 9, 975, 18, 8); props.fillStyle(C.ink).fillRect(x + 29, 988, 3, 13);
  }
  block(props, 105, 1224, 78, 61, C.wood); block(props, 198, 1260, 91, 40, C.woodLight);
  props.lineStyle(3, C.ink, 0.4).lineBetween(111, 1229, 176, 1278).lineBetween(176, 1229, 111, 1278);
  paper(props, 286, 1183, 17, 25, -2);

  equipment(props, 542, 951, 121); chair(props, 588, 1257, C.coral);
  board(props, 425, 1190, 110, 64); block(props, 428, 1281, 94, 25, 0x8c9e8b);
  floor.lineStyle(2, C.straw, 0.18).strokeRect(540, 1020, 125, 80);

  for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
    const x = 778 + column * 69, y = 947 + row * 50;
    block(props, x, y, 57, 40, C.steel);
    props.fillStyle(column === 2 && row === 0 ? 0x5d3c39 : C.ink).fillRect(x + 5, y + 5, 47, 27);
    props.lineStyle(2, column === 2 && row === 0 ? C.coral : C.sage, 0.55).lineBetween(x + 10, y + 23, x + 24, y + 13).lineBetween(x + 24, y + 13, x + 43, y + 20);
  }
  equipment(props, 784, 1224, 175); chair(props, 917, 1279, C.sage);
  props.lineStyle(3, C.ink).beginPath().moveTo(796, 1036).lineTo(796, 1062).lineTo(972, 1062).lineTo(972, 1082).strokePath();

  for (const [x, y] of [[1100, 957], [1162, 957], [1100, 1197], [1162, 1197], [1231, 1197]]) {
    block(props, x, y, 45, 103, 0x78938b);
    for (let row = 0; row < 5; row++) {
      props.fillStyle(C.ink).fillRoundedRect(x + 6, y + 8 + row * 18, 33, 13, 2);
      props.fillStyle(row % 3 === 0 ? C.coral : C.sage).fillRect(x + 30, y + 12 + row * 18, 4, 4);
      props.lineStyle(1, C.storm).lineBetween(x + 10, y + 14 + row * 18, x + 23, y + 14 + row * 18);
    }
  }
  props.lineStyle(4, C.coral, 0.5).beginPath().moveTo(1090, 935).lineTo(1090, 1081).lineTo(1266, 1081).lineTo(1266, 966).strokePath();
  props.lineStyle(3, C.sage, 0.4).beginPath().moveTo(1081, 936).lineTo(1081, 1090).lineTo(1311, 1090).strokePath();
  floor.lineStyle(2, C.paper, 0.15).strokeRect(1338, 1020, 85, 81);
  text(1122, 1144, "KEEP AISLE CLEAR", 10, "#b2ceba", 0.48);

  for (const x of [1500, 1573, 1798, 1870]) {
    block(props, x, 947, 58, 69, C.wood);
    for (let row = 0; row < 3; row++) {
      props.fillStyle(row % 2 ? C.sage : C.paper).fillRect(x + 7, 955 + row * 19, 43, 13);
      props.lineStyle(2, C.wood).lineBetween(x + 13, 955 + row * 19, x + 13, 968 + row * 19);
      props.fillStyle(C.ink).fillRect(x + 26, 960 + row * 19, 9, 3);
    }
  }
  bench(props, 1510, 1240, 166, C.woodLight); paper(props, 1554, 1248, 26, 22, 2);
  plant(props, 1924, 1265); block(props, 1770, 1251, 134, 46, C.wood);
  paper(props, 1738, 1162, 18, 25, 2); paper(props, 1753, 1160, 18, 25, -2);

  // The annex is driven by its room rectangles. All four centered doors and
  // the east-west y=1390 service corridor stay free of raised fixtures.
  rooms.filter((room) => room.y >= 1400).forEach((room) => {
    const left = room.x + 25, right = room.x + room.w - 100;
    const top = room.y + 89, bottom = room.y + room.h - 100;
    const cx = room.x + room.w / 2;
    floor.fillStyle(C.paper, 0.15).fillRect(cx - 30, room.y - 29, 60, 35);
    floor.lineStyle(3, C.straw, 0.5).lineBetween(cx - 27, room.y - 10, cx + 27, room.y - 10);
    if (room.name === "Records Annex") {
      for (const x of [left, right]) {
        block(props, x, top, 72, 75, C.wood);
        for (let row = 0; row < 4; row++) {
          props.fillStyle(row % 2 ? C.paper : C.sage).fillRect(x + 7, top + 9 + row * 16, 57, 11);
          props.lineStyle(2, C.ink).lineBetween(x + 25, top + 9 + row * 16, x + 25, top + 20 + row * 16);
          props.fillStyle(C.ink).fillRect(x + 39, top + 12 + row * 16, 14, 3);
        }
      }
      bench(props, left, bottom, 129, C.woodLight);
      paper(props, left + 13, bottom + 8, 24, 25, 2); paper(props, left + 49, bottom + 6, 26, 29, -2);
      block(props, right + 7, bottom + 7, 62, 57, 0x9b8060);
      props.lineStyle(3, C.ink, 0.4).lineBetween(right + 13, bottom + 13, right + 62, bottom + 57).lineBetween(right + 62, bottom + 13, right + 13, bottom + 57);
      pool(lighting, cx, room.y + room.h / 2, room.w * 0.86, room.h * 0.7);
    } else if (room.name === "Break Room") {
      bench(props, left, top - 13, 124, 0xa4b09a);
      props.fillStyle(C.ink).fillRoundedRect(left + 10, top - 6, 37, 24, 4);
      props.lineStyle(2, C.sage).strokeRoundedRect(left + 14, top - 3, 29, 17, 3);
      props.lineStyle(4, C.ink).beginPath().moveTo(left + 29, top - 8).lineTo(left + 29, top - 20).lineTo(left + 43, top - 20).strokePath();
      block(props, left + 69, top - 5, 33, 29, C.storm, 3);
      props.fillStyle(C.coral).fillRect(left + 74, top + 1, 23, 8); props.fillStyle(C.paper).fillRect(left + 80, top + 13, 12, 9);
      block(props, right + 20, top - 18, 55, 87, C.paper, 4);
      props.lineStyle(3, C.ink).lineBetween(right + 22, top + 11, right + 72, top + 11).lineBetween(right + 29, top - 3, right + 29, top + 6).lineBetween(right + 29, top + 28, right + 29, top + 45);
      props.fillStyle(C.coral).fillCircle(right + 56, top - 4, 4); paper(props, right + 40, top + 20, 21, 27, -1);
      bench(props, left, bottom - 2, 116, 0x9d785a); chair(props, left + 28, bottom + 52, C.coral); chair(props, left + 88, bottom + 52, C.sage);
      props.fillStyle(C.paper).fillCircle(left + 34, bottom + 15, 10); props.lineStyle(2, C.ink).strokeCircle(left + 34, bottom + 15, 10);
      props.fillStyle(C.storm).fillCircle(left + 79, bottom + 16, 6); plant(props, right + 52, bottom + 27);
    } else if (room.name === "Service Tunnel") {
      props.lineStyle(11, C.ink).beginPath().moveTo(left, top - 12).lineTo(left, top + 73).lineTo(left + 100, top + 73).strokePath();
      props.lineStyle(6, C.coral).beginPath().moveTo(left, top - 12).lineTo(left, top + 73).lineTo(left + 100, top + 73).strokePath();
      props.lineStyle(8, C.ink).beginPath().moveTo(left + 17, top - 12).lineTo(left + 17, top + 52).lineTo(left + 100, top + 52).strokePath();
      props.lineStyle(4, C.sage).beginPath().moveTo(left + 17, top - 12).lineTo(left + 17, top + 52).lineTo(left + 100, top + 52).strokePath();
      props.lineStyle(5, C.ink).strokeCircle(left, top + 25, 13); props.lineStyle(3, C.straw).strokeCircle(left, top + 25, 10);
      props.lineStyle(3, C.ink).lineBetween(left - 8, top + 17, left + 8, top + 33).lineBetween(left + 8, top + 17, left - 8, top + 33);
      block(props, right, bottom - 8, 73, 68, C.steel);
      for (let y = bottom + 2; y < bottom + 51; y += 8) props.lineStyle(3, C.ink).lineBetween(right + 10, y, right + 62, y);
      floor.lineStyle(2, C.straw, 0.22).strokeRect(room.x + room.w * 0.39, room.y + 12, room.w * 0.22, room.h - 24);
      arrow(floor, cx, room.y + room.h / 2, 1, C.straw);
    } else if (room.name === "Glasshouse") {
      for (const [x, y] of [[left, top], [right - 23, top], [left, bottom], [right - 23, bottom]]) {
        block(props, x, y, 95, 42, C.wood);
        props.fillStyle(C.ink).fillRect(x + 6, y + 6, 83, 28);
        for (let leaf = 0; leaf < 3; leaf++) {
          const px = x + 21 + leaf * 26;
          props.fillStyle(0x8eac73).fillEllipse(px - 4, y + 6, 17, 31).fillEllipse(px + 6, y + 4, 18, 37);
          props.lineStyle(2, C.ink).strokeEllipse(px - 4, y + 6, 17, 31).strokeEllipse(px + 6, y + 4, 18, 37);
          props.lineStyle(2, C.sage).lineBetween(px + 3, y - 7, px + 3, y + 16);
        }
      }
      floor.lineStyle(2, C.sage, 0.12).strokeRect(room.x + 17, room.y + 15, room.w - 34, room.h - 30);
      for (let pane = 0; pane < 4; pane++) {
        const x = room.x + 35 + pane * (room.w - 70) / 4;
        floor.lineStyle(2, C.paper, 0.1).lineBetween(x, room.y + 17, Math.min(x + 88, room.x + room.w - 17), room.y + room.h - 17);
      }
      pool(lighting, cx, room.y + room.h / 2, room.w * 0.95, room.h * 0.78, C.sage);
    }
  });

  // Lighting is static, broad and warm; fixtures have visible physical housings.
  for (const [x, y, w] of [[188, 105, 164], [790, 105, 230], [1532, 105, 225], [747, 840, 104], [1751, 840, 129]]) {
    pool(lighting, x + w / 2, y + 55, w + 110, 142);
    block(props, x - 4, y - 4, w + 8, 14, C.ink);
    props.fillStyle(C.straw).fillRoundedRect(x, y, w, 5, 2);
  }
  pool(lighting, 1010, 681, 620, 430); pool(lighting, 1715, 1094, 330, 250);
  pool(lighting, 323, 283, 260, 220, C.sage); pool(lighting, 1251, 1100, 310, 340, C.sage);

  walls.forEach(([x, y, w, h]) => {
    const horizontal = w > h, left = x - w / 2, top = y - h / 2;
    masonry.fillStyle(C.shadow, 0.5).fillRect(left + 10, top + 12, w + 4, h + 12);
    masonry.fillStyle(0x3b5059).fillRect(left, top - 5, w, h + 13);
    masonry.lineStyle(3, C.ink).strokeRect(left, top - 5, w, h + 13);
    masonry.fillStyle(0x8a9c8e).fillRect(left, top - 12, w, horizontal ? 12 : h + 7);
    masonry.lineStyle(3, C.ink).strokeRect(left, top - 12, w, horizontal ? 12 : h + 7);
    if (horizontal) {
      masonry.lineStyle(2, C.paper, 0.3).lineBetween(left + 3, top - 9, left + w - 3, top - 9);
      for (let notch = left + 95; notch < left + w - 10; notch += 140) masonry.lineStyle(2, C.ink, 0.45).lineBetween(notch, top - 12, notch, top - 1);
    } else {
      masonry.fillStyle(0x536c70).fillRect(left + w - 4, top - 8, 4, h + 8);
      masonry.lineStyle(2, C.paper, 0.25).lineBetween(left + 3, top - 8, left + 3, top + h - 5);
    }
  });
}

/** The same chunky object drawings feed world markers and generated inspection closeups. */
export function drawIndieObject(g: Graphics, kind: string) {
  g.fillStyle(C.shadow, 0.45).fillEllipse(4, 26, 65, 21);
  if (kind === "badge_scanner") {
    block(g, -20, -34, 40, 64, C.sage, 5);
    g.fillStyle(C.ink).fillRoundedRect(-14, -24, 28, 22, 2);
    g.fillStyle(C.coral).fillRect(-10, -19, 20, 8);
    g.fillStyle(C.paper).fillRect(-8, -17, 10, 3);
    g.fillStyle(C.ink).fillRoundedRect(-11, 8, 22, 6, 2);
    g.lineStyle(2, C.storm).lineBetween(-12, 22, -5, 22).lineBetween(4, 22, 12, 22);
    g.fillStyle(C.straw).fillCircle(12, -29, 3);
  } else if (kind === "experiment_chamber") {
    g.fillStyle(C.steel).fillEllipse(0, 11, 77, 61);
    g.lineStyle(4, C.ink).strokeEllipse(0, 11, 77, 61);
    g.fillStyle(C.ink).fillEllipse(0, -3, 70, 60);
    g.fillStyle(0x628880).fillEllipse(0, -5, 56, 49);
    g.lineStyle(3, C.sage).strokeEllipse(0, -5, 56, 49);
    polygon(g, [[-13, -5], [-4, -15], [12, -10], [15, 5], [3, 13], [-12, 6]], C.straw, C.ink, 2);
    g.lineStyle(2, C.paper, 0.7).beginPath().moveTo(-20, 2).lineTo(-23, -9).lineTo(-17, -19).strokePath();
    g.fillStyle(C.coral).fillRoundedRect(-24, 25, 13, 6, 2); g.fillStyle(C.sage).fillRoundedRect(11, 25, 13, 6, 2);
  } else if (kind === "notebook") {
    polygon(g, [[-31, -18], [-2, -23], [1, -18], [27, -23], [33, 20], [4, 26], [-2, 22], [-27, 26]], C.coral, C.ink, 3);
    polygon(g, [[-27, -17], [-3, -21], [0, -17], [24, -21], [28, 17], [3, 22], [-2, 19], [-24, 22]], C.paper, C.ink, 2);
    g.lineStyle(2, C.wood).lineBetween(-2, -16, 1, 19);
    for (let y = -10; y < 14; y += 6) g.lineStyle(1.5, C.storm, 0.6).lineBetween(-22, y + 2, -7, y).lineBetween(6, y, 21, y - 3);
    g.lineStyle(4, C.straw).lineBetween(31, -18, 36, 13);
    g.lineStyle(2, C.ink).lineBetween(35, 13, 37, 21);
    polygon(g, [[9, 18], [15, 17], [16, 32], [12, 28], [9, 33]], C.coral, C.ink, 1);
  } else if (kind === "broken_glass") {
    for (const [x, y, size] of [[-22, -8, 17], [3, -22, 14], [20, 0, 16], [-1, 8, 20], [-30, 20, 9], [21, 23, 7]]) {
      polygon(g, [[x, y], [x + size, y - 5], [x + size * 0.65, y + size]], C.glass, C.ink, 2);
      g.lineStyle(1.5, C.paper, 0.7).lineBetween(x + 3, y + 2, x + size - 3, y - 1);
    }
  } else if (kind === "id_card") {
    g.lineStyle(3, C.ink).beginPath().moveTo(-3, -24).lineTo(-14, -35).lineTo(-4, -42).lineTo(11, -30).lineTo(5, -23).strokePath();
    polygon(g, [[-21, -24], [17, -28], [24, 27], [-16, 31]], C.paper, C.ink, 3);
    polygon(g, [[-21, -24], [17, -28], [19, -17], [-19, -13]], C.coral, C.ink, 2);
    g.fillStyle(C.sage).fillRect(-12, -9, 19, 20); g.fillStyle(C.ink).fillCircle(-3, -4, 5).fillEllipse(-3, 8, 15, 10);
    g.lineStyle(2, C.storm).lineBetween(-10, 18, 15, 15).lineBetween(-9, 23, 7, 21);
  } else if (kind === "footprints") {
    for (let step = 0; step < 5; step++) {
      const x = (step % 2 ? 10 : -9) + step * 4 - 8, y = step * 12 - 25;
      g.fillStyle(C.ink, 0.4).fillEllipse(x, y, 9, 15).fillEllipse(x + 1, y + 10, 7, 5);
      g.lineStyle(1.5, C.straw, 0.35).lineBetween(x - 2, y - 4, x + 3, y - 3);
    }
  } else if (kind === "locker") {
    block(g, -25, -34, 50, 66, 0x92a38d, 3);
    g.lineStyle(2, C.ink).strokeRect(-19, -28, 38, 53);
    for (let y = -22; y < -11; y += 4) g.lineStyle(2, C.storm).lineBetween(-12, y, 11, y);
    g.fillStyle(C.paper).fillRect(-10, -4, 21, 10); g.fillStyle(C.ink).fillRect(10, 10, 4, 12);
    g.fillStyle(C.straw).fillRect(-6, -1, 13, 4);
    g.lineStyle(3, C.ink).lineBetween(-19, 33, -19, 37).lineBetween(18, 33, 18, 37);
  } else if (kind === "storage_cabinet") {
    block(g, -30, -30, 60, 60, C.woodLight, 2);
    for (let y = -22; y <= 13; y += 18) {
      g.fillStyle(C.wood).fillRect(-24, y, 48, 14); g.lineStyle(2, C.ink).strokeRect(-24, y, 48, 14);
      g.fillStyle(C.paper).fillRect(-10, y + 3, 20, 7); g.lineStyle(2, C.ink).lineBetween(-6, y + 11, 7, y + 11);
    }
    paper(g, -18, -39, 25, 14, 2);
  } else if (kind === "power_panel") {
    block(g, -27, -34, 54, 68, C.steel, 3);
    g.fillStyle(C.ink).fillRoundedRect(-21, -26, 42, 46, 2);
    g.fillStyle(C.straw).fillRect(-15, -20, 10, 9); g.fillStyle(C.coral).fillRect(6, -20, 9, 9);
    g.lineStyle(4, C.storm).lineBetween(-14, -3, 13, -3).lineBetween(-14, 10, 13, 10);
    g.fillStyle(C.coral).fillRoundedRect(-3, -7, 10, 22, 2); g.lineStyle(2, C.ink).strokeRoundedRect(-3, -7, 10, 22, 2);
    g.fillStyle(C.sage).fillCircle(16, 27, 3); g.lineStyle(2, C.ink).lineBetween(-16, 27, -5, 27);
  } else if (kind === "cctv_terminal") {
    block(g, -36, -27, 72, 52, C.steel, 4);
    for (let index = 0; index < 3; index++) {
      g.fillStyle(C.ink).fillRect(-30 + index * 21, -20, 18, 26);
      g.lineStyle(2, index === 1 ? C.coral : C.sage).lineBetween(-27 + index * 21, -7, -19 + index * 21, -13);
    }
    g.fillStyle(C.paper).fillRect(-24, 14, 42, 5); g.fillStyle(C.coral).fillCircle(26, 16, 3);
  } else if (kind === "emergency_console") {
    block(g, -29, -29, 58, 58, C.coral, 4);
    g.fillStyle(C.ink).fillRect(-22, -22, 44, 23); g.fillStyle(C.straw).fillRect(-16, -16, 32, 10);
    g.lineStyle(6, C.ink).lineBetween(-17, 13, 17, 13); g.lineStyle(3, C.paper).lineBetween(-15, 11, 15, 11);
    g.lineStyle(3, C.ink).lineBetween(-18, 9, -18, 21).lineBetween(18, 9, 18, 21);
  } else {
    block(g, -34, -26, 68, 51, C.sage, 4);
    g.fillStyle(C.ink).fillRoundedRect(-27, -19, 54, 27, 2);
    g.lineStyle(2, C.sage).beginPath().moveTo(-21, -5).lineTo(-12, -5).lineTo(-7, -12).lineTo(0, 1).lineTo(6, -6).lineTo(20, -6).strokePath();
    for (let y = 15; y < 23; y += 5) g.lineStyle(2, C.storm).lineBetween(-22, y, 14, y);
    g.fillStyle(C.coral).fillCircle(24, 17, 3);
    paper(g, -22, 26, 35, 15, -2);
  }
}
