import { useState } from "react";
import { Dossier } from "./MysteryPanels";
import { useCaseState } from "./Casefile";
import type { GameSocket } from "../network/GameSocket";
import type { RecoveredEvidence, Testimony, TimelineEntry, TimelineState } from "../types/protocol";

export const EMPTY_TIMELINE: TimelineState = { slots: Array(6).fill(null), revision: 0, votes: [], required_votes: 3, theory_changes: 0 };
const FIELDS = ["actor", "location", "time", "object", "action"];

export function InvestigationBoard({ evidence, testimonies, timeline, socket, playerId, onClose, caseTitle = "The Blackout" }: {
  evidence: RecoveredEvidence[]; testimonies: Testimony[]; timeline: TimelineState;
  socket: GameSocket; playerId: string; onClose: () => void; caseTitle?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"evidence" | "testimony">("evidence");
  const caseState = useCaseState(socket);
  const sources = tab === "evidence" ? evidence.map(item => ({ id: item.id, event_id: item.event_id, text: item.text, label: item.label }))
    : testimonies.filter(item => !item.retracted).map(item => ({ id: item.id, event_id: item.memory.event_id, text: item.memory.text, label: `${item.name} / TESTIMONY` }));
  const chosen = sources.find(source => source.id === selected);
  const withdrawn = new Set(testimonies.filter(item => item.retracted).map(item => item.id));
  const invalid = timeline.slots.some(entry => entry && (entry.source_ids ?? [entry.source_id]).some(id => withdrawn.has(id)));
  function place(slot: number, sourceId: string | null, status: TimelineEntry["status"] = "UNKNOWN") {
    socket.send({ type: "timeline", slot, source_id: sourceId, status, revision: timeline.revision });
    setSelected(null);
  }
  function link(slot: number, sourceId: string, remove = false) {
    socket.send({ type: "link_source", slot, source_id: sourceId, revision: timeline.revision, remove });
    setSelected(null);
  }
  const ready = timeline.slots.every(Boolean) && evidence.length >= 3 && !invalid && (!caseState || caseState.lock_available);
  const voted = timeline.votes.includes(playerId);
  return <Dossier title={`Reconstruct ${caseTitle.replace(/^The /, "the ")}`} subtitle="SHARED INVESTIGATION BOARD" onClose={onClose} wide>
    <details className="board-instructions"><summary>How the board works</summary><p className="dossier-intro">{caseState ? "Each record establishes only part of a moment. Select a source, then place it or link it to the same event. Physical records override conflicting recollections; details supplied only by testimony remain unverified." : "Drag a record onto the sequence, or select it and choose a position. Evidence is reliable; testimony is unverified."} The timeline stays ungraded until reality locks.</p></details>
    {caseState && <div className="theory-checkpoint">
      <div><b>{caseState.first_theory ? "Your first theory is on the record" : caseState.stage === "first_theory" ? "Record your first theory" : "The first-theory checkpoint"} </b><p>{caseState.first_theory ? `${caseState.first_theory.filled}/6 proposed moments saved. You can still change your mind.` : caseState.stage === "first_theory" ? "Three proposed moments are enough. A majority can save this version before the backup records open." : caseState.lead_available ? "The new lead is available. Revisit the backup sources and complete your deductions." : "Use the first search to propose a sequence. The discussion window opens before the new lead."}</p></div>
      {caseState.stage === "first_theory" && !caseState.first_theory && <button disabled={timeline.slots.filter(Boolean).length < 3} onClick={() => socket.send({ type: "theory_vote", revision: timeline.revision, vote: !caseState.theory_votes.includes(playerId) })}>{caseState.theory_votes.includes(playerId) ? "Withdraw theory vote" : "Record first theory"} ({caseState.theory_votes.length}/{timeline.required_votes})</button>}
    </div>}
    <div className="reconstruction-layout"><aside className="source-drawer"><div className="source-tabs"><button aria-pressed={tab === "evidence"} onClick={() => { setTab("evidence"); setSelected(null); }}>Records ({evidence.length})</button><button aria-pressed={tab === "testimony"} onClick={() => { setTab("testimony"); setSelected(null); }}>Testimony</button></div>
      <div className="source-records">{sources.length ? sources.map(source => <button key={source.id} className="source-record" draggable onDragStart={event => { event.dataTransfer.setData("text/plain", source.id); setSelected(source.id); }} aria-pressed={selected === source.id} onClick={() => setSelected(source.id)}><span>{source.label}</span><p>{source.text}</p></button>) : <p className="empty-record">{tab === "evidence" ? "Inspect marked objects to recover records. Different badges open different sources." : "Share a memory to add it to the public record."}</p>}</div>
    </aside><ol className="sequence-slots">{timeline.slots.map((entry, slot) => <li key={slot} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); place(slot, event.dataTransfer.getData("text/plain")); }}>
      <div className="slot-heading"><strong>{String(slot + 1).padStart(2, "0")}</strong><span>{entry ? entry.kind.toUpperCase() : "UNKNOWN MOMENT"}</span>{entry && <button aria-label={`Clear position ${slot + 1}`} onClick={() => place(slot, null)}>Clear</button>}</div>
      {entry ? <><p>{entry.text}</p>
        {caseState && <div className="deduction-facts">{FIELDS.map(field => <span key={field} className={entry.verified_fields?.includes(field) ? "verified" : field in entry.claim ? "recalled" : "missing"}><small>{field}</small><b>{entry.claim[field] ?? "Unknown"}</b><em>{entry.verified_fields?.includes(field) ? "Recorded" : field in entry.claim ? "Recalled" : "Missing"}</em></span>)}</div>}
        {!!entry.conflicts?.length && <p className="deduction-conflict">Sources disagree about {entry.conflicts.join(", ")}. Records take priority; otherwise the first linked recollection is retained.</p>}
        {!!entry.sources?.length && <div className="deduction-links" aria-label={`Linked sources for position ${slot + 1}`}>{entry.sources.map(source => <button key={source.id} className={withdrawn.has(source.id) ? "withdrawn" : ""} onClick={() => link(slot, source.id, true)} aria-label={`Remove ${source.label} from position ${slot + 1}`}>{withdrawn.has(source.id) ? "WITHDRAWN / " : ""}{source.label} <span>×</span></button>)}</div>}
        <label className="slot-status">Group status<select aria-label={`Status for position ${slot + 1}`} value={entry.status} onChange={event => place(slot, entry.source_id, event.target.value as TimelineEntry["status"])}><option>UNKNOWN</option><option>CONFIRMED</option><option>DISPUTED</option></select></label>
        {selected && <div className="deduction-actions"><button className="place-record" onClick={() => place(slot, selected)}>Replace position {slot + 1}</button>{caseState && <button className="place-record" disabled={chosen?.event_id !== entry.event_id || (entry.source_ids?.length ?? 1) >= 4 || entry.source_ids?.includes(selected)} onClick={() => link(slot, selected)}>Link selected source</button>}</div>}
      </> : <button className="place-record" disabled={!selected} onClick={() => place(slot, selected)}>{selected ? `Place in position ${slot + 1}` : "Select or drag a record here"}</button>}
    </li>)}</ol></div>
    <footer className="timeline-footer"><div><strong>{timeline.votes.length}/{timeline.required_votes} votes to lock reality</strong><span>{invalid ? "Remove withdrawn sources before voting." : caseState && !caseState.lock_available ? "Final voting opens when the new lead arrives." : evidence.length < 3 ? `${3 - evidence.length} more physical records required` : "Any edit clears previous lock votes."}</span></div><button className="primary-action" disabled={!ready} onClick={() => socket.send({ type: "lock_vote", revision: timeline.revision, vote: !voted })}>{voted ? "Withdraw vote" : "Lock reality"}</button></footer>
  </Dossier>;
}
