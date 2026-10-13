import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { SpikeTrap } from './SpikeTrap';
import type { BaitCoinConfig, Trap, TrapContext } from './types';

/**
 * Bait Coin: a shiny coin over a patch of ground. Grabbing it pops hidden spikes under it a
 * moment later. The coin and spikes reset on respawn; the safe play is to leave the coin alone.
 */
export class BaitCoinTrap implements Trap {
  readonly type = 'baitCoin';
  id = '';
  readonly spikes: SpikeTrap;
  readonly span;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly area: Phaser.Geom.Rectangle;
  private taken = false;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: BaitCoinConfig,
  ) {
    const cx = cfg.x * TILE + TILE / 2;
    const cy = cfg.y * TILE + TILE / 2;
    this.coin = scene.add.image(cx, cy, 'coin').setDepth(13);
    scene.tweens.add({ targets: this.coin, y: cy - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.coin, scaleX: 0.35, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.area = new Phaser.Geom.Rectangle(cx - 13, cy - 16, 26, 30);
    this.spikes = new SpikeTrap(scene, {
      x: cfg.spikes.x * TILE,
      surfaceY: cfg.spikes.y * TILE,
      tiles: cfg.spikes.w,
      hidden: true,
    });
    this.span = {
      left: Math.min(cfg.spikes.x, cfg.x) * TILE,
      right: Math.max(cfg.spikes.x + cfg.spikes.w, cfg.x + 1) * TILE,
    };
  }

  get isTaken(): boolean {
    return this.taken;
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (!this.taken && Phaser.Geom.Intersects.RectangleToRectangle(player, this.area)) this.take(ctx);
    if (this.spikes.hits(player)) ctx.kill('spike', this);
  }

  private take(ctx: TrapContext): void {
    this.taken = true;
    AudioManager.play('coin');
    ctx.fx.sparkle(this.coin.x, this.coin.y, 10);
    this.coin.setVisible(false);
    ctx.sprung(this);
    this.timer = this.scene.time.delayedCall(this.cfg.delayMs ?? 240, () => {
      this.spikes.reveal();
      ctx.fx.shake(120, 0.004);
      ctx.fx.pop(this.coin.x, this.coin.y - 30, 'Hehe!');
    });
  }

  onRespawn(): void {
    this.timer?.remove(false);
    this.timer = null;
    this.taken = false;
    this.coin.setVisible(true);
    this.spikes.hide();
  }
}
