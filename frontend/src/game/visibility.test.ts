import { describe, expect, it } from "vitest";
import { hasLineOfSight } from "./visibility";
describe("witness visibility", () => {
  const walls = [[100,40,12,80], [100,160,12,80]];
  it("hides a witness behind solid walls in both directions", () => {
    expect(hasLineOfSight(40,40,160,40,walls)).toBe(false);
    expect(hasLineOfSight(160,40,40,40,walls)).toBe(false);
  });
  it("allows sight through an actual doorway", () => expect(hasLineOfSight(40,100,160,100,walls)).toBe(true));
  it("keeps a witness in the same open room visible", () => expect(hasLineOfSight(20,20,70,70,walls)).toBe(true));
});
