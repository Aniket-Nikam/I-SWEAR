import { useEffect, useState } from "react";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { audioDirector } from "../game/AudioDirector";
import { useGameplayRecording } from "./GameplayRecorder";

export function GameSettings({ worldActive, onLeave }: { worldActive: boolean; onLeave?: () => void }) {
  const capture = useGameplayRecording();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("i-swear-preferences-v1") ?? "null");
      return { volume: typeof saved?.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : 0.25,
        muted: Boolean(saved?.muted), reduced: saved?.reduced ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    } catch { return { volume: 0.25, muted: false, reduced: false }; }
  });
  useEffect(() => {
    audioDirector.configure(settings.volume, settings.muted);
    document.documentElement.dataset.motion = settings.reduced ? "reduced" : "normal";
    try { localStorage.setItem("i-swear-preferences-v1", JSON.stringify(settings)); } catch { /* Preferences are optional. */ }
  }, [settings]);
  useEffect(() => {
    const unlock = () => { void audioDirector.unlock().then(() => audioDirector.setWorld(worldActive)); };
    window.addEventListener("pointerdown", unlock, { once: true }); window.addEventListener("keydown", unlock, { once: true });
    audioDirector.setWorld(worldActive);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); audioDirector.setWorld(false); };
  }, [worldActive]);
  return <div className="game-settings"><button className="icon-button" aria-label="Sound and accessibility settings" aria-expanded={open} onClick={() => setOpen(!open)}><GearSix size={20} /></button>{open && <section className="settings-sheet" aria-label="Sound and accessibility"><h2>Sound & accessibility</h2><button onClick={() => setSettings({ ...settings, muted: !settings.muted })}>{settings.muted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />} {settings.muted ? "Sound muted" : "Sound on"}</button><label htmlFor="game-volume">Volume<input id="game-volume" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /></label><label className="motion-setting"><input type="checkbox" checked={settings.reduced} onChange={(event) => setSettings({ ...settings, reduced: event.target.checked })} /> Reduce motion</label>{capture.control}<p>Every sound cue also has a visible label or message.</p><button onClick={() => setOpen(false)}>Close settings</button>{onLeave && <button onClick={onLeave}>Leave case</button>}</section>}{capture.recording && !open && <button className="capture-stop" onClick={capture.stop}>Stop recording</button>}</div>;
}
