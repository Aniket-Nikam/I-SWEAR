import { useEffect, useState } from "react";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { Scales } from "@phosphor-icons/react/dist/csr/Scales";
import { ListChecks } from "@phosphor-icons/react/dist/csr/ListChecks";
import { WitnessAvatar } from "./WitnessAvatar";
import { Dossier } from "./MysteryPanels";
import { MAPS } from "../game/maps";
import { DangerNote } from "./Horror";
import { useCaseState } from "./Casefile";
import type { GameSocket } from "../network/GameSocket";
import type { RoomSnapshot, RecoveredEvidence, TimelineState, Testimony, HorrorState } from "../types/protocol";

export type InvestigationPanel = "memories" | "testimony" | "chat" | "board" | "map" | "motive";

function PlanDrawing({ snapshot, socket, playerId, evidence, compact = false }: { snapshot: RoomSnapshot; socket: GameSocket; playerId: string; evidence: RecoveredEvidence[]; compact?: boolean }) {
  const [position, setPosition] = useState(() => snapshot.players.find(p => p.id === playerId)!);
  useEffect(() => { const timer = window.setInterval(() => { const player = socket.snapshot?.players.find(p => p.id === playerId); if (player) setPosition(player); }, 250); return () => window.clearInterval(timer); }, [socket, playerId]);
  const { width, height, rooms, walls } = snapshot.world;
  const recovered = new Set(evidence.map(item => item.object_id));
  return <svg className={compact ? "mini-plan" : "floor-plan"} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${snapshot.room.map?.name ?? "Orpheus Campus"} floor plan; your position only`}>
    <rect width={width} height={height} fill="#213e46" rx="24" />
    {rooms.map((room,index) => { const current = position.x >= room.x && position.x <= room.x + room.w && position.y >= room.y && position.y <= room.y + room.h; return <g key={room.name}><rect x={room.x} y={room.y} width={room.w} height={room.h} fill={current ? "#b2ceba" : index % 2 ? "#405963" : "#354f58"} stroke="#9ab5a8" strokeWidth={compact ? 4 : 3} /><title>{room.name}</title>{!compact && <text x={room.x+room.w/2} y={room.y+room.h/2} textAnchor="middle" fill={current ? "#132c36" : "#e8dfc5"} fontSize={Math.min(62,room.w/(room.name.length*.53))} fontFamily="Barlow Condensed" fontWeight="700">{room.name}</text>}</g>; })}
    {walls.map(([x,y,w,h],index) => <rect key={index} x={x-w/2} y={y-h/2} width={w} height={h} fill="#101d27" />)}
    {!compact && snapshot.interactables.map(item => <g key={item.id}><circle cx={item.x} cy={item.y-45} r="13" fill={recovered.has(item.id) ? "#b2ceba" : "#ecc574"} stroke="#101d27" strokeWidth="4" /><title>{item.label}{recovered.has(item.id) ? " — record recovered" : " — inspect nearby"}</title></g>)}
    <circle cx={position.x} cy={position.y} r={compact ? 35 : 24} fill="#ef805f" stroke="#f2e4c8" strokeWidth={compact ? 12 : 8} />
  </svg>;
}

export function FloorPlan({ snapshot, socket, playerId, evidence, onClose }: { snapshot: RoomSnapshot; socket: GameSocket; playerId: string; evidence: RecoveredEvidence[]; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const recovered = new Set(evidence.map(item => item.object_id));
  return <Dossier title={snapshot.room.map?.name ?? "Orpheus Campus"} subtitle="FIELD GUIDE / FLOOR PLAN" onClose={onClose} wide><div className="plan-layout"><div className="plan-paper"><div className="plan-zoom" aria-label="Floor plan zoom">{[1,2,3].map(value => <button key={value} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value}x</button>)}<small>Zoom, then scroll to explore.</small></div><div className="plan-viewport"><div style={{ width: `${zoom*100}%`, height: `${zoom*50}dvh` }}><PlanDrawing {...{snapshot,socket,playerId,evidence}} /></div></div></div><aside><span className="eyebrow">KNOW YOUR WAY OUT</span><h3>Every room has a story.</h3><p>Walk up to a marked object and inspect it. Your badge opens different records from your friends' badges.</p><ul className="plan-legend"><li><i className="legend-you" /> Your position</li><li><i className="legend-object" /> Inspectable object</li><li><i className="legend-record" /> Record recovered</li></ul>{snapshot.case && <div className="source-guide" aria-label="Record access guide">{snapshot.interactables.filter(item => item.clearance !== undefined).map(item => <div key={item.id}><strong>{item.label}</strong><span>Badge {(item.clearance ?? 0) + 1} / {recovered.has(item.id) ? "recovered" : item.backup ? "backup lead" : "initial search"}</span><small>{snapshot.players.filter(player => player.color_index % 4 === item.clearance).map(player => player.name.replace(" (scripted)", "")).join(", ")}</small></div>)}</div>}<p className="plan-privacy">Other witnesses appear nearby in the world. Their private memories stay private until shared.</p><button className="primary-action" onClick={onClose}>Back to investigating</button></aside></div></Dossier>;
}

export function InvestigationHUD({ snapshot, socket, playerId, currentRoom, status, evidence, timeline, testimonies, onOpen, horror, lessonStage=7 }: { snapshot: RoomSnapshot; socket: GameSocket; playerId: string; currentRoom: string; status: string; evidence: RecoveredEvidence[]; timeline: TimelineState; testimonies: Testimony[]; onOpen: (panel: InvestigationPanel) => void; lessonStage?:number;horror?:HorrorState|null }) {
  const [crewOpen, setCrewOpen] = useState(false);
  const map = snapshot.room.map ?? MAPS[0], tutorial=!!snapshot.room.tutorial;
  const local = snapshot.players.find(player => player.id === playerId)!;
  const caseState=useCaseState(socket);
  const filled = timeline.slots.filter(Boolean).length;
  const statements = testimonies.filter(item => !item.retracted).length;
  const ownRecord=snapshot.interactables.find(item=>item.clearance===local.color_index%4&&!item.backup&&!evidence.some(record=>record.object_id===item.id));
  const hasResponse=testimonies.some(item=>item.player_id!==playerId&&item.responses[playerId]);
  const next=!evidence.length?`Find ${ownRecord?.label??"a record"}${ownRecord?` in ${ownRecord.room}`:""}.`:!hasResponse?"Compare a witness's memory with a record.":filled<3?"Propose your first three moments.":caseState?.stage==="first_theory"&&!caseState.first_theory?"Record your first theory on the board.":filled<6?"Find the remaining moments. Check the board.":"Link complementary records, then review together.";
  return <>
    <header className="field-header"><div className="field-brand"><b>I SWEAR<span>!</span></b><div><small>CASE {map.number}</small><strong>{map.case_title}</strong></div></div><div className="field-location"><span>{map.name}</span><strong>{currentRoom}</strong></div><div className={`field-connection ${status}`}><i />{status === "connected" ? tutorial?"Training · no time limit":snapshot.room.solo ? snapshot.room.horror?"Nightmare · solo":"Solo case" : `${snapshot.room.horror?"Nightmare · ":"Room "}${snapshot.room.code}` : status}</div></header>
    <DangerNote state={horror??null} targetName={horror?.target_id===playerId?"you":snapshot.players.find(player=>player.id===horror?.target_id)?.name.replace(" (scripted)","")} onReview={()=>onOpen("board")}/>
    {!tutorial&&!horror?.phase.match(/warning|hunting/)&&<aside className="next-question"><small>FOLLOW THE RECORD</small><button onClick={()=>onOpen(!evidence.length?"map":!hasResponse?"testimony":"board")}>{next} <span>↗</span></button></aside>}
    <button className="field-kit-toggle" onClick={()=>setCrewOpen(!crewOpen)} aria-expanded={crewOpen}>Field notes {crewOpen?"−":"+"}</button>
    {crewOpen&&<aside className="field-kit-sheet"><h3>Your field notes</h3><p>Badge {local.color_index%4+1} · {evidence.length} records · {filled}/6 moments placed</p><div className="kit-shortcuts">{([['map','Floor plan · G'],['memories','Private memories · M'],['motive','Your motive · Q'],['chat','Radio · Enter']] as const).map(([key,label])=><button key={key} onClick={()=>{setCrewOpen(false);onOpen(key);}}>{label} ↗</button>)}</div><details><summary>{snapshot.players.length} witnesses</summary>{snapshot.players.map(player=><div className="kit-witness" key={player.id}><WitnessAvatar color={player.avatar_color??player.color_index} hat={player.hat}/><span>{player.name.replace(" (scripted)","")}<small>Badge {player.color_index%4+1}{player.is_bot?" · scripted":""}{!player.connected?" · reconnecting":""}</small></span></div>)}</details></aside>}
    {(!tutorial||lessonStage>=3)&&<nav className="field-tools" aria-label="Investigation tools"><button onClick={()=>onOpen("memories")}><BookOpen size={24}/><span><b>Memories</b><small>Your recollections</small></span><kbd>M</kbd></button><button onClick={()=>onOpen("testimony")}><Scales size={24}/><span><b>Testimony {statements>0&&<em>{statements}</em>}</b><small>Compare with records</small></span><kbd>T</kbd></button>{(!tutorial||lessonStage>=5)&&<button className="board-tool" onClick={()=>onOpen("board")}><ListChecks size={24}/><span><b>Reconstruction</b><small>{tutorial?"One practice moment":`${filled}/6 moments placed`}</small></span><kbd>Tab</kbd></button>}</nav>}
  </>;
}
