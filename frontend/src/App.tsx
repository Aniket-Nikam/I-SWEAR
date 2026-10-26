import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { DoorOpen } from "@phosphor-icons/react/dist/csr/DoorOpen";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { LinkSimple } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { GameSocket } from "./network/GameSocket";
import { ChatPanel, InvestigationTools, MemoryJournal, TestimonyBoard } from "./components/MysteryPanels";
import { EMPTY_TIMELINE, InvestigationBoard } from "./components/InvestigationBoard";
import { Results, TruthReveal } from "./components/Endgame";
import { objectThumbnails } from "./game/artworkCache";
import { audioDirector } from "./game/AudioDirector";
import { GameSettings } from "./components/GameSettings";
import { InviteQR } from "./components/InviteQR";
import { ReplayScreen } from "./components/ReplayScreen";
import type { ChatMessage, GameResult, Interactable, MemoryClash, MemoryFragment, RecoveredEvidence, RoomSnapshot, ServerMessage, Session, Testimony, TimelineState } from "./types/protocol";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";
const GameCanvas = lazy(() => import("./game/GameCanvas").then((module) => ({ default: module.GameCanvas })));

function updateSnapshot(snapshot: RoomSnapshot, message: ServerMessage): RoomSnapshot {
  if (message.type === "presence") {
    const exists = snapshot.players.some((player) => player.id === message.player.id);
    return {
      ...snapshot,
      players: exists
        ? snapshot.players.map((player) => (player.id === message.player.id ? message.player : player))
        : [...snapshot.players, message.player],
    };
  }
  if (message.type === "ready_changed") {
    return {
      ...snapshot,
      players: snapshot.players.map((player) =>
        player.id === message.player_id ? { ...player, ready: message.ready } : player,
      ),
    };
  }
  if (message.type === "host_changed") return { ...snapshot, room: { ...snapshot.room, host_id: message.host_id } };
  if (message.type === "phase_changed") return { ...snapshot, room: { ...snapshot.room, phase: message.phase } };
  if (message.type === "player_moved") {
    return {
      ...snapshot,
      players: snapshot.players.map((player) =>
        player.id === message.player_id ? { ...player, x: message.x, y: message.y } : player,
      ),
    };
  }
  return snapshot;
}

