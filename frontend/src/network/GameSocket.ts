import type { AppearanceAction, ClientAction, EndgameAction, InvestigationAction, MysteryAction, ServerMessage, Session } from "../types/protocol";
import type { MotionCommand } from "../game/motion";
import { recordLatency } from "../game/performance";

type MessageListener = (message: ServerMessage) => void;
type StatusListener = (status: "connecting" | "connected" | "reconnecting" | "offline") => void;

export class GameSocket {
  role: import("../types/protocol").CaseRole | null = null;
  snapshot: import("../types/protocol").RoomSnapshot | null = null;
  private socket: WebSocket | null = null;
  private retryTimer: number | null = null;
  private retryCount = 0;
  private closedByUser = false;
  private moveSequence = 0;
  latencyMs = 0;
  connected = false;
  private pingTimer: number | null = null;
  private pingAt: number | null = null;
  private movementListeners = new Set<(command: MotionCommand) => void>();
  private messageListeners = new Set<MessageListener>();
  private statusListeners = new Set<StatusListener>();

  constructor(readonly session: Session) {}

  connect() {
    this.closedByUser = false;
    this.emitStatus(this.retryCount ? "reconnecting" : "connecting");
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const query = new URLSearchParams({
      player_id: this.session.player_id,
      token: this.session.reconnect_token,
    });
    const socket = new WebSocket(
      `${protocol}://${location.host}/ws/rooms/${this.session.room_code}?${query.toString()}`,
    );
    this.socket = socket;
    socket.onopen = () => {
      this.retryCount = 0;
      this.connected = true;
      this.moveSequence = 0;
      this.pingAt = null;
      this.ping();
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 2000);
      this.emitStatus("connected");
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.closedByUser) return;
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "pong" && this.pingAt !== null) {
        const measured = performance.now() - this.pingAt;
        this.latencyMs = this.latencyMs ? this.latencyMs * .7 + measured * .3 : measured;
        this.pingAt = null;
        recordLatency(this.latencyMs);
      }
      if (message.type === "snapshot") { this.snapshot = message; if (message.room.phase === "lobby") this.role = null; }
      if (message.type === "case_role") this.role = message.role;
      if (this.snapshot && message.type === "case_state") this.snapshot = { ...this.snapshot, case: message.case };
      if (this.snapshot && message.type === "reveal") {
        this.snapshot = { ...this.snapshot, result: message.result, reveal_started_at: message.started_at, room: { ...this.snapshot.room, phase: "reveal" } };
      }
      if (this.snapshot && message.type === "presence") {
        const exists = this.snapshot.players.some((player) => player.id === message.player.id);
        this.snapshot = { ...this.snapshot, players: exists
          ? this.snapshot.players.map((player) => player.id === message.player.id ? message.player : player)
          : [...this.snapshot.players, message.player] };
      }
      if (this.snapshot && message.type === "phase_changed") {
        this.snapshot = { ...this.snapshot, room: { ...this.snapshot.room, phase: message.phase } };
      }
      if (this.snapshot && message.type === "positions") {
        const positions = new Map(message.players.map((player) => [player.id, player]));
        this.snapshot = { ...this.snapshot, players: this.snapshot.players.map((player) => positions.get(player.id) ?? player) };
      }
      this.messageListeners.forEach((listener) => listener(message));
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.connected = false;
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.socket = null;
      if (this.closedByUser || event.code === 4001 || event.code === 4003) {
        this.emitStatus("offline");
        return;
      }
      this.emitStatus("reconnecting");
      const delay = Math.min(5000, 500 * 2 ** this.retryCount++);
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  send(action: ClientAction | MysteryAction | InvestigationAction | EndgameAction | AppearanceAction) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(action));
    }
  }

  move(dx: number, dy: number) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const command = { dx, dy, sequence: this.moveSequence++, at: performance.now() };
    this.send({ type: "move", dx, dy, sequence: command.sequence });
    this.movementListeners.forEach(listener => listener(command));
  }

  onMovement(listener: (command: MotionCommand) => void) {
    this.movementListeners.add(listener);
    return () => { this.movementListeners.delete(listener); };
  }

  private ping() {
    if (!this.connected || (this.pingAt !== null && performance.now() - this.pingAt < 5000)) return;
    this.pingAt = performance.now();
    this.send({ type: "ping" });
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => { this.messageListeners.delete(listener); };
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }

  close() {
    this.closedByUser = true;
    this.connected = false;
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private emitStatus(status: "connecting" | "connected" | "reconnecting" | "offline") {
    this.statusListeners.forEach((listener) => listener(status));
  }
}
