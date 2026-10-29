import { useEffect, useRef, useState } from "react";
import type { GameSocket } from "../network/GameSocket";
import type { HorrorState } from "../types/protocol";
import { audioDirector } from "../game/AudioDirector";

export function useHorror(socket:GameSocket|null){
 const [state,setState]=useState<HorrorState|null>(()=>socket?.snapshot?.horror??null);
 useEffect(()=>{setState(socket?.snapshot?.horror??null);return socket?.onMessage(message=>{
  if(message.type==="snapshot")setState(message.horror??null);
  if(message.type==="horror")setState(message.horror);
 });},[socket]);return state;
}
export function HorrorOverlay({state,playerId,preview=false,onClosePreview}:{state:HorrorState|null;playerId:string;preview?:boolean;onClosePreview?:()=>void}){
 const sounded=useRef("");
 const closePreview=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(preview)closePreview.current?.focus();},[preview]);
 useEffect(()=>{audioDirector.setNightmare(!!state);return()=>audioDirector.setNightmare(false);},[!!state]);
 const caught=state?.phase==="devouring"&&(state.final||state.target_id===playerId);
 useEffect(()=>{
  const key=state?`${state.strikes}:${state.phase}:${state.final}:${caught}`:"";
  if(key===sounded.current)return;sounded.current=key;
  if(caught)audioDirector.cue("devour");else if(state?.phase==="warning"||state?.phase==="hunting")audioDirector.cue("growl",.4);
  audioDirector.setThreat(state?.phase==="warning"||state?.phase==="hunting"||!!caught);
 },[state,caught]);
 useEffect(()=>()=>audioDirector.setThreat(false),[]);
 if(!state||state.phase==="dormant"||state.phase==="cooldown")return null;
 if(caught)return <section className="creature-capture" onKeyDown={event=>{if(event.key==="Tab"){event.preventDefault();closePreview.current?.focus();}}} role="alert" aria-label={preview?"Creature preview":"Creature attack"}><div className="capture-veil"/><div className="capture-fallback" aria-hidden="true"><svg viewBox="0 0 300 360"><path fill="#b8ab8d" d="M55 55 90 15 130 38 173 12 248 50 263 150 224 190 81 190 35 137Z"/><path fill="#09171c" d="m61 85 62 12-10 32-48-10zm112 12 65-17-9 42-48 11zM76 148 227 146 250 294 145 343 49 283Z"/><path fill="#dfd2aa" d="m78 149 18 51 11-50 18 45 14-47 18 47 18-47 17 49 15-50 19 54 2-55M52 280l28-34 9 45 22-35 16 56 18-40 22 38 16-54 18 37 16-46 31 44-24 36-77 35-70-31z"/><path fill="#ef805f" d="m83 101 20 5-7 9-13-4zm112 4 22-6-2 12-15 5z"/></svg></div><div className="capture-caption"><small>{preview?"LOCAL PREVIEW · NO CAPTURE RECORDED":"THE UNSAID"}</small><h2>{preview?"The Unsaid":state.final?"It swallowed your story.":"It found you."}</h2><p>{preview?"A local cinematic preview. The case clock keeps running; close this to continue playing.":state.final?"The truth survives. Watch what really happened.":"You will return at the entrance. Correct the claim before it comes back."}</p>{preview&&<button ref={closePreview} autoFocus onClick={onClosePreview}>Close preview</button>}</div></section>;
 return <div className={`horror-presence ${state.phase}`} aria-hidden="true"/>;
}
export function DangerNote({state,onReview,targetName}:{state:HorrorState|null;onReview:()=>void;targetName?:string}){
 if(!state||!["warning","hunting"].includes(state.phase))return null;
 return <aside className={`danger-note ${state.phase}`} role="status"><small>THE UNSAID · {state.phase==="warning"?`WAKES IN ${state.remaining}s`:`HUNTING · ${state.remaining}s`}</small><button onClick={onReview}>{targetName&&<span className="marked-witness">Marked: {targetName}. </span>}{state.reason?`Position ${state.reason.slot+1}: “${state.reason.claimed}” conflicts with “${state.reason.recorded}” in ${state.reason.record}.`:"The creature heard your theory."}<strong>{state.phase==="warning"?"Correct or withdraw the claim →":"Correct the claim or keep moving →"}</strong></button></aside>;
}
