import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {GameCanvas} from "./GameCanvas";
import {campusView,setCampusView} from "./rendererPreference";
import type {WorldProps} from "./CampusCanvas";
vi.mock("./CampusCanvas",()=>({CampusCanvas:({onFailure}:{onFailure:()=>void})=><button onClick={onFailure}>3D campus</button>}));
vi.mock("./FlatGameCanvas",()=>({GameCanvas:()=> <div>Illustrated campus</div>}));
const props={snapshot:{room:{map_id:"campus"}}} as WorldProps;
beforeEach(()=>{localStorage.clear();setCampusView("3d");});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("starts the campus in 3D and falls back if the graphics context fails",async()=>{
  render(<GameCanvas {...props}/>);fireEvent.click(await screen.findByRole("button",{name:"3D campus"}));
  expect(await screen.findByText("Illustrated campus")).toBeTruthy();
});
it("uses the established illustrated renderer for the other maps",async()=>{
  render(<GameCanvas {...props} snapshot={{...props.snapshot,room:{...props.snapshot.room,map_id:"ferry"}}}/>);
  expect(await screen.findByText("Illustrated campus")).toBeTruthy();expect(screen.queryByText("3D campus")).toBeNull();
});
it("honours a 2D selection even when browser storage is unavailable",async()=>{
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("Storage blocked");});
  setCampusView("2d");expect(campusView()).toBe("2d");render(<GameCanvas {...props}/>);
  expect(await screen.findByText("Illustrated campus")).toBeTruthy();
});
