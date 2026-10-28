import Phaser from "phaser";
import type { GameSocket } from "../network/GameSocket";
import type { Interactable, PlayerState, RoomPhase, RoomSnapshot, ServerMessage } from "../types/protocol";
import { palette } from "./palette";
import { drawPhysicalFacility, drawIndieObject as drawObject } from "./IndieWorldArt";
import { drawAlternateMap } from "./AlternateMapArt";
import { drawWitness, hats } from "./WitnessArt";
import { hasLineOfSight } from "./visibility";
import { objectThumbnails } from "./artworkCache";
import { audioDirector } from "./AudioDirector";
import { recordFrame, resetFrames } from "./performance";
import { cacheStaticMap } from "./StaticMap";
import { LocalMotion, RemoteMotion } from "./motion";

interface SceneOptions {
  socket: GameSocket;
  snapshot: RoomSnapshot;
  localPlayerId: string;
  onPrompt: (item: Interactable | null) => void;
  onRoomChange: (room: string) => void;
  onReady?:()=>void;
}

interface PlayerVisual {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  motion: RemoteMotion;
  colorIndex: number;
  hat: string;
  bubble?: Phaser.GameObjects.Text;
}

export class BlackoutScene extends Phaser.Scene {
  private options: SceneOptions;
  private phase: RoomPhase;
  private local!: PlayerVisual;
  private players = new Map<string, PlayerVisual>();
  private interactables = new Map<string, { data: Interactable; marker: Phaser.GameObjects.Container }>();
  private nearest: Interactable | null = null;
  private unlisten: (() => void) | null = null;
  private unlistenMovement: (() => void) | null = null;
  private localMotion!: LocalMotion;
  private lastRoom = "Central Atrium";
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private revealHighlight!: Phaser.GameObjects.Graphics;
  private revealStep = -1;
  private lastFootstep = 0;

  constructor(options: SceneOptions) {
    super("blackout");
    this.options = options;
    this.phase = options.snapshot.room.phase;
  }

  disposeNetwork() {
    this.unlisten?.();
    this.unlisten = null;
    this.unlistenMovement?.();
    this.unlistenMovement = null;
  }

