import type Phaser from "phaser";

interface RoomGeometry { name: string; x: number; y: number; w: number; h: number; tint: number }
type WallGeometry = readonly [number, number, number, number];
type Graphics = Phaser.GameObjects.Graphics;
type Theme = "observatory" | "ferry";

const C = {
  ink: 0x101d27, paper: 0xf2e4c8, coral: 0xef805f, straw: 0xecc574,
  sage: 0xb2ceba, storm: 0x405665, glass: 0x7baca6, shadow: 0x0c1921,
  wood: 0x745b45, steel: 0x718b89,
};

function polygon(g: Graphics, points: number[][], color: number, outline = C.ink, line = 3, alpha = 1) {
  const vertices = points.map(([x, y]) => ({ x, y }));
  g.fillStyle(color, alpha).fillPoints(vertices, true);
  if (line) g.lineStyle(line, outline, alpha).strokePoints(vertices, true);
}

function box(g: Graphics, x: number, y: number, w: number, h: number, color: number, radius = 2) {
  g.fillStyle(C.shadow, 0.4).fillRoundedRect(x + 6, y + 7, w, h, radius);
  g.fillStyle(color).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, C.ink).strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, C.paper, 0.3).lineBetween(x + 4, y + 4, x + w - 4, y + 4);
}

function paper(g: Graphics, x: number, y: number, w: number, h: number, chart = false) {
  polygon(g, [[x, y + 2], [x + w - 3, y], [x + w, y + h - 2], [x + 2, y + h]], C.paper, C.ink, 1.5);
  if (chart) {
    const points = [[x + w * 0.18, y + h * 0.7], [x + w * 0.37, y + h * 0.3], [x + w * 0.64, y + h * 0.48], [x + w * 0.8, y + h * 0.2]];
    g.lineStyle(1.5, C.storm).strokePoints(points.map(([px, py]) => ({ x: px, y: py })));
    points.forEach(([px, py]) => g.fillStyle(C.coral).fillCircle(px, py, 2));
  } else {
    for (let yLine = y + 6; yLine < y + h - 3; yLine += 5) g.lineStyle(1.5, C.storm, 0.6).lineBetween(x + 5, yLine, x + w - 5, yLine - 1);
  }
}

function cabinet(g: Graphics, x: number, y: number, w: number, h: number, color = 0x8d9e88) {
  box(g, x, y, w, h, color);
  const rows = Math.max(2, Math.floor(h / 16));
  for (let row = 0; row < rows; row++) {
    const top = y + 7 + row * (h - 10) / rows;
    g.lineStyle(2, C.ink).lineBetween(x + 4, top + 10, x + w - 4, top + 10);
    g.fillStyle(C.paper).fillRect(x + w * 0.34, top, w * 0.32, 5);
    g.lineStyle(2, C.ink).lineBetween(x + w * 0.43, top + 7, x + w * 0.59, top + 7);
  }
}

function chartTable(g: Graphics, x: number, y: number, w: number, h: number) {
  box(g, x, y, w, h, 0x92785c);
  paper(g, x + 7, y + 5, w - 15, h - 12, true);
  g.lineStyle(3, C.coral).lineBetween(x + w - 8, y + 5, x + w - 4, y + h - 6);
}

function telescope(g: Graphics, x: number, y: number, size: number) {
  const s = size / 60;
  g.fillStyle(C.shadow, 0.4).fillEllipse(x + 5, y + 22 * s, 65 * s, 23 * s);
  g.lineStyle(4, C.ink).lineBetween(x, y + 2 * s, x - 21 * s, y + 24 * s).lineBetween(x, y + 2 * s, x + 24 * s, y + 18 * s).lineBetween(x, y + 2 * s, x + 4 * s, y + 30 * s);
  g.fillStyle(C.straw).fillCircle(x, y + 4 * s, 9 * s); g.lineStyle(2.5, C.ink).strokeCircle(x, y + 4 * s, 9 * s);
  polygon(g, [[x - 24 * s, y + 2 * s], [x + 20 * s, y - 31 * s], [x + 34 * s, y - 15 * s], [x - 11 * s, y + 16 * s]], C.paper, C.ink, 3);
  polygon(g, [[x + 17 * s, y - 30 * s], [x + 27 * s, y - 36 * s], [x + 42 * s, y - 19 * s], [x + 32 * s, y - 13 * s]], C.sage, C.ink, 3);
  g.lineStyle(3, C.ink).lineBetween(x - 23 * s, y + 8 * s, x - 32 * s, y + 15 * s);
  g.lineStyle(2, C.storm).lineBetween(x - 14 * s, y + 1 * s, x + 20 * s, y - 24 * s);
}

