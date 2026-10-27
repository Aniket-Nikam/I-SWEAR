import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvestigationBoard } from "./InvestigationBoard";
import { PrivateMotive } from "./Casefile";
import { CaseReplay } from "./CaseReplay";
import type { GameSocket } from "../network/GameSocket";
import type { CaseState, GameResult, TimelineState } from "../types/protocol";

afterEach(cleanup);
const state: CaseState = { version:2,elapsed:100,remaining:260,duration:360,stage:"first_theory",title:"Compare your first theory",stage_remaining:25,lead_available:false,lock_available:false,theory_votes:[],first_theory:null,revealed_motives:[] };
function connection() {
  return { snapshot:{ case:state }, role:{ id:"borrowed_badge",title:"A borrowed badge",secret:"A private note.",objective:"Recover two records.",goal:"records",progress:0,required:2,complete:false,revealed:false }, send:vi.fn(),onMessage:vi.fn(() => () => {}) } as unknown as GameSocket;
}
const record = { id:"evidence_one",object_id:"one",event_id:"arrival",label:"Entry audit",claim:{location:"Lab A",time:"22:39",action:"entered carrying"},text:"A partial record.",timestamp:"22:39" };
const entry = { source_id:record.id,source_ids:[record.id],event_id:record.event_id,kind:"evidence" as const,claim:record.claim,text:record.text,label:record.label,status:"UNKNOWN" as const,verified_fields:["location","time","action"],sources:[{id:record.id,label:record.label,kind:"evidence" as const}] };

it("keeps the final vote closed before the lead and submits a revision-bound first theory", () => {
  const socket = connection();
  const timeline: TimelineState = { slots:[entry,entry,entry,entry,entry,entry],revision:7,votes:[],required_votes:3,theory_changes:6 };
  render(<InvestigationBoard evidence={[record,{...record,id:"two"},{...record,id:"three"}]} testimonies={[]} timeline={timeline} socket={socket} playerId="p1" onClose={() => {}} />);
  expect((screen.getByRole("button",{name:"Lock reality"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByText("Missing")).toHaveLength(12);
  fireEvent.click(screen.getByRole("button",{name:"Record first theory (0/3)"}));
  expect(socket.send).toHaveBeenCalledWith({type:"theory_vote",revision:7,vote:true});
});

it("links a matching recovered source through the shared board", () => {
  const socket = connection();
  const second = {...record,id:"evidence_two",label:"Camera record"};
  render(<InvestigationBoard evidence={[record,second]} testimonies={[]} timeline={{slots:[entry,null,null,null,null,null],revision:2,votes:[],required_votes:3,theory_changes:1}} socket={socket} playerId="p1" onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button",{name:/Camera record A partial record/}));
  fireEvent.click(screen.getByRole("button",{name:"Link selected source"}));
  expect(socket.send).toHaveBeenCalledWith({type:"link_source",slot:0,source_id:second.id,revision:2,remove:false});
});

it("shows the owner's private motive and makes disclosure explicit", () => {
  const socket = connection();
  render(<PrivateMotive socket={socket} onClose={() => {}} />);
  expect(screen.getByText("A private note.")).toBeTruthy();
  expect(socket.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Tell the other witnesses"}));
  expect(socket.send).toHaveBeenCalledWith({type:"reveal_motive"});
});

it("renders a six-station incident sequence without a per-frame timer", () => {
  const comparisons = Array.from({length:6},(_,index) => ({event:{id:`e${index}`,time:`22:4${index}`,actor:index%2?"Mina":"Riya",location:`Room ${index}`,action:"moved",object:"case",cause:"transfer",order:index},actual:"Record",believed:"Theory",correct:true}));
  const view = render(<CaseReplay result={{comparisons} as GameResult} step={3} />);
  expect(screen.getByLabelText("Incident sequence, moment 4 of six")).toBeTruthy();
  expect(view.container.querySelectorAll(".moment")).toHaveLength(6);
  expect(view.container.querySelectorAll(".replay-token")).toHaveLength(2);
});
