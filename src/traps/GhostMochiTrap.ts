import Phaser from 'phaser';
import { TILE } from '../config';
import { SLAB_H, gateTexture, slabOutlineTexture, slabTexture } from '../art/illusionTextures';
import { AudioManager } from '../managers/AudioManager';
import { TRAP_DATA_KEY, type GhostMochiConfig, type Trap, type TrapContext } from './types';

/** Ring buffer size: far more samples than the delay ever needs (about 15 s at 120 fps). */
const CAP = 2048;
const GHOST_TINT = 0xcdb4ff;

interface Plate {
  left: number;
  right: number;
  top: number;
  img: Phaser.GameObjects.Image;
  pressed: boolean;
}

interface Gate {
  zone: Phaser.GameObjects.Zone;
  img: Phaser.GameObjects.Image;
  plate: number;
  closedY: number;
  openY: number;
  open: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Bridge {
  zone: Phaser.GameObjects.Zone;
  img: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  plate: number;
  solid: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Ghost Mochi (Zone 3). A recorder and a player: every frame MOCHI is in the zone, the pose of
 * MOCHI's sprite (position, frame, flip, scale) goes into a ring buffer; the ghost shows the pose
 * from exactly `delayMs` ago. It only reads the sprite, so the real player controller is never
 * touched. The ghost presses plates like MOCHI does. Because the ghost's next moves are already
 * recorded, a gate or bridge about to close can warn ahead of time, always correctly.
 * Everything (recording, ghost, plates, gates, bridges) is cleared on respawn.
 */
export class GhostMochiTrap implements Trap {
  readonly type = 'ghostMochi';
  id = '';
  readonly span;
  readonly solids: Phaser.GameObjects.Zone[] = [];
  private readonly fromX: number;
  private readonly toX: number;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly shrine: Phaser.GameObjects.Image;
  private readonly plates: Plate[];
  private readonly gates: Gate[];
  private readonly bridges: Bridge[];
  // Recording (preallocated; nothing is allocated per frame).
  private readonly tBuf = new Float64Array(CAP);
  private readonly xBuf = new Float32Array(CAP);
  private readonly yBuf = new Float32Array(CAP);
  private readonly sxBuf = new Float32Array(CAP);
  private readonly syBuf = new Float32Array(CAP);
  private readonly rotBuf = new Float32Array(CAP);
  private readonly flipBuf = new Uint8Array(CAP);
  private readonly keyBuf: string[] = new Array<string>(CAP).fill('');
  private written = 0;
  private read = -1;
  private clock = 0;
  private active = false;
  private ghostShown = false;
  private ghostX = 0;
  private ghostFootY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: GhostMochiConfig,
  ) {
    this.fromX = cfg.fromX * TILE;
    this.toX = cfg.toX * TILE;
    this.shrine = scene.add
      .image(cfg.shrine.x * TILE + TILE / 2, cfg.shrine.y * TILE + 2, 'ghost_shrine')
      .setOrigin(0.5, 1)
      .setDepth(9)
      .setAlpha(0.7);
    this.ghost = scene.add.image(0, 0, 'mochi_idle').setDepth(19).setAlpha(0.5).setTint(GHOST_TINT).setVisible(false);

    this.plates = cfg.plates.map((p) => {
      const left = p.x * TILE;
      const top = p.y * TILE;
      const img = scene.add
        .image(left + (p.w * TILE) / 2, top + 1, 'plate_up')
        .setOrigin(0.5, 1)
        .setDisplaySize(p.w * TILE, 12)
        .setDepth(13);
      return { left, right: left + p.w * TILE, top, img, pressed: false };
    });

    this.gates = cfg.gates.map((g) => {
      const h = g.h * TILE;
      const left = g.x * TILE;
      const bottom = g.y * TILE;
      const zone = scene.add.zone(left + TILE / 2, bottom - h / 2, TILE, h);
      scene.physics.add.existing(zone, true);
      const closedY = bottom;
      const img = scene.add.image(left + TILE / 2, closedY, gateTexture(scene, h)).setOrigin(0.5, 1).setDepth(11);
      this.solids.push(zone);
      return { zone, img, plate: g.plate, closedY, openY: closedY - h + 8, open: false, left, right: left + TILE, top: bottom - h, bottom };
    });

    this.bridges = cfg.bridges.map((b) => {
      const w = b.w * TILE;
      const left = b.x * TILE;
      const top = b.y * TILE;
      const zone = scene.add.zone(left + w / 2, top + SLAB_H / 2, w, SLAB_H);
      scene.physics.add.existing(zone, true);
      zone.setData(TRAP_DATA_KEY, this);
      const img = scene.add.image(left, top, slabTexture(scene, w)).setOrigin(0).setDepth(10).setTint(GHOST_TINT);
      const outline = scene.add.image(left, top, slabOutlineTexture(scene, w)).setOrigin(0).setDepth(10).setTint(0x9d82e0);
      this.solids.push(zone);
      return { zone, img, outline, plate: b.plate, solid: true, left, right: left + w, top, bottom: top + SLAB_H };
    });
    this.bridges.forEach((b) => this.setBridge(b, false));

    const xs = [...cfg.plates.map((p) => p.x), ...cfg.gates.map((g) => g.x), ...cfg.bridges.map((b) => b.x)];
    const xe = [...cfg.plates.map((p) => p.x + p.w), ...cfg.gates.map((g) => g.x + 1), ...cfg.bridges.map((b) => b.x + b.w)];
    this.span = { left: Math.min(...xs) * TILE, right: Math.max(...xe) * TILE };
  }

  // ----- Tests and debugging -----

  get isActive(): boolean {
    return this.active;
  }

  get ghostVisible(): boolean {
    return this.ghostShown;
  }

  get ghostPos(): { x: number; y: number } {
    return { x: this.ghostX, y: this.ghostFootY };
  }

  get recorded(): number {
    return this.written;
  }

  get state(): { plates: boolean[]; gates: boolean[]; bridges: boolean[] } {
    return {
      plates: this.plates.map((p) => p.pressed),
      gates: this.gates.map((g) => g.open),
      bridges: this.bridges.map((b) => b.solid),
    };
  }

  // ----- Frame -----

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const inZone = box.centerX >= this.fromX && box.centerX <= this.toX;
    if (inZone !== this.active) {
      if (inZone) this.activate();
      else this.deactivate();
    }
    if (!this.active) return;

    const dt = Math.min(this.scene.game.loop.delta, 50);
    this.clock += dt;
    this.record(ctx);
    this.playBack(ctx);

    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i];
      const pressed = this.playerOn(p, box) || (this.ghostShown && this.footOn(p, this.ghostX, this.ghostFootY));
      if (pressed !== p.pressed) {
        p.pressed = pressed;
        p.img.setTexture(pressed ? 'plate_down' : 'plate_up');
        if (pressed) AudioManager.play('click');
      }
    }
    // A plate the ghost is about to step off (and MOCHI is not holding) warns its gate/bridge.
    for (const g of this.gates) this.updateGate(g, box);
    for (const b of this.bridges) {
      this.updateBridge(b, box, ctx);
      // Dropping into the gap under a bridge: a fall that follows is credited to this puzzle.
      if (box.right > b.left && box.left < b.right && box.top > b.bottom) ctx.triggered(this);
    }
  }

  private activate(): void {
    this.active = true;
    this.clock = 0;
    this.written = 0;
    this.read = -1;
    this.ghostShown = false;
    this.shrine.setAlpha(1);
  }

  private deactivate(): void {
    this.active = false;
    this.written = 0;
    this.read = -1;
    this.ghostShown = false;
    this.ghost.setVisible(false);
    this.shrine.setAlpha(0.7);
    this.resetParts();
  }

  private record(ctx: TrapContext): void {
    const s = ctx.player.sprite;
    const i = this.written % CAP;
    this.tBuf[i] = this.clock;
    this.xBuf[i] = s.x;
    this.yBuf[i] = s.y;
    this.sxBuf[i] = s.scaleX;
    this.syBuf[i] = s.scaleY;
    this.rotBuf[i] = s.rotation;
    this.flipBuf[i] = s.flipX ? 1 : 0;
    this.keyBuf[i] = s.texture.key;
    this.written++;
  }

  /** Index of the newest sample at or before time `t`, or -1 if none yet. */
  private sampleAt(t: number, from: number): number {
    let r = Math.max(from, this.written - CAP);
    if (r < 0 && this.written > 0 && this.tBuf[0] <= t) r = 0;
    if (r < 0) return -1;
    while (r + 1 < this.written && this.tBuf[(r + 1) % CAP] <= t) r++;
    return this.tBuf[r % CAP] <= t ? r : -1;
  }

  private playBack(ctx: TrapContext): void {
    const r = this.sampleAt(this.clock - this.cfg.delayMs, this.read);
    if (r < 0) return;
    this.read = r;
    const i = r % CAP;
    this.ghostX = this.xBuf[i];
    this.ghostFootY = this.yBuf[i];
    this.ghost
      .setTexture(this.keyBuf[i])
      .setOrigin(ctx.player.sprite.originX, ctx.player.sprite.originY)
      .setPosition(this.ghostX, this.ghostFootY)
      .setScale(this.sxBuf[i], this.syBuf[i])
      .setRotation(this.rotBuf[i])
      .setFlipX(this.flipBuf[i] === 1);
    if (!this.ghostShown) {
      this.ghostShown = true;
      this.ghost.setVisible(true);
      AudioManager.play('ghost');
      ctx.fx.sparkle(this.ghostX, this.ghostFootY - 24, 10);
    }
  }

  private playerOn(p: Plate, box: Phaser.Geom.Rectangle): boolean {
    return box.centerX >= p.left - 4 && box.centerX <= p.right + 4 && Math.abs(box.bottom - p.top) <= 4;
  }

  private footOn(p: Plate, x: number, footY: number): boolean {
    return x >= p.left - 4 && x <= p.right + 4 && Math.abs(footY - p.top) <= 6;
  }

  /** Will the plate go up within `warnMs`? Only the ghost can be predicted, so MOCHI on it = no. */
  private releasingSoon(plateIndex: number, box: Phaser.Geom.Rectangle): boolean {
    const p = this.plates[plateIndex];
    if (!p.pressed || this.playerOn(p, box) || !this.ghostShown) return false;
    const r = this.sampleAt(this.clock - this.cfg.delayMs + this.cfg.warnMs, this.read);
    if (r < 0) return false;
    const i = r % CAP;
    return !this.footOn(p, this.xBuf[i], this.yBuf[i]);
  }

  private overlaps(box: Phaser.Geom.Rectangle, l: number, r: number, t: number, b: number): boolean {
    return box.right > l && box.left < r && box.bottom > t && box.top < b;
  }

  private updateGate(g: Gate, box: Phaser.Geom.Rectangle): void {
    const want = this.plates[g.plate].pressed;
    if (want && !g.open) {
      g.open = true;
      (g.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.scene.tweens.killTweensOf(g.img);
      this.scene.tweens.add({ targets: g.img, y: g.openY, alpha: 0.35, duration: 140, ease: 'Quad.easeOut' });
    } else if (!want && g.open && !this.overlaps(box, g.left, g.right, g.top, g.bottom)) {
      // Never closes on MOCHI: it waits until MOCHI is clear.
      g.open = false;
      (g.zone.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      this.scene.tweens.killTweensOf(g.img);
      this.scene.tweens.add({ targets: g.img, y: g.closedY, alpha: 1, duration: 120, ease: 'Quad.easeIn' });
    } else if (g.open) {
      g.img.setAlpha(this.releasingSoon(g.plate, box) && Math.floor(this.clock / 90) % 2 === 0 ? 0.9 : 0.35);
    }
  }

  private updateBridge(b: Bridge, box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const want = this.plates[b.plate].pressed;
    if (want && !b.solid) {
      // Never turns solid inside MOCHI.
      if (!this.overlaps(box, b.left, b.right, b.top, b.bottom)) this.setBridge(b, true);
    } else if (!want && b.solid) {
      const onIt = box.right > b.left && box.left < b.right && Math.abs(box.bottom - b.top) <= 4;
      if (onIt) ctx.triggered(this);
      this.setBridge(b, false);
    } else if (b.solid) {
      b.img.setAlpha(this.releasingSoon(b.plate, box) && Math.floor(this.clock / 90) % 2 === 0 ? 0.35 : 1);
    }
  }

  private setBridge(b: Bridge, solid: boolean): void {
    b.solid = solid;
    (b.zone.body as Phaser.Physics.Arcade.StaticBody).enable = solid;
    b.img.setAlpha(solid ? 1 : 0.18);
    b.outline.setAlpha(solid ? 0 : 0.9);
  }

  onContact(ctx: TrapContext): void {
    // Standing on a bridge: a fall right after is credited to the ghost puzzle.
    ctx.triggered(this);
  }

  private resetParts(): void {
    for (const p of this.plates) {
      p.pressed = false;
      p.img.setTexture('plate_up');
    }
    for (const g of this.gates) {
      g.open = false;
      (g.zone.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      this.scene.tweens.killTweensOf(g.img);
      g.img.setY(g.closedY).setAlpha(1);
    }
    for (const b of this.bridges) this.setBridge(b, false);
  }

  onRespawn(): void {
    this.deactivate();
  }
}
