import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GameSocket } from "./network/GameSocket";
import { ChatPanel, Dossier } from "./components/MysteryPanels";

afterEach(cleanup);

describe("accessible investigation overlays", () => {
  it("focuses the intended control, traps keyboard focus, and closes with Escape", () => {
    const onClose = vi.fn();
    render(<Dossier title="Test record" subtitle="PRIVATE" onClose={onClose}><input aria-label="Witness note" data-initial-focus /><button>Last action</button></Dossier>);
    expect(document.activeElement).toBe(screen.getByLabelText("Witness note"));
    const close = screen.getByRole("button", { name: "Close Test record" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sends trimmed radio text and an explicit quick reaction", () => {
    const send = vi.fn();
    render(<ChatPanel messages={[]} socket={{ send } as unknown as GameSocket} onClose={() => {}} />);
    const input = screen.getByLabelText("Message to all witnesses") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "  Compare the audit.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(send).toHaveBeenLastCalledWith({ type: "chat", text: "Compare the audit." });
    expect(input.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Show me the evidence." }));
    expect(send).toHaveBeenLastCalledWith({ type: "chat", text: "Show me the evidence." });
  });
});
