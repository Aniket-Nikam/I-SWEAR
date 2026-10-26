import type Phaser from "phaser";
import { palette } from "./palette";

/** A single authored prop vocabulary, drawn once and cached by Phaser's renderer. */
export function drawObject(g: Phaser.GameObjects.Graphics, kind: string, scale = 1) {
  g.setScale(scale);
  g.fillStyle(0x050b10, 0.45).fillEllipse(3, 20, 62, 19);
  const terminal = (warning = false) => {
    g.fillStyle(0x354954).fillRoundedRect(-27, -21, 54, 46, 3);
    g.lineStyle(1, 0x72888c).strokeRoundedRect(-27, -21, 54, 46, 3);
    g.fillStyle(0x09171c).fillRect(-21, -16, 42, 24);
    g.lineStyle(2, warning ? palette.red : palette.cyan, 0.7);
    for (let y = -11; y < 7; y += 6) g.lineBetween(-16, y, y === 1 ? 4 : 14, y);
    g.fillStyle(0x829292).fillRect(-17, 14, 27, 3);
    g.fillStyle(palette.orange).fillRect(16, 14, 4, 4);
  };
  if (["cctv_terminal", "security_log", "emergency_console"].includes(kind)) terminal(kind === "emergency_console");
  else if (kind === "badge_scanner") {
    g.fillStyle(0x42565d).fillRoundedRect(-14, -23, 28, 46, 3);
    g.lineStyle(1, 0x8ca2a2).strokeRoundedRect(-14, -23, 28, 46, 3);
    g.fillStyle(0x101e24).fillRect(-9, -14, 18, 12);
    g.fillStyle(palette.orange).fillRect(-7, -11, 14, 5);
    g.fillStyle(0x0c151c).fillRect(-7, 7, 14, 4);
  } else if (kind === "experiment_chamber") {
    g.fillStyle(0x3c5159).fillEllipse(0, 10, 78, 62);
    g.fillStyle(0x14242c).fillCircle(0, -2, 33);
    g.lineStyle(4, 0x627b7c).strokeCircle(0, -2, 31);
    g.fillStyle(palette.cyan, 0.12).fillCircle(0, -2, 26);
    g.lineStyle(2, palette.cyan, 0.6).strokeEllipse(0, -2, 31, 49);
    g.fillStyle(palette.orange).fillRect(-23, 18, 8, 4);
    g.fillRect(15, 18, 8, 4);
  } else if (kind === "notebook") {
    g.fillStyle(0x425058).fillRoundedRect(-38, -23, 76, 48, 3);
    g.fillStyle(0xc8c3a8).fillRect(-17, -18, 34, 34);
    g.lineStyle(2, 0x7c8175).lineBetween(0, -18, 0, 16);
    g.lineStyle(1, 0x6a736b, 0.65);
    for (let y = -11; y < 12; y += 5) { g.lineBetween(-13, y, -4, y); g.lineBetween(4, y, 12, y); }
    g.lineStyle(2, palette.orange).lineBetween(24, -12, 29, 14);
  } else if (kind === "broken_glass") {
    g.lineStyle(1, 0x93b7bd, 0.7);
    for (let i = 0; i < 9; i++) {
      const x = Math.sin(i * 5.6) * 32, y = Math.cos(i * 3.2) * 19;
      g.fillStyle(0x7399a4, 0.32).fillTriangle(x, y, x + 12, y - 6, x + 5, y + 9);
      g.strokeTriangle(x, y, x + 12, y - 6, x + 5, y + 9);
    }
  } else if (kind === "id_card") {
    g.fillStyle(0xabae9d).fillRoundedRect(-13, -19, 26, 38, 2);
    g.fillStyle(0x364853).fillRect(-8, -13, 16, 14);
    g.fillStyle(0xb89670).fillCircle(0, -7, 4);
    g.fillStyle(0x6e989a).fillRect(-7, 7, 14, 3);
    g.fillStyle(0x44575c).fillRect(-7, 12, 10, 2);
  } else if (kind === "footprints") {
    g.fillStyle(0x9f9a7e, 0.35);
    for (let i = 0; i < 6; i++) g.fillEllipse((i % 2 ? 10 : -6) + i * 4 - 10, i * 8 - 25, 6, 12);
  } else {
    const cabinet = kind === "locker" || kind === "storage_cabinet";
    g.fillStyle(cabinet ? 0x3d4e53 : 0x354853).fillRoundedRect(-24, -27, 48, 54, 3);
    g.lineStyle(2, 0x718184).strokeRoundedRect(-24, -27, 48, 54, 3);
    if (cabinet) {
      g.lineStyle(1, 0x1a2c34).lineBetween(-2, -24, -2, 24);
      g.fillStyle(0xac9d78).fillRect(7, -17, 10, 5);
      g.fillStyle(0x0f1e26).fillRect(8, 3, 3, 12);
      for (let y = 12; y < 22; y += 4) g.fillRect(-18, y, 10, 1);
    } else {
      g.fillStyle(0x10212b).fillRect(-17, -19, 34, 38);
      g.fillStyle(palette.red).fillRect(-10, -8, 20, 8);
      g.fillStyle(0xc9b37c).fillRect(-5, -14, 5, 15);
      g.fillStyle(palette.cyan).fillCircle(12, 13, 2);
    }
  }
}

