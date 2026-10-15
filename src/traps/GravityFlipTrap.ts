import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { SpikeTrap } from './SpikeTrap';
import type { GravityFlipConfig, Trap, TrapContext } from './types';

const UP_TINT = 0xb48cff;
const DOWN_TINT = 0xff9cc0;

interface Gate {
  x: number;
  top: number;
  bottom: number;
  right: 1 | -1;
  beam: Phaser.GameObjects.TileSprite;
}

/**
 * Gravity Betrayal (Level 04, Zone 1 and 5). Gates are glowing columns of chevrons; crossing one
 * sets MOCHI's gravity to the side MOCHI ends up on (walking back undoes it). Right before a
 * crossing that would flip gravity, the gate brightens and an icon pops over MOCHI. Only MOCHI's
 * own gravity changes; the world's gravity (and Levels 01-03) are never touched.
 */
export class GravityFlipTrap implements Trap {
  readonly type = 'gravityFlip';
  id = '';
  readonly span;
  private readonly gates: Gate[];
  private readonly spikes: SpikeTrap[];
  private readonly icon: Phaser.GameObjects.Image;
  private prevX: number | null = null;
  private clock = 0;
  private flips = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: GravityFlipConfig,
  ) {
    this.gates = cfg.gates.map((g) => {
      const x = g.x * TILE;
      const top = g.top * TILE;
      const bottom = g.bottom * TILE;
      const right: 1 | -1 = g.right === 'up' ? -1 : 1;
      const beam = scene.add
        .tileSprite(x, top, TILE, bottom - top, 'grav_cell')
        .setOrigin(0.5, 0)
        .setDepth(8)
        .setAlpha(0.55)
        .setTint(right < 0 ? UP_TINT : DOWN_TINT)
        .setFlipY(right > 0);
      return { x, top, bottom, right, beam };
    });
    this.spikes = (cfg.spikes ?? []).map(
      (s) => new SpikeTrap(scene, { x: s.x * TILE, surfaceY: s.y * TILE, tiles: s.w, hidden: false, ceiling: s.ceiling }),
    );
    this.icon = scene.add.image(0, 0, 'grav_icon').setDepth(23).setVisible(false);
    const xs = [...this.gates.map((g) => g.x), ...this.spikes.map((s) => s.left)];
    const xe = [...this.gates.map((g) => g.x), ...this.spikes.map((s) => s.right)];
    this.span = { left: Math.min(...xs), right: Math.max(...xe) };
  }

  /** Tests: how many flips happened since the level started. */
  get flipCount(): number {
    return this.flips;
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const dt = Math.min(this.scene.game.loop.delta, 50);
    this.clock += dt;
    const player = ctx.player;
    const x = box.centerX;
    const prev = this.prevX ?? x;
    this.prevX = x;

    for (const s of this.spikes) {
      if (s.hits(box)) {
        ctx.kill('spike', this);
        return;
      }
    }

    // Beams scroll in their gravity direction.
    const scroll = (dt / 1000) * 40;
    let warnGate: Gate | null = null;
    const warnPx = this.cfg.warnTiles * TILE;
    for (const g of this.gates) {
      g.beam.tilePositionY += g.right < 0 ? scroll : -scroll;
      const inside = box.bottom > g.top && box.top < g.bottom;
      if (inside && prev < g.x && x >= g.x) this.flip(g.right, ctx);
      else if (inside && prev >= g.x && x < g.x) this.flip(-g.right as 1 | -1, ctx);
      // Warning: close to a gate whose crossing would change gravity.
      const ahead = x < g.x ? g.right : (-g.right as 1 | -1);
      const near = Math.abs(x - g.x) <= warnPx && inside && ahead !== player.gravityDir;
      g.beam.setAlpha(near ? 0.65 + 0.35 * Math.abs(Math.sin(this.clock / 90)) : 0.55);
      if (near) warnGate = g;
    }
    if (warnGate) {
      const up = player.gravityDir > 0;
      this.icon
        .setVisible(true)
        .setPosition(box.centerX, up ? box.top - 22 : box.bottom + 22)
        .setScale(0.85 + 0.15 * Math.abs(Math.sin(this.clock / 110)));
    } else {
      this.icon.setVisible(false);
    }
  }

  private flip(dir: 1 | -1, ctx: TrapContext): void {
    const player = ctx.player;
    if (player.gravityDir === dir) return;
    player.setGravityDir(dir);
    this.flips++;
    AudioManager.play('gravity');
    const b = player.bounds;
    ctx.fx.sparkle(b.centerX, b.centerY, 8);
    // A fall (into the sky or a pit) right after a flip is credited to gravity.
    ctx.triggered(this);
    if (dir < 0) ctx.sprung(this, 'gravity');
  }

  onRespawn(): void {
    // Player.respawn puts gravity back to normal; start tracking crossings fresh.
    this.prevX = null;
    this.icon.setVisible(false);
  }
}
