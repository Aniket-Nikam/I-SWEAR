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
  fireEvent.click(screen.getByRole("button",{name:"Sound on"}));
  expect((screen.getByRole("button",{name:"Preview pickup"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Sound muted"}));
  fireEvent.change(screen.getByLabelText("Sound effects"),{target:{value:"0"}});
  expect((screen.getByRole("button",{name:"Preview pickup"}) as HTMLButtonElement).disabled).toBe(true);
});
