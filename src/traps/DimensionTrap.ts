import Phaser from 'phaser';
import { TILE } from '../config';
import { DIM_LINE, DIM_TINT, dimBlockTexture, dimOutlineTexture } from '../art/dimensionTextures';
import { SLAB_H } from '../art/illusionTextures';
import { AudioManager } from '../managers/AudioManager';
import { SpikeTrap } from './SpikeTrap';
import { TRAP_DATA_KEY, type Dimension, type DimensionConfig, type Trap, type TrapContext } from './types';

interface Block {
  zone: Phaser.GameObjects.Zone;
  img: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  dim: Dimension;
  rect: Phaser.Geom.Rectangle;
}

interface DimSpike {
  spike: SpikeTrap;
  dim: Dimension;
}

/** Glitch dimension screen tint: light, so the world stays readable. */
const GLITCH_OVERLAY = { color: 0x7f8cff, alpha: 0.1 };
/** How late in the cooldown a press is remembered (ms); quicker double taps are still ignored. */
const BUFFER_MS = 150;

/**
 * Dimension Switch (Level 04, Zones 2, 4 and 5). Two dimensions share the level: Sweet and
 * Glitch. Blocks and spikes belong to one of them; only the active dimension's are real, the
 * other's show as faint outlines so the player can plan. The action button swaps dimensions.
 * A swap that would put MOCHI inside a block or on spikes is cancelled (with a "nope"), so a
 * switch can never trap or kill MOCHI by itself. The dimension is saved at checkpoints.
 */
