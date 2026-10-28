/** A fixed diorama camera: movement follows the screen, simulation stays 2D. */
export const CAMERA_YAW = Math.PI / 6;
export function screenMovement(dx: number, dy: number) {
  const c = Math.cos(CAMERA_YAW), s = Math.sin(CAMERA_YAW);
  return { dx: dx * c + dy * s, dy: dy * c - dx * s };
}
export function renderSize(width: number, height: number, density: number, quality = 1) {
  return { width: Math.max(320, Math.round(width)), height: Math.max(240, Math.round(height)),
    pixelRatio: Math.max(.65, Math.min(1.5, Number.isFinite(density) ? density : 1) * quality) };
}
