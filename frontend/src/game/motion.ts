import type { PlayerState, RoomSnapshot } from "../types/protocol";

export type Geometry = RoomSnapshot["world"];
export interface MotionState { x: number; y: number; vx: number; vy: number }
export interface MotionCommand { dx: number; dy: number; sequence: number; at: number }
const SPEED = 230, RADIUS = 20;

export function blocked(x: number, y: number, world: Geometry) {
  const hit=([wx,wy,w,h]:readonly number[])=>Math.abs(x-wx)<w/2+RADIUS&&Math.abs(y-wy)<h/2+RADIUS;
  return world.walls.some(hit)||(world.obstacles?.some(hit)??false);
}

/** Sweep to the surface instead of throwing away an entire frame's travel.
 * Matches world.slide_axis: contact is independent of tick/frame rate. */
export function slideAxis(start:number, end:number, other:number, axis:0|1, world:Geometry) {
  const sweep=(boxes:readonly (readonly number[])[])=>{for(const box of boxes) {
    if(Math.abs(other-box[1-axis])>=box[3-axis]/2+RADIUS)continue;
    const low=box[axis]-box[2+axis]/2-RADIUS, high=box[axis]+box[2+axis]/2+RADIUS;
    if(end>start&&start<=low&&end>low)end=low;
    if(end<start&&start>=high&&end<high)end=high;
  }};
  sweep(world.walls);if(world.obstacles)sweep(world.obstacles);
  return end;
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
    const sx=slideAxis(state.x,x,state.y,0,world);
    if(sx!==x)state.vx=0; state.x=sx;
    const y = Math.max(32, Math.min(world.height - 32, state.y + travelY));
    const sy=slideAxis(state.y,y,state.x,1,world);
    if(sy!==y)state.vy=0; state.y=sy;
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
  private view:MotionState;
  constructor(player: PlayerState, private world: Geometry) { this.state = stateOf(player); this.view=stateOf(player); }
  reset(player: PlayerState) { this.state = stateOf(player); this.view=stateOf(player); this.commands = []; this.dx = this.dy = 0; }
  input(command: MotionCommand) {
    this.dx = command.dx; this.dy = command.dy;
    this.commands.push(command);
    if (this.commands.length > 60) this.commands.shift();
  }
  stop() { this.dx = this.dy = 0; }
  reconcile(player: PlayerState, roundTripMs: number, now: number) {
    if (player.input_sequence === undefined) return; // Older servers remain playable.
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
    if (Math.hypot(this.view.x-this.state.x,this.view.y-this.state.y)>120 || blocked(this.view.x,this.view.y,this.world))this.view={...this.state};
  }
  step(seconds: number, active: boolean) {
    const dt = Math.min(.1, Math.max(0, seconds));
    advanceMotion(this.state, active ? this.dx : 0, active ? this.dy : 0, dt, this.world);
    advanceMotion(this.view,active?this.dx:0,active?this.dy:0,dt,this.world);
    const ex=this.state.x-this.view.x,ey=this.state.y-this.view.y,distance=Math.hypot(ex,ey);
    const speed=Math.hypot(this.view.vx,this.view.vy),resting=(!active||(!this.dx&&!this.dy))&&speed<8;
    // The presentation has its own collision-integrated path. Network debt is
    // paid down slowly through the same surfaces, never by dropping an offset
    // when it happens to enter a bench. Small errors stay still at rest.
    const correction=resting&&distance<=24?0:Math.min(distance*(1-Math.exp(-dt/.10)),Math.max(speed,resting?80:0)*dt*.30);
    if(distance&&correction){
      this.view.x=slideAxis(this.view.x,this.view.x+ex/distance*correction,this.view.y,0,this.world);
      this.view.y=slideAxis(this.view.y,this.view.y+ey/distance*correction,this.view.x,1,this.world);
    }
    return this.position();
  }
  position() { return { x: this.view.x, y: this.view.y }; }
}

/** Other witnesses use a short interpolation buffer, with bounded extrapolation
 * through a missed packet instead of repeatedly easing to 20 Hz destinations. */
export class RemoteMotion {
  private samples: (MotionState & { at: number })[] = [];
  private clockOffset=Infinity;
  private view:{x:number;y:number}|null=null;
  private previous=0;
  push(player: PlayerState, at: number, serverAt?:number) {
    if(serverAt!==undefined){this.clockOffset=Math.min(this.clockOffset,at-serverAt);at=serverAt+this.clockOffset;}
    const previous=this.samples[this.samples.length-1];
    if(previous&&at<=previous.at)return;
    this.samples.push({ ...stateOf(player), at }); if (this.samples.length > 12) this.samples.shift();
  }
  velocity(now:number){const latest=this.samples[this.samples.length-1];return latest&&now-latest.at<300?latest:{vx:0,vy:0};}
  position(now: number, world: Geometry) {
    const target=this.target(now,world);if(!target)return null;
    const dt=this.previous?Math.min(.1,Math.max(0,(now-this.previous)/1000)):0;this.previous=now;
    if(!this.view||Math.hypot(target.x-this.view.x,target.y-this.view.y)>160)this.view={x:target.x,y:target.y};
    else {
      const dx=target.x-this.view.x,dy=target.y-this.view.y,d=Math.hypot(dx,dy),factor=d?Math.min(1,300*dt/d):1;
      this.view.x=slideAxis(this.view.x,this.view.x+dx*factor,this.view.y,0,world);
      this.view.y=slideAxis(this.view.y,this.view.y+dy*factor,this.view.x,1,world);
    }
    return this.view;
  }
  private target(now:number,world:Geometry) {
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
