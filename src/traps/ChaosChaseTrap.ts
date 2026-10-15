import Phaser from 'phaser';
import { PLAYER, TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import type { ChaosChaseConfig, Trap, TrapContext } from './types';

type ChaseState = 'idle' | 'warning' | 'running' | 'done';

/** Px of overlap with the wave front that still counts as a near miss (forgiving edge). */
const EDGE_GRACE = 6;
const WAVE_W = 520;

/**
 * Chaos Chase (Level 04, Zone 4). A wall of glitchy chaos that chases MOCHI. Passing `triggerX`
 * starts a warning (rumble, siren, warning icon, the wave fades in at `startX`), then the wave
 * sweeps right at a fixed fraction of MOCHI's real top speed. It has its own clock (no timers),
 * so a respawn simply puts it back to idle; the next try plays exactly the same.
 */
export class ChaosChaseTrap implements Trap {
  readonly type = 'chaosChase';
  id = '';
  readonly span;
  private state: ChaseState = 'idle';
  private t = 0;
  private front: number;
  private readonly speed: number;
  private readonly body: Phaser.GameObjects.TileSprite;
  private readonly edge: Phaser.GameObjects.TileSprite;
  private readonly icon: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: ChaosChaseConfig,
  ) {
    this.speed = cfg.speedRatio * PLAYER.maxSpeed;
    this.front = cfg.startX * TILE;
    const h = 2000;
    this.body = scene.add.tileSprite(0, -400, WAVE_W, h, 'chaos_tile').setOrigin(1, 0).setDepth(30).setVisible(false);
    this.edge = scene.add.tileSprite(0, -400, 40, h, 'chaos_edge').setOrigin(0, 0).setDepth(30).setVisible(false);
    this.icon = scene.add.image(0, 0, 'warn_icon').setDepth(24).setVisible(false);
    this.span = { left: cfg.startX * TILE, right: cfg.endX * TILE };
  }

  // ----- Tests and debugging -----

  get chaseState(): ChaseState {
    return this.state;
  }

  get frontX(): number {
    return this.front;
  }

  get speedPx(): number {
    return this.speed;
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const dt = Math.min(this.scene.game.loop.delta, 50);
    if (this.state === 'idle') {
      if (box.centerX >= this.cfg.triggerX * TILE && box.centerX < this.cfg.endX * TILE) this.start(ctx);
      return;
    }
    if (this.state === 'done') return;
    this.t += dt;
    if (this.state === 'warning') {
      const k = Math.min(1, this.t / this.cfg.warnMs);
      this.draw(0.35 + 0.55 * k);
      const blink = Math.floor(this.t / 120) % 2 === 0;
      this.icon.setVisible(blink).setPosition(box.centerX, ctx.player.gravityDir > 0 ? box.top - 24 : box.bottom + 24);
      if (this.t >= this.cfg.warnMs) {
        this.state = 'running';
        this.t = 0;
        this.icon.setVisible(false);
        AudioManager.play('chase');
      }
    } else {
      this.front += (this.speed * dt) / 1000;
      if (this.front >= this.cfg.endX * TILE) {
        this.finish(ctx);
        return;
      }
      this.draw(1);
      if (box.left < this.front - EDGE_GRACE) {
        ctx.kill('trap', this);
        return;
      }
    }
  }

  private start(ctx: TrapContext): void {
    this.state = 'warning';
    this.t = 0;
    this.front = this.cfg.startX * TILE;
    this.body.setVisible(true);
    this.edge.setVisible(true);
    this.draw(0.35);
    AudioManager.play('chaseWarn');
    this.scene.cameras.main.shake(this.cfg.warnMs, 0.0035);
    ctx.sprung(this, 'chase');
  }

  private draw(alpha: number): void {
    this.body.setPosition(this.front, -400).setAlpha(alpha);
    this.edge.setPosition(this.front, -400).setAlpha(alpha);
    // Shimmer: the pattern drifts so the wave looks alive (visual only).
    this.body.tilePositionY -= 1.6;
    this.edge.tilePositionY += 2.2;
  }

  private finish(ctx: TrapContext): void {
    this.state = 'done';
    this.icon.setVisible(false);
    this.scene.tweens.add({ targets: [this.body, this.edge], alpha: 0, duration: 400, onComplete: () => this.hide() });
    ctx.fx.sparkle(this.cfg.endX * TILE, ctx.player.bounds.centerY, 18);
  }

  private hide(): void {
    this.body.setVisible(false);
    this.edge.setVisible(false);
  }

  onRespawn(): void {
    this.scene.tweens.killTweensOf([this.body, this.edge]);
    this.state = 'idle';
    this.t = 0;
    this.front = this.cfg.startX * TILE;
    this.icon.setVisible(false);
    this.hide();
  }
}
