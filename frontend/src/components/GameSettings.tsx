import { useEffect, useState, useSyncExternalStore } from "react";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { audioDirector } from "../game/AudioDirector";
import { useGameplayRecording } from "./GameplayRecorder";
import { readPerformance } from "../game/performance";

function PerformanceReadout() {
  const [sample, setSample] = useState(readPerformance);
  useEffect(() => { const timer = window.setInterval(() => setSample(readPerformance()), 1000); return () => window.clearInterval(timer); }, []);
  return <p className="performance-readout" title={`95th percentile frame time: ${sample.frame95} ms`}>
    {sample.fps ? `${sample.fps} FPS` : "Measuring frame rate…"}{sample.latency !== null && ` · ${sample.latency} ms connection`}
  </p>;
}

function MusicReadout() {
  const state = useSyncExternalStore(audioDirector.onMusic, audioDirector.musicState);
  const label = { playing: "Playing", loading: "Loading theme…", waiting: "Tap a control to enable audio", paused: "Paused", off: "Music off", unavailable: "Music unavailable; reopen settings to retry" }[state];
  return <p className="music-credit" role="status"><b>{label}</b><br />Everybody Has a Version <span>· original lobby theme</span></p>;
}

export function GameSettings({ worldActive, lobbyActive = false, menu = false, onLeave }: { worldActive: boolean; lobbyActive?: boolean; menu?: boolean; onLeave?: () => void }) {
  const capture = useGameplayRecording();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("i-swear-preferences-v1") ?? "null");
      return { volume: typeof saved?.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : 0.25,
        muted: Boolean(saved?.muted), reduced: saved?.reduced ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        music: saved?.music !== false, musicVolume: typeof saved?.musicVolume === "number" ? Math.max(0, Math.min(1, saved.musicVolume)) : .55 };
    } catch { return { volume: 0.25, muted: false, reduced: false, music: true, musicVolume: .55 }; }
  });
  useEffect(() => {
    audioDirector.configure(settings.volume, settings.muted);
    audioDirector.configureMusic(settings.music, settings.musicVolume);
    document.documentElement.dataset.motion = settings.reduced ? "reduced" : "normal";
    try { localStorage.setItem("i-swear-preferences-v1", JSON.stringify(settings)); } catch { /* Preferences are optional. */ }
  }, [settings]);
  useEffect(() => {
    const unlock = () => { void audioDirector.unlock(); };
    const visibility = () => audioDirector.setPageVisible(document.visibilityState !== "hidden");
    window.addEventListener("pointerdown", unlock, { once: true }); window.addEventListener("keydown", unlock, { once: true });
    document.addEventListener("visibilitychange", visibility);
    visibility();
    audioDirector.setWorld(worldActive);
    audioDirector.setLobby(lobbyActive);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); document.removeEventListener("visibilitychange", visibility); audioDirector.setWorld(false); audioDirector.setLobby(false); };
  }, [worldActive, lobbyActive]);
  return <div className={`game-settings ${menu ? "menu-settings" : ""}`}>
    <button className="icon-button" aria-label="Sound and accessibility settings" aria-expanded={open} onClick={() => { void audioDirector.unlock(); setOpen(!open); }}><GearSix size={20} /></button>
    {open && <section className="settings-sheet" aria-label="Sound and accessibility">
      <h2>Sound & accessibility</h2>
      <button onClick={() => setSettings({ ...settings, muted: !settings.muted })}>{settings.muted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />} {settings.muted ? "Sound muted" : "Sound on"}</button>
      <label htmlFor="game-volume">Volume<input id="game-volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /></label>
      <label className="motion-setting"><input type="checkbox" checked={settings.music} onChange={(event) => setSettings({ ...settings, music: event.target.checked })} /> Lobby music</label>
      {lobbyActive ? <MusicReadout /> : <p>Music returns in the witness room.</p>}
      <label htmlFor="music-volume">Music volume<input id="music-volume" type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(event) => setSettings({ ...settings, musicVolume: Number(event.target.value) })} /></label>
      <label className="motion-setting"><input type="checkbox" checked={settings.reduced} onChange={(event) => setSettings({ ...settings, reduced: event.target.checked })} /> Reduce motion</label>
      {worldActive && <PerformanceReadout />}
      {!menu && !lobbyActive && capture.control}
      <p>Every sound cue also has a visible label or message.</p>
      <button onClick={() => setOpen(false)}>Close settings</button>
      {onLeave && <button onClick={onLeave}>Leave case</button>}
    </section>}
    {capture.recording && !open && <button className="capture-stop" onClick={capture.stop}>Stop recording</button>}
  </div>;
}
