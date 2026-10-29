import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {ClueNotebook} from "./ClueNotebook";
import type {RecoveredEvidence} from "../types/protocol";
afterEach(cleanup);
const record:RecoveredEvidence={id:"one",object_id:"badge",event_id:"arrival",claim:{location:"Lab C",time:"22:39"},text:"The full recovered record.",label:"Badge log",timestamp:"22:39"};
it("shows one chosen clue and does not steal focus when more evidence arrives",()=>{
 const read=vi.fn(),close=vi.fn();const props={evidence:[record],onRead:read,onClose:close,onBuild:vi.fn(),onWitnesses:vi.fn()};
 const view=render(<ClueNotebook {...props}/>);expect(read).toHaveBeenCalledWith("one");
 const second={...record,id:"two",label:"Camera log",claim:{location:"Lab B"}};
 view.rerender(<ClueNotebook {...props} evidence={[record,second]}/>);
 expect(screen.getByRole("heading",{name:"Badge log"})).toBeTruthy();expect(screen.queryByRole("heading",{name:"Camera log"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Next clue"}));expect(read).toHaveBeenLastCalledWith("two");
 fireEvent.click(screen.getByRole("button",{name:"Got it · back to the room"}));expect(close).toHaveBeenCalledOnce();
});
