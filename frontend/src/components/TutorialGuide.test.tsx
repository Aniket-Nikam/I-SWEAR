import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TutorialGuide } from "./TutorialGuide";
import { EMPTY_TIMELINE } from "./InvestigationBoard";
import type { GameSocket } from "../network/GameSocket";
import type { RecoveredEvidence, RoomSnapshot, ServerMessage, Testimony } from "../types/protocol";
beforeEach(()=>sessionStorage.clear());afterEach(cleanup);
const snapshot:RoomSnapshot={type:"snapshot",room:{code:"LEARN",host_id:"me",phase:"exploring",min_players:4,max_players:8,solo:true,tutorial:true},players:[{id:"me",name:"Learner",x:100,y:100,color_index:0,ready:true,connected:true}],world:{width:1000,height:1000,walls:[],rooms:[]},interactables:[{id:"atrium_badge",kind:"scanner",label:"Badge scanner",room:"Atrium",x:100,y:200,clearance:0}]};
const record:RecoveredEvidence={id:"e1",object_id:"atrium_badge",event_id:"arrival",label:"Badge audit",claim:{time:"22:39",location:"Lab C"},text:"The badge logged Lab C at 22:39.",timestamp:"22:39"};
const statements:Testimony[]=["Lab B","Lab C"].map((location,i)=>({id:`t${i}`,player_id:`bot${i}`,name:`Witness ${i}`,memory:{id:"m1",event_id:"arrival",claim:{location,time:"22:39"},category:"VISUAL",confidence:"CLEAR",sensory:"",text:`I remember ${location}.`},stake:10,responses:{},retracted:false}));
function setup(){const listeners=new Set<(message:ServerMessage)=>void>();const socket={snapshot,role:null,onMessage:(fn:(message:ServerMessage)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},send:vi.fn()} as unknown as GameSocket;return {listeners,props:{snapshot,socket,playerId:"me",panel:null,obscured:false,evidence:[] as RecoveredEvidence[],testimonies:statements,timeline:EMPTY_TIMELINE,onOpen:vi.fn(),onHint:vi.fn(),onLeave:vi.fn(),onStage:vi.fn()}};}
it("requires the real recovered record and checks understanding before teaching testimony",()=>{
 const {props}=setup(),view=render(<TutorialGuide {...props}/>);
 expect(screen.getByText("I remember Lab B.")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 expect(props.onStage).toHaveBeenLastCalledWith(1,"atrium_badge");expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(true);
 view.rerender(<TutorialGuide {...props} evidence={[record]}/>);fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 fireEvent.click(screen.getByRole("button",{name:"Lab B"}));expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Lab C"}));fireEvent.click(screen.getByRole("button",{name:"Next →"}));
 fireEvent.click(screen.getByRole("button",{name:"Open testimony ↗"}));expect(props.onOpen).toHaveBeenCalledWith("testimony");
 expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(true);
 view.rerender(<TutorialGuide {...props} evidence={[record]} testimonies={[{...statements[0],responses:{me:{response:"DOUBT",stake:10}}},statements[1]]}/>);
 expect((screen.getByRole("button",{name:"Next →"}) as HTMLButtonElement).disabled).toBe(false);
 expect(props.socket.send).not.toHaveBeenCalled();
});
it("resumes the short lesson, cleans subscriptions and never silently advances",()=>{
 const {props,listeners}=setup(),view=render(<TutorialGuide {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Next →"}));view.unmount();expect(listeners.size).toBe(0);
 render(<TutorialGuide {...props}/>);expect(screen.getByRole("heading",{name:"Find a record, not a hunch."})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Minimize tutorial"}));expect(screen.queryByRole("heading")).toBeNull();
 act(()=>listeners.forEach(fn=>fn({type:"positions",players:[{...snapshot.players[0],x:900}]})));
 fireEvent.click(screen.getByRole("button",{name:"Expand tutorial"}));expect(screen.getByRole("heading",{name:"Find a record, not a hunch."})).toBeTruthy();expect(props.onLeave).not.toHaveBeenCalled();
});
