import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {GameCanvas} from "./GameCanvas";
import type {WorldProps} from "./CampusCanvas";
vi.mock("./CampusCanvas",()=>({CampusCanvas:({onFailure}:{onFailure:()=>void})=><button onClick={onFailure}>3D campus</button>}));
vi.mock("./FlatGameCanvas",()=>({GameCanvas:()=> <div>Illustrated campus</div>}));
const props={snapshot:{room:{map_id:"campus"}}} as WorldProps;
beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("starts the campus in 3D and falls back if the graphics context fails",async()=>{
  render(<GameCanvas {...props}/>);fireEvent.click(await screen.findByRole("button",{name:"3D campus"}));
  expect(await screen.findByText("Illustrated campus")).toBeTruthy();
});
it.each(["observatory","ferry"] as const)("opens %s in 3D",async(map_id)=>{
  render(<GameCanvas {...props} snapshot={{...props.snapshot,room:{...props.snapshot.room,map_id}}}/>);
  expect(await screen.findByRole("button",{name:"3D campus"})).toBeTruthy();expect(screen.queryByText("Illustrated campus")).toBeNull();
});
it("opens the campus in 3D even when an old illustrated preference remains",async()=>{
  localStorage.setItem("i-swear-campus-view","2d");render(<GameCanvas {...props}/>);
  expect(await screen.findByRole("button",{name:"3D campus"})).toBeTruthy();
});