function controlDesk(g: Graphics, x: number, y: number, w: number, h: number, radar = false) {
  box(g, x, y, w, h, 0x80998d);
  g.fillStyle(C.ink).fillRoundedRect(x + 7, y + 6, w - 14, h * 0.57, 2);
  if (radar) {
    const radius = Math.min(w * 0.2, h * 0.23), cx = x + w / 2, cy = y + h * 0.37;
    g.lineStyle(1.5, C.sage, 0.7).strokeCircle(cx, cy, radius).strokeCircle(cx, cy, radius * 0.48);
    g.lineStyle(1.5, C.sage).lineBetween(cx, cy, cx + radius * 0.65, cy - radius * 0.65);
    g.fillStyle(C.straw).fillCircle(cx - radius * 0.48, cy + radius * 0.18, 2);
  } else {
    g.lineStyle(2, C.sage).beginPath().moveTo(x + 12, y + h * 0.43).lineTo(x + w * 0.35, y + h * 0.43).lineTo(x + w * 0.47, y + h * 0.2).lineTo(x + w * 0.61, y + h * 0.5).lineTo(x + w - 11, y + h * 0.34).strokePath();
  }
  g.fillStyle(C.coral).fillCircle(x + w - 11, y + h - 8, 2.5);
  g.lineStyle(2, C.storm).lineBetween(x + 12, y + h - 10, x + w - 23, y + h - 10);
}

function crate(g: Graphics, x: number, y: number, w: number, h: number) {
  box(g, x, y, w, h, 0xa28b66);
  g.lineStyle(3, C.ink, 0.6).strokeRect(x + 5, y + 5, w - 10, h - 10).lineBetween(x + 7, y + 7, x + w - 7, y + h - 7).lineBetween(x + w - 7, y + 7, x + 7, y + h - 7);
  g.fillStyle(C.paper).fillRect(x + w * 0.4, y + h * 0.3, w * 0.31, h * 0.25);
}

function rope(g: Graphics, x: number, y: number, w: number, h: number) {
  for (let index = 0; index < 4; index++) {
    g.lineStyle(4, C.ink).strokeEllipse(x + index * 3, y + index * 2, w - index * 7, h - index * 4);
    g.lineStyle(2, C.straw).strokeEllipse(x + index * 3, y + index * 2, w - index * 7, h - index * 4);
  }
  g.lineStyle(3, C.straw).beginPath().moveTo(x - w / 2 + 5, y).lineTo(x - w / 2 - 6, y + h / 2).lineTo(x - w / 2 + 8, y + h / 2 + 3).strokePath();
}

function lifeRing(g: Graphics, x: number, y: number, radius: number) {
  g.lineStyle(10, C.ink).strokeCircle(x, y, radius);
  g.lineStyle(6, C.paper).strokeCircle(x, y, radius);
  for (let index = 0; index < 4; index++) {
    const a = Math.PI / 4 + index * Math.PI / 2;
    g.lineStyle(7, C.coral).lineBetween(x + Math.cos(a) * (radius - 3), y + Math.sin(a) * (radius - 3), x + Math.cos(a) * (radius + 3), y + Math.sin(a) * (radius + 3));
  }
}

function boiler(g: Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(C.shadow, 0.45).fillEllipse(x + w / 2 + 5, y + h - 2, w + 10, 17);
  box(g, x + 6, y + 4, w - 12, h - 4, 0x8c9b86, 8);
  g.fillStyle(C.sage).fillEllipse(x + w / 2, y + 7, w - 13, 17);
  g.lineStyle(2.5, C.ink).strokeEllipse(x + w / 2, y + 7, w - 13, 17);
  g.fillStyle(C.ink).fillCircle(x + w / 2, y + h * 0.48, 8);
  g.fillStyle(C.straw).fillCircle(x + w / 2, y + h * 0.48, 5);
  g.lineStyle(2, C.ink).lineBetween(x + w / 2, y + h * 0.48, x + w / 2 + 2, y + h * 0.48 - 4);
  g.lineStyle(5, C.ink).beginPath().moveTo(x + w - 5, y + h * 0.35).lineTo(x + w + 6, y + h * 0.35).lineTo(x + w + 6, y + h - 1).strokePath();
}

