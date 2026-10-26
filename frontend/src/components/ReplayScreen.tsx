import { useEffect, useState } from "react";
import type { GameResult } from "../types/protocol";
import { Results } from "./Endgame";

export function ReplayScreen({ code }: { code: string }) {
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/replays/${encodeURIComponent(code)}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("This saved case is unavailable.");
      setResult(await response.json());
    }).catch((caught) => { if (caught.name !== "AbortError") setError(caught.message); });
    return () => controller.abort();
  }, [code]);
  return <main className="game-shell replay-shell">{result ? <Results result={result} isHost={false} onRematch={() => {}} onChallenge={() => { location.href = location.pathname; }} replay /> : <div className="loading-screen"><div className="wordmark">I SWEAR</div><p>{error || "Recovering saved case"}</p>{error && <a href="/">Open a new case</a>}</div>}</main>;
}
