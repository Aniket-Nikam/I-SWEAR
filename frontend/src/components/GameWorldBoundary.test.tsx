import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameWorldBoundary } from "./GameWorldBoundary";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("keeps a reload action available when an updated world chunk cannot load",()=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});
  function UnavailableWorld():never{throw new TypeError("Failed to fetch dynamically imported module");}
  render(<GameWorldBoundary><UnavailableWorld/></GameWorldBoundary>);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Reload this case"})).toBeTruthy();
});
