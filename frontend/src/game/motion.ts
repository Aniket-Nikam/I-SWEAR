import type { PlayerState, RoomSnapshot } from "../types/protocol";

export type Geometry = RoomSnapshot["world"];
export interface MotionState { x: number; y: number; vx: number; vy: number }
export interface MotionCommand { dx: number; dy: number; sequence: number; at: number }
const SPEED = 230, RADIUS = 12;

export function blocked(x: number, y: number, world: Geometry) {
  const hit=([wx,wy,w,h]:readonly number[])=>Math.abs(x-wx)<w/2+RADIUS&&Math.abs(y-wy)<h/2+RADIUS;
  return world.walls.some(hit)||(world.obstacles?.some(hit)??false);
}

/** The same acceleration and axis-separated collision as the authoritative server. */
export function advanceMotion(state: MotionState, dx: number, dy: number, seconds: number, world: Geometry) {
  const length = Math.max(1, Math.hypot(dx, dy));
  let remaining = Math.max(0, seconds);
  while (remaining > 0.000001) {
    const dt = Math.min(remaining, 1 / 120);
    const blend = 1 - Math.exp(-dt / .065);
    const tx = dx / length * SPEED, ty = dy / length * SPEED;
    // Integrate the exponential analytically. Euler integration gave the
    // 20 Hz server and high-refresh client different stopping distances.
    const travelX = tx * dt + (state.vx - tx) * .065 * blend;
    const travelY = ty * dt + (state.vy - ty) * .065 * blend;
    state.vx += (tx - state.vx) * blend;
    state.vy += (ty - state.vy) * blend;
    if (Math.abs(state.vx) < .1) state.vx = 0;
    if (Math.abs(state.vy) < .1) state.vy = 0;
    const x = Math.max(32, Math.min(world.width - 32, state.x + travelX));
    if (!blocked(x, state.y, world)) state.x = x; else state.vx = 0;
    const y = Math.max(32, Math.min(world.height - 32, state.y + travelY));
    if (!blocked(state.x, y, world)) state.y = y; else state.vy = 0;
    remaining -= dt;
  }
}

function stateOf(player: PlayerState): MotionState { return { x: player.x, y: player.y, vx: player.vx ?? 0, vy: player.vy ?? 0 }; }

/** Predict immediately, then replay unacknowledged input from the server state.
 * Only the presentation predicts; evidence, speed and collision stay server-owned. */
export class LocalMotion {
  state: MotionState;
  private commands: MotionCommand[] = [];
  private dx = 0;
  private dy = 0;
  private offsetX = 0;
  private offsetY = 0;
  constructor(player: PlayerState, private world: Geometry) { this.state = stateOf(player); }
  reset(player: PlayerState) { this.state = stateOf(player); this.commands = []; this.dx = this.dy = this.offsetX = this.offsetY = 0; }
  input(command: MotionCommand) {
    this.dx = command.dx; this.dy = command.dy;
    this.commands.push(command);
    if (this.commands.length > 60) this.commands.shift();
  }
  stop() { this.dx = this.dy = 0; }
  reconcile(player: PlayerState, roundTripMs: number, now: number) {
    if (player.input_sequence === undefined) return; // Older servers remain playable.
    const before = this.position();
    this.state = stateOf(player);
    this.commands = this.commands.filter(command => command.sequence > player.input_sequence!);
    // Server state is one transit behind us, while our input reaches it one
    // transit later. Replaying a full RTT puts the local presentation at now.
    let cursor = now - Math.max(0, Math.min(250, roundTripMs));
    let dx = player.dx ?? 0, dy = player.dy ?? 0;
    for (const command of this.commands) {
      const at = Math.max(cursor, Math.min(now, command.at));
      advanceMotion(this.state, dx, dy, (at - cursor) / 1000, this.world);
      cursor = at; dx = command.dx; dy = command.dy;
    }
    advanceMotion(this.state, dx, dy, (now - cursor) / 1000, this.world);
    this.offsetX = before.x - this.state.x; this.offsetY = before.y - this.state.y;
    if (Math.hypot(this.offsetX, this.offsetY) > 120 || blocked(before.x, before.y, this.world)) this.offsetX = this.offsetY = 0;
  }
  step(seconds: number, active: boolean) {
    const dt = Math.min(.1, Math.max(0, seconds));
    advanceMotion(this.state, active ? this.dx : 0, active ? this.dy : 0, dt, this.world);
    const decay = Math.exp(-dt / .10);
    const distance=Math.hypot(this.offsetX,this.offsetY),speed=Math.hypot(this.state.vx,this.state.vy);
    // Keep a small presentation offset at rest rather than dragging a stopped
    // witness backwards. It is paid down during the next walk. Physics and
    // interaction checks still use the authoritative position, and offsets
    // into furniture, reconnects and large corrections cannot be held.
    const resting = !this.dx && !this.dy && speed < 8;
    const correction=resting&&distance<=24?0:Math.min(distance*(1-decay),Math.max(speed,resting?80:0)*dt*.30);
    const remaining=distance?Math.max(0,1-correction/distance):0;
    this.offsetX*=remaining;this.offsetY*=remaining;
    const position = this.position();
    if (blocked(position.x, position.y, this.world)) this.offsetX = this.offsetY = 0;
    return this.position();
  }
  position() { return { x: this.state.x + this.offsetX, y: this.state.y + this.offsetY }; }
}

/** Other witnesses use a short interpolation buffer, with bounded extrapolation
 * through a missed packet instead of repeatedly easing to 20 Hz destinations. */
export class RemoteMotion {
  private samples: (MotionState & { at: number })[] = [];
  push(player: PlayerState, at: number) { this.samples.push({ ...stateOf(player), at }); if (this.samples.length > 12) this.samples.shift(); }
  velocity(now:number){const latest=this.samples[this.samples.length-1];return latest&&now-latest.at<300?latest:{vx:0,vy:0};}
  position(now: number, world: Geometry) {
    const at = now - 100;
    while (this.samples.length > 2 && this.samples[1].at <= at) this.samples.shift();
    const first = this.samples[0], next = this.samples[1];
    if (!first) return null;
    if (next && at >= first.at && at <= next.at) {
      const factor = (at - first.at) / Math.max(1, next.at - first.at);
      const x = first.x + (next.x - first.x) * factor, y = first.y + (next.y - first.y) * factor;
      return blocked(x, y, world) ? first : { x, y };
    }
    const latest = this.samples[this.samples.length - 1];
    if (at < first.at) return first;
    const dt = Math.min(.1, Math.max(0, (at - latest.at) / 1000));
    const x = latest.x + latest.vx * dt, y = latest.y + latest.vy * dt;
    return { x: blocked(x, latest.y, world) ? latest.x : x, y: blocked(latest.x, y, world) ? latest.y : y };
  }
}
