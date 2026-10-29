import {useEffect,useState} from "react";
import type {RecoveredEvidence} from "../types/protocol";
import {Dossier} from "./MysteryPanels";

const LABELS:Record<string,string>={location:"Where",time:"When",actor:"Who",object:"What",action:"Action"};
export function ClueNotebook({evidence,initialId,onRead,onClose,onBuild,onWitnesses,memoryEvents=[]}:{evidence:RecoveredEvidence[];initialId?:string;onRead:(id:string)=>void;onClose:()=>void;onBuild:()=>void;onWitnesses:(eventId:string)=>void;memoryEvents?:string[]}){
 const [selected,setSelected]=useState(initialId??evidence[0]?.id);
 const index=Math.max(0,evidence.findIndex(item=>item.id===selected)),record=evidence[index];
 useEffect(()=>{if(record)onRead(record.id);},[record?.id,onRead]);
 return <Dossier title="Your clues" subtitle="ONE RECORD AT A TIME" onClose={onClose}>
  <div className="clue-notebook">{record?<>
   <div className="clue-paging"><button disabled={!index} onClick={()=>setSelected(evidence[index-1].id)} aria-label="Previous clue">←</button><span>Clue {index+1} / {evidence.length}</span><button disabled={index>=evidence.length-1} onClick={()=>setSelected(evidence[index+1].id)} aria-label="Next clue">→</button></div>
   <h3>{record.label.replace(/ \/ (LOCAL )?RECORD$/,"")}</h3>
   <dl>{Object.entries(record.claim).filter(([key])=>["location","time","actor","object","action"].includes(key)).map(([key,value])=><div key={key}><dt>{LABELS[key]}</dt><dd>{value}</dd></div>)}</dl>
   <details><summary>Read the full record</summary><p>{record.text}</p></details>
   <p className="clue-pause">Witnesses wait while you read.</p>
   <div className="clue-actions"><button className="primary-action" onClick={onClose}>Got it · back to the room</button>{memoryEvents.includes(record.event_id)&&<button onClick={()=>onWitnesses(record.event_id)}>Compare a memory</button>}{new Set(evidence.map(item=>item.event_id)).size>=6&&<button onClick={onBuild}>Build my answer</button>}</div>
  </>:<p>Inspect the gold-marked object to find your first clue.</p>}</div>
 </Dossier>;
}
