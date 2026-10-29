import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {HorrorOverlay,DangerNote} from "./Horror";
import {audioDirector} from "../game/AudioDirector";
import type {HorrorState} from "../types/protocol";
vi.mock("../game/AudioDirector",()=>({audioDirector:{cue:vi.fn(),setThreat:vi.fn(),setNightmare:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const state:HorrorState={phase:"warning",remaining:9,target_id:"me",final:false,strikes:1,captures:{},reason:{slot:1,field:"location",claimed:"Lab B",recorded:"Lab C",record:"Badge log"}};
it("offers the exact disputed position without opening a second automatic panel",()=>{
 const review=vi.fn();render(<DangerNote state={state} onReview={review} targetName="you"/>);
 expect(screen.getByText(/Marked: you/)).toBeTruthy();fireEvent.click(screen.getByRole("button"));expect(review).toHaveBeenCalledOnce();
});
it("plays a capture once, only shows the face to its target, and restores the score after leaving",()=>{
 const view=render(<HorrorOverlay state={{...state,phase:"devouring"}} playerId="other"/>);
 expect(screen.queryByRole("alert")).toBeNull();expect(audioDirector.cue).not.toHaveBeenCalledWith("devour");
 view.rerender(<HorrorOverlay state={{...state,phase:"devouring"}} playerId="me"/>);
 expect(screen.getByRole("alert")).toBeTruthy();expect(audioDirector.cue).toHaveBeenCalledWith("devour");
 view.rerender(<HorrorOverlay state={{...state,phase:"devouring",remaining:2}} playerId="me"/>);
 expect(vi.mocked(audioDirector.cue).mock.calls.filter(call=>call[0]==="devour")).toHaveLength(1);
 view.unmount();expect(audioDirector.setThreat).toHaveBeenLastCalledWith(false);
});
