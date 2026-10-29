import { useEffect, useRef, useState } from "react";
import { useCaseState } from "./Casefile";
import type { InvestigationPanel } from "./InvestigationHUD";
import type { GameSocket } from "../network/GameSocket";
import type { ChatMessage, RecoveredEvidence, RoomSnapshot, Testimony, TimelineState } from "../types/protocol";

interface Progress { step:number; moved:boolean; inspected:string[]; visited:string[] }
const EMPTY:Progress={step:0,moved:false,inspected:[],visited:[]};
export const TUTORIAL_CHAPTERS=15;
function load(key:string):Progress {
  try {
    const value=JSON.parse(sessionStorage.getItem(key)??"null");
    if(value&&Number.isInteger(value.step)&&value.step>=0&&value.step<TUTORIAL_CHAPTERS&&Array.isArray(value.inspected)&&Array.isArray(value.visited))return value;
  } catch { /* The lesson also works with storage disabled. */ }
  return {...EMPTY};
}

export function TutorialGuide({snapshot,socket,playerId,panel,obscured,settingsVisited,evidence,testimonies,timeline,chat,onOpen,onHint,onLeave}:{
  snapshot:RoomSnapshot;socket:GameSocket;playerId:string;panel:InvestigationPanel|null;obscured:boolean;settingsVisited:boolean;
  evidence:RecoveredEvidence[];testimonies:Testimony[];timeline:TimelineState;chat:ChatMessage[];
  onOpen:(panel:InvestigationPanel)=>void;onHint:(text:string)=>void;onLeave:()=>void;
}) {
  const key=`i-swear-tutorial-${snapshot.room.code}`;
  const [progress,setProgress]=useState(()=>load(key));
  const [folded,setFolded]=useState(false),[contents,setContents]=useState(false);
  const guide=useRef<HTMLElement>(null);
  useEffect(()=>{const page=guide.current?.querySelector(".lesson-pages");if(page)page.scrollTop=0;},[progress.step]);
  const state=useCaseState(socket);
  const local=snapshot.players.find(player=>player.id===playerId)!;
  useEffect(()=>{
    try{sessionStorage.setItem(key,JSON.stringify(progress));}catch{/* Optional checkpoint. */}
  },[key,progress]);
  useEffect(()=>{
    if(panel)setProgress(previous=>previous.visited.includes(panel)?previous:{...previous,visited:[...previous.visited,panel]});
  },[panel]);
  useEffect(()=>{
    const start=socket.snapshot?.players.find(player=>player.id===playerId)??local;
    return socket.onMessage(message=>{
      if(message.type==="positions"){
        const player=message.players.find(p=>p.id===playerId);
        if(player&&Math.hypot(player.x-start.x,player.y-start.y)>36)setProgress(previous=>previous.moved?previous:{...previous,moved:true});
      }
      if(message.type==="inspection"&&message.interactable.evidence){
        const id=message.interactable.id;
        setProgress(previous=>previous.inspected.includes(id)?previous:{...previous,inspected:[...previous.inspected,id]});
      }
    });
  // Subscribe once per lesson; movement never causes a React frame loop.
  },[socket,playerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const backupIds=new Set(snapshot.interactables.filter(item=>item.backup).map(item=>item.id));
  const recordTarget=snapshot.interactables.filter(item=>item.clearance===local.color_index%4&&!item.backup)
    .sort((a,b)=>Math.hypot(a.x-local.x,a.y-local.y)-Math.hypot(b.x-local.x,b.y-local.y))[0];
  const backupTarget=snapshot.interactables.find(item=>item.backup&&item.clearance===local.color_index%4);
  const visited=(name:string)=>progress.visited.includes(name);
  const completeMoments=timeline.slots.filter(entry=>(entry?.verified_fields?.length??0)>=5).length;
  const chapters=[
    {title:"You were all there.",body:"One incident. Six moments. Four witnesses remember it differently, including you. Rebuild what happened using physical records and shared testimony. There is no killer to catch and no one is eliminated.",task:"This case waits for you. Use Next when you are ready.",done:true},
    {title:"Find your feet.",body:"Move with WASD or the arrow keys. On a phone, use the direction pad. Walk through the coral-marked door gaps; benches and equipment are solid. Nearby witnesses are visible, but their memories are private.",task:"Walk a few steps, then stop.",done:progress.moved},
    {title:"Read the floor plan.",body:`Press G or tap Floor plan. The coral dot is you; marked objects hold possible clues. You carry badge ${local.color_index%4+1}. The record access guide tells you which witness can open each source. Other badges require cooperation.`,task:"Open the floor plan, find the access guide, then close it.",done:visited("map"),panel:"map" as const},
    {title:"Follow a physical record.",body:"Walk close to an object until Examine nearby appears. Press E or tap the inspect button. A recovered record is shared with everyone. Revisiting is safe; a locked badge or an ordinary object may reveal no new evidence.",task:recordTarget?`Inspect ${recordTarget.label} in ${recordTarget.room}. Your badge opens it.`:"Inspect a record your badge can open.",done:progress.inspected.length>0,panel:"map" as const},
    {title:"A memory isn't proof.",body:"Open Memories with M. These fragments belong only to you. Confidence describes how sure you feel, not whether you are right. Choose a fragment, a confidence stake (10, 25 or 50), and share it. You can change your stake or retract your statement later.",task:"Share one of your memories with the witnesses.",done:testimonies.some(item=>item.player_id===playerId&&!item.retracted),panel:"memories" as const},
    {title:"Compare before agreeing.",body:"Open Testimony with T. Riya, Mina and Omar are scripted practice partners. Believe, Doubt or Contradicts me records your response; a higher stake risks more confidence points. A Memory clash means two statements disagree, not which one is false. A majority can still be wrong.",task:"Respond to another witness's testimony.",done:testimonies.some(item=>item.player_id!==playerId&&item.responses[playerId]),panel:"testimony" as const},
    {title:"Make your first deduction.",body:"Open Reconstruction with Tab or its tool button. Select a record or testimony, then choose a sequence position; dragging also works. Positions run earliest to latest. Recorded fields are verified; recalled fields need checking. Unknown, Confirmed and Disputed are your team's labels, not automatic grading.",task:"Place one source on the shared board yourself.",done:timeline.slots.some(Boolean),panel:"board" as const},
    {title:"Ask for a second opinion.",body:"Your practice partners can suggest the remaining positions using only their shared memories and recovered records. Their draft may be wrong. It keeps the position you already placed, and you can replace or clear any source. In multiplayer, edits are shared and each edit clears earlier votes.",task:"Ask the witnesses for a draft, then review it on the board.",done:timeline.slots.filter(Boolean).length>=3&&state?.stage!=="search",action:"draft" as const},
    {title:"Put your theory on record.",body:"A first theory is a checkpoint, not your final answer. Open the board and choose Record first theory. At least three proposed moments are required. In multiplayer this needs a majority; your tutorial partners agree when you vote.",task:"Record your first theory using the board's vote button.",done:!!state?.first_theory,panel:"board" as const},
    {title:"Follow the new lead.",body:"Open the backup records below. In a normal case they arrive later on the clock; here you decide when. These are independent records about the same incident, not a new version of the truth. Revisit the marked backup sources with the correct badge.",task:backupTarget?`After opening backups, inspect ${backupTarget.label} in ${backupTarget.room}.` : "Open backups, then inspect an accessible backup source.",done:progress.inspected.some(id=>backupIds.has(id)),action:!state?.lead_available?"leads" as const:undefined,panel:state?.lead_available?"map" as const:undefined},
    {title:"Link independent sources.",body:"On the board, select another source for the same event and use Link selected source on its position. Up to four sources can support a deduction. Physical records override conflicting memories. Different events cannot be linked; replace a position if its source belongs elsewhere. Remove a linked source with its × button.",task:"Link two sources for the same moment in one position. Newly recovered backups are useful here.",done:timeline.slots.some(entry=>(entry?.source_ids?.length??0)>1),panel:"board" as const},
    {title:"What's your hesitation?",body:"Press Q or open Your motive. Your secret happened before tonight and explains a personal worry; it does not prove guilt. Its optional objective is separate from the team's recovery score. You can choose to disclose it, but the tutorial does not require sharing it.",task:"Read your private motive and its objective.",done:visited("motive"),panel:"motive" as const},
    {title:"Talk it through.",body:"Open Radio with Enter or its button. Send a message or quick reaction. With friends, Voice chat can join the room audio channel after you permit the microphone; push to talk transmits only while held. Test with a second human player. Your solo partners cannot hear or speak. Voice is optional and excluded from world recordings.",task:"Send one radio message. Microphone permission is not required.",done:chat.some(message=>message.player_id===playerId),panel:"chat" as const},
    {title:"Make yourself comfortable.",body:"The gear opens your field kit. Audio has separate master, music and effects levels. Display has reduced motion and live performance; rendering adapts to your device. Capture records the game world and game audio, then offers a download. It excludes the microphone and desktop.",task:"Open settings, explore its tabs, then close the field kit.",done:settingsVisited},
    {title:"Commit, then learn.",body:"Review all six positions, linked facts and conflicts. Correct order alone cannot recover missing facts: link complementary records until each moment's five fields are Recorded. Status labels do not verify facts. You need three physical records, six positions and a majority to Lock reality; your tutorial partners agree with your vote. The reveal explains your score and distorted memories. Results offer replay and rematch. To play with friends, host a room, share its code and have everyone ready up. Accounts save case history; guests can play too.",task:`${completeMoments}/6 moments have five recorded fields. Open Reconstruction, keep investigating if needed, and Lock reality when ready. A lower practice score is something to learn from.`,done:false,panel:"board" as const},
  ];
  const chapter=chapters[progress.step];
  const hint=`LESSON ${progress.step+1}/${chapters.length} · ${chapter.title} ${chapter.task}`;
  useEffect(()=>{onHint(hint);return()=>onHint("");},[hint,onHint]);
  if(snapshot.room.phase==="reveal")return null;
  if(snapshot.room.phase==="results")return <aside className="tutorial-finished"><small>FIELD TRAINING COMPLETE</small><h3>You have a case to learn from.</h3><p>Review the reveal and replay before your next round. Ready for a timed case or a room with friends?</p><button onClick={onLeave}>Back to the main menu ↗</button></aside>;
  if(panel||obscured)return null;
  return <aside ref={guide} className={`tutorial-guide ${folded?"folded":""}`} aria-label="Guided tutorial" data-tutorial-step={progress.step}>
    <header><span>FIELD TRAINING <b>{String(progress.step+1).padStart(2,"0")} / {chapters.length}</b></span><button aria-label={folded?"Expand tutorial":"Minimize tutorial"} onClick={()=>setFolded(!folded)}>{folded?"+":"−"}</button></header>
    {!folded&&<><div className="lesson-track" aria-hidden="true"><i style={{width:`${(progress.step+1)/chapters.length*100}%`}}/></div><div className="lesson-pages"><span className="lesson-leaf" aria-hidden="true">WITNESS FIELD NOTES</span><h2>{chapter.title}</h2><p>{chapter.body}</p><div className={`lesson-task ${chapter.done?"complete":""}`} role="status"><b>{chapter.done?"✓ Ready to continue":"YOUR NEXT MOVE"}</b><span>{chapter.task}</span></div>
      {chapter.panel&&<button className="lesson-open" onClick={()=>onOpen(chapter.panel!)}>Open {({map:"floor plan",board:"reconstruction",memories:"memories",testimony:"testimony",motive:"your motive",chat:"radio"})[chapter.panel]} ↗</button>}
      {chapter.action&&!chapter.done&&<button className="lesson-open" onClick={()=>socket.send({type:"tutorial",action:chapter.action!})}>{chapter.action==="draft"?"Ask the witnesses for a draft":"Open the backup records"} ↗</button>}
      <button className="lesson-contents" aria-expanded={contents} onClick={()=>setContents(!contents)}>Lesson index {contents?"−":"+"}</button>
      {contents&&<ol className="lesson-index">{chapters.map((item,index)=><li key={item.title}><button onClick={()=>{setProgress(p=>({...p,step:index}));setContents(false);}}>{String(index+1).padStart(2,"0")} · {item.title}</button></li>)}</ol>}
      <button className="lesson-exit" onClick={onLeave}>End tutorial & return home</button></div>
      <footer><button disabled={!progress.step} onClick={()=>setProgress(p=>({...p,step:p.step-1}))}>Back</button><span aria-hidden="true">{String(progress.step+1).padStart(2,"0")} / {chapters.length}</span><button disabled={!chapter.done||progress.step===chapters.length-1} onClick={()=>setProgress(p=>({...p,step:p.step+1}))}>Next →</button></footer></>}
  </aside>;
}
