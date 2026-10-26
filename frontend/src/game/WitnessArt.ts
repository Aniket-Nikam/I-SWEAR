import type Phaser from "phaser";
import { avatarColors } from "./palette";

export const hats = ["none", "beanie", "cap", "headphones"];

/** Inked witness sprite, matching the wardrobe's cutout portrait. Coordinates are 64×82. */
export function drawWitness(g: Phaser.GameObjects.Graphics, colorIndex: number, hat: string, frame: number) {
  const ink = 0x12212a, coat = avatarColors[colorIndex], bob = frame ? -1 : 0;
  const polygon = (points: number[], fill: number, stroke = ink, width = 2.5) => {
    const vertices = [];
    for (let i = 0; i < points.length; i += 2) vertices.push({ x: points[i], y: points[i + 1] + bob });
    g.fillStyle(fill).fillPoints(vertices, true).lineStyle(width, stroke).strokePoints(vertices, true);
  };
  g.fillStyle(0x07151b, .4).fillEllipse(33, 75, 47, 13);
  polygon([22,59,20 + frame * 2,74,29,74,33,59], 0x2d414c);
  polygon([36,59,37 - frame * 2,74,47,74,44,59], 0x2d414c);
  g.fillStyle(ink).fillRoundedRect(16 + frame * 2, 72, 14, 7, 2).fillRoundedRect(36 - frame * 2, 72, 15, 7, 2);
  polygon([20,32,11,52,17,57,26,42], coat);
  polygon([43,33,54,53,48,58,39,43], coat);
  polygon([22,30,17,62,28,66,33,59,38,66,49,62,44,30], coat);
  g.lineStyle(1.5, ink, .45).lineBetween(33, 37 + bob, 33, 60 + bob).lineBetween(20, 53 + bob, 28, 53 + bob).lineBetween(40, 53 + bob, 46, 53 + bob);
  polygon([22,31,32,40,44,31,39,27,27,27], 0xe5c27d);
  polygon([32,37,38,37,41,51,35,49], 0xe5c27d);
  polygon([19,11,23,4,40,4,46,11,46,25,41,33,28,34,20,27], 0xe9c59b);
  polygon([18,18,18,10,24,3,36,1,43,7,48,19,38,17,35,11,30,18], 0x263c47);
  g.lineStyle(2, ink).lineBetween(23, 22 + bob, 29, 21 + bob).lineBetween(37, 21 + bob, 42, 22 + bob).lineBetween(32, 23 + bob, 32, 27 + bob);
  g.lineStyle(1.5, ink).lineBetween(30, 30 + bob, 36, 30 + bob);
  polygon([18,41,25,42,24,49,17,48], 0xf2e4c8, ink, 1);
  polygon([48,51,55,50,56,64,47,65], 0xb6bcb0, ink, 1.5);
  g.lineStyle(1, 0xf2e4c8).lineBetween(49, 55, 54, 55);
  if (hat === "beanie") { polygon([17,16,18,6,25,0,37,0,44,5,47,15], avatarColors[(colorIndex + 2) % 8]); polygon([17,13,48,13,48,20,17,21], avatarColors[(colorIndex + 2) % 8]); }
  if (hat === "cap") { polygon([18,15,21,4,32,0,43,4,47,16], 0xb2ceba); polygon([29,15,54,17,53,23,29,20], 0xb2ceba); }
  if (hat === "headphones") { g.lineStyle(5, 0xe7b768).strokeEllipse(32, 17 + bob, 34, 32); g.fillStyle(0x405665).fillRoundedRect(13, 16 + bob, 8, 13, 3).fillRoundedRect(44, 16 + bob, 8, 13, 3); }
}
