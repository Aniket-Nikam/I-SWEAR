import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TutorialGuide } from "./TutorialGuide";
import { EMPTY_TIMELINE } from "./InvestigationBoard";
import type { GameSocket } from "../network/GameSocket";
import type { RoomSnapshot, ServerMessage } from "../types/protocol";

beforeEach(()=>sessionStorage.clear());afterEach(cleanup);
const snapshot:RoomSnapshot={type:"snapshot",room:{code:"LEARN",host_id:"me",phase:"exploring",min_players:4,max_players:8,solo:true,tutorial:true},
  players:[{id:"me",name:"Learner",x:100,y:100,color_index:0,ready:true,connected:true}],world:{width:1000,height:1000,walls:[],rooms:[]},
  interactables:[{id:"badge",kind:"scanner",label:"Badge scanner",room:"Atrium",x:100,y:200,clearance:0}]};
function setup(){
 const listeners=new Set<(message:ServerMessage)=>void>();
 const socket={snapshot,role:null,onMessage:(fn:(message:ServerMessage)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},send:vi.fn()} as unknown as GameSocket;
 const props={snapshot,socket,playerId:"me",panel:null,obscured:false,settingsVisited:false,evidence:[],testimonies:[],timeline:EMPTY_TIMELINE,chat:[],onOpen:vi.fn(),onHint:vi.fn(),onLeave:vi.fn()};
 return {props,listeners,emit:(message:ServerMessage)=>act(()=>listeners.forEach(fn=>fn(message)))};
}
it("waits for actual movement and a recovered record, and carries instructions into real panels",()=>{
 const {props,emit}=setup();const view=render(<TutorialGuide {...props}/>);
 fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(true);
 emit({type:"positions",players:[{...snapshot.players[0],x:150}]});
 fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 fireEvent.click(screen.getByRole("button",{name:"Open floor plan ↗"}));expect(props.onOpen).toHaveBeenCalledWith("map");
 view.rerender(<TutorialGuide {...props} panel="map"/>);expect(screen.queryByRole("complementary")).toBeNull();
 view.rerender(<TutorialGuide {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 emit({type:"inspection",interactable:snapshot.interactables[0]});
 expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(true);
 emit({type:"inspection",interactable:{...snapshot.interactables[0],evidence:{id:"e1",object_id:"badge",event_id:"arrival",label:"Badge audit",claim:{time:"22:39"},text:"Recorded",timestamp:"22:39"}}});
 expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(false);
 expect(props.onHint).toHaveBeenCalledWith(expect.stringContaining("Inspect Badge scanner in Atrium"));
});
it("resumes its checkpoint without retaining dead socket listeners or silently ending the lesson",()=>{
 const {props,listeners}=setup();const view=render(<TutorialGuide {...props}/>);
 fireEvent.click(screen.getByRole("button",{name:"Next →"}));view.unmount();expect(listeners.size).toBe(0);
 render(<TutorialGuide {...props}/>);expect(screen.getByRole("heading",{name:"Find your feet."})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Minimize tutorial"}));expect(screen.queryByText("Walk a few steps, then stop.")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Expand tutorial"}));expect(screen.getByRole("heading",{name:"Find your feet."})).toBeTruthy();
 expect(props.onLeave).not.toHaveBeenCalled();expect((props.socket.send as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
});