function App() {
  const initialRoom = new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";
  const [session, setSession] = useState<Session | null>(() => {
    if (!initialRoom) return null;
    try {
      const stored = sessionStorage.getItem(`i-swear-session-${initialRoom}`);
      return stored ? (JSON.parse(stored) as Session) : null;
    } catch { return null; }
  });
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [error, setError] = useState("");
  const [inspection, setInspection] = useState<Interactable | null>(null);
  const [prompt, setPrompt] = useState<Interactable | null>(null);
  const [currentRoom, setCurrentRoom] = useState("Central Atrium");
  const [activity, setActivity] = useState("");
  const [copied, setCopied] = useState(false);
  const [onboarding, setOnboarding] = useState(true);
  const [memories, setMemories] = useState<MemoryFragment[]>([]);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [clashes, setClashes] = useState<MemoryClash[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [panel, setPanel] = useState<"memories" | "testimony" | "chat" | "board" | null>(null);
  const [evidence, setEvidence] = useState<RecoveredEvidence[]>([]);
  const [timeline, setTimeline] = useState<TimelineState>(EMPTY_TIMELINE);
  const [result, setResult] = useState<GameResult | null>(null);
  const [revealStartedAt, setRevealStartedAt] = useState(0);
  const [archivist, setArchivist] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeClash, setActiveClash] = useState<MemoryClash | null>(null);
  const dossierOpen = Boolean(panel || inspection || inviteOpen);

  useEffect(() => {
    if (!activeClash || dossierOpen) return;
    const timer = window.setTimeout(() => setActiveClash(null), 6000);
    return () => window.clearTimeout(timer);
  }, [activeClash, dossierOpen]);

  useEffect(() => {
    if (!archivist || dossierOpen || activeClash) return;
    const timer = window.setTimeout(() => setArchivist(""), 9000);
    return () => window.clearTimeout(timer);
  }, [archivist, dossierOpen, activeClash]);

  useEffect(() => {
    if (!session) return;
    const next = new GameSocket(session);
    const timers: number[] = [];
    setSocket(next);
    const unsubscribeStatus = next.onStatus(setStatus);
    const unsubscribeMessage = next.onMessage((message) => {
      if (message.type === "snapshot") {
        setSnapshot(message);
        setTestimonies(message.testimonies ?? []);
        setClashes(message.clashes ?? []);
        setChat(message.chat ?? []);
        setEvidence(message.evidence ?? []);
        setTimeline(message.timeline ?? EMPTY_TIMELINE);
        setResult(message.result ?? null);
        setRevealStartedAt(message.reveal_started_at ?? 0);
        if (message.room.phase === "exploring") {
          setOnboarding(true);
          timers.push(window.setTimeout(() => setOnboarding(false), 7000));
        }
        if (message.room.phase === "lobby") { setPanel(null); setInspection(null); setActiveClash(null); setArchivist(""); }
      }
      else if (message.type !== "positions") setSnapshot((current) => (current ? updateSnapshot(current, message) : current));
      if (message.type === "inspection") { setInspection(message.interactable); audioDirector.cue("inspection"); }
      if (message.type === "activity") {
        setActivity(`${message.label} was inspected nearby`);
        timers.push(window.setTimeout(() => setActivity(""), 3200));
      }
      if (message.type === "error") setError(message.message);
      if (message.type === "phase_changed") {
        if (message.phase !== "exploring") { setPanel(null); setInspection(null); setActiveClash(null); setArchivist(""); }
        setOnboarding(true);
        timers.push(window.setTimeout(() => setOnboarding(false), 7000));
      }
      if (message.type === "memories") setMemories(message.memories);
      if (message.type === "evidence") {
        audioDirector.cue("evidence");
        setEvidence((current) => current.some((item) => item.id === message.evidence.id) ? current : [...current, message.evidence]);
        setActivity(`${message.finder} recovered ${message.evidence.label.toLowerCase()}`);
        timers.push(window.setTimeout(() => setActivity(""), 4000));
      }
      if (message.type === "timeline") setTimeline(message.timeline);
      if (message.type === "recap") setResult((current) => current ? { ...current, archivist_line: message.text } : current);
      if (message.type === "reveal") {
        audioDirector.cue("reveal"); audioDirector.setWorld(false);
        setResult(message.result); setRevealStartedAt(message.started_at);
        setPanel(null); setInspection(null); setActiveClash(null);
      }
      if (message.type === "archivist") {
        setArchivist(message.text);
      }
      if (message.type === "testimony") setTestimonies((current) => current.some((item) => item.id === message.testimony.id)
        ? current.map((item) => item.id === message.testimony.id ? message.testimony : item)
        : [...current, message.testimony]);
      if (message.type === "chat") setChat((current) => [...current, message.message].slice(-60));
      if (message.type === "clash") {
        audioDirector.cue("clash");
        setClashes((current) => [...current, message.clash]);
        setActiveClash(message.clash);
      }
    });
    next.connect();
    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      next.close();
      timers.forEach(window.clearTimeout);
    };
  }, [session]);

  useEffect(() => {
    const closeInspection = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setInspection(null); setPanel(null); return; }
      if (snapshot?.room.phase !== "exploring" || inspection) return;
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.key === "Tab" && !panel && target.closest('[role="application"]')) {
        event.preventDefault(); setPanel("board");
      }
      if (key === "m" || key === "t") {
        event.preventDefault();
        const nextPanel = key === "m" ? "memories" : "testimony";
        setPanel((current) => current === nextPanel ? null : nextPanel);
      }
      if (event.key === "Enter" && !panel && target.tagName !== "BUTTON") {
        event.preventDefault(); setPanel("chat");
      }
    };
    window.addEventListener("keydown", closeInspection);
    return () => window.removeEventListener("keydown", closeInspection);
  }, [snapshot?.room.phase, inspection, panel]);

  const isHost = snapshot?.room.host_id === session?.player_id;
  const allReady = Boolean(snapshot && snapshot.players.length >= snapshot.room.min_players && snapshot.players.every((player) => player.ready && player.connected));
  const inviteUrl = useMemo(() => {
    if (!session) return "";
    return `${location.origin}${location.pathname}?room=${session.room_code}`;
  }, [session]);

  async function enterRoom(name: string, roomCode?: string, solo = false) {
    setError("");
    setMemories([]); setTestimonies([]); setClashes([]); setChat([]); setPanel(null);
    const endpoint = solo ? "/api/rooms/solo" : roomCode ? `/api/rooms/${roomCode}/join` : "/api/rooms";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Please check the witness name and room code");
      const nextSession = body as Session;
      sessionStorage.setItem(`i-swear-session-${nextSession.room_code}`, JSON.stringify(nextSession));
      history.replaceState({}, "", `?room=${nextSession.room_code}`);
      setSession(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Archivist could not open this room");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError(`Invite link: ${inviteUrl}`); }
  }

  function leaveRoom() {
    socket?.close();
    sessionStorage.removeItem(`i-swear-session-${session?.room_code}`);
    history.replaceState({}, "", location.pathname);
    setSession(null);
    setSnapshot(null);
    setSocket(null);
    setError("");
  }

  const replayCode = new URLSearchParams(location.search).get("replay");
  if (!session && replayCode) return <ReplayScreen code={replayCode} />;
  if (!session) return <EntryScreen initialRoom={initialRoom} error={error} onEnter={enterRoom} onSolo={(name) => enterRoom(name, undefined, true)} />;

  if (!snapshot || !socket) {
    return (
      <main className="loading-screen">
        <div className="wordmark">I SWEAR</div>
        <div className="loading-line" />
        <p>{status === "offline" ? "This room is no longer available" : status === "reconnecting" ? "Restoring witness record" : "Opening the case file"}</p>
        {status === "offline" && <button className="ready-action" onClick={leaveRoom}>Return to entry</button>}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <Suspense fallback={<div className="loading-screen">Opening the facility</div>}><GameCanvas
        socket={socket}
        snapshot={snapshot}
        localPlayerId={session.player_id}
        onPrompt={setPrompt}
        onRoomChange={setCurrentRoom}
        inputEnabled={snapshot.room.phase === "exploring" && !inspection && !panel && status === "connected"}
      /></Suspense>
      <div className="grain" aria-hidden="true" />
      <GameSettings worldActive={snapshot.room.phase === "exploring"} />
      <header className="game-header">
        <div className="case-mark">
          <span className="case-title">I SWEAR</span>
          <span className="case-subtitle">THE BLACKOUT</span>
        </div>
        <div className="location-readout">
          <span>YOU ARE IN</span>
          <strong>{currentRoom}</strong>
        </div>
        <div className={`connection ${status}`}>
          <Broadcast size={17} weight="bold" />
          {status === "connected" ? "Live room" : status}
        </div>
      </header>

      {snapshot.room.phase === "lobby" && (
        <LobbyOverlay
          snapshot={snapshot}
          localPlayerId={session.player_id}
          isHost={isHost}
          allReady={allReady}
          copied={copied}
          onCopy={copyInvite}
          onReady={(ready) => socket.send({ type: "ready", ready })}
          onStart={() => socket.send({ type: "start" })}
          onQR={() => setInviteOpen(true)}
        />
      )}

      {snapshot.room.phase === "exploring" && (
        <>
          <aside className="witness-strip" aria-label="Witnesses in room">
            <span className="strip-heading">WITNESSES</span>
            {snapshot.players.map((player) => (
              <div className={`witness-chip ${player.connected ? "" : "absent"}`} key={player.id}>
                <i style={{ "--witness-color": `var(--avatar-${player.color_index})` } as React.CSSProperties} />
                <span>{player.name}{!player.connected ? " (offline)" : player.afk ? " (away)" : ""}</span>
              </div>
            ))}
          </aside>
          <div className={`context-prompt ${prompt ? "visible" : ""}`} aria-live="polite">
            {prompt && (
              <>
                <kbd>E</kbd>
                <div>
                  <span>INSPECT</span>
                  <strong>{prompt.label}</strong>
                </div>
              </>
            )}
          </div>
          {onboarding && (
            <section className="onboarding" aria-label="Controls">
              <p>You all experienced the same event. Explore what remains.</p>
              <div><kbd>WASD</kbd> Move</div>
              <div><kbd>E</kbd> Inspect</div>
              <div><kbd>M</kbd> Private memories</div>
              <div><kbd>T</kbd> Testimony</div>
            </section>
          )}
          <InvestigationTools count={testimonies.filter((item) => !item.retracted).length} onOpen={setPanel} />
        </>
      )}

      {activity && <div className="activity-toast"><Eye size={18} /> {activity}</div>}
      {error && <div className="error-toast"><Warning size={18} /> {error}<button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}
      {inspection && <InspectionOverlay item={inspection} onClose={() => setInspection(null)} />}
      {panel === "memories" && <MemoryJournal memories={memories} testimonies={testimonies} socket={socket} playerId={session.player_id} onClose={() => setPanel(null)} />}
      {panel === "testimony" && <TestimonyBoard testimonies={testimonies} clashes={clashes} socket={socket} playerId={session.player_id} onClose={() => setPanel(null)} />}
      {panel === "chat" && <ChatPanel messages={chat} socket={socket} onClose={() => setPanel(null)} />}
      {panel === "board" && <InvestigationBoard evidence={evidence} testimonies={testimonies} timeline={timeline} socket={socket} playerId={session.player_id} onClose={() => setPanel(null)} />}
      {archivist && !dossierOpen && !activeClash && snapshot.room.phase === "exploring" && <div className="memory-clash" role="status"><strong>THE ARCHIVIST</strong><p>{archivist}</p><button onClick={() => setArchivist("")}>Keep investigating</button></div>}
      {result && snapshot.room.phase === "reveal" && <TruthReveal result={result} startedAt={revealStartedAt} />}
      {result && snapshot.room.phase === "results" && <Results result={result} isHost={isHost} onRematch={() => socket.send({ type: "rematch" })} onChallenge={() => enterRoom(snapshot.players.find((player) => player.id === session.player_id)?.name ?? "Witness")} />}
      {inviteOpen && <InviteQR url={inviteUrl} roomCode={session.room_code} onClose={() => setInviteOpen(false)} />}
      {activeClash && !dossierOpen && <div className="memory-clash" role="status"><strong>MEMORY CLASH</strong><p>{activeClash.names.join(" / ")} disagree about {activeClash.fields.join(", ")}.</p><button onClick={() => { setPanel("testimony"); setActiveClash(null); }}>Compare testimony <kbd>T</kbd></button><button className="icon-button" aria-label="Dismiss memory clash" onClick={() => setActiveClash(null)}><X size={18} /></button></div>}
      {status === "offline" && <div className="inspection-scrim"><section className="entry-panel"><h2>Connection ended</h2><p>This session may have opened elsewhere, or the room has closed.</p><button className="primary-action" onClick={leaveRoom}>Return to entry</button></section></div>}
    </main>
  );
}

interface EntryScreenProps {
  initialRoom: string;
  error: string;
  onEnter: (name: string, roomCode?: string) => Promise<void>;
  onSolo: (name: string) => Promise<void>;
}

function EntryScreen({ initialRoom, error, onEnter, onSolo }: EntryScreenProps) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState(initialRoom);
  const [mode, setMode] = useState<"create" | "join">(initialRoom ? "join" : "create");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || (mode === "join" && room.length < 5)) return;
    setBusy(true);
    await onEnter(name.trim(), mode === "join" ? room.toUpperCase() : undefined);
    setBusy(false);
  }

  return (
    <main className="entry-screen">
      <div className="entry-architecture" aria-hidden="true">
        <div className="map-block block-a" />
        <div className="map-block block-b" />
        <div className="map-block block-c" />
        <div className="map-ring" />
        <div className="trace trace-one" />
        <div className="trace trace-two" />
      </div>
      <section className="entry-copy">
        <div className="entry-kicker">A SHARED RECOLLECTION</div>
        <h1>I SWEAR</h1>
        <p className="tagline">Same event. Different memories.</p>
        <p className="premise">You remember what happened. So does everyone else. The problem is that you remember different things.</p>
      </section>
      <section className="entry-panel">
        <div className="mode-switch" role="tablist" aria-label="Room action">
          <button className={mode === "create" ? "active" : ""} aria-selected={mode === "create"} onClick={() => setMode("create")} role="tab">Create room</button>
          <button className={mode === "join" ? "active" : ""} aria-selected={mode === "join"} onClick={() => setMode("join")} role="tab">Join room</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="name">Witness name</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={18} autoComplete="nickname" placeholder="How others will know you" />
          {mode === "join" && (
            <>
              <label htmlFor="room">Room code</label>
              <input id="room" className="code-input" value={room} onChange={(event) => setRoom(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase())} maxLength={5} autoCapitalize="characters" placeholder="XXXXX" />
            </>
          )}
          {error && <p className="form-error"><Warning size={17} /> {error}</p>}
          <button className="primary-action" type="submit" disabled={busy || name.trim().length < 2 || (mode === "join" && room.length < 5)}>
            {busy ? "Opening case file" : mode === "create" ? "Create room" : "Enter room"}
            {!busy && <ArrowRight size={19} weight="bold" />}
          </button>
        </form>
        <p className="entry-note"><UsersThree size={19} /> Built for 4-8 witnesses. No account required.</p>
        <button className="solo-action" disabled={busy} onClick={async () => { setBusy(true); await onSolo(name.trim().length >= 2 ? name.trim() : "The Witness"); setBusy(false); }}>Play solo demo <ArrowRight size={18} /></button>
        <p className="solo-note">Three scripted witnesses. One complete case. About three minutes.</p>
      </section>
    </main>
  );
}

