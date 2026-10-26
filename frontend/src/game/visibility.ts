/** A wall stops a witness silhouette; door gaps remain visible. No private memory data is used. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, walls: readonly (readonly number[])[]) {
  const dx = bx - ax, dy = by - ay;
  for (const [cx, cy, w, h] of walls) {
    let enter = 0, leave = 1;
    const bounds = [[ax, dx, cx - w / 2, cx + w / 2], [ay, dy, cy - h / 2, cy + h / 2]];
    let intersects = true;
    for (const [origin, direction, min, max] of bounds) {
      if (Math.abs(direction) < .0001) { if (origin < min || origin > max) { intersects = false; break; } }
      else { const a = (min - origin) / direction, b = (max - origin) / direction; enter = Math.max(enter, Math.min(a,b)); leave = Math.min(leave, Math.max(a,b)); if (enter > leave) { intersects = false; break; } }
    }
    if (intersects && enter < 1 && leave > 0) return false;
  }
  return true;
}
