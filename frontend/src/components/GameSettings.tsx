import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { Record } from "@phosphor-icons/react/dist/csr/Record";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { audioDirector } from "../game/AudioDirector";
import { useGameplayRecording } from "./GameplayRecorder";
import { readPerformance } from "../game/performance";

type Page = "audio" | "display" | "capture";
interface Preferences { scares:boolean; volume:number; muted:boolean; reduced:boolean; music:boolean; musicVolume:number; effectsVolume:number }
function readPreferences():Preferences {
  const level=(value:unknown,fallback:number)=>typeof value==="number"&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
  const defaults={scares:true,volume:.25,muted:false,reduced:window.matchMedia("(prefers-reduced-motion: reduce)").matches,music:true,musicVolume:.55,effectsVolume:.8};
  try {
    const saved=JSON.parse(localStorage.getItem("i-swear-preferences-v1")??"null");
    return {scares:saved?.scares!==false,volume:level(saved?.volume,.25),muted:Boolean(saved?.muted),
      reduced:typeof saved?.reduced==="boolean"?saved.reduced:defaults.reduced,music:saved?.music!==false,
      musicVolume:level(saved?.musicVolume,.55),effectsVolume:level(saved?.effectsVolume,.8)};
  } catch {return defaults;}
}
function VolumeControl({name,value,onChange}:{name:string;value:number;onChange:(value:number)=>void}) {
  const id=useId(),percent=Math.round(value*100);
  return <div className="kit-volume">
    <div className="kit-volume-title"><label htmlFor={id}>{name}</label><output htmlFor={id}>{percent}<small>%</small></output></div>
    <input id={id} type="range" min="0" max="1" step=".05" value={value} style={{"--level":percent+"%"} as CSSProperties} onChange={event=>onChange(Number(event.target.value))}/>
    <div className="kit-scale" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
  </div>;
}
function ToggleControl({name,note,checked,onChange}:{name:string;note:string;checked:boolean;onChange:(checked:boolean)=>void}) {
  const id=useId();
  return <div className="kit-toggle">
    <div><label htmlFor={id}>{name}</label><small>{note}</small></div>
    <div className="kit-switch"><input id={id} type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span aria-hidden="true">{checked?"ON":"OFF"}</span></div>
  </div>;
}
function PerformanceReadout() {
  const [sample,setSample]=useState(readPerformance);
  useEffect(()=>{const timer=window.setInterval(()=>setSample(readPerformance()),1000);return ()=>window.clearInterval(timer);},[]);
  return <div className="kit-performance">
    <span>LIVE PERFORMANCE</span>
    <div><p><b>{sample.fps||"—"}</b><small>frames / second</small></p><p><b>{sample.latency??"—"}<em>ms</em></b><small>connection</small></p></div>
    <small>95th percentile frame time: {sample.frame95} ms</small>
  </div>;
}
function MusicReadout() {
  const state=useSyncExternalStore(audioDirector.onMusic,audioDirector.musicState),title=useSyncExternalStore(audioDirector.onMusic,audioDirector.musicTitle);
  const label={playing:"NOW PLAYING",loading:"LOADING SCORE",waiting:"TAP A CONTROL TO ENABLE AUDIO",paused:"PAUSED",off:"MUSIC OFF",unavailable:"REOPEN SETTINGS TO RETRY"}[state];
  return <div className="kit-score" role="status"><span className={state==="playing"?"is-playing":""}/><div><small>{label}</small><b>{title}</b></div></div>;
}

