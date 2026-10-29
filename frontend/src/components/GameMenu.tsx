import { CaseObjective } from "./CaseObjective";
import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Key } from "@phosphor-icons/react/dist/csr/Key";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Dossier } from "./MysteryPanels";
import { MAPS } from "../game/maps";
import { GameSettings } from "./GameSettings";
import type { MapInfo } from "../types/protocol";
import { WitnessAvatar, witnessHats, coatColors, coatNames, type WitnessHat, type WitnessProfile } from "./WitnessAvatar";

export interface AccountProfile extends WitnessProfile { id: string; username: string; rounds: number; best_score: number }
export interface RoomEntry { map_id: MapInfo["id"]; name: string; room_code?: string; solo?: boolean; tutorial?: boolean; horror?:boolean; paced_solo?:boolean; avatar_color: number; hat: WitnessHat; is_public?: boolean; max_players?: number }
type MenuDialog = "tutorial" | "solo" | "host" | "join" | "browse" | "wardrobe" | "register" | "login" | "how" | "cases" | null;
interface Lobby { map_id?: MapInfo["id"]; code: string; host: string; players: number; max_players: number }

function savedWitness(): WitnessProfile {
  try {
    const value = JSON.parse(localStorage.getItem("i-swear-witness") ?? "null");
    if (value && typeof value.display_name === "string" && value.display_name.length >= 2 && Number.isInteger(value.avatar_color)) return { display_name: value.display_name.slice(0,18), avatar_color: Math.max(0, Math.min(11, value.avatar_color)), hat: witnessHats.includes(value.hat) ? value.hat : "none" };
  } catch { /* Guest play is available without storage. */ }
  return { display_name: `Witness ${Math.random().toString(36).slice(2, 5).toUpperCase()}`, avatar_color: 0, hat: "none" };
}

