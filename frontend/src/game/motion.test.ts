import { describe, expect, it } from "vitest";
import { advanceMotion, blocked, LocalMotion, RemoteMotion, type Geometry } from "./motion";
import type { PlayerState } from "../types/protocol";

const world: Geometry = { width: 1200, height: 1000, rooms: [], walls: [[600, 300, 16, 400]] };
const player = (overrides: Partial<PlayerState> = {}): PlayerState => ({ id: "local", name: "Witness", x: 300, y: 300,
  vx: 0, vy: 0, color_index: 0, ready: true, connected: true, input_sequence: -1, dx: 0, dy: 0, ...overrides });

describe("latency-tolerant movement", () => {
  it.each([80,160,240])("does not pull a released character backwards over a %i ms round trip",rtt=>{
    const initial=player({y:700}),motion=new LocalMotion(initial,world),server={...initial};
    const inputs:{at:number;dx:number;sequence:number}[]=[],packets:{at:number;player:PlayerState}[]=[];
    let sequence=0,previous=300,minStoppedDelta=Infinity,previousArrival=0;
    for(let now=0;now<=2400;now+=10){
      if(now<=600&&now%100===0){
        const dx=now===600?0:1;motion.input({dx,dy:0,sequence,at:now});
        inputs.push({at:now+rtt/2,dx,sequence:sequence++});
      }
      while(inputs[0]?.at<=now){const input=inputs.shift()!;server.dx=input.dx;server.input_sequence=input.sequence;}
      if(now&&now%50===0){
        advanceMotion(server as Required<typeof server>,server.dx??0,0,.05,world);
        // WebSocket ordering is preserved even when individual packets jitter.
        previousArrival=Math.max(previousArrival,now+rtt/2+(now%150===0?30:0));
        packets.push({at:previousArrival,player:{...server}});
      }
      while(packets[0]?.at<=now)motion.reconcile(packets.shift()!.player,rtt,now);
      const current=motion.step(.01,true).x;
      if(now>=600)minStoppedDelta=Math.min(minStoppedDelta,current-previous);
      previous=current;
    }
    expect(minStoppedDelta).toBeGreaterThanOrEqual(-.001);
    expect(Math.abs(motion.position().x-server.x)).toBeLessThanOrEqual(24);
    const resting=motion.position().x;
    for(let frame=0;frame<180;frame++)expect(motion.step(1/60,true).x).toBeCloseTo(resting,4);
    // The presentation debt disappears while walking again, without a snap.
    motion.input({dx:1,dy:0,sequence:sequence++,at:5500});
    for(let frame=0;frame<120;frame++)motion.step(1/60,true);
    expect(Math.abs(motion.position().x-motion.state.x)).toBeLessThan(.01);
  });
  it("never yanks steady forward movement backwards after a delayed correction",()=>{
    const motion=new LocalMotion(player({y:700}),world);motion.input({dx:1,dy:0,sequence:0,at:0});
    for(let i=0;i<36;i++)motion.step(1/60,true);
    motion.reconcile(player({x:motion.state.x-55,y:700,vx:230,dx:1,input_sequence:0}),0,600);
    let previous=motion.position().x;
    for(let i=0;i<30;i++){const current=motion.step(1/60,true).x;expect(current-previous).toBeGreaterThan(1);previous=current;}
  });
  it("predicts furniture collision before the authoritative reply",()=>{
    const physical={...world,obstacles:[[300,500,190,42]] as [number,number,number,number][]};
    const state={x:300,y:600,vx:0,vy:0};
    for(let frame=0;frame<180;frame++)advanceMotion(state,0,-1,1/60,physical);
    expect(state.y).toBeGreaterThanOrEqual(533);expect(blocked(state.x,state.y,physical)).toBe(false);
    const motion=new LocalMotion(player({x:300,y:600}),physical);motion.input({dx:0,dy:-1,sequence:0,at:0});
    motion.reconcile(player({x:300,y:534}),200,200);expect(blocked(motion.state.x,motion.state.y,physical)).toBe(false);
  });
  it("moves on the first frame without waiting for the server round trip", () => {
    const motion = new LocalMotion(player(), world);
    motion.input({ dx: 1, dy: 0, sequence: 0, at: 0 });
    expect(motion.step(1 / 60, true).x).toBeGreaterThan(300);
    // A still-in-transit initial state must not cancel the pending direction.
    motion.reconcile(player(), 160, 50);
    expect(motion.step(1 / 60, true).x).toBeGreaterThan(300);
  });

  it("keeps speed consistent at different frame rates and normalizes diagonals", () => {
    const run = (fps: number, dx = 1, dy = 0) => {
      const state = { x: 300, y: 700, vx: 0, vy: 0 };
      for (let frame = 0; frame < fps; frame++) advanceMotion(state, dx, dy, 1 / fps, world);
      return Math.hypot(state.x - 300, state.y - 700);
    };
    expect(Math.abs(run(30) - run(144))).toBeLessThan(.6);
    expect(run(60, 1, 1)).toBeCloseTo(run(60), 4);
    expect(run(60)).toBeGreaterThan(210);
    expect(run(60)).toBeLessThan(230);
  });

  it("blocks and slides along authoritative walls at low frame rates", () => {
    const state = { x: 550, y: 300, vx: 0, vy: 0 };
    for (let frame = 0; frame < 15; frame++) advanceMotion(state, 1, 1, 1 / 15, world);
    expect(state.x).toBeLessThanOrEqual(580);
    expect(state.y).toBeGreaterThan(430);
    expect(blocked(state.x, state.y, world)).toBe(false);
  });

  it("replays a stop that the delayed server has not acknowledged yet", () => {
    const motion = new LocalMotion(player(), world);
    motion.input({ dx: 1, dy: 0, sequence: 0, at: 0 });
    for (let i = 0; i < 12; i++) motion.step(1 / 60, true);
    motion.input({ dx: 0, dy: 0, sequence: 1, at: 200 });
    motion.reconcile(player({ x: 320, vx: 210, dx: 1, input_sequence: 0 }), 160, 300);
    const start = motion.position().x;
    for (let i = 0; i < 30; i++) motion.step(1 / 60, true);
    expect(motion.position().x - start).toBeLessThan(25);
    expect(motion.state.vx).toBe(0);
  });

  it("resets prediction on reconnect and bounds large corrections", () => {
    const motion = new LocalMotion(player(), world);
    motion.input({ dx: 1, dy: 0, sequence: 40, at: 0 });
    motion.step(.1, true);
    motion.reset(player({ x: 900, y: 700 }));
    expect(motion.step(.1, true)).toEqual({ x: 900, y: 700 });
    motion.reconcile(player({ x: 200, input_sequence: 0 }), 900, 1000);
    expect(motion.position().x).toBe(200);
  });

  it("stays close to the immediate local path over a simulated 160 ms round trip", () => {
    const initial = player({ y: 700 });
    const motion = new LocalMotion(initial, world);
    const server = { ...initial }, ideal = { x: initial.x, y: initial.y, vx: 0, vy: 0 };
    const inputs: { at: number; dx: number; dy: number; sequence: number }[] = [];
    const packets: { at: number; player: PlayerState }[] = [];
    let direction = 1, sequence = 0;
    const errors: number[] = [];
    for (let now = 0; now <= 1500; now += 10) {
      if (now === 600) direction = 0;
      if (now === 1000) direction = -1;
      if (now % 100 === 0) {
        const command = { at: now, dx: direction, dy: 0, sequence: sequence++ };
        motion.input(command); inputs.push({ ...command, at: now + 80 });
      }
      while (inputs[0]?.at <= now) { const command = inputs.shift()!; server.dx = command.dx; server.dy = command.dy; server.input_sequence = command.sequence; }
      if (now && now % 50 === 0) {
        advanceMotion(server as Required<typeof server>, server.dx ?? 0, server.dy ?? 0, .05, world);
        packets.push({ at: now + 80, player: { ...server } });
      }
      while (packets[0]?.at <= now) motion.reconcile(packets.shift()!.player, 160, now);
      advanceMotion(ideal, direction, 0, .01, world);
      const position = motion.step(.01, true);
      if (now > 300) errors.push(Math.abs(position.x - ideal.x));
    }
    // A 20 Hz server quantizes direction changes to its next tick (11.5px at
    // full speed). Transit latency must not add another 160ms of visible lag.
    expect(Math.max(...errors)).toBeLessThan(12);
  });

  it("interpolates remote witnesses and caps extrapolation after a packet gap", () => {
    const motion = new RemoteMotion();
    motion.push(player({ x: 300, vx: 200 }), 1000);
    motion.push(player({ x: 310, vx: 200 }), 1050);
    expect(motion.position(1125, world)?.x).toBe(305);
    expect(motion.position(5000, world)?.x).toBe(330);
  });
});
