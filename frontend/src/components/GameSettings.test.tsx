import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameSettings } from "./GameSettings";
import { audioDirector } from "../game/AudioDirector";

vi.mock("../game/AudioDirector",() => ({ audioDirector: {
  configure:vi.fn(),configureMusic:vi.fn(),configureEffects:vi.fn(),unlock:vi.fn(async () => {}),
  setPageVisible:vi.fn(),setWorld:vi.fn(),setLobby:vi.fn(),previewPickup:vi.fn(async () => {}),
  musicState:() => "playing",musicTitle:() => "Footnotes After Midnight",onMusic:() => () => {},
} }));
vi.mock("./GameplayRecorder",() => ({useGameplayRecording:() => ({control:null,recording:false})}));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  vi.stubGlobal("matchMedia",() => ({matches:false}));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves older music preferences and persists the new effects control", () => {
  localStorage.setItem("i-swear-preferences-v1",JSON.stringify({volume:.35,music:false,musicVolume:.4}));
  const view = render(<GameSettings worldActive={false} lobbyActive />);
  fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  expect((screen.getByRole("checkbox",{name:"Music"}) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText("Master volume") as HTMLInputElement).value).toBe("0.35");
  expect((screen.getByLabelText("Sound effects") as HTMLInputElement).value).toBe("0.8");
  fireEvent.change(screen.getByLabelText("Sound effects"),{target:{value:"0.3"}});
  expect(audioDirector.configureEffects).toHaveBeenLastCalledWith(.3);
  expect(JSON.parse(localStorage.getItem("i-swear-preferences-v1")!).effectsVolume).toBe(.3);
  view.unmount(); render(<GameSettings worldActive={false} />);
  fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  expect((screen.getByLabelText("Sound effects") as HTMLInputElement).value).toBe("0.3");
});

it("shows the investigation score and previews the pickup without a game action", () => {
  render(<GameSettings worldActive />);
  fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  expect(screen.getByText(/Footnotes After Midnight/)).toBeTruthy();
  expect(audioDirector.setWorld).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole("button",{name:"Preview pickup"}));
  expect(audioDirector.previewPickup).toHaveBeenCalledOnce();
});

it("disables pickup preview when muted or effects are silent", () => {
  render(<GameSettings worldActive={false} />);
  fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  fireEvent.click(screen.getByRole("button",{name:"Mute all sound"}));
  expect((screen.getByRole("button",{name:"Preview pickup"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Unmute all sound"}));
  fireEvent.change(screen.getByLabelText("Sound effects"),{target:{value:"0"}});
  expect((screen.getByRole("button",{name:"Preview pickup"}) as HTMLButtonElement).disabled).toBe(true);
});

it("opens a modal, traps focus, and restores the gear after Escape",()=>{
  render(<GameSettings worldActive/>);
  const gear=screen.getByRole("button",{name:"Sound and accessibility settings"});fireEvent.click(gear);
  const modal=screen.getByRole("dialog",{name:"Settings"}),close=screen.getByRole("button",{name:"Close settings"}),back=screen.getByRole("button",{name:"Back to game"});
  expect(document.activeElement).toBe(close);
  const first=screen.getByRole("tab",{name:/Audio/});first.focus();
  fireEvent.keyDown(first,{key:"Tab",shiftKey:true});expect(document.activeElement).toBe(back);
  fireEvent.keyDown(back,{key:"Tab"});expect(document.activeElement).toBe(first);
  fireEvent.keyDown(modal,{key:"Escape"});expect(screen.queryByRole("dialog")).toBeNull();expect(document.activeElement).toBe(gear);
});

it("navigates sections with arrow keys and preserves display and audio preferences",()=>{
  render(<GameSettings worldActive/>);fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  expect(screen.queryByRole("combobox")).toBeNull();expect(screen.queryByText(/2D illustration/)).toBeNull();
  fireEvent.keyDown(screen.getByRole("tab",{name:/Audio/}),{key:"ArrowRight"});
  expect(screen.getByRole("tab",{name:/Display/}).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByLabelText("Reduce motion"));expect(document.documentElement.dataset.motion).toBe("reduced");
  fireEvent.click(screen.getByRole("tab",{name:/Audio/}));expect(screen.getByLabelText("Master volume")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("i-swear-preferences-v1")!).reduced).toBe(true);
});

it("keeps game shortcuts inside the modal and leaves through the explicit action",()=>{
  const leave=vi.fn(),shortcut=vi.fn();window.addEventListener("keydown",shortcut);
  render(<GameSettings worldActive onLeave={leave}/>);fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  fireEvent.keyDown(screen.getByRole("dialog"),{key:"m"});expect(shortcut).not.toHaveBeenCalled();window.removeEventListener("keydown",shortcut);
  fireEvent.click(screen.getByRole("tab",{name:/Capture/}));expect(screen.getByText("Save a clip of your investigation.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Leave case"}));expect(leave).toHaveBeenCalledOnce();expect(screen.queryByRole("dialog")).toBeNull();
});

it("offers only audio and display sections on the title screen",()=>{
  render(<GameSettings worldActive={false} menu/>);fireEvent.click(screen.getByRole("button",{name:"Sound and accessibility settings"}));
  expect(screen.getAllByRole("tab")).toHaveLength(2);expect(screen.queryByRole("tab",{name:/Capture/})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Back to menu"}));expect(screen.queryByRole("dialog")).toBeNull();
});
