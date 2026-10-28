import { lazy, Suspense, useEffect, useMemo, useCallback, useRef, useState } from "react";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { CaseLoading } from "./components/CaseLoading";
import { GameSocket } from "./network/GameSocket";
import { GameMenu, type RoomEntry } from "./components/GameMenu";
import { IndieLobby } from "./components/IndieLobby";
import { InvestigationHUD, FloorPlan, type InvestigationPanel } from "./components/InvestigationHUD";
import { ChatPanel, MemoryJournal, TestimonyBoard } from "./components/MysteryPanels";
import { EMPTY_TIMELINE, InvestigationBoard } from "./components/InvestigationBoard";
import { Results, TruthReveal } from "./components/Endgame";
import { objectThumbnails } from "./game/artworkCache";
import { audioDirector } from "./game/AudioDirector";
import { GameSettings } from "./components/GameSettings";
import { RoomVoice } from "./components/RoomVoice";
import { CaseRhythm, PrivateMotive } from "./components/Casefile";
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
  const [entering,setEntering]=useState(Boolean(session));
  const [worldReady,setWorldReady]=useState(false);
  const sceneReady=useCallback(()=>setWorldReady(true),[]);
  const finishEntry=useCallback(()=>setEntering(false),[]);
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
  const [panel, setPanel] = useState<InvestigationPanel | null>(null);
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
        if (message.room.phase === "lobby") { setWorldReady(false); setPanel(null); setInspection(null); setActiveClash(null); setArchivist(""); }
      }
      else if (message.type !== "positions") setSnapshot((current) => (current ? updateSnapshot(current, message) : current));
      if (message.type === "inspection") { setInspection(message.interactable); audioDirector.cue("inspection"); }
      if (message.type === "activity") {
        setActivity(`${message.label} was inspected nearby`);
        timers.push(window.setTimeout(() => setActivity(""), 3200));
      }
      if (message.type === "error") setError(message.message);
      if (message.type === "phase_changed") {
        if(message.phase==="exploring"){setWorldReady(false);setEntering(true);}
        if (message.phase !== "exploring") { setPanel(null); setInspection(null); setActiveClash(null); setArchivist(""); }
        setOnboarding(true);
        timers.push(window.setTimeout(() => setOnboarding(false), 7000));
      }
      if (message.type === "memories") setMemories(message.memories);
      if (message.type === "evidence") {
        const localName = next.snapshot?.players.find(player => player.id === session.player_id)?.name;
        audioDirector.cue("evidence", message.finder === localName ? 1 : .45);
        setEvidence((current) => current.some((item) => item.id === message.evidence.id) ? current : [...current, message.evidence]);
        setActivity(`${message.finder} recovered ${message.evidence.label.toLowerCase()}`);
        timers.push(window.setTimeout(() => setActivity(""), 4000));
      }
      if (message.type === "timeline") setTimeline(message.timeline);
      if (message.type === "recap") setResult((current) => current ? { ...current, archivist_line: message.text } : current);
      if (message.type === "result_saved") setResult(current => current?.replay_code === message.replay_code ? { ...current, best_score: message.best_score } : current);
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
      if (key === "g") { event.preventDefault(); setPanel(current => current === "map" ? null : "map"); }
      if (key === "q" && snapshot.case) { event.preventDefault(); setPanel(current => current === "motive" ? null : "motive"); }
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
  }, [snapshot?.room.phase, snapshot?.case, inspection, panel]);

  useEffect(() => {
    if (!error || !session) return;
    const timer = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timer);
  }, [error, session]);

  const isHost = snapshot?.room.host_id === session?.player_id;
  const inviteUrl = useMemo(() => {
    if (!session) return "";
    return `${location.origin}${location.pathname}?room=${session.room_code}`;
  }, [session]);

  async function enterRoom(name: string, roomCode?: string, solo = false, appearance?: Partial<RoomEntry>) {
    setError(""); setEntering(true); setWorldReady(false); setSnapshot(null);
    setMemories([]); setTestimonies([]); setClashes([]); setChat([]); setPanel(null);
    const endpoint = solo ? "/api/rooms/solo" : roomCode ? `/api/rooms/${roomCode}/join` : "/api/rooms";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...appearance, name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Please check the witness name and room code");
      const nextSession = body as Session;
      try { sessionStorage.setItem(`i-swear-session-${nextSession.room_code}`, JSON.stringify(nextSession)); } catch { /* Current session still works when browser storage is disabled. */ }
      history.replaceState({}, "", `?room=${nextSession.room_code}`);
      setSession(nextSession);
      return true;
    } catch (caught) {
      setEntering(false);
      setError(caught instanceof Error ? caught.message : "The Archivist could not open this room");
      return false;
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
    socket?.send({ type: "leave" });
    socket?.close();
    try { sessionStorage.removeItem(`i-swear-session-${session?.room_code}`); } catch {}
    setEntering(false); setWorldReady(false);
    history.replaceState({}, "", location.pathname);
    setSession(null);
    setSnapshot(null);
    setSocket(null);
    setError("");
  }

  const replayCode = new URLSearchParams(location.search).get("replay");
  if (!session && replayCode) return <ReplayScreen code={replayCode} />;
  if (!session) return <><GameMenu initialRoom={initialRoom} error={error} onEnter={(entry) => enterRoom(entry.name, entry.room_code, entry.solo, entry)} />{entering&&<CaseLoading stage={25} />}</>;

  if (!snapshot || !socket) {
    return (
      <CaseLoading stage={50} error={status==="offline"?"This room is no longer available.":undefined} onCancel={leaveRoom} />
    );
  }

  return (
    <main className={`game-shell ${snapshot.case ? "casefile-enabled" : ""}`}>
      {(entering || (snapshot.room.phase!=="lobby"&&!worldReady)) && <CaseLoading stage={(snapshot.room.phase==="lobby"&&!snapshot.room.solo)||worldReady?100:80} onComplete={finishEntry} onCancel={leaveRoom} />}
      {snapshot.room.phase !== "lobby" && <Suspense fallback={<div className="loading-screen">Opening the facility</div>}><GameCanvas
        onReady={sceneReady}
        socket={socket}
        snapshot={snapshot}
        localPlayerId={session.player_id}
        onPrompt={setPrompt}
        onRoomChange={setCurrentRoom}
        inputEnabled={snapshot.room.phase === "exploring" && !inspection && !panel && status === "connected" && worldReady && !entering}
      /></Suspense>}
      <div className="grain" aria-hidden="true" />
      <GameSettings worldActive={snapshot.room.phase === "exploring"} lobbyActive={snapshot.room.phase === "lobby"} onLeave={leaveRoom} />
      <RoomVoice session={session} />
      {snapshot.room.phase !== "lobby" && snapshot.room.phase !== "exploring" && <header className="game-header">
        <div className="case-mark">
          <span className="case-title">I SWEAR</span>
          <span className="case-subtitle">{snapshot.room.map?.case_title ?? "THE BLACKOUT"}</span>
        </div>
        <div className="location-readout">
          <span>YOU ARE IN</span>
          <strong>{currentRoom}</strong>
        </div>
        <div className={`connection ${status}`}>
          <Broadcast size={17} weight="bold" />
          {status === "connected" ? "Live room" : status}
        </div>
      </header>}

      {snapshot.room.phase === "lobby" && (
        <IndieLobby
          snapshot={snapshot}
          playerId={session.player_id}
          copied={copied}
          onCopy={copyInvite}
          onReady={(ready) => socket.send({ type: "ready", ready })}
          onStart={() => socket.send({ type: "start" })}
          onQR={() => setInviteOpen(true)}
          onLeave={leaveRoom}
          onChat={() => setPanel("chat")}
          onAppearance={(avatar_color, hat) => socket.send({ type: "appearance", avatar_color, hat })}
        />
      )}

      {snapshot.room.phase === "exploring" && (
        <>
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
          <InvestigationHUD snapshot={snapshot} socket={socket} playerId={session.player_id} currentRoom={currentRoom} status={status} evidence={evidence} timeline={timeline} testimonies={testimonies} onOpen={setPanel} />
          {snapshot.case && <CaseRhythm socket={socket} onMotive={() => setPanel("motive")} onBoard={() => setPanel("board")} />}
        </>
      )}

      {activity && <div className="activity-toast"><Eye size={18} /> {activity}</div>}
      {error && <div className="error-toast"><Warning size={18} /> {error}<button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}
      {inspection && <InspectionOverlay item={inspection} onClose={() => setInspection(null)} />}
      {panel === "map" && <FloorPlan snapshot={snapshot} socket={socket} playerId={session.player_id} evidence={evidence} onClose={() => setPanel(null)} />}
      {panel === "motive" && <PrivateMotive socket={socket} onClose={() => setPanel(null)} />}
      {panel === "memories" && <MemoryJournal memories={memories} testimonies={testimonies} socket={socket} playerId={session.player_id} onClose={() => setPanel(null)} />}
      {panel === "testimony" && <TestimonyBoard testimonies={testimonies} clashes={clashes} socket={socket} playerId={session.player_id} onClose={() => setPanel(null)} />}
      {panel === "chat" && <ChatPanel messages={chat} socket={socket} onClose={() => setPanel(null)} />}
      {panel === "board" && <InvestigationBoard evidence={evidence} testimonies={testimonies} timeline={timeline} socket={socket} playerId={session.player_id} caseTitle={snapshot.room.map?.case_title} onClose={() => setPanel(null)} />}
      {archivist && !dossierOpen && !activeClash && snapshot.room.phase === "exploring" && <div className="memory-clash" role="status"><strong>THE ARCHIVIST</strong><p>{archivist}</p><button onClick={() => setArchivist("")}>Keep investigating</button></div>}
      {result && snapshot.room.phase === "reveal" && <TruthReveal result={result} startedAt={revealStartedAt} />}
      {result && snapshot.room.phase === "results" && <Results result={result} isHost={isHost} onRematch={() => socket.send({ type: "rematch" })} onChallenge={() => enterRoom(snapshot.players.find((player) => player.id === session.player_id)?.name ?? "Witness")} />}
      {inviteOpen && <InviteQR url={inviteUrl} roomCode={session.room_code} onClose={() => setInviteOpen(false)} />}
      {activeClash && !dossierOpen && <div className="memory-clash" role="status"><strong>MEMORY CLASH</strong><p>{activeClash.names.join(" / ")} disagree about {activeClash.fields.join(", ")}.</p><button onClick={() => { setPanel("testimony"); setActiveClash(null); }}>Compare testimony <kbd>T</kbd></button><button className="icon-button" aria-label="Dismiss memory clash" onClick={() => setActiveClash(null)}><X size={18} /></button></div>}
      {status === "offline" && <div className="inspection-scrim"><section className="entry-panel"><h2>Connection ended</h2><p>This session may have opened elsewhere, or the room has closed.</p><button className="primary-action" onClick={leaveRoom}>Return to entry</button></section></div>}
    </main>
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
