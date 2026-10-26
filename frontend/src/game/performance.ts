export interface PerformanceSample { fps: number; frame95: number; latency: number | null }
let sample: PerformanceSample = { fps: 0, frame95: 0, latency: null };
let frames: number[] = [];
let previous = 0;
let published = 0;

/** Sample real frame intervals; Phaser's smoothed delta can conceal dropped frames. */
export function recordFrame(now: number) {
  if (previous && now - previous < 1000) frames.push(now - previous);
  previous = now;
  if (now - published < 1000 || frames.length < 2) return;
  const ordered = [...frames].sort((a, b) => a - b);
  sample = { ...sample, fps: Math.round(1000 * frames.length / frames.reduce((a, b) => a + b, 0)),
    frame95: Math.round(ordered[Math.floor((ordered.length - 1) * .95)] * 10) / 10 };
  frames = [];
  published = now;
}
export function recordLatency(latency: number) { sample = { ...sample, latency: Math.round(latency) }; }
export function readPerformance() { return sample; }
export function resetFrames() { frames = []; previous = published = 0; sample = { ...sample, fps: 0, frame95: 0 }; }
