import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("voice audio worklet", () => {
  function processor(rate: number) {
    const frames: Int16Array[] = [];
    let Constructor: new () => { process: (input: Float32Array[][]) => boolean };
    runInNewContext(readFileSync("public/audio/voice-processor.js", "utf8"), {
      sampleRate: rate, Int16Array,
      AudioWorkletProcessor: class { port = { postMessage: (buffer: ArrayBuffer) => frames.push(new Int16Array(buffer)) }; },
      registerProcessor: (_name: string, value: typeof Constructor) => { Constructor = value; },
    });
    return { worklet: new Constructor!(), frames };
  }
  it("produces exactly 25 bounded 40ms PCM frames from one second at 48kHz", () => {
    const { worklet, frames } = processor(48000);
    for (let i=0;i<375;i++) worklet.process([[new Float32Array(128).fill(.25)]]);
    expect(frames).toHaveLength(25);
    expect(frames.every(frame => frame.length === 640 && frame[0] === 8191)).toBe(true);
  });
  it("clips overdriven samples and keeps running when input is absent", () => {
    const { worklet, frames } = processor(48000);
    expect(worklet.process([])).toBe(true);
    for (let i=0;i<15;i++) worklet.process([[new Float32Array(128).fill(-2)]]);
    expect(frames[0][0]).toBe(-32768);
  });
});
