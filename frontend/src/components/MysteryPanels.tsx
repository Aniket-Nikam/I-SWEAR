import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { Scales } from "@phosphor-icons/react/dist/csr/Scales";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import type { Belief, ChatMessage, MemoryClash, MemoryFragment, Stake, Testimony } from "../types/protocol";
import type { GameSocket } from "../network/GameSocket";

export function Dossier({ title, subtitle, children, onClose, wide = false }: {
  title: string; subtitle: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    (root.current?.querySelector<HTMLElement>("[data-initial-focus]") ?? root.current?.querySelector<HTMLElement>("button, input"))?.focus();
    return () => document.querySelector<HTMLElement>('[role="application"]')?.focus();
  }, []);
  return <div className="dossier-scrim"><section className={`dossier ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={root} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = root.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, textarea");
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <header className="dossier-heading"><div><span>{subtitle}</span><h2>{title}</h2></div><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={22} /></button></header>
    {children}
  </section></div>;
}

function StakeControl({ value, onChange }: { value: Stake; onChange: (value: Stake) => void }) {
  return <fieldset className="stake-control"><legend>Confidence stake</legend>{([10, 25, 50] as const).map((stake) => <button type="button" aria-pressed={value === stake} onClick={() => onChange(stake)} key={stake}>{stake}</button>)}</fieldset>;
}

export function MemoryJournal({ memories, testimonies, socket, playerId, onClose }: {
  memories: MemoryFragment[]; testimonies: Testimony[]; socket: GameSocket; playerId: string; onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [stake, setStake] = useState<Stake>(10);
  const memory = memories[selected];
  return <Dossier title="What I remember" subtitle="PRIVATE WITNESS JOURNAL" onClose={onClose} wide>
    <p className="dossier-intro">These are your recollections. A clear memory can still be wrong. Only testimony you choose to share becomes public.</p>
    {memory ? <div className="journal-layout"><nav aria-label="Memory fragments" className="memory-index">{memories.map((fragment, index) => <button key={fragment.id} aria-pressed={index === selected} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{String(fragment.claim.time)}</strong><small>{fragment.category.toLowerCase()}</small></button>)}</nav>
      <article className="memory-page"><div className="memory-meta"><span>{memory.category}</span><span>FEELS {memory.confidence}</span></div><p className="sensory">{memory.sensory}</p><blockquote>{memory.text}</blockquote><div className="claim-stamps"><span>{String(memory.claim.location)}</span><time>{String(memory.claim.time)}</time></div><StakeControl value={stake} onChange={setStake} /><button className="primary-action" onClick={() => socket.send({ type: "testify", memory_id: memory.id, stake })}><Broadcast size={18} /> {testimonies.some((item) => item.player_id === playerId && item.memory.id === memory.id && !item.retracted) ? "Update testimony" : "Share testimony"}</button><p className="private-note">Sharing reveals this fragment to every witness. Its truth remains unknown.</p></article>
    </div> : <p className="dossier-intro">Your recollections are being recovered. They will appear here when the investigation begins.</p>}
  </Dossier>;
}

export function TestimonyBoard({ testimonies, clashes, playerId, socket, onClose }: {
  testimonies: Testimony[]; clashes: MemoryClash[]; playerId: string; socket: GameSocket; onClose: () => void;
}) {
  const [stake, setStake] = useState<Stake>(10);
  return <Dossier title="Witness testimony" subtitle="PUBLIC RECORD / UNVERIFIED" onClose={onClose} wide>
    <p className="dossier-intro">Agreement is not evidence. Challenge conflicting details, change your confidence, or leave them unresolved.</p>
    <StakeControl value={stake} onChange={setStake} />
    <div className="testimony-record" aria-live="polite">{testimonies.length === 0 ? <p className="empty-record">The record is empty. Open your journal with M and share a recollection.</p> : testimonies.map((testimony) => {
      const fields = [...new Set(clashes.filter((clash) => clash.testimony_ids.includes(testimony.id)).flatMap((clash) => clash.fields))];
      const own = testimony.player_id === playerId;
      const selected = testimony.responses[playerId]?.response;
      return <article className={`testimony-entry ${testimony.retracted ? "retracted" : ""}`} key={testimony.id}>
        <header><strong>{testimony.name}</strong><span>{testimony.retracted ? "RETRACTED" : `${testimony.stake} CONFIDENCE`}</span>{fields.length > 0 && !testimony.retracted && <b className="clash-label">CLASH: {fields.join(", ")}</b>}</header>
        <p>{testimony.memory.text}</p>
        {fields.length > 0 && <div className="conflicting-details">{fields.map((field) => <span key={field}>{field}: <mark>{String(testimony.memory.claim[field])}</mark></span>)}</div>}
        {!testimony.retracted && (own ? <div className="testimony-actions"><button onClick={() => socket.send({ type: "retract", testimony_id: testimony.id })}>Retract</button><button onClick={() => socket.send({ type: "testify", memory_id: testimony.memory.id, stake })}>Defend at {stake}</button></div> : <div className="testimony-actions">{(["BELIEVE", "DOUBT", "CONTRADICTS_ME"] as Belief[]).map((response) => {
          const label = response === "CONTRADICTS_ME" ? "Contradicts me" : response === "BELIEVE" ? "Believe" : "Doubt";
          const count = Object.values(testimony.responses).filter((item) => item.response === response).length;
          return <button key={response} aria-pressed={selected === response} onClick={() => socket.send({ type: "respond", testimony_id: testimony.id, response, stake })}>{label}{count ? ` (${count})` : ""}</button>;
        })}</div>)}
      </article>;
    })}</div>
  </Dossier>;
}

export function ChatPanel({ messages, socket, onClose }: { messages: ChatMessage[]; socket: GameSocket; onClose: () => void }) {
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages.length]);
  return <Dossier title="Witness radio" subtitle="ROOM CHANNEL / ALL WITNESSES" onClose={onClose}>
    <div className="chat-log" role="log" aria-live="polite" ref={log}>{messages.length ? messages.map((message) => <p key={message.id}><strong>{message.name}</strong><span>{message.text}</span></p>) : <p className="empty-record">The line is open. Compare what you remember.</p>}</div>
    <div className="quick-reactions" aria-label="Quick radio reactions">{["I remember it differently.", "Show me the evidence.", "Let's compare memories."].map((reaction) => <button key={reaction} onClick={() => socket.send({ type: "chat", text: reaction })}>{reaction}</button>)}</div>
    <form className="chat-form" onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; socket.send({ type: "chat", text: text.trim() }); setText(""); }}><label htmlFor="radio-message">Message to all witnesses</label><div><input id="radio-message" data-initial-focus autoFocus maxLength={280} value={text} onChange={(event) => setText(event.target.value)} placeholder="What did you see?" /><button className="primary-action" disabled={!text.trim()}>Send</button></div></form>
  </Dossier>;
}

export function InvestigationTools({ count, onOpen }: { count: number; onOpen: (panel: "memories" | "testimony" | "chat" | "board") => void }) {
  return <nav className="investigation-tools" aria-label="Investigation tools"><button onClick={() => onOpen("memories")}><BookOpen size={19} /> Memories <kbd>M</kbd></button><button onClick={() => onOpen("testimony")}><Scales size={19} /> Testimony{count > 0 ? ` (${count})` : ""} <kbd>T</kbd></button><button onClick={() => onOpen("board")}>Reconstruction <kbd>TAB</kbd></button><button onClick={() => onOpen("chat")}><Broadcast size={19} /> Radio <kbd>ENTER</kbd></button></nav>;
}
