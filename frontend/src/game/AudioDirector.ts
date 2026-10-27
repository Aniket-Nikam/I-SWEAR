type Cue = "inspection" | "clash" | "evidence" | "reveal" | "step";
type MusicState = "off" | "paused" | "unavailable" | "loading" | "playing" | "waiting";

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.25;
  private muted = false;
  private ambient: GainNode | null = null;
  private capture: MediaStreamAudioDestinationNode | null = null;
  private worldActive = false;
  private lobbyActive = false;
  private pageVisible = true;
  private musicEnabled = true;
  private musicVolume = .55;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicLoading: Promise<void> | null = null;
  private musicFailed = false;
  private musicStop: number | null = null;
  private musicListeners = new Set<() => void>();

  musicState = (): MusicState => {
    if (!this.musicEnabled || this.muted) return "off";
    if (!this.lobbyActive || !this.pageVisible) return "paused";
    if (this.musicFailed) return "unavailable";
    if (this.musicLoading) return "loading";
    if (this.musicSource) return "playing";
    return "waiting";
  };
  onMusic = (listener: () => void) => { this.musicListeners.add(listener); return () => { this.musicListeners.delete(listener); }; };
  private notifyMusic() { this.musicListeners.forEach(listener => listener()); }

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
      this.musicFailed = false;
      this.setWorld(this.worldActive);
      this.updateMusic();
    } catch { /* Text equivalents keep the game playable without audio. */ }
  }
  configure(volume: number, muted: boolean) {
    this.volume = volume; this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.04);
    this.updateMusic();
  }
  configureMusic(enabled: boolean, volume: number) {
    this.musicEnabled = enabled;
    this.musicVolume = Math.min(1, Math.max(0, volume));
    this.updateMusic();
  }
  setLobby(active: boolean) { this.lobbyActive = active; this.updateMusic(); }
  setPageVisible(visible: boolean) { this.pageVisible = visible; this.setWorld(this.worldActive); this.updateMusic(); }

  private updateMusic() {
    const context = this.context;
    const wanted = this.lobbyActive && this.musicEnabled && !this.muted && this.pageVisible;
    if (!wanted && context && this.musicSource && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(context.currentTime);
      this.musicGain.gain.setTargetAtTime(0, context.currentTime, .12);
      if (this.musicStop === null) {
        const source = this.musicSource;
        this.musicStop = window.setTimeout(() => {
          source.stop(); source.disconnect();
          if (this.musicSource === source) this.musicSource = null;
          this.musicStop = null; this.notifyMusic();
        }, 650);
      }
    }
    if (!wanted || !context || context.state !== "running" || !this.master) { this.notifyMusic(); return; }
    if (this.musicStop !== null) { window.clearTimeout(this.musicStop); this.musicStop = null; }
    if (this.musicBuffer) {
      if (!this.musicGain) { this.musicGain = context.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master); }
      if (!this.musicSource) {
        this.musicSource = context.createBufferSource(); this.musicSource.buffer = this.musicBuffer;
        this.musicSource.loop = true;
        this.musicSource.loopEnd = Math.min(this.musicBuffer.duration, 64 * 60 / 78);
        this.musicSource.connect(this.musicGain); this.musicSource.start();
      }
      this.musicGain.gain.cancelScheduledValues(context.currentTime);
      this.musicGain.gain.setTargetAtTime(this.musicVolume, context.currentTime, .25);
    } else if (!this.musicLoading && !this.musicFailed) {
      this.musicLoading = fetch("/audio/lobby-theme.mp3")
        .then(response => { if (!response.ok) throw new Error("Music unavailable"); return response.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes))
        .then(buffer => { this.musicBuffer = buffer; this.musicLoading = null; this.updateMusic(); })
        .catch(() => { this.musicFailed = true; this.musicLoading = null; this.notifyMusic(); });
    }
    this.notifyMusic();
  }
  setWorld(active: boolean) {
    this.worldActive = active;
    if (!this.context || !this.master) return;
    if (!this.ambient) {
      if (!active) return;
      this.ambient = this.context.createGain(); this.ambient.gain.value = 0; this.ambient.connect(this.master);
      for (const frequency of [55, 82.5]) {
        const oscillator = this.context.createOscillator(); oscillator.type = "sine"; oscillator.frequency.value = frequency;
        oscillator.connect(this.ambient); oscillator.start();
      }
    }
    this.ambient.gain.setTargetAtTime(active && this.pageVisible ? 0.018 : 0, this.context.currentTime, 0.6);
  }
  cue(kind: Cue) {
    if (!this.context || !this.master || this.context.state !== "running" || !this.pageVisible) return;
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