export function GameSettings({worldActive,lobbyActive=false,menu=false,onLeave,onOpenChange,onPreviewScare,pausedSolo=false}:{worldActive:boolean;pausedSolo?:boolean;lobbyActive?:boolean;menu?:boolean;onLeave?:()=>void;onOpenChange?:(open:boolean)=>void;onPreviewScare?:()=>void}) {
  const capture=useGameplayRecording(),[open,setOpen]=useState(false),[page,setPage]=useState<Page>("audio");
  const [settings,setSettings]=useState(readPreferences);
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),closeButton=useRef<HTMLButtonElement>(null),id=useId();
  const hasCapture=!menu&&!lobbyActive;
  const pages:Page[]=hasCapture?["audio","display","capture"]:["audio","display"];
  const activePage=page==="capture"&&!hasCapture?"audio":page;
  useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
  const change=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setSettings(current=>({...current,[key]:value}));
  useEffect(()=>{
    audioDirector.configure(settings.volume,settings.muted);audioDirector.configureMusic(settings.music,settings.musicVolume);audioDirector.configureEffects(settings.effectsVolume);
    audioDirector.setScares(settings.scares);document.documentElement.dataset.scares=settings.scares?"on":"off";
    document.documentElement.dataset.motion=settings.reduced?"reduced":"normal";
    try{localStorage.setItem("i-swear-preferences-v1",JSON.stringify(settings));}catch{/* Preferences are optional. */}
  },[settings]);
  useEffect(()=>{
    const unlock=()=>{void audioDirector.unlock();},visibility=()=>audioDirector.setPageVisible(document.visibilityState!=="hidden");
    window.addEventListener("pointerdown",unlock,{once:true});window.addEventListener("keydown",unlock,{once:true});document.addEventListener("visibilitychange",visibility);
    visibility();audioDirector.setWorld(worldActive);audioDirector.setLobby(lobbyActive);
    return ()=>{window.removeEventListener("pointerdown",unlock);window.removeEventListener("keydown",unlock);document.removeEventListener("visibilitychange",visibility);audioDirector.setWorld(false);audioDirector.setLobby(false);};
  },[worldActive,lobbyActive]);
  useEffect(()=>{
    if(!open)return;
    closeButton.current?.focus();const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;if(trigger.current?.isConnected)trigger.current.focus();};
  },[open]);
  function keyboard(event:KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if(event.key==="Escape"){event.preventDefault();setOpen(false);return;}
    if(event.key!=="Tab")return;
    const controls=dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled):not([tabindex='-1']), input:not(:disabled), a[href], [tabindex='0']");
    if(!controls?.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  function pageKeys(event:KeyboardEvent<HTMLElement>) {
    const index=pages.indexOf(activePage);
    const next=event.key==="ArrowDown"||event.key==="ArrowRight"?(index+1)%pages.length:event.key==="ArrowUp"||event.key==="ArrowLeft"?(index+pages.length-1)%pages.length:event.key==="Home"?0:event.key==="End"?pages.length-1:-1;
    if(next<0)return;event.preventDefault();setPage(pages[next]);document.getElementById(id+"-"+pages[next])?.focus();
  }
  return <div className={`game-settings ${menu?"menu-settings":""}`}>
    <button ref={trigger} className="icon-button" aria-label="Sound and accessibility settings" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined}
      onClick={()=>{void audioDirector.unlock();setOpen(current=>!current);}}><GearSix size={20}/></button>
    {open&&createPortal(<div className="settings-scrim" onPointerDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section id={id} ref={dialog} className="settings-book" role="dialog" aria-modal="true" aria-labelledby={id+"-title"} onKeyDown={keyboard}>
        <aside className="settings-binding">
          <div className="kit-brand"><span>YOUR FIELD KIT</span><b>I SWEAR<span>!</span></b></div>
          <nav className="kit-tabs" role="tablist" aria-label="Settings sections" onKeyDown={pageKeys}>
            {pages.map((item,index)=><button key={item} id={id+"-"+item} role="tab" aria-selected={activePage===item} aria-controls={id+"-page"} tabIndex={activePage===item?0:-1} onClick={()=>setPage(item)}>
              {item==="audio"?<SpeakerHigh size={20}/>:item==="display"?<GearSix size={20}/>:<Record size={20}/>}<span>{item==="audio"?"Audio":item==="display"?"Display":"Capture"}</span><small>{String(index+1).padStart(2,"0")}</small>
            </button>)}
          </nav>
          <div className="kit-cover" aria-hidden="true"><img src="/art/campus-night.svg" alt=""/><span>SAME EVENT.<br/>DIFFERENT MEMORIES.</span></div>
        </aside>
        <div className="settings-page">
          <header className="kit-heading"><div><span>PLAYER PREFERENCES</span><h2 id={id+"-title"}>Settings</h2></div><button ref={closeButton} className="kit-close" aria-label="Close settings" onClick={()=>setOpen(false)}><X size={23}/></button></header>
          <div className="kit-body" role="tabpanel" id={id+"-page"} aria-labelledby={id+"-"+activePage} tabIndex={0}>
            {activePage==="audio"&&<>
              <div className="kit-section-heading"><h3>The sound of the night.</h3><button className={`kit-mute ${settings.muted?"muted":""}`} aria-label={settings.muted?"Unmute all sound":"Mute all sound"} aria-pressed={settings.muted} onClick={()=>change("muted",!settings.muted)}>
                {settings.muted?<SpeakerSlash size={19}/>:<SpeakerHigh size={19}/>}<span>{settings.muted?"MUTED":"SOUND ON"}</span>
              </button></div>
              <VolumeControl name="Master volume" value={settings.volume} onChange={value=>change("volume",value)}/>
              <ToggleControl name="Music" note="Lobby themes & investigation score" checked={settings.music} onChange={value=>change("music",value)}/>
              <MusicReadout/>
              <p className="kit-note">Music: <a href="https://opengameart.org/content/moil" target="_blank" rel="noreferrer">Moil · Ruskerdax</a> / <a href="https://opengameart.org/content/unsolved-investigation" target="_blank" rel="noreferrer">Unsolved Investigation · isaiah658</a>. Both CC0. Effects: <a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noreferrer">Kenney (CC0)</a>. <a href="/audio/CREDITS.md" target="_blank" rel="noreferrer">Credits ↗</a></p>
              <VolumeControl name="Music volume" value={settings.musicVolume} onChange={value=>change("musicVolume",value)}/>
              <VolumeControl name="Sound effects" value={settings.effectsVolume} onChange={value=>change("effectsVolume",value)}/>
              <button className="kit-preview" disabled={settings.muted||!settings.volume||!settings.effectsVolume} onClick={()=>void audioDirector.previewPickup()}><SpeakerHigh size={17}/>Preview pickup</button>
            </>}
            {activePage==="display"&&<>
              <div className="kit-section-heading"><h3>A steadier view.</h3></div>
              <ToggleControl name="Reduce motion" note="Reduce camera easing and character animation." checked={settings.reduced} onChange={value=>change("reduced",value)}/>
              <ToggleControl name="Cinematic scares" note="Show the creature’s face lunge and attack roar. Pursuit and capture rules stay the same." checked={settings.scares} onChange={value=>change("scares",value)}/>
              {worldActive&&onPreviewScare&&<button className="kit-preview-scare" onClick={()=>{void audioDirector.prepareScare().then(()=>{setOpen(false);onPreviewScare();});}}>Preview creature encounter</button>}
              <p className="kit-caption">Every sound cue also has a visible label or message.</p>
              {worldActive&&<PerformanceReadout/>}
              <div className="kit-controls"><span>KEEP THESE HANDY</span><p><kbd>W A S D</kbd> Move <kbd>E</kbd> Inspect</p><p><kbd>M</kbd> Memories <kbd>Tab</kbd> Reconstruction</p></div>
            </>}
            {activePage==="capture"&&<>
              <div className="kit-section-heading"><h3>Keep a piece of the night.</h3></div>
              <p className="kit-caption">Save a clip of your investigation.</p>
              <div className="kit-capture"><Record size={42} weight="duotone"/>{capture.control}</div>
            </>}
          </div>
          <footer className="kit-footer"><div><small>{worldActive?pausedSolo?"Solo play waits while you read.":"The investigation keeps running.":"Changes apply immediately."}</small><span><kbd>Esc</kbd> Close</span></div><div className="kit-footer-actions">
            {onLeave&&<button className="kit-leave" onClick={()=>{setOpen(false);onLeave();}}>Leave case</button>}
            <button className="kit-return" onClick={()=>setOpen(false)}>{menu?"Back to menu":"Back to game"}</button>
          </div></footer>
        </div>
      </section>
    </div>,document.body)}
    {capture.recording&&!open&&<button className="capture-stop" onClick={capture.stop}>Stop recording</button>}
  </div>;
}
