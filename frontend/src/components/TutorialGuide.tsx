import { useEffect, useState } from "react";
import { useCaseState } from "./Casefile";
import type { InvestigationPanel } from "./InvestigationHUD";
import type { GameSocket } from "../network/GameSocket";
import type { RecoveredEvidence, RoomSnapshot, Testimony, TimelineState } from "../types/protocol";

export const TUTORIAL_CHAPTERS=7;
interface Progress { step:number; answer:string }
export function TutorialGuide({snapshot,socket,playerId,panel,obscured,evidence,testimonies,timeline,onOpen,onHint,onLeave,onStage}:{
 snapshot:RoomSnapshot;socket:GameSocket;playerId:string;panel:InvestigationPanel|null;obscured:boolean;
 evidence:RecoveredEvidence[];testimonies:Testimony[];timeline:TimelineState;
 onOpen:(panel:InvestigationPanel)=>void;onHint:(text:string)=>void;onLeave:()=>void;
 onStage?:(stage:number,targetId:string|undefined)=>void;
}) {
 const key=`i-swear-lesson-v2-${snapshot.room.code}`;
 const [progress,setProgress]=useState<Progress>(()=>{try{const p=JSON.parse(sessionStorage.getItem(key)??"null");if(p&&Number.isInteger(p.step)&&p.step>=0&&p.step<7)return p;}catch{/* Optional checkpoint. */}return {step:0,answer:""};});
 const [folded,setFolded]=useState(false);
 const state=useCaseState(socket);
 const badge=snapshot.interactables.find(item=>item.id==="atrium_badge");
 const backup=snapshot.interactables.find(item=>item.id==="cctv_terminal");
 const record=evidence.find(item=>item.object_id===badge?.id);
 const second=evidence.find(item=>item.object_id===backup?.id);
 const witnesses=testimonies.filter(item=>!item.retracted&&item.memory.event_id==="arrival"&&item.player_id!==playerId);
 const locations=[...new Set(witnesses.map(item=>String(item.memory.claim.location)))].sort();
 const correct=!!record&&progress.answer===record.claim.location;
 const contradicted=witnesses.find(item=>record&&item.memory.claim.location!==record.claim.location);
 const challenged=!!contradicted&&contradicted.responses[playerId]?.response==="DOUBT";
 const deduction=timeline.slots.find(item=>item?.event_id==="arrival");
 const linked=!!record&&!!second&&!!deduction?.source_ids?.includes(record.id)&&!!deduction.source_ids.includes(second.id);
 const at=String(record?.claim.time??witnesses[0]?.memory.claim.time??"the disputed time");
 const chapters=[
  {title:"Where did the case go?",body:"During the blackout, a case changed rooms. Two witnesses remember its destination differently. Your first job is to settle that one disagreement.",task:"Read their statements below. Which record could tell us who is right?",done:true},
  {title:"Find a record, not a hunch.",body:"Move with WASD or arrows; use the direction pad on a phone. Coral strips mark door gaps. Fold this guide with − to see more of the scene.",task:`Follow the gold marker to ${badge?.label??"the badge scanner"} in ${badge?.room??"the atrium"}. Press E or tap Inspect beside it.`,done:!!record},
  {title:"What does the record say?",body:record?.text??"Recover the badge record first.",task:`Which room does the recovered record show at ${at}?`,done:correct},
  {title:"Someone remembers it wrong.",body:`The record names ${record?.claim.location??"a room"}. Open Testimony and compare that with the two statements. Confidence is a wager, not a truth meter.`,task:"Choose Doubt on the statement that names the wrong room. Then close Testimony.",done:challenged,panel:"testimony" as const},
  {title:"Check an independent source.",body:"The badge log establishes a room and time, but it does not identify everything that was carried. A camera record can fill those gaps. In a full case, backup leads open later; this practice waits for you.",task:`Open the backup, then inspect ${backup?.label??"the CCTV terminal"} in ${backup?.room??"the CCTV room"}. Follow the gold marker.`,done:!!second,panel:state?.lead_available?"map" as const:undefined},
  {title:"Build one supported moment.",body:"Open Reconstruction. Select the badge record, place it in the practice position, then select the camera record and choose Link selected source. Together they establish more than either record alone.",task:"Combine both physical records. This lesson supplies position 2; in a full case you work out the order of all six moments.",done:linked,panel:"board" as const},
  {title:"You resolved a contradiction.",body:deduction?.text??"Two independent records now support the same moment.",task:"That is the loop: explore → question a memory → combine records. A full case has six moments. Share your memories, work with other badges, and vote together. Nightmare mode adds a hunter: sealing a claim against a recovered record wakes it. Correct that claim or outrun it.",done:true},
 ];
 const chapter=chapters[progress.step];
 const targetId=progress.step===1&&!record?badge?.id:progress.step===4&&!second?backup?.id:undefined;
 const hint=`${chapter.title} ${chapter.task}`;
 useEffect(()=>{onHint(hint);return()=>onHint("");},[hint,onHint]);
 useEffect(()=>{onStage?.(progress.step,targetId);},[progress.step,targetId,onStage]);
 useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify(progress));}catch{/* Optional checkpoint. */}},[key,progress]);
 if(panel||obscured||snapshot.room.phase!=="exploring")return null;
 return <aside className={`tutorial-guide ${folded?"folded":""}`} aria-label="Guided tutorial" data-tutorial-step={progress.step}>
  <header><span>ONE SMALL MYSTERY <b>{progress.step+1} / 7</b></span><button aria-label={folded?"Expand tutorial":"Minimize tutorial"} onClick={()=>setFolded(!folded)}>{folded?"+":"−"}</button></header>
  {!folded&&<><div className="lesson-track" aria-hidden="true"><i style={{width:`${(progress.step+1)/7*100}%`}}/></div><div className="lesson-pages"><h2>{chapter.title}</h2><p>{chapter.body}</p>
   {progress.step===0&&<div className="lesson-statements">{witnesses.map(item=><blockquote key={item.id}><b>{item.name.replace(" (scripted)","")}</b><p>{item.memory.text}</p></blockquote>)}</div>}
   <div className={`lesson-task ${chapter.done?"complete":""}`} role="status"><b>{chapter.done?"✓ Understood":"YOUR NEXT MOVE"}</b><span>{chapter.task}</span></div>
   {progress.step===2&&<div className="lesson-answers">{locations.map(location=><button key={location} aria-pressed={progress.answer===location} onClick={()=>setProgress(p=>({...p,answer:location}))}>{location}</button>)}{progress.answer&&<p role="status">{correct?"Yes. A physical log supports that room, even if a witness disagrees.":"Check the room named in the recovered record above. You can try again."}</p>}</div>}
   {chapter.panel&&<button className="lesson-open" onClick={()=>onOpen(chapter.panel!)}>Open {({map:"floor plan",board:"reconstruction",testimony:"testimony"})[chapter.panel]} ↗</button>}
   {progress.step===4&&!state?.lead_available&&<button className="lesson-open" onClick={()=>socket.send({type:"tutorial",action:"lesson_lead"})}>Open the camera backup ↗</button>}
   {progress.step===6&&<><p className="lesson-conclusion">One event learned. This is not a six-moment case score.</p><button className="lesson-open" onClick={onLeave}>Return home · choose a full case ↗</button></>}
   <button className="lesson-exit" onClick={onLeave}>End tutorial & return home</button>
  </div><footer><button disabled={!progress.step} onClick={()=>setProgress(p=>({...p,step:p.step-1}))}>Back</button><span aria-hidden="true">{progress.step+1} / 7</span><button disabled={!chapter.done||progress.step===6} onClick={()=>setProgress(p=>({...p,step:p.step+1}))}>Next →</button></footer></>}
 </aside>;
}