export class DimensionTrap implements Trap {
  readonly type = 'dimension';
  id = '';
  readonly span;
  readonly solids: Phaser.GameObjects.Zone[] = [];
  private readonly blocks: Block[];
  private readonly spikes: DimSpike[];
  private readonly crystal: Phaser.GameObjects.Image;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly nope: Phaser.GameObjects.Image;
  private dim: Dimension = 'sweet';
  private savedDim: Dimension = 'sweet';
  private unlocked = false;
  private cooldown = 0;
  /** A press in the last moments of the cooldown is kept and played when it ends. */
  private buffered = 0;
  private lastNope = false;
  private clock = 0;
  private switches = 0;
  private cancels = 0;
  private ctx: TrapContext | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: DimensionConfig,
  ) {
    this.blocks = cfg.blocks.map((b) => {
      const w = b.w * TILE;
      const h = b.h ? b.h * TILE : SLAB_H;
      const left = b.x * TILE;
      const top = b.y * TILE;
      const zone = scene.add.zone(left + w / 2, top + h / 2, w, h);
      scene.physics.add.existing(zone, true);
      zone.setData(TRAP_DATA_KEY, this);
      this.solids.push(zone);
      const img = scene.add.image(left, top, dimBlockTexture(scene, w, h)).setOrigin(0).setDepth(10).setTint(DIM_TINT[b.dim]);
      const outline = scene.add.image(left, top, dimOutlineTexture(scene, w, h)).setOrigin(0).setDepth(10).setTint(DIM_LINE[b.dim]);
      return { zone, img, outline, dim: b.dim, rect: new Phaser.Geom.Rectangle(left, top, w, h) };
    });
    this.spikes = (cfg.spikes ?? []).map((s) => {
      const spike = new SpikeTrap(scene, { x: s.x * TILE, surfaceY: s.y * TILE, tiles: s.w, hidden: false, ceiling: s.ceiling });
      return { spike, dim: s.dim };
    });
    this.crystal = scene.add
      .image(cfg.unlock.x * TILE + TILE / 2, cfg.unlock.y * TILE + 2, 'dim_crystal')
      .setOrigin(0.5, 1)
      .setDepth(9);
    scene.tweens.add({ targets: this.crystal, y: this.crystal.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const { width, height } = scene.scale;
    this.overlay = scene.add
      .rectangle(width / 2, height / 2, width * 4, height * 4, GLITCH_OVERLAY.color, GLITCH_OVERLAY.alpha)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false);
    this.nope = scene.add.image(0, 0, 'nope_x').setDepth(24).setVisible(false);

    const xs = [...cfg.blocks.map((b) => b.x), ...(cfg.spikes ?? []).map((s) => s.x), cfg.unlock.x];
    const xe = [...cfg.blocks.map((b) => b.x + b.w), ...(cfg.spikes ?? []).map((s) => s.x + s.w), cfg.unlock.x + 1];
    this.span = { left: Math.min(...xs) * TILE, right: Math.max(...xe) * TILE };
    this.apply();
  }

  // ----- Tests and debugging -----

  get current(): Dimension {
    return this.dim;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  get stats(): { switches: number; cancels: number; saved: Dimension } {
    return { switches: this.switches, cancels: this.cancels, saved: this.savedDim };
  }

  // ----- Lifecycle -----

  init(ctx: TrapContext): void {
    this.ctx = ctx;
    // Started past the crystal (dev checkpoint jump): the switch is already learned.
    if (ctx.player.bounds.centerX >= this.cfg.unlock.x * TILE) this.unlock(ctx, false);
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const dt = Math.min(this.scene.game.loop.delta, 50);
    this.clock += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.buffered > 0) {
      this.buffered -= dt;
      if (this.cooldown <= 0) {
        this.buffered = 0;
        this.onAction(ctx);
      }
    }
    if (!this.unlocked && box.centerX >= this.cfg.unlock.x * TILE) this.unlock(ctx, true);
    for (const s of this.spikes) {
      if (s.dim === this.dim && s.spike.hits(box)) {
        ctx.kill('spike', this);
        return;
      }
    }
    // Dropping through a block of the other dimension: a fall that follows is credited here.
    if (!ctx.player.onGround) {
      for (const b of this.blocks) {
        const r = b.rect;
        if (b.dim !== this.dim && box.right > r.left && box.left < r.right && box.bottom >= r.top - 4 && box.top < r.bottom + 64) {
          ctx.triggered(this);
          break;
        }
      }
    }
  }

  private unlock(ctx: TrapContext, fanfare: boolean): void {
    this.unlocked = true;
    this.crystal.setAlpha(0.45);
    if (fanfare) {
      AudioManager.play('dimension');
      ctx.fx.sparkle(this.crystal.x, this.crystal.y - 36, 16);
    }
    ctx.setAction({ mode: this.dim });
  }

  onAction(ctx: TrapContext): void {
    if (!this.unlocked) return;
    if (this.cooldown > 0) {
      // Late press (not a quick double tap, not after a "nope"): switch as soon as the cooldown ends.
      if (!this.lastNope && this.cooldown <= BUFFER_MS) this.buffered = BUFFER_MS;
      return;
    }
    const next: Dimension = this.dim === 'sweet' ? 'glitch' : 'sweet';
    const box = ctx.player.bounds;
    // Never switch MOCHI into a block or onto spikes: cancel with a clear "nope" instead.
    const inner = new Phaser.Geom.Rectangle(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    const blocked =
      this.blocks.some((b) => b.dim === next && Phaser.Geom.Intersects.RectangleToRectangle(inner, b.rect)) ||
      this.spikes.some((s) => s.dim === next && s.spike.hits(box));
    if (blocked) {
      this.cancels++;
      this.cooldown = 180;
      this.lastNope = true;
      AudioManager.play('dimNope');
      this.scene.tweens.killTweensOf(this.nope);
      this.nope.setVisible(true).setAlpha(1).setScale(0.6).setPosition(box.centerX, ctx.player.gravityDir > 0 ? box.top - 20 : box.bottom + 20);
      this.scene.tweens.add({ targets: this.nope, scale: 1, duration: 120, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.nope, alpha: 0, delay: 380, duration: 200, onComplete: () => this.nope.setVisible(false) });
      return;
    }
    this.dim = next;
    this.lastNope = false;
    this.switches++;
    this.cooldown = this.cfg.cooldownMs;
    this.apply();
    AudioManager.play('dimension');
    // One soft flash per switch (never strobing: the cooldown spaces them out).
    const c = Phaser.Display.Color.IntegerToColor(DIM_TINT[next]);
    this.scene.cameras.main.flash(140, c.red, c.green, c.blue, true);
    ctx.fx.sparkle(box.centerX, box.centerY, 6);
    // A fall right after a switch is credited to the dimension.
    ctx.triggered(this);
    ctx.setAction({ mode: this.dim });
  }

  /** Makes the active dimension's blocks solid and real-looking, the other's faint. */
  private apply(): void {
    const glitch = this.dim === 'glitch';
    for (const b of this.blocks) {
      const on = b.dim === this.dim;
      (b.zone.body as Phaser.Physics.Arcade.StaticBody).enable = on;
      b.img.setAlpha(on ? 1 : 0.14);
      b.outline.setAlpha(on ? 0 : 0.85);
    }
    for (const s of this.spikes) s.spike.setAlpha(s.dim === this.dim ? 1 : 0.18);
    this.overlay.setVisible(glitch);
  }

  onContact(ctx: TrapContext): void {
    // Standing on a dimension block: a fall right after is credited to the dimension.
    ctx.triggered(this);
  }

  onCheckpoint(): void {
    this.savedDim = this.dim;
  }

  onRespawn(): void {
    this.dim = this.savedDim;
    this.cooldown = 0;
    this.buffered = 0;
    this.nope.setVisible(false);
    this.apply();
    if (this.unlocked) this.ctx?.setAction({ mode: this.dim });
  }
}
