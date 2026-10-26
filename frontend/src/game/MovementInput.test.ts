import { afterEach, describe, expect, it, vi } from "vitest";
import { MovementInput } from "./MovementInput";

afterEach(() => vi.useRealTimers());

describe("keyboard input", () => {
  it("normalizes diagonals and accepts uppercase and arrow controls", () => {
    const emit = vi.fn();
    const input = new MovementInput(emit);
    input.down("W");
    input.down("ArrowRight");
    const [x, y] = emit.mock.lastCall!;
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
    input.clear();
    expect(emit).toHaveBeenLastCalledWith(0, 0);
  });

  it("preserves a short tap and stops after release", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const input = new MovementInput(emit);
    input.down("d");
    input.up("d");
    expect(emit).toHaveBeenLastCalledWith(1, 0);
    vi.advanceTimersByTime(85);
    expect(emit).toHaveBeenLastCalledWith(0, 0);
    const count = emit.mock.calls.length;
    input.heartbeat();
    expect(emit.mock.calls.length).toBe(count);
  });

  it("clears pending taps on focus loss", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const input = new MovementInput(emit);
    input.down("a");
    input.up("a");
    input.clear();
    vi.runAllTimers();
    expect(emit).toHaveBeenLastCalledWith(0, 0);
    expect(emit.mock.calls).toHaveLength(2);
  });
});
