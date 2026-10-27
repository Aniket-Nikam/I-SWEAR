import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioDirector } from "./AudioDirector";

class Param { value = 0; setTargetAtTime = vi.fn(); cancelScheduledValues = vi.fn(); }
class Node { gain = new Param(); connect = vi.fn(); disconnect = vi.fn(); }
class Source { buffer = null; loop = false; loopEnd = 0; connect = vi.fn(); start = vi.fn(); stop = vi.fn(); disconnect = vi.fn(); }
class Context {
  state = "running"; currentTime = 0; destination = new Node();
  sources: Source[] = [];
  createGain() { return new Node(); }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  decodeAudioData = vi.fn(async () => ({ duration: 49.23077 }));
  resume = vi.fn(async () => { this.state = "running"; });
}
let contexts: Context[];
const settle = async () => { for (let i=0; i<8; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers(); contexts = [];
  vi.stubGlobal("AudioContext", class extends Context { constructor() { super(); contexts.push(this); } });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("lobby music lifecycle", () => {
  it("does not fetch or play before audio is unlocked, and reuses one looping source", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    expect(fetch).not.toHaveBeenCalled(); expect(director.musicState()).toBe("waiting");
    await director.unlock(); await settle();
    expect(director.musicState()).toBe("playing");
    director.setLobby(true); director.configureMusic(true, .2); await director.unlock();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(contexts[0].sources).toHaveLength(1);
    expect(contexts[0].sources[0].loop).toBe(true);
    expect(contexts[0].sources[0].start).toHaveBeenCalledTimes(1);
  });
  it("fades and stops when the case starts, then reuses the decoded buffer", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    await director.unlock(); await settle(); const first = contexts[0].sources[0];
    director.setLobby(false); expect(director.musicState()).toBe("paused");
    expect(first.stop).not.toHaveBeenCalled(); vi.advanceTimersByTime(700);
    expect(first.stop).toHaveBeenCalledTimes(1);
    director.setLobby(true); await settle();
    expect(contexts[0].sources).toHaveLength(2); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not stack loops when moving from the menu into the lobby during a fade", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    await director.unlock(); await settle(); const first = contexts[0].sources[0];
    director.setLobby(false); vi.advanceTimersByTime(100); director.setLobby(true); vi.advanceTimersByTime(1000);
    expect(first.stop).not.toHaveBeenCalled(); expect(contexts[0].sources).toHaveLength(1);
  });
  it("honors music off, master mute, and hidden tabs", async () => {
    const director = new AudioDirector(); director.configureMusic(false, .5); director.setLobby(true);
    await director.unlock(); await settle(); expect(fetch).not.toHaveBeenCalled();
    director.configureMusic(true, .5); await settle(); expect(director.musicState()).toBe("playing");
    director.configure(.25, true); vi.advanceTimersByTime(700); expect(director.musicState()).toBe("off");
    director.configure(.25, false); expect(director.musicState()).toBe("playing");
    director.setPageVisible(false); vi.advanceTimersByTime(700); expect(director.musicState()).toBe("paused");
    director.setPageVisible(true); expect(director.musicState()).toBe("playing");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not start a pending download after leaving the lobby, and allows retry after failure", async () => {
    let complete!: (response: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { complete = resolve; })));
    const director = new AudioDirector(); director.setLobby(true); await director.unlock();
    director.setLobby(false); complete({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); await settle();
    expect(contexts[0].sources).toHaveLength(0);
    const failed = new AudioDirector(); failed.setLobby(true);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await failed.unlock(); await settle(); expect(failed.musicState()).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    await failed.unlock(); await settle(); expect(failed.musicState()).toBe("playing");
  });
});
