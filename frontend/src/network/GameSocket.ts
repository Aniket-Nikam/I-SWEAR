import type { ClientAction, EndgameAction, InvestigationAction, MysteryAction, ServerMessage, Session } from "../types/protocol";

type MessageListener = (message: ServerMessage) => void;
type StatusListener = (status: "connecting" | "connected" | "reconnecting" | "offline") => void;

export class GameSocket {
  snapshot: import("../types/protocol").RoomSnapshot | null = null;
  private socket: WebSocket | null = null;
  private retryTimer: number | null = null;
  private retryCount = 0;
  private closedByUser = false;
  private moveSequence = 0;
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
      this.emitStatus("connected");
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.closedByUser) return;
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "snapshot") this.snapshot = message;
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

  send(action: ClientAction | MysteryAction | InvestigationAction | EndgameAction) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(action));
    }
  }

  move(dx: number, dy: number) {
    this.send({ type: "move", dx, dy, sequence: this.moveSequence++ });
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  close() {
    this.closedByUser = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private emitStatus(status: "connecting" | "connected" | "reconnecting" | "offline") {
    this.statusListeners.forEach((listener) => listener(status));
  }
}