async function accountRequest(path: string, body?: object) {
  const response = await fetch(`/api/auth/${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Check your details and try again.");
  return result;
}

export function GameMenu({ initialRoom, error, onEnter }: { initialRoom: string; error: string; onEnter: (entry: RoomEntry) => Promise<boolean> }) {
  const [profile, setProfile] = useState<WitnessProfile>(savedWitness);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [dialog, setDialog] = useState<MenuDialog>(initialRoom ? "join" : null);
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nightmare,setNightmare]=useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [returnToSolo, setReturnToSolo] = useState(false);
  const [mapId, setMapId] = useState<MapInfo["id"]>("campus");
  const selectedMap = MAPS.find(map => map.id === mapId)!;
  const [rooms, setRooms] = useState<Lobby[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/auth/me", { signal: abort.signal }).then((response) => response.json()).then((value) => {
      if (value.account) { setAccount(value.account); setProfile(value.account); }
    }).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => { try { localStorage.setItem("i-swear-witness", JSON.stringify(profile)); } catch {} }, [profile]);
  useEffect(() => {
    if (dialog !== "browse") return;
    const abort = new AbortController();
    async function refresh() {
      setLoadingRooms(true);
      try {
        const response = await fetch("/api/lobbies", { signal: abort.signal });
        if (!response.ok) throw new Error("The lobby list couldn't be reached.");
        setRooms((await response.json()).rooms);
      } catch (caught) { if (!abort.signal.aborted) setMessage((caught as Error).message); }
      finally { if (!abort.signal.aborted) setLoadingRooms(false); }
    }
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => { abort.abort(); window.clearInterval(timer); };
  }, [dialog]);

  function open(next: MenuDialog) { setMessage(""); setPassword(""); setDialog(next); }
  async function enter(solo = false, code?: string) {
    setBusy(true); setMessage("");
    try {
      if (account) {
        const saved = await accountRequest("profile", profile);
        setAccount(saved);
      }
      await onEnter({ map_id: dialog === "tutorial" ? "campus" : mapId, name: profile.display_name.trim(), avatar_color: profile.avatar_color, hat: profile.hat, room_code: code, solo, tutorial: dialog === "tutorial", horror:dialog!=="tutorial"&&nightmare, paced_solo:solo&&dialog!=="tutorial", is_public: isPublic, max_players: maxPlayers });
    } catch (caught) { setMessage((caught as Error).message); }
    finally { setBusy(false); }
  }
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const value = await accountRequest(dialog === "register" ? "register" : "login", { username, password, ...profile });
      setAccount(value); setProfile(value); setPassword(""); setDialog(null);
    } catch (caught) { setMessage((caught as Error).message); }
    finally { setBusy(false); }
  }
  const title = dialog === "tutorial" ? "Your first night on the case." : dialog === "solo" ? "Rehearse your testimony." : dialog === "cases" ? "Choose a night to remember." : dialog === "host" ? "Gather your witnesses." : dialog === "join" ? "You have a room code?" : dialog === "browse" ? "Find your people." : dialog === "wardrobe" ? "Your witness. Your alibi." : dialog === "register" ? "Make it official." : dialog === "login" ? "Welcome back, witness." : "Your job: rebuild what happened.";

  return <main className="title-screen">
    <img className="campus-illustration" src="/art/campus-night.svg" alt="An inked research campus at midnight, its windows still lit after the blackout" />
    <div className="title-vignette" aria-hidden="true" />
    <header className="menu-topbar"><a className="studio-mark" href="/" aria-label="I SWear home"><span className="studio-sigil">i!</span> A game of unreliable witnesses</a><div className="menu-account-actions"><GameSettings worldActive={false} lobbyActive menu /><button className="account-toggle" onClick={() => open(account ? "wardrobe" : "login")}>{account ? account.display_name : "Sign in"}<ArrowRight size={17} /></button></div></header>
    <section className="title-content">
      <p className="title-overline">You were all there.</p>
      <h1 className="game-wordmark"><span>I</span> SWEAR<i aria-hidden="true">!</i></h1>
      <p className="title-tagline">Same event.<br /><strong>Different memories.</strong></p>
      <p className="title-premise">Work out who moved what,<br />where it went, and when.</p>
      <div className="play-menu" aria-label="Play I SWEAR">
        <button className="play-button" onClick={() => open("host")}><UsersThree size={25} weight="bold" /><span>Host a room<small>Bring your own suspicious friends</small></span><ArrowRight size={26} /></button>
        <div className="join-menu"><button onClick={() => open("browse")}><MagnifyingGlass size={19} /> Find a room</button><button onClick={() => open("join")}><Key size={19} /> Enter a code</button></div>
        <button className="learn-button" onClick={() => open("tutorial")}><span>New here? Learn to investigate<small>A guided case · no time limit</small></span><ArrowRight size={19} /></button>
        <button className="demo-button" disabled={busy} onClick={() => open("solo")}>{busy ? "Opening the case…" : "Play solo"}<span>Your pace · one clue at a time</span><ArrowRight size={22} /></button>
      </div>
      {(error || message) && !dialog && <p className="menu-error" role="alert">{error || message}</p>}
    </section>
    <button className="witness-pass" onClick={() => open("wardrobe")} aria-label="Customize your witness"><span className="pass-pin" /><WitnessAvatar color={profile.avatar_color} hat={profile.hat} /><span><small>{account ? "YOUR WITNESS" : "GUEST WITNESS"}</small><strong>{profile.display_name}</strong><em>Customize ↗</em></span></button>
    <footer className="menu-footer"><button onClick={() => open("how")}>How to play</button><span>4–8 witnesses · one very different story</span><button className="menu-case" onClick={() => open("cases")} aria-label="Choose incident map"><span><small>TONIGHT’S CASE</small>{selectedMap.case_title}</span><b>{selectedMap.number}</b><ArrowRight size={17} /></button></footer>

    {dialog && <Dossier title={title} subtitle={dialog === "wardrobe" ? "WITNESS REGISTRATION" : dialog === "how" ? "YOUR OBJECTIVE" : "I SWEAR"} onClose={() => open(null)} wide={dialog === "wardrobe" || dialog === "browse"}>
      {(dialog === "tutorial" || dialog === "solo" || dialog === "host" || dialog === "join") && <form className="menu-form" onSubmit={(event) => { event.preventDefault(); void enter(dialog === "solo" || dialog === "tutorial", dialog === "join" ? roomCode : undefined); }}>
        {(dialog === "host" || dialog === "solo") && <div className="host-map-picker" aria-label="Incident map">{MAPS.map(map => <button type="button" key={map.id} aria-pressed={mapId === map.id} onClick={() => setMapId(map.id)}><img src={map.art} alt="" /><span>{map.case_title}<small>{map.name}</small></span></button>)}</div>}<label>Your witness name<input value={profile.display_name} maxLength={18} minLength={2} required onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>
        {dialog === "join" ? <label>Room code<input className="room-code-input" data-initial-focus value={roomCode} placeholder="ABCDE" maxLength={5} minLength={5} autoCapitalize="characters" required onChange={(event) => setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} /></label> : dialog === "tutorial" ? <div className="solo-brief"><p>Solve one small disagreement at Orpheus Campus. Find a doorway log, challenge the wrong recollection, then combine it with a camera record.</p><p>Your practice question: which room did the container enter? Seven short steps teach you to answer it using records. No countdown, account or microphone required. You can fold the guide or leave at any time. Training is calm; full cases offer Nightmare mode.</p></div> : dialog === "solo" ? <div className="solo-brief"><p>Find one clue. Read it. Ask a witness to find the next. Nothing advances while you read.</p><p>{selectedMap.subtitle}</p><button type="button" className="text-button" onClick={() => { setReturnToSolo(true); open("wardrobe"); }}>Customize your witness ↗</button><small>WASD moves · E inspects. Witnesses search only when you ask.</small></div> : <><div className="room-size"><span>Seats at the table</span>{[4, 6, 8].map((value) => <button type="button" key={value} aria-pressed={maxPlayers === value} onClick={() => setMaxPlayers(value)}>{value}</button>)}</div><label className="public-room-option"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><span>List this room publicly<small>Let other witnesses find and join your lobby.</small></span></label></>}
        {(dialog==="host"||dialog==="solo")&&<label className="nightmare-choice"><input type="checkbox" checked={nightmare} onChange={event=>setNightmare(event.target.checked)}/><span><strong>Nightmare mode</strong><small>Strong jump scares and creature devouring. Confirm a claim against recovered evidence and The Unsaid hunts. Turn off for a calm mystery.</small></span></label>}
        {(error || message) && <p className="menu-error" role="alert">{error || message}</p>}<button className="primary-action" disabled={busy || profile.display_name.trim().length < 2 || (dialog === "join" && roomCode.length !== 5)}>{busy ? "Opening the door…" : dialog === "join" ? "Join the room" : dialog === "tutorial" ? "Start guided tutorial" : dialog === "solo" ? "Begin rehearsal" : "Create the lobby"}<ArrowRight size={20} /></button><p className="form-footnote">Everyone can play as a guest. No account needed.</p>
      </form>}

      {dialog === "cases" && <div className="case-selection">{MAPS.map(map => <button className={map.id === mapId ? "chosen" : ""} key={map.id} onClick={() => { setMapId(map.id); open(null); }}><img src={map.art} alt={map.name} /><span className="case-selection-copy"><small>CASE {map.number} / {map.rooms} ROOMS</small><strong>{map.case_title}</strong><b>{map.name}</b><span>{map.subtitle}</span><em>{map.id === mapId ? "Selected for your next game" : "Open this case"}</em></span></button>)}</div>}
      {dialog === "wardrobe" && <div className="wardrobe"><div className="wardrobe-stage"><WitnessAvatar color={profile.avatar_color} hat={profile.hat} /><span>{coatNames[profile.avatar_color]} coat</span></div><div className="wardrobe-controls"><label>What should we call you?<input value={profile.display_name} minLength={2} maxLength={18} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label><fieldset><legend>Pick your coat</legend><div className="coat-swatches">{coatColors.map((color, index) => <button key={color} aria-label={`${coatNames[index]} coat`} aria-pressed={profile.avatar_color === index} onClick={() => setProfile({ ...profile, avatar_color: index })} style={{ "--coat": color } as React.CSSProperties} />)}</div></fieldset><fieldset><legend>A little something extra</legend><div className="hat-options">{witnessHats.map((hat) => <button key={hat} aria-pressed={profile.hat === hat} onClick={() => setProfile({ ...profile, hat })}>{hat === "none" ? "Just me" : hat}</button>)}</div></fieldset><button className="primary-action" disabled={busy || profile.display_name.trim().length < 2} onClick={async () => { setBusy(true); try { if (account) setAccount(await accountRequest("profile", profile)); setDialog(returnToSolo ? "solo" : null); setReturnToSolo(false); } catch (caught) { setMessage((caught as Error).message); } finally { setBusy(false); } }}>That's me <ArrowRight size={20} /></button>{message && <p className="menu-error">{message}</p>}{account ? <div className="account-stats"><p>{account.rounds} cases played · Best recovery {account.best_score}%</p><button onClick={async () => { await accountRequest("logout", {}); setAccount(null); open(null); }}>Sign out</button></div> : <button className="text-button" onClick={() => open("register")}>Create an account to keep your case record <ArrowRight size={16} /></button>}</div></div>}

      {(dialog === "login" || dialog === "register") && <form className="menu-form account-form" onSubmit={authenticate}><p>Your coat, your name, and the cases you survived.</p><label>Username<input data-initial-focus value={username} required minLength={dialog === "register" ? 3 : 1} maxLength={20} autoComplete="username" pattern={dialog === "register" ? "[A-Za-z][A-Za-z0-9_]+" : undefined} onChange={(event) => setUsername(event.target.value)} /></label>{dialog === "register" && <label>Witness name<input value={profile.display_name} required minLength={2} maxLength={18} autoComplete="nickname" onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>}<label>Password<input type="password" value={password} minLength={dialog === "register" ? 8 : 1} maxLength={128} required autoComplete={dialog === "register" ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} /></label>{dialog === "register" && <small>At least 8 characters. Keep your username and password somewhere safe.</small>}{message && <p className="menu-error" role="alert">{message}</p>}<button className="primary-action" disabled={busy}>{busy ? "One moment…" : dialog === "register" ? "Create my account" : "Sign in"}<ArrowRight size={20} /></button><button className="text-button" type="button" onClick={() => open(dialog === "register" ? "login" : "register")}>{dialog === "register" ? "Already a witness? Sign in" : "New here? Create an account"}</button></form>}

      {dialog === "browse" && <div className="lobby-browser"><p>Open cases looking for a few more unreliable memories.</p>{loadingRooms && !rooms.length ? <div className="room-skeleton" aria-label="Finding rooms" /> : rooms.length ? rooms.map((room) => <button className="public-lobby" disabled={busy || room.players >= room.max_players} key={room.code} onClick={() => enter(false, room.code)}><span><strong>{room.host}'s table</strong><small>{MAPS.find(map => map.id === room.map_id)?.case_title ?? "The Blackout"} / {room.code}</small></span><b>{room.players}/{room.max_players}</b><ArrowRight size={21} /></button>) : <div className="no-lobbies"><img src="/art/dossier-objects.svg" alt="A case, camera, and witness badge waiting to be investigated" /><h3>The room is a little too quiet.</h3><p>Start a case and invite someone to disagree with you.</p><button className="primary-action" onClick={() => open("host")}>Host the first room <ArrowRight size={19} /></button></div>}{message && <p className="menu-error">{message}</p>}</div>}

      {dialog === "how" && <div className="how-to-play"><CaseObjective mapId={mapId}/><p className="how-controls"><kbd>WASD</kbd> move <kbd>E</kbd> inspect <kbd>M</kbd> memories <kbd>T</kbd> testimony <kbd>Q</kbd> private motive <kbd>Tab</kbd> timeline</p><button className="text-button" onClick={() => open(null)}><ArrowLeft size={18} /> Back to the menu</button></div>}
    </Dossier>}
  </main>;
}
