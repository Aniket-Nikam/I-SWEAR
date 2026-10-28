export type RoomPhase = "lobby" | "exploring" | "reveal" | "results";
export interface MapInfo { id: "campus" | "observatory" | "ferry"; name: string; case_title: string; subtitle: string; theme: string; art: string; number: string; rooms?: number }
export interface GameResult {
  case_review?: { first_recovery: number; first_recorded: boolean; changed_positions: number; deadline_used: boolean;
    motives: (CaseRole & { player_id: string; name: string })[] } | null;
  reality_recovered: number; timeline_accuracy: number; facts_recovered: number;
  replay_code: string; archetype: string; description: string; recap: string;
  best_score?: number; archivist_line?: string;
  map?: MapInfo;
  evidence_found: number; theory_changes: number; consensus_mistakes: number;
  players: { player_id: string; name: string; memory_accuracy: number; score: number; avatar_color?: number; hat?: string;
    successful_challenges: number; failed_challenges: number; confidence_accuracy: number | null;
    false_memories_spread: number; truthful_memories_rejected: number; evidence_found: number }[];
  awards: { title: string; name: string; player_id: string; metric: string; value: number }[];
  comparisons: { event: { id: string; time: string; actor: string; location: string; action: string; object: string; cause: string; order: number };
    actual: string; believed: string; correct: boolean }[];
  corrupted_memories: { name: string; text: string; state: string; corruption: string | null; event_id?: string; explanation?: string }[];
  belief_spread: { text: string; witness: string; believers: string[] }[];
}

export interface MemoryFragment {
  id: string;
  event_id: string;
  claim: Record<string, string | number>;
  category: string;
  confidence: string;
  sensory: string;
  text: string;
}

export type Belief = "BELIEVE" | "DOUBT" | "CONTRADICTS_ME";
export type Stake = 10 | 25 | 50;
export interface Testimony {
  id: string;
  player_id: string;
  name: string;
  memory: MemoryFragment;
  stake: Stake;
  responses: Record<string, { response: Belief; stake: Stake }>;
  retracted: boolean;
}
export interface MemoryClash {
  id: string;
  testimony_ids: string[];
  fields: string[];
  names: string[];
}
export interface ChatMessage { id: string; player_id: string; name: string; text: string }
export interface RecoveredEvidence {
  id: string; object_id: string; event_id: string; label: string;
  claim: Record<string, string | number>; text: string; timestamp: string;
  partial?: boolean; recorded_fields?: string[];
}
export interface TimelineEntry {
  source_id: string; event_id: string; kind: "evidence" | "testimony" | "deduction";
  source_ids?: string[]; verified_fields?: string[]; conflicts?: string[];
  sources?: { id: string; label: string; kind: "evidence" | "testimony" }[];
  claim: Record<string, string | number>; text: string; label: string;
  status: "CONFIRMED" | "DISPUTED" | "UNKNOWN";
}
export interface TimelineState {
  slots: (TimelineEntry | null)[]; revision: number; votes: string[];
  required_votes: number; theory_changes: number;
}

export interface CaseRole {
  id: string; title: string; secret: string; objective: string; goal: string;
  revealed: boolean; progress: number; required: number; complete: boolean;
}
export interface CaseState {
  version: number; elapsed: number; remaining: number; duration: number;
  stage: "search" | "first_theory" | "new_lead" | "final_call";
  title: string; stage_remaining: number; lead_available: boolean; lock_available: boolean;
  theory_votes: string[];
  first_theory: { filled: number; recorded_at: number; method: string } | null;
  revealed_motives: { player_id: string; name: string; title: string; secret: string }[];
}

export interface PlayerState {
  id: string;
  name: string;
  color_index: number;
  avatar_color?: number;
  hat?: string;
  x: number;
  y: number;
  ready: boolean;
  connected: boolean;
  is_bot?: boolean;
  afk?: boolean;
  vx?: number;
  vy?: number;
  dx?: number;
  dy?: number;
  input_sequence?: number;
}

export interface Interactable {
  clearance?: number;
  backup?: boolean;
  id: string;
  kind: string;
  label: string;
  room: string;
  x: number;
  y: number;
  detail?: string;
  evidence?: RecoveredEvidence | null;
}

export interface RoomSnapshot {
  type: "snapshot";
  case?: CaseState | null;
  room: {
    code: string;
    host_id: string;
    phase: RoomPhase;
    min_players: number;
    max_players: number;
    solo?: boolean;
    is_public?: boolean;
    map_id?: MapInfo["id"];
    map?: MapInfo;
  };
  players: PlayerState[];
  interactables: Interactable[];
  testimonies?: Testimony[];
  clashes?: MemoryClash[];
  chat?: ChatMessage[];
  evidence?: RecoveredEvidence[];
  timeline?: TimelineState;
  result?: GameResult | null;
  reveal_started_at?: number | null;
  world: {
    furniture?: { id: string; kind: string; x: number; y: number; w: number; d: number; seed: number }[];
    obstacles?: [number, number, number, number][];
    doors?: { x: number; y: number; width: number; axis: "x" | "y" }[];
    layout_version?: number;
    width: number; height: number;
    rooms: { name: string; x: number; y: number; w: number; h: number; tint: number }[];
    walls: [number, number, number, number][];
  };
}

export interface Session {
  room_code: string;
  player_id: string;
  reconnect_token: string;
  share_url: string;
}

export type ServerMessage =
  | RoomSnapshot
  | { type: "case_state"; case: CaseState }
  | { type: "case_role"; role: CaseRole }
  | { type: "result_saved"; replay_code: string; best_score: number }
  | { type: "presence"; player: PlayerState }
  | { type: "ready_changed"; player_id: string; ready: boolean }
  | { type: "host_changed"; host_id: string }
  | { type: "phase_changed"; phase: RoomPhase }
  | { type: "player_moved"; player_id: string; x: number; y: number; sequence: number }
  | { type: "positions"; players: PlayerState[] }
  | { type: "memories"; memories: MemoryFragment[] }
  | { type: "testimony"; testimony: Testimony }
  | { type: "clash"; clash: MemoryClash }
  | { type: "chat"; message: ChatMessage }
  | { type: "evidence"; evidence: RecoveredEvidence; finder: string }
  | { type: "timeline"; timeline: TimelineState }
  | { type: "reveal"; result: GameResult; started_at: number }
  | { type: "archivist"; text: string }
  | { type: "recap"; text: string }
  | { type: "inspection"; interactable: Interactable }
  | { type: "activity"; player_id: string; verb: string; label: string }
  | { type: "error"; message: string }
  | { type: "pong" };

export type ClientAction =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "move"; dx: number; dy: number; sequence: number }
  | { type: "interact"; interactable_id: string }
  | { type: "ping" };
export type AppearanceAction = { type: "appearance"; avatar_color: number; hat: string } | { type: "leave" };

export type MysteryAction =
  | { type: "testify"; memory_id: string; stake: Stake }
  | { type: "respond"; testimony_id: string; response: Belief; stake: Stake }
  | { type: "retract"; testimony_id: string }
  | { type: "chat"; text: string };
export type InvestigationAction =
  | { type: "timeline"; slot: number; source_id: string | null; status: TimelineEntry["status"]; revision: number }
  | { type: "lock_vote"; revision: number; vote: boolean }
  | { type: "link_source"; slot: number; source_id: string; revision: number; remove?: boolean }
  | { type: "theory_vote"; revision: number; vote: boolean }
  | { type: "reveal_motive" };
export type EndgameAction = { type: "rematch" };
