import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioDirector } from "./AudioDirector";

class Param {
  value = 0;
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn(); exponentialRampToValueAtTime = vi.fn(); cancelScheduledValues = vi.fn();
}
class Node { gain = new Param(); connect = vi.fn(); disconnect = vi.fn(); stream = {}; }
class Source {
  buffer: unknown = null; loop = false; loopEnd = 0; onended: (() => void) | null = null;
  connect = vi.fn(); start = vi.fn(); stop = vi.fn(); disconnect = vi.fn();
}
class Context {
  state = "running"; currentTime = 0; destination = new Node();
  sources: Source[] = []; gains: Node[] = [];
  createGain() { const gain = new Node(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createOscillator() { return { type:"sine",frequency:new Param(),connect:vi.fn(),start:vi.fn(),stop:vi.fn(),disconnect:vi.fn(),onended:null }; }
  createMediaStreamDestination() { return new Node(); }
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => ({ duration: [0,45.714286,60,.95,.18][new Uint8Array(bytes)[0]] }));
  resume = vi.fn(async () => { this.state = "running"; });
}
let contexts: Context[];
const settle = async () => { for (let index=0; index<20; index++) await Promise.resolve(); };
const response = (url: string) => ({ ok:true,arrayBuffer:async () => new Uint8Array([url.includes("lobby-theme") ? 1 : url.includes("investigation-theme") ? 2 : url.includes("record-pickup") ? 3 : 4]).buffer });
const musicFetches = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("-theme"));
const loopGain = (source: Source) => source.connect.mock.calls[0][0] as Node;
beforeEach(() => {
  vi.useFakeTimers(); contexts = [];
  vi.stubGlobal("AudioContext",class extends Context { constructor() { super(); contexts.push(this); } });
  vi.stubGlobal("fetch",vi.fn(async (url: string) => response(url)));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("scene score and tactile effects", () => {
  it("waits for a gesture and reuses one loop between menu and lobby", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    expect(fetch).not.toHaveBeenCalled(); expect(director.musicState()).toBe("waiting");
    await director.unlock(); await settle();
    expect(director.musicState()).toBe("playing");
    director.setLobby(true); director.configureMusic(true,.2); await director.unlock();
    expect(musicFetches()).toHaveLength(1);
    expect(contexts[0].sources).toHaveLength(1);
    expect(contexts[0].sources[0].loop).toBe(true);
    expect(contexts[0].sources[0].start).toHaveBeenCalledTimes(1);
  });
  it("crossfades into the investigation and releases the old decoded score", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    await director.unlock(); await settle(); const lobby = contexts[0].sources[0];
    director.setWorld(true); await settle();
    expect(director.musicTitle()).toBe("Footnotes After Midnight");
    expect(contexts[0].sources).toHaveLength(2);
    expect(contexts[0].sources[1].loopEnd).toBe(60);
    expect(lobby.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1300); expect(lobby.stop).toHaveBeenCalledOnce();
    expect(lobby.disconnect).toHaveBeenCalledOnce();
    director.setWorld(false); await settle();
    // The previous lobby buffer was evicted, keeping settled music memory bounded.
    expect(musicFetches().filter(([url]) => String(url).includes("lobby-theme"))).toHaveLength(2);
    expect(director.musicTitle()).toBe("Everybody Has a Version");
  });
  it("cancels a pending fade without stacking loops", async () => {
    const director = new AudioDirector(); director.setLobby(true);
    await director.unlock(); await settle(); const first = contexts[0].sources[0];
    director.setLobby(false); vi.advanceTimersByTime(100); director.setLobby(true); vi.advanceTimersByTime(1400);
    expect(first.stop).not.toHaveBeenCalled(); expect(contexts[0].sources).toHaveLength(1);
  });
  it("pauses hidden pages and the reveal, then reuses the current buffer", async () => {
    const director = new AudioDirector(); director.setWorld(true);
    await director.unlock(); await settle();
    director.setPageVisible(false); vi.advanceTimersByTime(1300);
    expect(director.musicState()).toBe("paused");
    const count = contexts[0].sources.length; director.cue("evidence"); expect(contexts[0].sources).toHaveLength(count);
    director.setPageVisible(true); expect(director.musicState()).toBe("playing");
    expect(musicFetches()).toHaveLength(1);
    director.setWorld(false); vi.advanceTimersByTime(1300); expect(director.musicState()).toBe("paused");
  });
  it("honors music off and master mute while sound effects have independent volume", async () => {
    const director = new AudioDirector(); director.configureMusic(false,.5); director.setWorld(true);
    await director.unlock(); await settle(); expect(musicFetches()).toHaveLength(0);
    director.cue("evidence"); expect(contexts[0].sources).toHaveLength(1);
    contexts[0].currentTime = 1; director.configureEffects(0); director.cue("evidence");
    expect(contexts[0].sources).toHaveLength(1);
    director.configureMusic(true,.5); await settle(); expect(director.musicState()).toBe("playing");
    director.configure(.25,true); vi.advanceTimersByTime(1300); expect(director.musicState()).toBe("off");
    director.configureEffects(.8); director.cue("evidence"); expect(contexts[0].sources).toHaveLength(2);
    director.configure(.25,false); expect(director.musicState()).toBe("playing");
  });
  it("never starts an obsolete pending track after leaving its scene", async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal("fetch",vi.fn((url: string) => url.includes("investigation-theme") ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response(url))));
    const director = new AudioDirector(); director.setWorld(true); await director.unlock();
    director.setWorld(false); finish(response("investigation-theme")); await settle();
    expect(contexts[0].sources).toHaveLength(0); expect(director.musicState()).toBe("paused");
  });
  it("reports a failed score and retries from a user interaction", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => ({ok:false})));
    const director = new AudioDirector(); director.setLobby(true); await director.unlock(); await settle();
    expect(director.musicState()).toBe("unavailable");
    vi.stubGlobal("fetch",vi.fn(async (url: string) => response(url)));
    await director.unlock(); await settle(); expect(director.musicState()).toBe("playing");
  });
  it("ducks for conversation and pickup without making speech fight a rebound", async () => {
    const director = new AudioDirector(); director.setWorld(true); await director.unlock(); await settle();
    const gain = loopGain(contexts[0].sources[0]); expect(gain.gain.value).toBeCloseTo(.55);
    director.setVoiceFocus(true); expect(gain.gain.value).toBeCloseTo(.55*.32);
    director.cue("evidence"); vi.advanceTimersByTime(1100);
    expect(gain.gain.value).toBeCloseTo(.55*.32);
    director.setVoiceFocus(false); expect(gain.gain.value).toBeCloseTo(.55);
    contexts[0].currentTime = 2; director.cue("evidence");
    expect(gain.gain.value).toBeCloseTo(.55*.62);
    vi.advanceTimersByTime(1100); expect(gain.gain.value).toBeCloseTo(.55);
  });
  it("avoids a double inspection cue and makes remote pickups quieter", async () => {
    const director = new AudioDirector(); await director.unlock(); await settle();
    director.cue("evidence",.45); director.cue("inspection");
    expect(contexts[0].sources).toHaveLength(1);
    expect(loopGain(contexts[0].sources[0]).gain.value).toBeCloseTo(.75*.45);
    director.cue("evidence",1); expect(contexts[0].sources).toHaveLength(2);
    expect(loopGain(contexts[0].sources[1]).gain.value).toBeCloseTo(.75);
    contexts[0].currentTime = .4; director.cue("inspection"); expect(contexts[0].sources).toHaveLength(3);
  });
  it("caps overlapping pickups and frees finished sample voices", async () => {
    const director = new AudioDirector(); await director.unlock(); await settle();
    for (let index=0;index<5;index++) { contexts[0].currentTime = index*.2; director.cue("evidence"); }
    expect(contexts[0].sources).toHaveLength(4);
    contexts[0].sources[0].onended!();
    expect(contexts[0].sources[0].disconnect).toHaveBeenCalledOnce();
    contexts[0].currentTime = 2; director.cue("evidence"); expect(contexts[0].sources).toHaveLength(5);
  });
  it("previews the loaded pickup and routes effects through the recorded game mix", async () => {
    const director = new AudioDirector(); await director.previewPickup();
    expect(contexts[0].sources).toHaveLength(1);
    const stream = director.recordingStream(); expect(stream).toBeTruthy();
    expect(director.recordingStream()).toBe(stream);
    expect(contexts[0].gains[0].connect).toHaveBeenCalledTimes(2);
    expect(contexts[0].gains[1].connect).toHaveBeenCalledWith(contexts[0].gains[0]);
  });
});
