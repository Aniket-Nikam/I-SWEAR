import { useEffect, useState } from "react";

/** Progress follows completed work. Only the finished bar gets a short visual hold. */
export function CaseLoading({stage,onComplete,onCancel,error}:{stage:number;onComplete?:()=>void;onCancel?:()=>void;error?:string}) {
  const [shown,setShown]=useState(0);
  const [fading,setFading]=useState(false);
  useEffect(()=>{setFading(false);if(stage<100)return;const timer=window.setTimeout(()=>setFading(true),450);return()=>clearTimeout(timer);},[stage]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setShown(stage));return()=>cancelAnimationFrame(frame);},[stage]);
  useEffect(()=>{if(stage<100||!onComplete)return;const timer=window.setTimeout(onComplete,650);return()=>clearTimeout(timer);},[stage,onComplete]);
  return <section className={`case-loading ${fading?'is-finished':''}`} role="status" aria-live="polite"><div className="case-loading-paper"><span className="case-loading-stamp">ORPHEUS / CASE REGISTRY</span><h1>I SWEAR<span>!</span></h1><p>{error|| (stage<40?"Opening your case file…":stage<75?"Connecting the witnesses…":stage<100?"Preparing the scene…":"Case ready. Welcome, witness.")}</p><div className="case-loading-track" role="progressbar" aria-label="Preparing case" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage}><i style={{width:`${shown}%`}} /></div><small>{stage}% · {stage===100?"ALL RECORDS IN ORDER":"PLEASE KEEP YOUR ALIBI READY"}</small>{onCancel&&<button onClick={onCancel}>{error?"Back to menu":"Cancel"}</button>}</div></section>;
}
