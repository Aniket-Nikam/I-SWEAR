import { useEffect, useRef } from "react";
import type { GameSocket } from "../network/GameSocket";
import type { Interactable, RoomSnapshot } from "../types/protocol";
import { MovementInput } from "./MovementInput";
import { CampusScene } from "./campus3d/CampusScene";
import { screenMovement } from "./campus3d/view";

export interface WorldProps {
  socket:GameSocket; snapshot:RoomSnapshot; localPlayerId:string;
  onPrompt:(item:Interactable|null)=>void; onRoomChange:(room:string)=>void; inputEnabled:boolean; onReady?:()=>void;
}
export function CampusCanvas(props:WorldProps & {onFailure:()=>void}) {
  const host=useRef<HTMLDivElement>(null),latest=useRef(props),nearest=useRef<Interactable|null>(null),input=useRef<MovementInput|null>(null);
  latest.current=props;
  useEffect(()=>{
    if(!host.current)return;
    const movement=new MovementInput((dx,dy)=>{const world=screenMovement(dx,dy);props.socket.move(world.dx,world.dy);});input.current=movement;
    let scene:CampusScene|undefined;
    try {scene=new CampusScene(host.current,{...props,snapshot:props.socket.snapshot??props.snapshot,
      onPrompt:item=>{nearest.current=item;latest.current.onPrompt(item);},onRoomChange:room=>latest.current.onRoomChange(room),onFailure:()=>latest.current.onFailure()});
      scene.start();}catch {scene?.dispose();latest.current.onFailure();}
    const heartbeat=window.setInterval(()=>movement.heartbeat(),100),clear=()=>movement.clear();
    window.addEventListener("blur",clear);document.addEventListener("visibilitychange",clear);
    return ()=>{window.clearInterval(heartbeat);window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",clear);movement.clear();scene?.dispose();latest.current.onPrompt(null);};
  },[props.socket,props.localPlayerId]);
  useEffect(()=>{if(!props.inputEnabled)input.current?.clear();else host.current?.focus();},[props.inputEnabled]);
  function inspect(){if(props.inputEnabled&&nearest.current)props.socket.send({type:"interact",interactable_id:nearest.current.id});}
  return <div className="game-canvas" ref={host} role="application" tabIndex={0} aria-label={`${props.snapshot.room.map?.name??"Orpheus Campus"} 3D game world`}
    onPointerDown={()=>host.current?.focus()} onBlur={()=>input.current?.clear()}
    onKeyDown={event=>{if(!props.inputEnabled)return;if(input.current?.down(event.key))event.preventDefault();if(event.key.toLowerCase()==="e"&&!event.repeat){event.preventDefault();inspect();}}}
    onKeyUp={event=>{if(input.current?.up(event.key))event.preventDefault();}}>
    {props.inputEnabled&&<div className="touch-controls" aria-label="Touch movement" onPointerDown={event=>event.stopPropagation()}>
      <div className="touch-dpad">{([["w","Up","↑"],["a","Left","←"],["s","Down","↓"],["d","Right","→"]] as const).map(([key,label,glyph])=><button key={key} className={`touch-${key}`} aria-label={`Move ${label.toLowerCase()}`} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);input.current?.down(key);}} onPointerUp={()=>input.current?.clear()} onPointerCancel={()=>input.current?.clear()}>{glyph}</button>)}</div>
      <button className="touch-inspect" onClick={inspect}>Inspect <kbd>E</kbd></button>
    </div>}
  </div>;
}
