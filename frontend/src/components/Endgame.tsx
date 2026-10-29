import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import type { GameResult } from "../types/protocol";
import { WitnessAvatar } from "./WitnessAvatar";
import { CaseReplay } from "./CaseReplay";

function useRevealClock(startedAt: number) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(5, Math.floor((Date.now() / 1000 - startedAt) / 4))));
  useEffect(() => {
    const timer = window.setInterval(() => setStep(Math.max(0, Math.min(5, Math.floor((Date.now() / 1000 - startedAt) / 4)))), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return step;
}

export function TruthReveal({ result, startedAt }: { result: GameResult; startedAt: number }) {
  const step = useRevealClock(startedAt);
  const comparison = result.comparisons[step];
  const distortion = result.corrupted_memories?.find(memory => memory.event_id === comparison.event.id && memory.explanation);
  return <section className="truth-reveal" aria-label="Truth reveal"><div className="reveal-vignette" /><header><span>THE ARCHIVIST</span><h1>Reality is locked.</h1><p>Six moments. One night. This is what the records remember.</p></header>{result.case_review && <CaseReplay result={result} step={step} />}<article className="reveal-frame" key={step} aria-live="polite"><div className="reveal-time"><time>{comparison.event.time}</time><span>{comparison.event.location}</span><small>{step + 1} OF 6</small></div><div className="reveal-comparison"><div><span>WHAT YOU BELIEVED</span><p>{comparison.believed}</p></div><ArrowRight size={24} /><div className={comparison.correct ? "matched" : "corrected"}><span>WHAT HAPPENED</span><p>{comparison.actual}</p></div></div>{distortion && <p className="reveal-explanation">{distortion.name}: {distortion.explanation}</p>}</article><p className="reveal-footnote">A false memory is not the same as a lie.</p></section>;
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  let line = "";
  for (const word of text.split(" ")) {
    if (context.measureText(`${line}${word} `).width > width && line) {
      context.fillText(line.trim(), x, y); y += lineHeight; line = "";
    }
    line += `${word} `;
  }
  if (line) context.fillText(line.trim(), x, y);
  return y + lineHeight;
}

export async function downloadShareCard(result: GameResult) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#132630"; context.fillRect(0, 0, 1080, 1920);
  const campus = new Image();
  await new Promise<void>((resolve) => { campus.onload = () => resolve(); campus.onerror = () => resolve(); campus.src = result.map?.art ?? "/art/campus-night.svg"; });
  if (campus.complete && campus.naturalWidth) { context.globalAlpha = .3; context.drawImage(campus, 0, 0, 1080, 675); context.globalAlpha = 1; }
  context.fillStyle = "#ef805f"; context.fillRect(76, 100, 928, 12);
  context.fillStyle = "#f2e4c8"; context.font = "900 155px 'Barlow Condensed', sans-serif"; context.fillText("I SWEAR!", 76, 280);
  context.font = "30px Aptos, sans-serif"; context.fillStyle = "#a5b5b9"; context.fillText("Same event. Different memories.", 80, 345);
  context.font = "bold 36px monospace"; context.fillStyle = "#8bbfc3"; context.fillText("WE RECOVERED", 80, 540);
  context.font = "900 330px 'Barlow Condensed', sans-serif"; context.fillStyle = "#f2e4c8"; context.fillText(`${result.reality_recovered}%`, 66, 830);
  context.font = "bold 54px monospace"; context.fillText("OF REALITY", 80, 915);
  context.fillStyle = "#ecc574"; context.font = "800 56px 'Barlow Condensed', sans-serif"; let y = wrapText(context, result.archetype, 80, 1080, 920, 60);
  context.fillStyle = "#b2c0c0"; context.font = "34px Aptos, sans-serif"; y = wrapText(context, result.description, 80, y + 35, 890, 48);
  for (const award of result.awards.slice(0, 3)) {
    context.fillStyle = "#8fa9b0"; context.font = "27px monospace"; context.fillText(award.title.toUpperCase(), 80, y + 70);
    context.fillStyle = "#f2e4c8"; context.font = "700 52px 'Barlow Condensed', sans-serif"; context.fillText(award.name, 80, y + 125); y += 145;
  }
  context.fillStyle = "#ef805f"; context.font = "800 46px 'Barlow Condensed', sans-serif"; context.fillText("CAN YOUR GROUP DO BETTER?", 80, 1780);
  context.fillStyle = "#8da6ae"; context.font = "25px monospace"; context.fillText(`${(result.map?.case_title ?? "The Blackout").toUpperCase()} / ${result.replay_code}`, 80, 1840);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `i-swear-${result.replay_code}.png`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export function Results({ result, isHost, onRematch, onChallenge, replay = false }: { result: GameResult; isHost: boolean; onRematch: () => void; onChallenge?: () => void; replay?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareText, setShareText] = useState("");
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?replay=${encodeURIComponent(result.replay_code)}`);
      setLinkCopied(true);
    } catch { setLinkCopied(false); setShareText(`${location.origin}${location.pathname}?replay=${encodeURIComponent(result.replay_code)}`); }
  }
  async function copyResult() {
    try {
      await navigator.clipboard.writeText(`I SWEAR\nWe recovered ${result.reality_recovered}% of reality.\n${result.archetype}\n${result.description}\nCase ${result.replay_code}\nCan your group do better?`);
      setCopied(true);
    } catch { setCopied(false); setShareText(`I SWEAR: We recovered ${result.reality_recovered}% of reality. ${result.archetype}. Case ${result.replay_code}. Can your group do better?`); }
  }
  return <section className="results-screen" style={{ "--case-art": `url(${result.map?.art ?? "/art/campus-night.svg"})` } as React.CSSProperties} aria-label="Match results"><div className="results-page"><header className="results-brand"><strong>I SWEAR</strong><span>{(result.map?.case_title ?? "The Blackout").toUpperCase()} / CASE CLOSED</span></header><div className="results-hero"><div><span className="result-label">TOGETHER, YOU RECOVERED</span><h1>{result.reality_recovered}<small>%</small></h1><p>OF REALITY</p></div><div className="group-archetype"><span>YOUR GROUP</span><h2>{result.archetype}</h2><p>{result.description}</p><blockquote>{result.recap}</blockquote></div></div><div className="case-stats"><div><strong>{result.timeline_accuracy}%</strong><span>Timeline order</span></div><div><strong>{result.evidence_found}</strong><span>Records recovered</span></div><div><strong>{result.theory_changes}</strong><span>Theory changes</span></div><div><strong>{result.consensus_mistakes}</strong><span>False consensuses</span></div></div>
    {result.nightmare&&<section className="nightmare-result"><small>NIGHTMARE / THE UNSAID</small><h3>{result.nightmare.ending==="unsealed"?"The clock closed the case.":result.nightmare.ending==="devoured"?"It swallowed the false story.":"You escaped its hunger."}</h3><p>{result.nightmare.ending==="unsealed"?"You did not vote to seal a final story. Review the reconstruction and its recovery score.":result.nightmare.ending==="devoured"?"The final reconstruction contained a false detail or misplaced event. The reveal above explains it.":"Your final proposed details did not feed it. Unresolved facts still affect your recovery score."} {result.nightmare.strikes} record-backed warning(s) during the investigation.</p></section>}
    {result.case_review && <section className="case-growth" aria-label="How your theory changed"><strong>{result.case_review.first_recorded ? `${result.case_review.first_recovery}% → ` : ""}{result.reality_recovered}%</strong><p>{result.case_review.first_recorded ? `First theory to final reconstruction. You revised ${result.case_review.changed_positions} of six moments.` : "Your final reconstruction."} {result.case_review.deadline_used ? "The clock closed the record." : "Your witnesses voted to close the record."}</p></section>}
    <div className="result-lineup" aria-label="Your witnesses">{result.players.map((player, index) => <div key={player.player_id}><WitnessAvatar color={player.avatar_color ?? index} hat={player.hat} /><strong>{player.name.replace(" (scripted)", "")}</strong><span>{player.score > 0 ? "+" : ""}{player.score} confidence points</span></div>)}</div>
    {result.archivist_line && <p className="archivist-recap">{result.archivist_line}</p>}
    {result.best_score !== undefined && <p className="group-best">This group's best recovery: {result.best_score}%</p>}
    <div className="result-awards">{result.awards.slice(0, 3).map((award) => <div key={award.title}><span>{award.title}</span><strong>{award.name}</strong><small>{award.value} {award.metric.replaceAll("_", " ")}</small></div>)}</div>
    {result.awards.length > 3 && <details className="result-record"><summary>More witness awards</summary>{result.awards.slice(3).map((award) => <article key={award.title}><strong>{award.title} / {award.name}</strong><p>{award.value} {award.metric.replaceAll("_", " ")}</p></article>)}</details>}
    <details className="result-record"><summary>Review belief versus reality</summary>{result.comparisons.map((comparison) => <article key={comparison.event.id}><time>{comparison.event.time}</time><p><span>You believed</span>{comparison.believed}</p><p><span>{comparison.correct ? "Confirmed" : "Actually"}</span>{comparison.actual}</p></article>)}</details>
    {result.case_review && <details className="result-record"><summary>What everyone was hiding</summary>{result.case_review.motives.map(motive => <article className="motive-result" key={motive.player_id}><strong>{motive.name} / {motive.title}</strong><p>{motive.secret}</p><small>{motive.complete ? "Personal objective completed" : `${motive.progress}/${motive.required} steps`} · {motive.revealed ? "Disclosed during the case" : "Kept private until the reveal"}</small></article>)}</details>}
    <details className="result-record"><summary>What happened to your memories</summary>{result.corrupted_memories.map((memory, index) => <article key={index}><strong>{memory.name}</strong><p>{memory.text}</p>{memory.explanation && <p>{memory.explanation}</p>}<small>{memory.state.replaceAll("_", " ")}{memory.corruption ? ` / ${memory.corruption.replaceAll("_", " ")}` : ""}</small></article>)}</details>
    <details className="result-record"><summary>How beliefs spread</summary>{result.belief_spread.length ? result.belief_spread.map((belief, index) => <article key={index}><strong>{belief.witness} remembered:</strong><p>{belief.text}</p><small>Believed by {belief.believers.join(", ")}</small></article>) : <p>No false testimony gained a public believer.</p>}</details>
    <details className="result-record"><summary>Witness accuracy and confidence</summary>{result.players.map((player) => <article key={player.player_id}><strong>{player.name}</strong><p>{player.memory_accuracy}% memory accuracy / {player.confidence_accuracy === null ? "No confidence staked" : `${player.confidence_accuracy}% confidence accuracy`} / {player.score} points</p><small>{player.successful_challenges} correct challenges, {player.failed_challenges} failed challenges, {player.evidence_found} records recovered</small></article>)}</details>
    {shareText && <label className="share-fallback">Select and copy to share<textarea readOnly value={shareText} onFocus={(event) => event.currentTarget.select()} /></label>}
    <footer className="results-actions"><button onClick={() => downloadShareCard(result)}><DownloadSimple size={19} /> Share card</button><button onClick={copyResult}><Copy size={19} /> {copied ? "Copied" : "Copy result"}</button><button onClick={copyLink}><Copy size={19} /> {linkCopied ? "Link copied" : "Copy replay link"}</button>{isHost ? <button className="primary-action" onClick={onRematch}><ArrowCounterClockwise size={19} /> Rematch</button> : onChallenge ? <button className="primary-action" onClick={onChallenge}>Can your group do better? <ArrowRight size={19} /></button> : <span>The host can reopen the case.</span>}</footer><p className="results-code">{replay ? "SAVED CASE" : "Same event. Different memories."} / {result.replay_code}</p></div></section>;
}
