import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Key } from "@phosphor-icons/react/dist/csr/Key";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Dossier } from "./MysteryPanels";
import { WitnessAvatar, coatColors, coatNames, type WitnessHat, type WitnessProfile } from "./WitnessAvatar";

export interface AccountProfile extends WitnessProfile { id: string; username: string; rounds: number; best_score: number }
export interface RoomEntry { name: string; room_code?: string; solo?: boolean; avatar_color: number; hat: WitnessHat; is_public?: boolean; max_players?: number }
type MenuDialog = "host" | "join" | "browse" | "wardrobe" | "register" | "login" | "how" | null;
interface Lobby { code: string; host: string; players: number; max_players: number }

function savedWitness(): WitnessProfile {
  try {
    const value = JSON.parse(localStorage.getItem("i-swear-witness") ?? "null");
    if (value && typeof value.display_name === "string" && value.display_name.length >= 2 && Number.isInteger(value.avatar_color)) return { display_name: value.display_name.slice(0,18), avatar_color: Math.max(0, Math.min(7, value.avatar_color)), hat: ["none", "beanie", "cap", "headphones"].includes(value.hat) ? value.hat : "none" };
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
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
      await onEnter({ name: profile.display_name.trim(), avatar_color: profile.avatar_color, hat: profile.hat, room_code: code, solo, is_public: isPublic, max_players: maxPlayers });
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
  const title = dialog === "host" ? "Gather your witnesses." : dialog === "join" ? "You have a room code?" : dialog === "browse" ? "Find your people." : dialog === "wardrobe" ? "Your witness. Your alibi." : dialog === "register" ? "Make it official." : dialog === "login" ? "Welcome back, witness." : "Trust your friends. Maybe.";

  return <main className="title-screen">
    <img className="campus-illustration" src="/art/campus-night.svg" alt="An inked research campus at midnight, its windows still lit after the blackout" />
    <div className="title-vignette" aria-hidden="true" />
    <header className="menu-topbar"><a className="studio-mark" href="/" aria-label="I SWear home"><span className="studio-sigil">i!</span> A game of unreliable witnesses</a><button className="account-toggle" onClick={() => open(account ? "wardrobe" : "login")}>{account ? account.display_name : "Sign in"}<ArrowRight size={17} /></button></header>
    <section className="title-content">
      <p className="title-overline">You were all there.</p>
      <h1 className="game-wordmark"><span>I</span> SWEAR<i aria-hidden="true">!</i></h1>
      <p className="title-tagline">Same event.<br /><strong>Different memories.</strong></p>
      <p className="title-premise">Someone remembers it wrong.<br />It might be you.</p>
      <div className="play-menu" aria-label="Play I SWEAR">
        <button className="play-button" onClick={() => open("host")}><UsersThree size={25} weight="bold" /><span>Host a room<small>Bring your own suspicious friends</small></span><ArrowRight size={26} /></button>
        <div className="join-menu"><button onClick={() => open("browse")}><MagnifyingGlass size={19} /> Find a room</button><button onClick={() => open("join")}><Key size={19} /> Enter a code</button></div>
        <button className="demo-button" disabled={busy} onClick={() => enter(true)}>{busy ? "Opening the case…" : "Play solo demo"}<span>3 scripted witnesses · about 3 minutes</span><ArrowRight size={22} /></button>
      </div>
      {(error || message) && !dialog && <p className="menu-error" role="alert">{error || message}</p>}
    </section>
    <button className="witness-pass" onClick={() => open("wardrobe")} aria-label="Customize your witness"><span className="pass-pin" /><WitnessAvatar color={profile.avatar_color} hat={profile.hat} /><span><small>{account ? "YOUR WITNESS" : "GUEST WITNESS"}</small><strong>{profile.display_name}</strong><em>Customize ↗</em></span></button>
    <footer className="menu-footer"><button onClick={() => open("how")}>How to play</button><span>4–8 witnesses · one very different story</span><span className="menu-case">The Blackout <b>01</b></span></footer>

    {dialog && <Dossier title={title} subtitle={dialog === "wardrobe" ? "WITNESS REGISTRATION" : dialog === "how" ? "THE RULES ARE SIMPLE" : "I SWEAR"} onClose={() => open(null)} wide={dialog === "wardrobe" || dialog === "browse"}>
      {(dialog === "host" || dialog === "join") && <form className="menu-form" onSubmit={(event) => { event.preventDefault(); void enter(false, dialog === "join" ? roomCode : undefined); }}>
        <label>Your witness name<input value={profile.display_name} maxLength={18} minLength={2} required onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>
        {dialog === "join" ? <label>Room code<input className="room-code-input" data-initial-focus value={roomCode} placeholder="ABCDE" maxLength={5} minLength={5} autoCapitalize="characters" required onChange={(event) => setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} /></label> : <><div className="room-size"><span>Seats at the table</span>{[4, 6, 8].map((value) => <button type="button" key={value} aria-pressed={maxPlayers === value} onClick={() => setMaxPlayers(value)}>{value}</button>)}</div><label className="public-room-option"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><span>List this room publicly<small>Let other witnesses find and join your lobby.</small></span></label></>}
        {(error || message) && <p className="menu-error" role="alert">{error || message}</p>}<button className="primary-action" disabled={busy || profile.display_name.trim().length < 2 || (dialog === "join" && roomCode.length !== 5)}>{busy ? "Opening the door…" : dialog === "join" ? "Join the room" : "Create the lobby"}<ArrowRight size={20} /></button><p className="form-footnote">Everyone can play as a guest. No account needed.</p>
      </form>}

      {dialog === "wardrobe" && <div className="wardrobe"><div className="wardrobe-stage"><WitnessAvatar color={profile.avatar_color} hat={profile.hat} /><span>{coatNames[profile.avatar_color]} coat</span></div><div className="wardrobe-controls"><label>What should we call you?<input value={profile.display_name} minLength={2} maxLength={18} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label><fieldset><legend>Pick your coat</legend><div className="coat-swatches">{coatColors.map((color, index) => <button key={color} aria-label={`${coatNames[index]} coat`} aria-pressed={profile.avatar_color === index} onClick={() => setProfile({ ...profile, avatar_color: index })} style={{ "--coat": color } as React.CSSProperties} />)}</div></fieldset><fieldset><legend>A little something extra</legend><div className="hat-options">{(["none", "beanie", "cap", "headphones"] as WitnessHat[]).map((hat) => <button key={hat} aria-pressed={profile.hat === hat} onClick={() => setProfile({ ...profile, hat })}>{hat === "none" ? "Just me" : hat}</button>)}</div></fieldset><button className="primary-action" disabled={busy || profile.display_name.trim().length < 2} onClick={async () => { setBusy(true); try { if (account) setAccount(await accountRequest("profile", profile)); setDialog(null); } catch (caught) { setMessage((caught as Error).message); } finally { setBusy(false); } }}>That's me <ArrowRight size={20} /></button>{message && <p className="menu-error">{message}</p>}{account ? <div className="account-stats"><p>{account.rounds} cases played · Best recovery {account.best_score}%</p><button onClick={async () => { await accountRequest("logout", {}); setAccount(null); open(null); }}>Sign out</button></div> : <button className="text-button" onClick={() => open("register")}>Create an account to keep your case record <ArrowRight size={16} /></button>}</div></div>}

      {(dialog === "login" || dialog === "register") && <form className="menu-form account-form" onSubmit={authenticate}><p>Your coat, your name, and the cases you survived.</p><label>Username<input data-initial-focus value={username} required minLength={dialog === "register" ? 3 : 1} maxLength={20} autoComplete="username" pattern={dialog === "register" ? "[A-Za-z][A-Za-z0-9_]+" : undefined} onChange={(event) => setUsername(event.target.value)} /></label>{dialog === "register" && <label>Witness name<input value={profile.display_name} required minLength={2} maxLength={18} autoComplete="nickname" onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>}<label>Password<input type="password" value={password} minLength={dialog === "register" ? 8 : 1} maxLength={128} required autoComplete={dialog === "register" ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} /></label>{dialog === "register" && <small>At least 8 characters. Keep your username and password somewhere safe.</small>}{message && <p className="menu-error" role="alert">{message}</p>}<button className="primary-action" disabled={busy}>{busy ? "One moment…" : dialog === "register" ? "Create my account" : "Sign in"}<ArrowRight size={20} /></button><button className="text-button" type="button" onClick={() => open(dialog === "register" ? "login" : "register")}>{dialog === "register" ? "Already a witness? Sign in" : "New here? Create an account"}</button></form>}

      {dialog === "browse" && <div className="lobby-browser"><p>Open cases looking for a few more unreliable memories.</p>{loadingRooms && !rooms.length ? <div className="room-skeleton" aria-label="Finding rooms" /> : rooms.length ? rooms.map((room) => <button className="public-lobby" disabled={busy || room.players >= room.max_players} key={room.code} onClick={() => enter(false, room.code)}><span><strong>{room.host}'s table</strong><small>The Blackout · {room.code}</small></span><b>{room.players}/{room.max_players}</b><ArrowRight size={21} /></button>) : <div className="no-lobbies"><img src="/art/dossier-objects.svg" alt="A case, camera, and witness badge waiting to be investigated" /><h3>The room is a little too quiet.</h3><p>Start a case and invite someone to disagree with you.</p><button className="primary-action" onClick={() => open("host")}>Host the first room <ArrowRight size={19} /></button></div>}{message && <p className="menu-error">{message}</p>}</div>}

      {dialog === "how" && <div className="how-to-play"><img src="/art/dossier-objects.svg" alt="Evidence from the night of the blackout" /><ol><li><b>Remember.</b><p>Read your private memories. A clear recollection can still be wrong.</p></li><li><b>Compare.</b><p>Explore the facility, recover records, and challenge what your friends remember.</p></li><li><b>Reconstruct.</b><p>Put six moments in order. Lock your theory together, then face what really happened.</p></li></ol><p className="how-controls"><kbd>WASD</kbd> move <kbd>E</kbd> inspect <kbd>M</kbd> memories <kbd>T</kbd> testimony <kbd>Tab</kbd> timeline</p><button className="text-button" onClick={() => open(null)}><ArrowLeft size={18} /> I think I remember the rules</button></div>}
    </Dossier>}
  </main>;
}
