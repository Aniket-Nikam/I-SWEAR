import Phaser from "phaser";
import type { GameSocket } from "../network/GameSocket";
import type { Interactable, PlayerState, RoomPhase, RoomSnapshot, ServerMessage } from "../types/protocol";
import { avatarColors, palette } from "./palette";
import { drawFacilityDetails, drawObject } from "./WorldArt";
import { objectThumbnails } from "./artworkCache";
import { audioDirector } from "./AudioDirector";

interface SceneOptions {
  socket: GameSocket;
  snapshot: RoomSnapshot;
  localPlayerId: string;
  onPrompt: (item: Interactable | null) => void;
  onRoomChange: (room: string) => void;
}

interface PlayerVisual {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  colorIndex: number;
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
  }

  create() {
    this.cameras.main.setBackgroundColor(palette.void);
    this.drawFacility();
    drawFacilityDetails(this);
    this.createAvatarTextures();
    this.createWalls();
    this.revealHighlight = this.add.graphics().setDepth(14);
    this.options.snapshot.interactables.forEach((item) => this.createInteractable(item));
    this.options.snapshot.players.forEach((player) => this.createPlayer(player));
    this.local = this.players.get(this.options.localPlayerId)!;
    this.cameras.main.startFollow(this.local.sprite, true, 0.11, 0.11);
    this.cameras.main.setZoom(1.08);
    this.cameras.main.setBounds(0, 0, 2048, 1400);
    this.unlisten = this.options.socket.onMessage((message) => this.handleMessage(message));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposeNetwork());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.disposeNetwork());
    if (!this.reducedMotion) this.cameras.main.fadeIn(400, 8, 13, 18);
  }

  update(_time: number, delta: number) {
    if (!this.local) return;
    const reduced = document.documentElement.dataset.motion === "reduced";
    if (reduced !== this.reducedMotion) {
      this.reducedMotion = reduced;
      this.tweens.getTweens().forEach((tween) => reduced ? tween.pause() : tween.resume());
      this.cameras.main.setLerp(reduced ? 1 : 0.11, reduced ? 1 : 0.11);
    }
    // Background tabs can suspend Phaser while socket presence continues.
    const live = this.options.socket.snapshot;
    if (live) {
      this.phase = live.room.phase;
      live.players.forEach((player) => {
        this.createPlayer(player);
        const visual = this.players.get(player.id)!;
        visual.targetX = player.x;
        visual.targetY = player.y;
      });
    }
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

  private drawFacility() {
    const graphics = this.add.graphics();
    graphics.fillStyle(palette.void, 1).fillRect(0, 0, 2048, 1400);
    this.options.snapshot.world.rooms.forEach((room) => {
      graphics.fillStyle(room.tint, 1).fillRect(room.x, room.y, room.w, room.h);
      graphics.lineStyle(1, 0x53636b, 0.18);
      for (let gx = room.x + 24; gx < room.x + room.w; gx += 48) graphics.lineBetween(gx, room.y, gx, room.y + room.h);
      for (let gy = room.y + 24; gy < room.y + room.h; gy += 48) graphics.lineBetween(room.x, gy, room.x + room.w, gy);
      this.add
        .text(room.x + 26, room.y + 22, room.name.toUpperCase(), {
          fontFamily: "Bahnschrift, Arial Narrow, sans-serif",
          fontSize: "17px",
          fontStyle: "bold",
          color: "#85959b",
          letterSpacing: 3,
        })
        .setAlpha(0.8);
    });
    this.drawFixtures(graphics);
    this.drawLight(graphics, 338, 230, 190, palette.orange, 0.08);
    this.drawLight(graphics, 1010, 650, 280, palette.orange, 0.11);
    this.drawLight(graphics, 1700, 250, 190, palette.cyan, 0.06);
    this.drawLight(graphics, 1228, 1100, 180, palette.cyan, 0.06);
    this.add.text(70, 1350, "ORPHEUS RESEARCH COMPLEX / NIGHT ACCESS", {
      fontFamily: "Cascadia Mono, monospace",
      fontSize: "12px",
      color: "#53636b",
      letterSpacing: 2,
    });
  }

  private drawLight(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha: number) {
    for (let ring = 1; ring >= 0.2; ring -= 0.2) {
      graphics.fillStyle(color, alpha * (1.1 - ring)).fillCircle(x, y, radius * ring);
    }
  }

  private drawFixtures(graphics: Phaser.GameObjects.Graphics) {
    graphics.fillStyle(0x26343c, 1);
    [[170, 155], [250, 155], [330, 155], [740, 145], [820, 145], [1540, 150], [1630, 150]].forEach(([x, y]) =>
      graphics.fillRoundedRect(x, y, 58, 90, 5),
    );
    graphics.lineStyle(5, palette.orange, 0.45).strokeCircle(1010, 680, 118);
    graphics.lineStyle(2, palette.orange, 0.25).strokeCircle(1010, 680, 94);
    graphics.fillStyle(0x0d171e, 0.22).fillCircle(1010, 680, 91);
    graphics.lineStyle(1, 0x63777b, 0.35).strokeCircle(1010, 680, 69);
    graphics.fillStyle(0x273a41, 1);
    for (let x = 1100; x < 1370; x += 54) graphics.fillRoundedRect(x, 958, 35, 250, 4);
    graphics.fillStyle(0x2c3033, 1);
    for (let x = 1520; x < 1900; x += 76) graphics.fillRect(x, 980, 48, 236);
    graphics.fillStyle(palette.red, 0.65).fillRect(1942, 615, 10, 184);
  }

  private createWalls() {
    const wall = (x: number, y: number, w: number, h: number) => {
      const body = this.add.rectangle(x, y, w, h, palette.wall);
      const edge = this.add.rectangle(x, y - h / 2 + 2, w, 3, palette.wallEdge, 0.6);
      edge.setDepth(body.depth + 1);
    };
    this.options.snapshot.world.walls.forEach(([x, y, w, h]) => wall(x, y, w, h));
  }

  private createAvatarTextures() {
    avatarColors.forEach((color, colorIndex) => {
      for (let frame = 0; frame < 2; frame++) {
        const key = `avatar-${colorIndex}-${frame}`;
        if (this.textures.exists(key)) continue;
        const g = this.make.graphics({ x: 0, y: 0 });
        const bob = frame ? 1 : 0;
        g.fillStyle(0x0a0e12, 0.5).fillEllipse(15, 39, 25, 7);
        g.fillStyle(color, 1).fillRoundedRect(5, 12 + bob, 20, 23, 6);
        g.fillStyle(0xd5c4ab, 1).fillCircle(15, 10 + bob, 8);
        g.fillStyle(0x182129, 1).fillRect(9, 2 + bob, 12, 5);
        g.fillStyle(palette.cyan, 0.85).fillRect(22, 18 + bob, 5, 9);
        g.fillStyle(0x101820, 1).fillRect(frame ? 6 : 8, 33 + bob, 6, 7);
        g.fillRect(frame ? 18 : 16, 33 + bob, 6, 7);
        g.generateTexture(key, 30, 44).destroy();
      }
      this.anims.create({
        key: `walk-${colorIndex}`,
        frames: [{ key: `avatar-${colorIndex}-0` }, { key: `avatar-${colorIndex}-1` }],
        frameRate: 7,
        repeat: -1,
      });
    });
  }

  private createPlayer(player: PlayerState) {
    if (this.players.has(player.id)) return;
    const sprite = this.add.sprite(player.x, player.y, `avatar-${player.color_index}-0`);
    sprite.setDepth(20);
    const label = this.add
      .text(player.x, player.y - 32, player.name, {
        fontFamily: "Aptos, Segoe UI, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: player.connected ? "#e0ddd2" : "#78858b",
        backgroundColor: "#0b1118bb",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.players.set(player.id, { sprite, label, targetX: player.x, targetY: player.y, colorIndex: player.color_index });
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
        visual.targetX = player.x;
        visual.targetY = player.y;
      });
    }
    if (message.type === "phase_changed") this.phase = message.phase;
    if (message.type === "presence") {
      this.createPlayer(message.player);
      const visual = this.players.get(message.player.id);
      visual?.label.setColor(message.player.connected ? "#e0ddd2" : "#78858b");
    }
    if (message.type === "positions") {
      message.players.forEach((state) => {
        this.createPlayer(state);
        const visual = this.players.get(state.id)!;
        visual.targetX = state.x;
        visual.targetY = state.y;
      });
    }
  }

  private updateRemotePlayers(delta: number) {
    this.players.forEach((visual) => {
      const previousX = visual.sprite.x;
      const previousY = visual.sprite.y;
      const factor = 1 - Math.exp(-Math.min(delta, 100) / 30);
      visual.sprite.x = Phaser.Math.Linear(visual.sprite.x, visual.targetX, factor);
      visual.sprite.y = Phaser.Math.Linear(visual.sprite.y, visual.targetY, factor);
      visual.label.setPosition(visual.sprite.x, visual.sprite.y - 32);
      visual.bubble?.setPosition(visual.sprite.x, visual.sprite.y - 52);
      const moving = Math.hypot(visual.sprite.x - previousX, visual.sprite.y - previousY) > 0.08;
      if (visual === this.local && moving && performance.now() - this.lastFootstep > 280) {
        audioDirector.cue("step"); this.lastFootstep = performance.now();
      }
      if (moving) {
        if (Math.abs(visual.sprite.x - previousX) > 0.05) visual.sprite.setFlipX(visual.sprite.x < previousX);
        visual.sprite.anims.play(`walk-${visual.colorIndex}`, true);
      } else {
        visual.sprite.anims.stop();
        visual.sprite.setTexture(`avatar-${visual.colorIndex}-0`);
      }
    });
  }

  private updateProximity() {
    let closest: Interactable | null = null;
    let closestDistance = 88;
    for (const { data, marker } of this.interactables.values()) {
      const distance = Phaser.Math.Distance.Between(this.local.sprite.x, this.local.sprite.y, data.x, data.y);
      marker.setAlpha(distance < 150 ? 1 : 0.52);
      if (distance < closestDistance) {
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
