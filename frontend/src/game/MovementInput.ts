const DIRECTIONS: Record<string, [number, number]> = {
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};

/** One keyboard stream for taps, held keys, diagonals, and focus loss. */
export class MovementInput {
  private held = new Set<string>();
  private pressedAt = new Map<string, number>();
  private releases = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private emit: (dx: number, dy: number) => void) {}

  down(key: string) {
    const normalized = key.toLowerCase();
    if (!DIRECTIONS[normalized]) return false;
    const pending = this.releases.get(normalized);
    if (pending) clearTimeout(pending);
    if (!this.held.has(normalized)) this.pressedAt.set(normalized, performance.now());
    this.held.add(normalized);
    this.flush();
    return true;
  }

  up(key: string) {
    const normalized = key.toLowerCase();
    if (!this.held.has(normalized)) return false;
    // Preserve very short taps for at least one authoritative simulation tick.
    const delay = Math.max(0, 80 - (performance.now() - (this.pressedAt.get(normalized) ?? 0)));
    this.releases.set(normalized, setTimeout(() => {
      this.held.delete(normalized);
      this.pressedAt.delete(normalized);
      this.releases.delete(normalized);
      this.flush();
    }, delay));
    return true;
  }

  flush() {
    let x = 0, y = 0;
    for (const key of this.held) {
      x += DIRECTIONS[key][0];
      y += DIRECTIONS[key][1];
    }
    x = Math.sign(x);
    y = Math.sign(y);
    const length = Math.max(1, Math.hypot(x, y));
    this.emit(x / length, y / length);
  }

  heartbeat() {
    if (this.held.size) this.flush();
  }

  clear() {
    for (const timer of this.releases.values()) clearTimeout(timer);
    this.releases.clear();
    this.pressedAt.clear();
    this.held.clear();
    this.emit(0, 0);
  }
}