function boat(g: Graphics, x: number, y: number, w: number, h: number) {
  polygon(g, [[x, y + h * 0.48], [x + w * 0.2, y], [x + w * 0.87, y + h * 0.07], [x + w, y + h * 0.5], [x + w * 0.85, y + h], [x + w * 0.19, y + h]], C.coral);
  polygon(g, [[x + 10, y + h * 0.5], [x + w * 0.25, y + 6], [x + w * 0.8, y + 8], [x + w - 10, y + h * 0.5], [x + w * 0.78, y + h - 5], [x + w * 0.26, y + h - 5]], C.paper, C.ink, 2);
  g.lineStyle(3, C.wood).lineBetween(x + w * 0.36, y + 7, x + w * 0.36, y + h - 5).lineBetween(x + w * 0.64, y + 7, x + w * 0.64, y + h - 5);
}

function bench(g: Graphics, x: number, y: number, w: number, h: number) {
  box(g, x, y, w, h, 0x967558, 3);
  g.lineStyle(3, C.ink).lineBetween(x + 4, y + h * 0.43, x + w - 4, y + h * 0.43);
  g.lineStyle(4, C.ink).lineBetween(x + 8, y + h - 1, x + 8, y + h + 7).lineBetween(x + w - 8, y + h - 1, x + w - 8, y + h + 7);
}

function floorCompass(g: Graphics, x: number, y: number, radius: number, accent: number) {
  g.lineStyle(2, accent, 0.25).strokeCircle(x, y, radius).strokeCircle(x, y, radius * 0.8);
  for (let index = 0; index < 8; index++) {
    const a = index * Math.PI / 4;
    const length = index % 2 ? radius * 0.45 : radius * 0.72;
    polygon(g, [[x + Math.cos(a) * length, y + Math.sin(a) * length], [x + Math.cos(a + 0.7) * 12, y + Math.sin(a + 0.7) * 12], [x, y], [x + Math.cos(a - 0.7) * 12, y + Math.sin(a - 0.7) * 12]], accent, accent, 0, 0.2);
  }
  g.fillStyle(accent, 0.3).fillCircle(x, y, 5);
}

