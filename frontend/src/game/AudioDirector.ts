type Cue = "inspection" | "clash" | "evidence" | "reveal" | "step";

class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.25;
  private muted = false;
  private ambient: GainNode | null = null;
  private capture: MediaStreamAudioDestinationNode | null = null;

  recordingStream() {
    if (!this.context || !this.master) return null;
    if (!this.capture) { this.capture = this.context.createMediaStreamDestination(); this.master.connect(this.capture); }
    return this.capture.stream;
  }

  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.connect(this.context.destination); this.configure(this.volume, this.muted);
      }
      if (this.context.state === "suspended") await this.context.resume();
    } catch { /* Text equivalents keep the game playable without audio. */ }
  }
  configure(volume: number, muted: boolean) {
    this.volume = volume; this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.04);
  }
  setWorld(active: boolean) {
    if (!this.context || !this.master) return;
    if (!this.ambient) {
      this.ambient = this.context.createGain(); this.ambient.gain.value = 0; this.ambient.connect(this.master);
      for (const frequency of [55, 82.5]) {
        const oscillator = this.context.createOscillator(); oscillator.type = "sine"; oscillator.frequency.value = frequency;
        oscillator.connect(this.ambient); oscillator.start();
      }
    }
    this.ambient.gain.setTargetAtTime(active ? 0.018 : 0, this.context.currentTime, 0.6);
  }
  cue(kind: Cue) {
    if (!this.context || !this.master || this.context.state !== "running") return;
    const frequencies = { inspection: [520, 650], clash: [185, 92], evidence: [660, 880], reveal: [220, 277, 330], step: [95] }[kind];
    frequencies.forEach((frequency, index) => {
      const context = this.context!, now = context.currentTime + index * (kind === "step" ? 0 : 0.07);
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = kind === "clash" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === "clash" ? 0.7 : 0.9), now + 0.15);
      gain.gain.setValueAtTime(0.001, now); gain.gain.exponentialRampToValueAtTime(kind === "step" ? 0.04 : 0.12, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "reveal" ? 0.9 : 0.2));
      oscillator.connect(gain); gain.connect(this.master!); oscillator.start(now); oscillator.stop(now + 1);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
export const audioDirector = new AudioDirector();
