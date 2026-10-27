import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameSocket } from "./GameSocket";

class Wire {
  static OPEN = 1;
  static instances: Wire[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: {data:string}) => void) | null = null;
  onclose: ((event: {code:number}) => void) | null = null;
  send = vi.fn(); close = vi.fn();
  constructor() { Wire.instances.push(this); }
}
let now = 0;
beforeEach(() => {
  now = 0; Wire.instances = [];
  vi.useFakeTimers(); vi.stubGlobal("WebSocket",Wire);
  vi.spyOn(performance,"now").mockImplementation(() => now);
  vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const session = { room_code:"ABCDE",player_id:"p1",reconnect_token:"test-token",share_url:"/?room=ABCDE" };

it("replaces a half-open transport and ignores late events from that transport", () => {
  const socket = new GameSocket(session); const status = vi.fn(); const messages = vi.fn();
  socket.onStatus(status); socket.onMessage(messages); socket.connect();
  const old = Wire.instances[0]; old.onopen!();
  expect(socket.connected).toBe(true);
  now = 13000; vi.advanceTimersByTime(2000);
  expect(old.close).toHaveBeenCalledWith(4000,"Heartbeat timed out");
  expect(status).toHaveBeenLastCalledWith("reconnecting");
  vi.advanceTimersByTime(500);
  const fresh = Wire.instances[1]; fresh.onopen!();
  old.onmessage!({data:JSON.stringify({type:"error",message:"stale"})});
  old.onclose!({code:1006});
  expect(messages).not.toHaveBeenCalled();
  expect(socket.connected).toBe(true);
  expect(fresh.send.mock.calls.every(([raw]) => JSON.parse(raw).type === "ping")).toBe(true);
  socket.close();
});

it("keeps a healthy idle lobby alive with pongs and cancels retries on leave", () => {
  const socket = new GameSocket(session); socket.connect(); const wire = Wire.instances[0]; wire.onopen!();
  for (let index=1;index<10;index++) {
    now = index*2000; wire.onmessage!({data:JSON.stringify({type:"pong"})}); vi.advanceTimersByTime(2000);
  }
  expect(wire.close).not.toHaveBeenCalled();
  wire.onclose!({code:1006}); socket.close(); vi.advanceTimersByTime(10000);
  expect(Wire.instances).toHaveLength(1);
});

it("detects a missing pong even when one-way position traffic still arrives", () => {
  const socket = new GameSocket(session); socket.connect(); const wire = Wire.instances[0]; wire.onopen!();
  for (let index=1;index<=7;index++) {
    now = index*2000; wire.onmessage!({data:JSON.stringify({type:"positions",players:[]})}); vi.advanceTimersByTime(2000);
  }
  expect(wire.close).toHaveBeenCalledWith(4000,"Heartbeat timed out");
  expect(socket.connected).toBe(false);
  socket.close();
});