/** Static, geometry-driven rendering for the two alternate incident locations. */
export function drawAlternateMap(
  scene: Phaser.Scene,
  rooms: readonly RoomGeometry[],
  walls: readonly WallGeometry[],
  width: number,
  height: number,
  theme: Theme,
): void {
  const floor = scene.add.graphics().setDepth(0);
  const detail = scene.add.graphics().setDepth(3);
  const light = scene.add.graphics().setDepth(5);
  const masonry = scene.add.graphics().setDepth(7);
  const ferry = theme === "ferry";
  floor.fillStyle(ferry ? 0x284952 : 0x1e333f).fillRect(0, 0, width, height);
  floor.fillStyle(ferry ? 0x526151 : 0x40524f).fillRect(35, 35, width - 70, height - 70);

  const label = (room: RoomGeometry, text: string, size: number, y: number, color = "#f2e4c8", alpha = 0.7) => {
    scene.add.text(room.x + room.w / 2, y, text, {
      fontFamily: '"Barlow Condensed", Bahnschrift, "Arial Narrow", sans-serif', fontSize: `${size}px`, fontStyle: "bold", color, letterSpacing: 1.3,
    }).setOrigin(0.5, 0).setAlpha(alpha).setDepth(2).setAngle(-0.45);
  };

  for (let x = 60; x < width - 60; x += 139) {
    const y = 15 + (x * 17 % 13);
    floor.lineStyle(2, C.sage, 0.2).lineBetween(x, y, x + 31, y);
    if (ferry) floor.lineStyle(2, C.sage, 0.2).lineBetween(x + 20, height - y, x + 62, height - y);
  }

  rooms.forEach((room, index) => {
    const name = room.name.toLowerCase();
    const deck = ferry && /deck|promenade|gate|freight|cargo/.test(name);
    const archive = /archive|chart|manifest/.test(name);
    const machinery = /power|engine|boiler|equipment/.test(name);
    const dome = !ferry && /dome|rotunda|telescope/.test(name);
    const special = /darkroom|radio|signal/.test(name);
    const base = ferry ? deck ? 0x79684d : machinery ? 0x4e6866 : archive ? 0x86745b : 0x68766a
      : dome ? 0x4f6974 : archive ? 0x7b7258 : machinery ? 0x596e65 : special ? 0x594f59 : 0x647665;
    const alternate = ferry ? deck ? 0x837056 : machinery ? 0x566f6b : archive ? 0x8c7b60 : 0x707e70
      : dome ? 0x56727b : archive ? 0x837960 : machinery ? 0x62796d : special ? 0x61565f : 0x6c7d6c;
    const accent = ferry ? deck ? C.straw : machinery ? C.coral : C.paper : dome ? C.sage : special ? C.coral : C.straw;
    floor.fillStyle(C.ink).fillRect(room.x - 6, room.y - 6, room.w + 12, room.h + 12);
    floor.fillStyle(base).fillRect(room.x, room.y, room.w, room.h);

    if (ferry && (deck || archive)) {
      for (let y = room.y; y < room.y + room.h; y += 25) {
        floor.fillStyle(Math.floor((y - room.y) / 25) % 2 ? alternate : base).fillRect(room.x, y, room.w, Math.min(25, room.y + room.h - y));
        floor.lineStyle(1.5, C.ink, 0.2).lineBetween(room.x, y, room.x + room.w, y);
        for (let x = room.x + (Math.floor((y - room.y) / 25) % 3) * 60; x < room.x + room.w; x += 170) {
          floor.lineStyle(1.5, C.ink, 0.19).lineBetween(x, y, x, y + 25);
          floor.lineStyle(1, C.paper, 0.09).lineBetween(x + 11, y + 9, Math.min(x + 94, room.x + room.w - 2), y + 9);
        }
      }
    } else {
      const tile = ferry ? 52 : dome ? 64 : 44;
      for (let y = room.y; y < room.y + room.h; y += tile) for (let x = room.x; x < room.x + room.w; x += tile) {
        const parity = (Math.floor((x - room.x) / tile) + Math.floor((y - room.y) / tile)) % 2;
        floor.fillStyle(parity ? alternate : base).fillRect(x, y, Math.min(tile - 1, room.x + room.w - x), Math.min(tile - 1, room.y + room.h - y));
        floor.lineStyle(1, C.ink, 0.14).lineBetween(x, y, Math.min(x + tile, room.x + room.w), y);
      }
    }
    floor.lineStyle(3, C.ink, 0.3).strokeRect(room.x + 7, room.y + 7, room.w - 14, room.h - 14);
    label(room, room.name.toUpperCase(), Math.min(25, Math.max(17, room.w / 15)), room.y + 13);
    label(room, ferry ? deck ? "WATCH YOUR STEP" : "NIGHT CROSSING / TERMINAL" : dome ? "LET THE SKY KEEP ITS SECRETS" : "NIGHT OBSERVATION / STAFF ONLY", 9, room.y + room.h - 27, "#f2e4c8", 0.37);

    const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
    if (dome) floorCompass(floor, cx, cy, Math.min(room.w, room.h) * 0.3, C.sage);
    else if (ferry && /promenade|waiting|gate/.test(name)) {
      const direction = /gate/.test(name) ? 1 : -1;
      polygon(floor, [[cx - 28 * direction, cy - 6], [cx + 8 * direction, cy - 6], [cx + 8 * direction, cy - 15], [cx + 30 * direction, cy], [cx + 8 * direction, cy + 15], [cx + 8 * direction, cy + 6], [cx - 28 * direction, cy + 6]], C.paper, C.paper, 0, 0.27);
    }
    for (let mark = 0; mark < Math.max(4, Math.floor(room.w / 100)); mark++) {
      const x = room.x + 18 + (mark * 137 + index * 41) % Math.max(1, room.w - 42);
      const y = room.y + 43 + (mark * 83 + index * 23) % Math.max(1, room.h - 78);
      floor.lineStyle(1.5, C.ink, 0.15).lineBetween(x, y, x + 9, y + 2).lineBetween(x + 13, y + 4, x + 18, y + 2);
    }

    // Props live in corner pockets, outside the orthogonal center-to-door crossing.
    const cw = Math.max(28, Math.min(91, room.w * 0.25 - 22));
    const ch = Math.max(23, Math.min(49, room.h * 0.19));
    const lx = room.x + 20, rx = room.x + room.w - cw - 20;
    const ty = room.y + 39, by = room.y + room.h - ch - 38;
    if (!ferry) {
      if (dome || /roof walk/.test(name)) {
        telescope(detail, lx + cw / 2, ty + ch * 0.55, Math.min(cw * 0.78, ch * 1.02));
        chartTable(detail, rx, ty, cw, ch);
        if (room.h > 300) cabinet(detail, rx, by, cw * 0.78, ch, 0x8b9d86);
      } else if (/chart|archive/.test(name)) {
        chartTable(detail, lx, ty, cw, ch); cabinet(detail, rx, ty, cw, ch, 0x9d8969);
        cabinet(detail, lx, by, cw, ch * 0.85, 0x8d9e88);
        paper(detail, rx + 5, by + 4, cw * 0.6, ch * 0.7, true);
      } else if (/darkroom/.test(name)) {
        box(detail, lx, ty, cw, ch, 0x7f6d65);
        detail.fillStyle(C.ink).fillRect(lx + 6, ty + 6, cw - 12, ch - 12);
        detail.fillStyle(0x77545a).fillEllipse(lx + cw / 2, ty + ch / 2, cw * 0.6, ch * 0.45);
        detail.lineStyle(2, C.paper, 0.5).lineBetween(rx, ty, rx + cw, ty + 3);
        for (let i = 0; i < 3; i++) {
          const x = rx + 3 + i * cw * 0.29;
          paper(detail, x, ty + 8, cw * 0.22, ch * 0.6, true);
          detail.fillStyle(C.ink).fillRect(x + 3, ty + 13, cw * 0.13, ch * 0.3);
        }
      } else if (/power|equipment/.test(name)) {
        boiler(detail, lx, ty, cw * 0.82, ch); crate(detail, rx, ty, cw, ch);
        detail.lineStyle(3, C.coral, 0.6).beginPath().moveTo(lx + cw / 2, ty + ch + 3).lineTo(lx + cw / 2, ty + ch + 15).lineTo(lx + cw - 4, ty + ch + 15).strokePath();
        if (room.h > 320) cabinet(detail, rx, by, cw, ch);
      } else if (/control|signal/.test(name)) {
        controlDesk(detail, lx, ty, cw, ch, true); controlDesk(detail, rx, ty, cw, ch);
        cabinet(detail, lx, by, cw * 0.75, ch, 0x7b9486);
      } else {
        bench(detail, lx, ty, cw, Math.min(ch, 34)); cabinet(detail, rx, ty, cw * 0.72, ch);
        paper(detail, lx + 6, by + 7, Math.min(cw * 0.6, 34), Math.min(ch * 0.7, 27), true);
      }
      if (/roof|deck/.test(name)) {
        for (const edge of [lx, rx]) {
          detail.lineStyle(3, C.ink).lineBetween(edge, by + ch, edge + cw, by + ch);
          for (let post = edge; post <= edge + cw; post += cw / 4) detail.lineStyle(3, C.ink).lineBetween(post, by + ch - 10, post, by + ch + 4);
        }
      }
    } else {
      if (/lifeboat/.test(name)) {
        boat(detail, lx, ty + ch * 0.12, cw, ch * 0.76);
        rope(detail, rx + cw / 2, ty + ch / 2, cw * 0.8, ch * 0.6);
        lifeRing(detail, lx + cw / 2, by + ch / 2, Math.min(19, ch * 0.32));
      } else if (/engine|boiler/.test(name)) {
        boiler(detail, lx, ty, cw * 0.8, ch); boiler(detail, rx, ty, cw * 0.78, ch);
        detail.lineStyle(5, C.ink).beginPath().moveTo(lx + 5, by).lineTo(lx + 5, by + ch).lineTo(lx + cw - 5, by + ch).strokePath();
        detail.lineStyle(2.5, C.coral).beginPath().moveTo(lx + 5, by).lineTo(lx + 5, by + ch).lineTo(lx + cw - 5, by + ch).strokePath();
      } else if (/cargo|freight/.test(name)) {
        crate(detail, lx, ty, cw, ch); crate(detail, rx, ty, cw * 0.9, ch * 0.85);
        if (room.h > 290) crate(detail, rx, by, cw, ch);
        rope(detail, lx + cw / 2, by + ch / 2, cw * 0.75, ch * 0.55);
      } else if (/radio|bridge/.test(name)) {
        controlDesk(detail, lx, ty, cw, ch, true); controlDesk(detail, rx, ty, cw, ch);
        if (/bridge/.test(name)) {
          const wheelX = lx + cw / 2, wheelY = by + ch / 2, r = Math.min(21, ch * 0.4);
          detail.lineStyle(5, C.ink).strokeCircle(wheelX, wheelY, r);
          detail.lineStyle(3, C.straw).strokeCircle(wheelX, wheelY, r);
          for (let spoke = 0; spoke < 8; spoke++) {
            const a = spoke * Math.PI / 4;
            detail.lineStyle(3, C.ink).lineBetween(wheelX, wheelY, wheelX + Math.cos(a) * (r + 5), wheelY + Math.sin(a) * (r + 5));
          }
          detail.fillStyle(C.straw).fillCircle(wheelX, wheelY, 4);
        }
      } else if (/archive|office|customs|ticket/.test(name)) {
        cabinet(detail, lx, ty, cw, ch, 0x9b8869); chartTable(detail, rx, ty, cw, ch);
        paper(detail, lx + 4, by + 7, cw * 0.58, ch * 0.73);
        if (/customs/.test(name)) crate(detail, rx, by, cw * 0.78, ch * 0.9);
      } else if (/galley/.test(name)) {
        box(detail, lx, ty, cw, ch, 0x9eab98);
        for (let i = 0; i < 2; i++) {
          detail.fillStyle(C.ink).fillCircle(lx + cw * (0.3 + i * 0.4), ty + ch / 2, ch * 0.26);
          detail.lineStyle(2, C.steel).strokeCircle(lx + cw * (0.3 + i * 0.4), ty + ch / 2, ch * 0.15);
        }
        cabinet(detail, rx, ty, cw, ch, 0xa6b19c);
        box(detail, lx, by, cw, ch * 0.65, 0x967558);
      } else {
        bench(detail, lx, ty, cw, Math.min(ch, 34)); bench(detail, rx, ty, cw, Math.min(ch, 34));
        lifeRing(detail, lx + cw / 2, by + ch / 2, Math.min(19, ch * 0.33));
        rope(detail, rx + cw / 2, by + ch / 2, cw * 0.75, ch * 0.58);
      }
      if (deck) {
        for (const edge of [lx, rx]) for (let i = 0; i < 3; i++) {
          const x = edge + i * cw / 2;
          detail.fillStyle(C.ink).fillCircle(x, room.y + room.h - 16, 4);
          detail.lineStyle(2.5, C.sage, 0.65).lineBetween(x, room.y + room.h - 16, Math.min(x + cw / 2, edge + cw), room.y + room.h - 16);
        }
      }
    }

    // Broad static pools soften the inked geometry; they never conceal navigation.
    for (let layer = 4; layer > 0; layer--) {
      light.fillStyle(special ? C.coral : ferry ? C.straw : C.sage, 0.018 + (4 - layer) * 0.008)
        .fillEllipse(cx, room.y + room.h * 0.3, room.w * 0.86 * layer / 4, room.h * 0.63 * layer / 4);
    }
    for (const x of [room.x + 20, room.x + room.w - 72]) {
      detail.fillStyle(C.ink).fillRoundedRect(x - 3, room.y + 7, 55, 11, 2);
      detail.fillStyle(special ? C.coral : accent).fillRect(x + 1, room.y + 10, 47, 4);
    }
  });

  // Exact server wall footprints, with a shallow illustrated cap and cast shadow.
  walls.forEach(([x, y, w, h]) => {
    const left = x - w / 2, top = y - h / 2, horizontal = w > h;
    masonry.fillStyle(C.shadow, 0.45).fillRect(left + 8, top + 11, w + 5, h + 8);
    masonry.fillStyle(ferry ? 0x3d565b : 0x3a5360).fillRect(left, top - 4, w, h + 12);
    masonry.lineStyle(3, C.ink).strokeRect(left, top - 4, w, h + 12);
    masonry.fillStyle(ferry ? 0x9eaa91 : 0x93a9a1).fillRect(left, top - 11, w, horizontal ? 11 : h + 6);
    masonry.lineStyle(3, C.ink).strokeRect(left, top - 11, w, horizontal ? 11 : h + 6);
    if (horizontal) {
      masonry.lineStyle(1.5, C.paper, 0.3).lineBetween(left + 3, top - 8, left + w - 3, top - 8);
      for (let joint = left + 95; joint < left + w - 4; joint += ferry ? 110 : 140) masonry.lineStyle(2, C.ink, 0.45).lineBetween(joint, top - 11, joint, top - 1);
    } else {
      masonry.fillStyle(ferry ? 0x5a7777 : 0x5d7883).fillRect(left + w - 4, top - 7, 4, h + 7);
      masonry.lineStyle(1.5, C.paper, 0.25).lineBetween(left + 3, top - 7, left + 3, top + h - 4);
    }
  });
}
