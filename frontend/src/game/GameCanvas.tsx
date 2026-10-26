import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { GameSocket } from "../network/GameSocket";
import type { Interactable, RoomSnapshot } from "../types/protocol";
import { BlackoutScene } from "./BlackoutScene";
import { MovementInput } from "./MovementInput";

interface GameCanvasProps {
  socket: GameSocket;
  snapshot: RoomSnapshot;
  localPlayerId: string;
  onPrompt: (item: Interactable | null) => void;
  onRoomChange: (room: string) => void;
  inputEnabled: boolean;
}

export function GameCanvas(props: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const nearest = useRef<Interactable | null>(null);
  const input = useRef<MovementInput | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const movement = new MovementInput((dx, dy) => props.socket.move(dx, dy));
    input.current = movement;
    const scene = new BlackoutScene({
      ...props,
      snapshot: props.socket.snapshot ?? props.snapshot,
      onPrompt: (item) => { nearest.current = item; latest.current.onPrompt(item); },
      onRoomChange: (room) => latest.current.onRoomChange(room),
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: host.current.clientWidth,
      height: host.current.clientHeight,
      backgroundColor: "#080d12",
      render: { antialias: true, pixelArt: false, roundPixels: true },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
      audio: { noAudio: true },
    });
    const timer = window.setInterval(() => movement.heartbeat(), 100);
    const clear = () => movement.clear();
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      movement.clear();
      scene.disposeNetwork();
      game.destroy(true);
    };
  }, [props.socket, props.localPlayerId]);

  useEffect(() => {
    if (!props.inputEnabled) input.current?.clear();
    else host.current?.focus();
  }, [props.inputEnabled]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!props.inputEnabled) return;
    if (input.current?.down(event.key)) event.preventDefault();
    if (event.key.toLowerCase() === "e" && !event.repeat && nearest.current) {
      event.preventDefault();
      props.socket.send({ type: "interact", interactable_id: nearest.current.id });
    }
  }

  function inspect() {
    if (props.inputEnabled && nearest.current) props.socket.send({ type: "interact", interactable_id: nearest.current.id });
  }

  return (
    <div
      className="game-canvas"
      ref={host}
      role="application"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => { if (input.current?.up(event.key)) event.preventDefault(); }}
      onBlur={() => input.current?.clear()}
      onPointerDown={() => host.current?.focus()}
      aria-label="The Blackout research complex game world"
    >
      {props.inputEnabled && <div className="touch-controls" aria-label="Touch movement" onPointerDown={(event) => event.stopPropagation()}>
        <div className="touch-dpad">{([["w", "Up", "↑"], ["a", "Left", "←"], ["s", "Down", "↓"], ["d", "Right", "→"]] as const).map(([key, label, glyph]) => <button key={key} className={`touch-${key}`} aria-label={`Move ${label.toLowerCase()}`} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); input.current?.down(key); }} onPointerUp={() => input.current?.clear()} onPointerCancel={() => input.current?.clear()}>{glyph}</button>)}</div><button className="touch-inspect" onClick={inspect}>Inspect <kbd>E</kbd></button>
      </div>}
    </div>
  );
}
