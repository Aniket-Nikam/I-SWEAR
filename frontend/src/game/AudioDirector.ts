import score from "./score.json";

type Cue = "inspection" | "clash" | "evidence" | "reveal" | "step" | "growl" | "devour";
type Sample = Exclude<Cue,"step">;
type Track = keyof typeof score;
type MusicState = "off" | "paused" | "unavailable" | "loading" | "playing" | "waiting";
interface MusicVoice { source: AudioBufferSourceNode; gain: GainNode; stop: number | null }
const SAMPLE_FILES: Record<Sample, string> = { growl:"/audio/unsaid-growl.ogg?v=1",devour:"/audio/unsaid-attack.ogg?v=1", inspection: "/audio/paper-inspect.wav?v=kenney1", evidence: "/audio/record-pickup.wav?v=kenney1", clash:"/audio/memory-clash.wav?v=kenney1", reveal:"/audio/case-reveal.wav?v=kenney1" };
const unit = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private capture: MediaStreamAudioDestinationNode | null = null;
  private volume = .25;
  private effectsVolume = .8;
  private muted = false;
  private worldActive = false;
  private lobbyActive = false;
  private pageVisible = true;
  private musicEnabled = true;
  private musicVolume = .55;
  private voiceFocus = false;
  private threat=false;
  private scares=true;
  private nightmare=false;
  private duckUntil = 0;
  private unduck: number | null = null;
  private retained: { track: Track; buffer: AudioBuffer } | null = null;
  private voices = new Map<Track, MusicVoice>();
  private musicLoads = new Map<Track, Promise<void>>();
  private musicFailed = new Set<Track>();
  private samples = new Map<Sample, AudioBuffer>();
  private sampleLoads = new Map<Sample, Promise<AudioBuffer | null>>();
  private lastPickup = -Infinity;
  private lastPickupStrength = 0;
  private liveSamples = 0;
  private musicListeners = new Set<() => void>();

  private sceneTrack(): Track | null { return this.worldActive ? "investigation" : this.lobbyActive ? "lobby" : null; }
  private wantedTrack(): Track | null {
    return this.musicEnabled && this.musicVolume > 0 && this.volume > 0 && !this.muted && this.pageVisible ? this.sceneTrack() : null;
  }
  musicState = (): MusicState => {
    if (!this.musicEnabled || this.muted || !this.musicVolume || !this.volume) return "off";
    const track = this.sceneTrack();
    if (!track || !this.pageVisible) return "paused";
    if (this.musicFailed.has(track)) return "unavailable";
    if (this.musicLoads.has(track)) return "loading";
    if (this.context?.state === "running" && this.voices.has(track)) return "playing";
    return "waiting";
  };
  musicTitle = () => { const track = this.sceneTrack(); return track ? score[track].title : "Music pauses during the reveal."; };
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
        this.master.connect(this.context.destination);
        this.effects = this.context.createGain(); this.effects.connect(this.master);
        this.configure(this.volume, this.muted); this.configureEffects(this.effectsVolume);
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.musicFailed.clear();
      if (!this.muted && this.pageVisible) { for(const sample of Object.keys(SAMPLE_FILES) as Sample[])if(this.nightmare||!["growl","devour"].includes(sample))void this.loadSample(sample); }
      this.updateMusic();
    } catch { /* Visible records and messages remain usable without audio. */ }
  }
  configure(volume: number, muted: boolean) {
    this.volume = unit(volume); this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, .04);
    this.updateMusic();
  }
  configureEffects(volume: number) {
    this.effectsVolume = unit(volume);
    if (this.effects && this.context) this.effects.gain.setTargetAtTime(this.pageVisible ? this.effectsVolume : 0, this.context.currentTime, .04);
  }
  configureMusic(enabled: boolean, volume: number) { this.musicEnabled = enabled; this.musicVolume = unit(volume); this.updateMusic(); }
  setLobby(active: boolean) { this.lobbyActive = active; this.updateMusic(); }
  setWorld(active: boolean) { this.worldActive = active; this.updateMusic(); }
  setPageVisible(visible: boolean) { this.pageVisible = visible; this.configureEffects(this.effectsVolume); this.updateMusic(); }
  setVoiceFocus(active: boolean) { if (this.voiceFocus !== active) { this.voiceFocus = active; this.updateMusic(); } }

  setNightmare(active:boolean){this.nightmare=active;if(active){void this.loadSample("growl");void this.loadSample("devour");}}
  setThreat(active:boolean){if(this.threat!==active){this.threat=active;this.updateMusic();}}
  setScares(enabled:boolean){this.scares=enabled;}
  private musicLevel() {
    const discovery = this.context && this.context.currentTime < this.duckUntil ? .62 : 1;
    return this.musicVolume * Math.min(discovery, this.voiceFocus ? .32 : 1,this.threat?.15:1);
  }
  private retire(track: Track, voice: MusicVoice) {
    if (!this.context || voice.stop !== null) return;
    voice.gain.gain.cancelScheduledValues(this.context.currentTime);
    voice.gain.gain.setTargetAtTime(0, this.context.currentTime, .16);
    voice.stop = window.setTimeout(() => {
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect();
      if (this.voices.get(track) === voice) this.voices.delete(track);
      this.notifyMusic();
    }, 1200);
  }
  private updateMusic() {
    const context = this.context, track = this.wantedTrack();
    for (const [key, voice] of this.voices) if (key !== track) this.retire(key, voice);
    if (!context || context.state !== "running" || !this.master || !track) { this.notifyMusic(); return; }
    let voice = this.voices.get(track);
    if (!voice && this.retained?.track === track) {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = this.retained.buffer; source.loop = true;
      source.loopEnd = Math.min(this.retained.buffer.duration, score[track].duration);
      gain.gain.value = 0; source.connect(gain); gain.connect(this.master);
      voice = { source, gain, stop: null }; this.voices.set(track, voice); source.start();
    }
    if (voice) {
      if (voice.stop !== null) { window.clearTimeout(voice.stop); voice.stop = null; }
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setTargetAtTime(this.musicLevel(), context.currentTime, .28);
    } else if (!this.musicLoads.has(track) && !this.musicFailed.has(track)) {
      const loading = fetch(score[track].file)
        .then(response => { if (!response.ok) throw new Error("Music unavailable"); return response.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes))
        .then(buffer => {
          this.musicLoads.delete(track);
          // Retain only the current scene's decoded score. A fading source owns
          // its old buffer until stopped; settled playback needs one music buffer.
          if (this.sceneTrack() === track) this.retained = { track, buffer };
          this.updateMusic();
        })
        .catch(() => { this.musicLoads.delete(track); this.musicFailed.add(track); this.notifyMusic(); });
      this.musicLoads.set(track, loading);
    }
    this.notifyMusic();
  }
  private async loadSample(kind: Sample): Promise<AudioBuffer | null> {
    if (this.samples.has(kind)) return this.samples.get(kind)!;
    if (this.sampleLoads.has(kind)) return this.sampleLoads.get(kind)!;
    if (!this.context) return null;
    const context = this.context;
    const loading = fetch(SAMPLE_FILES[kind])
      .then(response => { if (!response.ok) throw new Error("Effect unavailable"); return response.arrayBuffer(); })
      .then(bytes => context.decodeAudioData(bytes))
      .then(buffer => { this.samples.set(kind, buffer); return buffer; })
      .catch(() => null)
      .finally(() => this.sampleLoads.delete(kind));
    this.sampleLoads.set(kind, loading);
    return loading;
  }
  async prepareScare(){await this.unlock();await this.loadSample("devour");}
  async previewPickup() {
    await this.unlock();
    if (this.muted || !this.volume || !this.effectsVolume || !this.pageVisible) return;
    await this.loadSample("evidence");
    this.cue("evidence");
  }
  private duckMusic() {
    if (!this.context) return;
    this.duckUntil = this.context.currentTime + .95;
    if (this.unduck !== null) window.clearTimeout(this.unduck);
    this.unduck = window.setTimeout(() => { this.unduck = null; this.duckUntil = 0; this.updateMusic(); }, 1000);
    this.updateMusic();
  }
  cue(kind: Cue, intensity = 1) {
    const context = this.context;
    if(kind==="devour"&&!this.scares)return;
    if (!context || !this.effects || context.state !== "running" || this.muted || !this.volume || !this.effectsVolume || !this.pageVisible || !unit(intensity)) return;
    const now = context.currentTime;
    if (kind === "inspection" && now-this.lastPickup < .3) return;
    if (kind === "evidence") {
      if (now-this.lastPickup < .12 && unit(intensity) <= this.lastPickupStrength) return;
      this.lastPickup = now; this.lastPickupStrength = unit(intensity); this.duckMusic();
    }
    const buffer = kind !== "step" ? this.samples.get(kind) : null;
    if (buffer) {
      if (this.liveSamples >= 4) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; gain.gain.value = (kind === "evidence" ? .75 : .5)*unit(intensity);
      source.connect(gain); gain.connect(this.effects); this.liveSamples++;
      source.onended = () => { this.liveSamples--; source.disconnect(); gain.disconnect(); };
      source.start(); return;
    }
    // No synthetic discovery fallback and no delayed cue after a download.
    if(kind!=="step"){void this.loadSample(kind);return;}
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type="sine";oscillator.frequency.setValueAtTime(95,now);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.025*unit(intensity),now+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.10);
    oscillator.connect(gain);gain.connect(this.effects);oscillator.start(now);oscillator.stop(now+.12);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
export const audioDirector = new AudioDirector();
