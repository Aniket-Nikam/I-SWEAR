import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import { Dossier } from "./MysteryPanels";
import { WitnessAvatar, coatColors, coatNames, type WitnessHat } from "./WitnessAvatar";
import type { RoomSnapshot } from "../types/protocol";

interface Props {
  snapshot: RoomSnapshot; playerId: string; copied: boolean; onCopy: () => void; onQR: () => void;
  onReady: (ready: boolean) => void; onStart: () => void; onLeave: () => void; onChat: () => void;
  onAppearance: (color: number, hat: WitnessHat) => void;
}

export function IndieLobby({ snapshot, playerId, copied, onCopy, onQR, onReady, onStart, onLeave, onChat, onAppearance }: Props) {
  const local = snapshot.players.find((player) => player.id === playerId)!;
  const isHost = snapshot.room.host_id === playerId;
  const allReady = snapshot.players.length >= snapshot.room.min_players && snapshot.players.every((player) => player.ready && player.connected);
  const readyCount = snapshot.players.filter((player) => player.connected && player.ready).length;
  const [customize, setCustomize] = useState(false);
  const [color, setColor] = useState(local.avatar_color ?? local.color_index);
  const [hat, setHat] = useState<WitnessHat>((local.hat ?? "none") as WitnessHat);
  const emptyCount = Math.max(0, snapshot.room.max_players - snapshot.players.length);
  return <section className="indie-lobby" aria-label="Witness room">
    <img className="lobby-campus" src="/art/campus-night.svg" alt="" />
    <header className="lobby-topbar"><button className="text-button" onClick={onLeave}><ArrowLeft size={19} /> Leave room</button><strong className="lobby-logo">I SWEAR<span>!</span></strong><button onClick={onChat}><Broadcast size={18} /> Room radio</button></header>
    <div className="lobby-layout">
      <aside className="case-poster"><span className="case-tab">TONIGHT'S INCIDENT</span><h1>The<br /><em>Blackout.</em></h1><div className="poster-object"><img src="/art/dossier-objects.svg" alt="The case, a missing badge, and a disconnected camera" /></div><p>Six moments. One missing piece.<br />And nobody remembers it the same.</p><div className="case-difficulty"><span>4–8 witnesses</span><span>Explore · remember · disagree</span></div><div className="lobby-invite"><span>{snapshot.room.is_public ? "PUBLIC ROOM" : "INVITE YOUR FRIENDS"}</span><button className="room-ticket" onClick={onCopy} aria-label={`Copy room code ${snapshot.room.code}`}><strong>{snapshot.room.code}</strong>{copied ? <Check size={22} /> : <Copy size={22} />}</button><button className="text-button" onClick={onQR}>Show QR invitation <ArrowRight size={15} /></button></div></aside>
      <div className="witness-waiting-room"><div className="waiting-title"><div><p>THE WITNESS ROOM</p><h2>Everybody has a version.</h2></div><span>{snapshot.players.length}<small>/{snapshot.room.max_players}</small></span></div><div className="witness-stage">
        {snapshot.players.map((player) => <article className={`lobby-witness ${player.ready && player.connected ? "is-ready" : ""} ${player.id === playerId ? "is-you" : ""} ${!player.connected ? "is-offline" : ""}`} key={player.id}>
          {player.id === snapshot.room.host_id && <span className="host-ribbon">HOST</span>}<WitnessAvatar color={player.avatar_color ?? player.color_index} hat={player.hat} /><strong>{player.name.replace(" (scripted)", "")}</strong><span className="witness-role">{player.id === playerId ? "That's you" : player.is_bot ? "Scripted witness" : "Fellow witness"}</span><span className="lobby-ready-state">{!player.connected ? "Reconnecting…" : player.ready ? <><Check size={13} weight="bold" /> Ready</> : "Choosing an alibi…"}</span>{player.id === playerId && <button onClick={() => setCustomize(true)}>Change outfit</button>}
        </article>)}
        {Array.from({ length: emptyCount }).map((_, index) => <div className="empty-witness" key={index}><div className="empty-coat" /><span>Waiting for a witness</span></div>)}
      </div><footer className="lobby-launch"><div className="lobby-ready-copy"><b>{readyCount} of {snapshot.players.length} ready</b><span>{snapshot.players.length < 4 ? `Bring ${4 - snapshot.players.length} more ${4 - snapshot.players.length === 1 ? "witness" : "witnesses"} to open the case.` : allReady ? "Everyone is here. Time to compare stories." : "Take a seat, choose an outfit, and mark ready."}</span></div><div className="lobby-launch-actions"><button className={`lobby-ready-button ${local.ready ? "selected" : ""}`} onClick={() => onReady(!local.ready)}>{local.ready ? <><Check size={18} /> I'm ready</> : "Mark ready"}</button>{isHost && <button className="primary-action" disabled={!allReady} onClick={onStart}>Open the case <ArrowRight size={20} /></button>}</div>{!isHost && <small className="waiting-on-host">The host opens the case when everyone is ready.</small>}</footer></div>
    </div>
    {customize && <Dossier title="Look suspicious. Be yourself." subtitle="YOUR WITNESS" onClose={() => setCustomize(false)}><div className="lobby-wardrobe"><WitnessAvatar color={color} hat={hat} /><div className="coat-swatches">{coatColors.map((value, index) => <button key={value} style={{ "--coat": value } as React.CSSProperties} aria-label={`${coatNames[index]} coat`} aria-pressed={color === index} onClick={() => setColor(index)} />)}</div><div className="hat-options">{(["none", "beanie", "cap", "headphones"] as WitnessHat[]).map((value) => <button key={value} aria-pressed={hat === value} onClick={() => setHat(value)}>{value === "none" ? "Just me" : value}</button>)}</div><button className="primary-action" onClick={() => { onAppearance(color, hat); setCustomize(false); }}>That's my alibi <Check size={18} /></button></div></Dossier>}
  </section>;
}