interface LobbyOverlayProps {
  snapshot: RoomSnapshot;
  localPlayerId: string;
  isHost: boolean;
  allReady: boolean;
  copied: boolean;
  onCopy: () => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onQR: () => void;
}

function LobbyOverlay({ snapshot, localPlayerId, isHost, allReady, copied, onCopy, onReady, onStart, onQR }: LobbyOverlayProps) {
  const local = snapshot.players.find((player) => player.id === localPlayerId)!;
  return (
    <section className="lobby-overlay" aria-label="Witness room">
      <div className="lobby-heading">
        <span>CASE ROOM</span>
        <strong>{snapshot.room.code}</strong>
        <div className="invite-actions"><button onClick={onCopy}>{copied ? <Check /> : <LinkSimple />} {copied ? "Copied" : "Copy invite"}</button><button onClick={onQR}>Show QR</button></div>
      </div>
      <div className="witness-ledger">
        <div className="ledger-title"><UsersThree size={20} /> Witnesses <span>{snapshot.players.length}/{snapshot.room.max_players}</span></div>
        {snapshot.players.map((player, index) => (
          <div className="ledger-row" key={player.id}>
            <span className="ledger-number">{String(index + 1).padStart(2, "0")}</span>
            <i style={{ "--witness-color": `var(--avatar-${player.color_index})` } as React.CSSProperties} />
            <strong>{player.name}</strong>
            {player.id === snapshot.room.host_id && <span className="host-label">HOST</span>}
            <span className={`ready-label ${player.ready && player.connected ? "ready" : ""}`}>{!player.connected ? "RECONNECTING" : player.ready ? "READY" : "WAITING"}</span>
          </div>
        ))}
        {Array.from({ length: Math.max(0, snapshot.room.min_players - snapshot.players.length) }).map((_, index) => (
          <div className="ledger-row empty" key={`empty-${index}`}>
            <span className="ledger-number">{String(snapshot.players.length + index + 1).padStart(2, "0")}</span>
            <i />
            <strong>Awaiting witness</strong>
          </div>
        ))}
      </div>
      <div className="lobby-brief">
        <MagnifyingGlass size={25} />
        <p>Explore the facility. Compare what you remember. Reconstruct what actually happened.</p>
      </div>
      <div className="lobby-actions">
        <button className={`ready-action ${local.ready ? "marked" : ""}`} onClick={() => onReady(!local.ready)}>
          {local.ready ? <Check weight="bold" /> : <DoorOpen weight="bold" />}
          {local.ready ? "Ready" : "Mark ready"}
        </button>
        {isHost && <button className="primary-action" onClick={onStart} disabled={!allReady}>Begin investigation <ArrowRight weight="bold" /></button>}
        {!isHost && <span className="host-wait">The host begins when all witnesses are ready.</span>}
      </div>
    </section>
  );
}

function InspectionOverlay({ item, onClose }: { item: Interactable; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => document.querySelector<HTMLElement>('[role="application"]')?.focus();
  }, []);
  return (
    <div className="inspection-scrim" role="dialog" aria-modal="true" aria-labelledby="inspection-title" ref={dialog} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    }}>
      <section className="inspection-sheet">
        <button className="close-button" onClick={onClose} aria-label="Close inspection"><X size={22} /></button>
        <div className="inspection-visual">
          <img className="object-illustration" src={objectThumbnails.get(item.kind)} alt={`${item.label}, recovered object view`} />
          <span>RECOVERED FROM {item.room.toUpperCase()}</span>
        </div>
        <div className="inspection-copy">
          <span>OBJECT INSPECTION</span>
          <h2 id="inspection-title">{item.label}</h2>
          <p>{item.detail ?? "The object has been logged for closer review."}</p>
          <div className="archivist-note">{item.evidence ? `RECOVERED ${item.evidence.timestamp} / ${item.evidence.label}. A verified record has been added to the shared board.` : "ARCHIVIST NOTE: Observation logged. Evidentiary value remains unknown."}</div>
          <button onClick={onClose}>Return to facility</button>
        </div>
      </section>
    </div>
  );
}

export default App;
