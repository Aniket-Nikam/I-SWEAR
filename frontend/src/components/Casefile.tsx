import { useEffect, useState } from "react";
import { Dossier } from "./MysteryPanels";
import type { GameSocket } from "../network/GameSocket";
import type { CaseState, CaseRole } from "../types/protocol";

export function useCaseState(socket: GameSocket) {
  const [state, setState] = useState<CaseState | null>(() => socket.snapshot?.case ?? null);
  useEffect(() => socket.onMessage(message => {
    if (message.type === "case_state") setState(message.case);
    if (message.type === "snapshot") setState(message.case ?? null);
  }), [socket]);
  return state;
}
export function CaseRhythm({ socket, onMotive, onBoard }: { socket: GameSocket; onMotive: () => void; onBoard: () => void }) {
  const state = useCaseState(socket);
  if (!state) return null;
  const remaining = `${Math.floor(state.remaining / 60)}:${String(state.remaining % 60).padStart(2, "0")}`;
  return <aside className={`case-rhythm ${state.stage}`} aria-label="Case progress">
    <button className="case-stage" onClick={onBoard}><time>{remaining}</time><span><small>{state.first_theory ? "FIRST THEORY RECORDED" : "THE RECORD IS STILL OPEN"}</small><b>{state.title}</b></span></button>
    <button className="motive-open" onClick={onMotive}>Your motive <kbd>Q</kbd></button>
    <div className="case-clock-track" aria-hidden="true"><i style={{ width: `${state.remaining/state.duration*100}%` }} /></div>
  </aside>;
}

export function PrivateMotive({ socket, onClose }: { socket: GameSocket; onClose: () => void }) {
  const [role, setRole] = useState<CaseRole | null>(() => socket.role);
  const state = useCaseState(socket);
  useEffect(() => socket.onMessage(message => { if (message.type === "case_role") setRole(message.role); }), [socket]);
  return <Dossier title="What you haven't told them" subtitle="PRIVATE / BEFORE TONIGHT" onClose={onClose}>
    {role ? <div className="motive-paper"><span className="eyebrow">{role.revealed ? "YOU CHOSE TO SHARE THIS" : "ONLY YOU CAN SEE THIS"}</span><h3>{role.title}</h3><p>{role.secret}</p>
      <div className="motive-objective"><b>Your optional objective</b><p>{role.objective}</p><span>{role.progress}/{role.required} steps · {role.revealed ? "motive disclosed" : "still private"}</span>{role.complete && <strong>Personal objective complete</strong>}</div>
      <p className="private-note">This happened before the incident. It explains your hesitation; it does not prove anyone's guilt. Your objective never changes the team's recovery score.</p>
      <button className="primary-action" disabled={role.revealed} onClick={() => socket.send({ type: "reveal_motive" })}>{role.revealed ? "Shared with the room" : "Tell the other witnesses"}</button>
    </div> : <p className="dossier-intro">Your private case note arrives when the investigation begins.</p>}
    {!!state?.revealed_motives.length && <section className="disclosed-motives"><h3>What the others admitted</h3>{state.revealed_motives.map(motive => <article key={motive.player_id}><b>{motive.name} / {motive.title}</b><p>{motive.secret}</p></article>)}</section>}
  </Dossier>;
}