  create() {
    resetFrames();
    this.cameras.main.setBackgroundColor(palette.void);
    const world = this.options.snapshot.world;
    const mapId = this.options.snapshot.room.map_id ?? "campus";
    if (mapId === "campus") drawPhysicalFacility(this, world);
    else drawAlternateMap(this, world.rooms, world.walls, world.width, world.height, mapId);
    cacheStaticMap(this, world.width, world.height);

    this.revealHighlight = this.add.graphics().setDepth(14);
    this.options.snapshot.interactables.forEach((item) => this.createInteractable(item));
    this.options.snapshot.players.forEach((player) => this.createPlayer(player));
    this.local = this.players.get(this.options.localPlayerId)!;
    this.localMotion = new LocalMotion(this.options.snapshot.players.find(player => player.id === this.options.localPlayerId)!, world);
    this.unlistenMovement = this.options.socket.onMovement(command => this.localMotion.input(command));
    this.cameras.main.startFollow(this.local.sprite, true, 0.11, 0.11);
    this.cameras.main.setZoom(window.innerWidth < 760 ? 1.15 : 1.12);
    this.cameras.main.setBounds(0, 0, this.options.snapshot.world.width, this.options.snapshot.world.height);
    this.unlisten = this.options.socket.onMessage((message) => this.handleMessage(message));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposeNetwork());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.disposeNetwork());
    this.game.events.once(Phaser.Core.Events.POST_RENDER,()=>this.options.onReady?.());
  }

  update(_time: number, delta: number) {
    recordFrame(performance.now());
    if (!this.local) return;
    const reduced = document.documentElement.dataset.motion === "reduced";
    if (reduced !== this.reducedMotion) {
      this.reducedMotion = reduced;
      this.tweens.getTweens().forEach((tween) => reduced ? tween.pause() : tween.resume());
      this.cameras.main.setLerp(reduced ? 1 : 0.11, reduced ? 1 : 0.11);
    }
    const live = this.options.socket.snapshot;
    if (live) this.phase = live.room.phase;
    const cameraBlend = this.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 100) / 85);
    this.cameras.main.setLerp(cameraBlend, cameraBlend);
    if (!this.options.socket.connected) this.localMotion.stop();
    this.updateRemotePlayers(delta);
    this.updateProximity();
    this.updateRoomLabel();
    if (this.phase === "reveal" && live?.result && live.reveal_started_at) {
      const step = Math.max(0, Math.min(5, Math.floor((Date.now() / 1000 - live.reveal_started_at) / 4)));
      if (step !== this.revealStep) {
        this.revealStep = step;
        const event = live.result.comparisons[step].event;
        const room = live.world.rooms.find((entry) => entry.name === event.location);
        if (room) {
          this.revealHighlight.clear().fillStyle(palette.orange, 0.12).fillRect(room.x, room.y, room.w, room.h)
            .lineStyle(3, palette.orange, 0.65).strokeRect(room.x, room.y, room.w, room.h);
          this.cameras.main.stopFollow();
          if (this.reducedMotion) this.cameras.main.centerOn(room.x + room.w / 2, room.y + room.h / 2);
          else this.cameras.main.pan(room.x + room.w / 2, room.y + room.h / 2, 900, "Sine.easeInOut");
        }
      }
    } else if (this.phase === "lobby" && this.revealStep !== -1) {
      this.revealStep = -1;
      this.revealHighlight.clear();
      this.cameras.main.startFollow(this.local.sprite, true, 0.11, 0.11);
    }
  }

  private createAvatarTextures(colorIndex:number,hat:string) {
        for (let frame = 0; frame < 2; frame++) {
          const key = `avatar-${colorIndex}-${hat}-${frame}`;
          if (this.textures.exists(key)) continue;
          const g = this.make.graphics({ x: 0, y: 0 });
          drawWitness(g, colorIndex, hat, frame);
          g.generateTexture(key, 64, 82).destroy();
        }
        const key = `walk-${colorIndex}-${hat}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: [{ key: `avatar-${colorIndex}-${hat}-0` }, { key: `avatar-${colorIndex}-${hat}-1` }], frameRate: 7, repeat: -1 });
  }

  private createPlayer(player: PlayerState) {
    const colorIndex = player.avatar_color ?? player.color_index;
    const hat = hats.includes(player.hat ?? "none") ? player.hat ?? "none" : "none";
    this.createAvatarTextures(colorIndex,hat);
    const existing = this.players.get(player.id);
    if (existing) { existing.colorIndex = colorIndex; existing.hat = hat; return; }
    const sprite = this.add.sprite(player.x, player.y, `avatar-${colorIndex}-${hat}-0`).setDisplaySize(45, 58).setOrigin(.5, .8);
    sprite.setDepth(20);
    const label = this.add
      .text(player.x, player.y - 57, player.name.replace(" (scripted)", ""), {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: player.connected ? "#f2e4c8" : "#8fa8a4",
        backgroundColor: "#142c37ee",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(21);
    const motion = new RemoteMotion();
    motion.push(player, performance.now());
    this.players.set(player.id, { sprite, label, motion, colorIndex, hat });
  }

  private createInteractable(item: Interactable) {
    if (!objectThumbnails.has(item.kind)) {
      const thumbnail = this.make.graphics({ x: 0, y: 0 });
      thumbnail.translateCanvas(128, 128).scaleCanvas(3, 3);
      drawObject(thumbnail, item.kind);
      const key = `object-art-${item.kind}`;
      thumbnail.generateTexture(key, 256, 256);
      const source = this.textures.get(key).getSourceImage();
      if (source instanceof HTMLCanvasElement) objectThumbnails.set(item.kind, source.toDataURL("image/png"));
      thumbnail.destroy();
    }
    const art = this.add.graphics();
    drawObject(art, item.kind);
    const ring = this.add.circle(0, 0, 40).setStrokeStyle(1, palette.cyan, 0.28);
    const marker = this.add.container(item.x, item.y, [ring, art]).setDepth(12);
    if (!this.reducedMotion) this.tweens.add({ targets: ring, alpha: 0.08, scale: 1.35, duration: 1200, yoyo: true, repeat: -1 });
    this.interactables.set(item.id, { data: item, marker });
  }

  private handleMessage(message: ServerMessage) {
    if (!this.sys.isActive()) return;
    if (message.type === "chat") {
      const visual = this.players.get(message.message.player_id);
      if (visual) {
        visual.bubble?.destroy();
        const text = message.message.text.length > 90 ? `${message.message.text.slice(0, 87)}…` : message.message.text;
        const bubble = this.add.text(visual.sprite.x, visual.sprite.y - 52, text, {
          fontFamily: "Aptos, Segoe UI, sans-serif", fontSize: "13px", color: "#d5e0d9",
          backgroundColor: "#182c35", padding: { x: 10, y: 7 }, wordWrap: { width: 190 }, align: "center",
        }).setOrigin(0.5, 1).setDepth(40);
        visual.bubble = bubble;
        this.time.delayedCall(5000, () => { if (visual.bubble === bubble) visual.bubble = undefined; bubble.destroy(); });
      }
    }
    if (message.type === "snapshot") {
      this.phase = message.room.phase;
      message.players.forEach((player) => {
        this.createPlayer(player);
        const visual = this.players.get(player.id)!;
        visual.motion = new RemoteMotion();
        visual.motion.push(player, performance.now());
        if (player.id === this.options.localPlayerId) this.localMotion.reset(player);
      });
    }
    if (message.type === "phase_changed") {
      this.phase = message.phase;
      if (message.phase !== "exploring") this.localMotion.stop();
    }
    if (message.type === "presence") {
      this.createPlayer(message.player);
      const visual = this.players.get(message.player.id);
      visual?.label.setColor(message.player.connected ? "#f2e4c8" : "#8fa8a4");
      if (message.player.id !== this.options.localPlayerId) visual?.motion.push(message.player, performance.now());
    }
    if (message.type === "positions") {
      message.players.forEach((state) => {
        this.createPlayer(state);
        const visual = this.players.get(state.id)!;
        if (state.id === this.options.localPlayerId) this.localMotion.reconcile(state, this.options.socket.latencyMs, performance.now());
        else visual.motion.push(state, performance.now());
      });
    }
  }

  private updateRemotePlayers(delta: number) {
    const now = performance.now();
    const local = this.localMotion.step(delta / 1000, this.phase === "exploring" && this.options.socket.connected);
    this.players.forEach((visual) => {
      const previousX = visual.sprite.x;
      const previousY = visual.sprite.y;
      const position = visual === this.local ? local : visual.motion.position(now, this.options.snapshot.world);
      if (position) visual.sprite.setPosition(position.x, position.y);
      visual.label.setPosition(visual.sprite.x, visual.sprite.y - 57);
      visual.bubble?.setPosition(visual.sprite.x, visual.sprite.y - 78);
      const visible = visual === this.local || (Phaser.Math.Distance.Between(this.local.sprite.x, this.local.sprite.y, visual.sprite.x, visual.sprite.y) < 620 && hasLineOfSight(this.local.sprite.x, this.local.sprite.y, visual.sprite.x, visual.sprite.y, this.options.snapshot.world.walls));
      visual.sprite.setVisible(visible); visual.label.setVisible(visible); visual.bubble?.setVisible(visible);
      const moving = Math.hypot(visual.sprite.x - previousX, visual.sprite.y - previousY) > 0.08;
      if (visual === this.local && moving && performance.now() - this.lastFootstep > 280) {
        audioDirector.cue("step"); this.lastFootstep = performance.now();
      }
      if (moving) {
        if (Math.abs(visual.sprite.x - previousX) > 0.05) visual.sprite.setFlipX(visual.sprite.x < previousX);
        visual.sprite.anims.play(`walk-${visual.colorIndex}-${visual.hat}`, true);
      } else {
        visual.sprite.anims.stop();
        visual.sprite.setTexture(`avatar-${visual.colorIndex}-${visual.hat}-0`);
      }
    });
  }

  private updateProximity() {
    let closest: Interactable | null = null;
    let closestDistance = 88;
    for (const { data, marker } of this.interactables.values()) {
      const distance = Phaser.Math.Distance.Between(this.local.sprite.x, this.local.sprite.y, data.x, data.y);
      marker.setAlpha(distance < 150 ? 1 : 0.52);
      if (distance < closestDistance && hasLineOfSight(this.local.sprite.x, this.local.sprite.y, data.x, data.y, this.options.snapshot.world.walls)) {
        closest = data;
        closestDistance = distance;
      }
    }
    if (closest?.id !== this.nearest?.id) {
      this.nearest = closest;
      this.options.onPrompt(closest);
    }
  }

  private updateRoomLabel() {
    const x = this.local.sprite.x;
    const y = this.local.sprite.y;
    const room = this.options.snapshot.world.rooms.find((entry) => x >= entry.x && x <= entry.x + entry.w && y >= entry.y && y <= entry.y + entry.h);
    const name = room?.name ?? "Service Corridor";
    if (name !== this.lastRoom) {
      this.lastRoom = name;
      this.options.onRoomChange(name);
    }
  }
}
