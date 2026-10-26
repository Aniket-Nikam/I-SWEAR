import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TruthReveal } from "./Endgame";
import type { GameResult } from "../types/protocol";

it("starts the first reveal moment when the server clock is ahead of the browser", () => {
  const event = { id:"arrival",time:"22:39",actor:"Riya",location:"Lab C",action:"entered carrying",object:"silver case",cause:"transfer",order:0 };
  const result = { comparisons: [{ event, actual:"A verified first moment.", believed:"What we thought.", correct:true }] } as GameResult;
  const view = render(<TruthReveal result={result} startedAt={Date.now()/1000+2} />);
  expect(screen.getByText("A verified first moment.")).toBeTruthy();
  expect(screen.getByText("1 OF 6")).toBeTruthy();
  view.unmount();
});