export function drawFacilityDetails(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(3);
  const bench = (x: number, y: number, width = 180) => {
    g.fillStyle(0x080f15, 0.55).fillRect(x + 8, y + 10, width, 48);
    g.fillStyle(0x364a53).fillRoundedRect(x, y, width, 43, 3);
    g.lineStyle(2, 0x718488, 0.65).strokeRoundedRect(x, y, width, 43, 3);
    for (let i = 20; i < width - 20; i += 35) {
      g.fillStyle(0x172b35).fillRect(x + i, y + 8, 20, 19);
      g.fillStyle(0x7a9f9d, 0.7).fillRect(x + i + 4, y + 12, 11, 3);
    }
  };
  bench(130, 170, 300); bench(160, 360, 240);
  bench(750, 180, 250); bench(1090, 340, 180);
  bench(1510, 170, 275); bench(1710, 365, 190);
  bench(470, 1005, 150); bench(820, 1155, 145);
  g.fillStyle(0x152a33).fillRoundedRect(900, 245, 190, 85, 7);
  g.lineStyle(3, 0x6c8589).strokeRoundedRect(900, 245, 190, 85, 7);
  g.lineStyle(1, palette.cyan, 0.4).strokeCircle(1040, 287, 25);
  // CCTV wall: discrete feeds, one damaged pane.
  for (let i = 0; i < 6; i++) {
    const x = 785 + (i % 3) * 65, y = 972 + Math.floor(i / 3) * 50;
    g.fillStyle(0x4a6068).fillRoundedRect(x, y, 53, 38, 2);
    g.fillStyle(i === 2 ? 0x281e1f : 0x18313a).fillRect(x + 4, y + 4, 45, 29);
    g.lineStyle(1, i === 2 ? palette.red : palette.cyan, 0.3).lineBetween(x + 8, y + 24, x + 40, y + 12);
  }
  // Server rack faces and restrained indicator lights.
  for (let x = 1100; x < 1370; x += 54) {
    for (let y = 975; y < 1190; y += 22) {
      g.fillStyle(0x091921).fillRect(x + 5, y, 25, 15);
      g.fillStyle((y / 22) % 2 > 0.5 ? 0x7aa7a6 : 0x9e8955).fillRect(x + 24, y + 5, 3, 3);
      g.lineStyle(1, 0x435f68).lineBetween(x + 8, y + 6, x + 19, y + 6);
    }
  }
  // Storage lockers and archive folders have the same material vocabulary.
  for (let x = 105; x < 310; x += 52) {
    g.fillStyle(0x34474d).fillRect(x, 955, 38, 75);
    g.lineStyle(1, 0x7a8982, 0.6).strokeRect(x, 955, 38, 75);
    g.fillStyle(0xa69670).fillRect(x + 9, 967, 20, 7);
    g.fillStyle(0x0e1b22).fillRect(x + 26, 992, 3, 15);
  }
  for (let x = 1520; x < 1900; x += 76) {
    for (let y = 990; y < 1205; y += 19) {
      g.fillStyle(y % 3 ? 0x9c9271 : 0x596f70, 0.7).fillRect(x + 5, y, 37, 11);
      g.lineStyle(1, 0x1a292c).lineBetween(x + 13, y, x + 13, y + 11);
    }
  }
  // Lit wall strips and wayfinding paint are anchors, not screen-space effects.
  for (const [x, y, width] of [[180, 100, 180], [790, 100, 250], [1560, 100, 230], [720, 835, 110], [1770, 835, 140]]) {
    g.fillStyle(palette.orange, 0.05).fillRect(x - 12, y - 8, width + 24, 42);
    g.fillStyle(palette.orange, 0.65).fillRect(x, y, width, 4);
  }
  g.lineStyle(2, 0x778d8f, 0.35).strokeRect(1800, 615, 140, 185);
  g.fillStyle(0xa2b6ad, 0.55).fillTriangle(1860, 700, 1880, 710, 1860, 720);
  g.lineStyle(4, 0xa2b6ad, 0.45).lineBetween(1820, 710, 1870, 710);
  const label = (x: number, y: number, text: string, color = "#758e96") => scene.add.text(x, y, text, {
    fontFamily: "Bahnschrift, sans-serif", fontSize: "11px", color, letterSpacing: 2,
  }).setAlpha(0.8).setDepth(4);
  label(186, 305, "NEURAL RESPONSE / SEALED"); label(850, 390, "CALIBRATION FLOOR");
  label(1530, 350, "CAMERA SERVICE IN PROGRESS", "#b48a68");
  label(125, 800, "RESEARCH WING  >"); label(1790, 817, "EXIT / TEST ONLY", "#b28a7a");
  label(905, 807, "ORPHEUS / MEMORY STUDIES", "#9a8a6b");
}
