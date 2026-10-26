import { useState } from "react";
import { Dossier } from "./MysteryPanels";
import type { GameSocket } from "../network/GameSocket";
import type { RecoveredEvidence, Testimony, TimelineEntry, TimelineState } from "../types/protocol";

export const EMPTY_TIMELINE: TimelineState = { slots: Array(6).fill(null), revision: 0, votes: [], required_votes: 3, theory_changes: 0 };

export function InvestigationBoard({ evidence, testimonies, timeline, socket, playerId, onClose }: {
  evidence: RecoveredEvidence[]; testimonies: Testimony[]; timeline: TimelineState;
  socket: GameSocket; playerId: string; onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"evidence" | "testimony">("evidence");
  const sources = tab === "evidence" ? evidence.map((item) => ({ id: item.id, text: item.text, label: item.label }))
    : testimonies.filter((item) => !item.retracted).map((item) => ({ id: item.id, text: item.memory.text, label: `${item.name} / TESTIMONY` }));
  function place(slot: number, sourceId: string | null, status: TimelineEntry["status"] = "UNKNOWN") {
    socket.send({ type: "timeline", slot, source_id: sourceId, status, revision: timeline.revision });
    setSelected(null);
  }
  const ready = timeline.slots.every(Boolean) && evidence.length >= 3;
  const voted = timeline.votes.includes(playerId);
  return <Dossier title="Reconstruct the blackout" subtitle="SHARED INVESTIGATION BOARD" onClose={onClose} wide>
    <p className="dossier-intro">Drag a record onto the sequence, or select it and choose a position. Evidence records are reliable. Testimony is unverified. The timeline stays ungraded until you lock reality.</p>
    <div className="reconstruction-layout"><aside className="source-drawer"><div className="source-tabs"><button aria-pressed={tab === "evidence"} onClick={() => setTab("evidence")}>Evidence ({evidence.length})</button><button aria-pressed={tab === "testimony"} onClick={() => setTab("testimony")}>Testimony</button></div><div className="source-records">{sources.length ? sources.map((source) => <button key={source.id} className="source-record" draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", source.id); setSelected(source.id); }} aria-pressed={selected === source.id} onClick={() => setSelected(source.id)}><span>{source.label}</span><p>{source.text}</p></button>) : <p className="empty-record">{tab === "evidence" ? "Inspect marked objects in the facility to recover records." : "Share a memory to add it to the public record."}</p>}</div></aside>
      <ol className="sequence-slots">{timeline.slots.map((entry, slot) => <li key={slot} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); place(slot, event.dataTransfer.getData("text/plain")); }}><div className="slot-heading"><strong>{String(slot + 1).padStart(2, "0")}</strong><span>{entry ? entry.kind.toUpperCase() : "UNKNOWN EVENT"}</span>{entry && <button aria-label={`Clear position ${slot + 1}`} onClick={() => place(slot, null)}>Clear</button>}</div>{entry ? <><p>{entry.text}</p><label className="slot-status">Group status<select aria-label={`Status for position ${slot + 1}`} value={entry.status} onChange={(event) => place(slot, entry.source_id, event.target.value as TimelineEntry["status"])}><option>UNKNOWN</option><option>CONFIRMED</option><option>DISPUTED</option></select></label>{selected && <button className="place-record" onClick={() => place(slot, selected)}>Replace position {slot + 1}</button>}</> : <button className="place-record" disabled={!selected} onClick={() => place(slot, selected)}>{selected ? `Place in position ${slot + 1}` : "Select or drag a record here"}</button>}</li>)}</ol>
    </div><footer className="timeline-footer"><div><strong>{timeline.votes.length}/{timeline.required_votes} votes to lock reality</strong><span>{evidence.length < 3 ? `${3 - evidence.length} more physical records required` : "Any edit clears previous lock votes."}</span></div><button className="primary-action" disabled={!ready} onClick={() => socket.send({ type: "lock_vote", revision: timeline.revision, vote: !voted })}>{voted ? "Withdraw vote" : "Lock reality"}</button></footer>
  </Dossier>;
}
