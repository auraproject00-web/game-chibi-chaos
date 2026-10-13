import { TILE } from '../config';
import { SpikeTrap } from './SpikeTrap';
import type { SurpriseSpikesConfig, Trap, TrapContext } from './types';

/** Surprise Spikes: hidden in the ground, pop up under MOCHI, then stay visible for good. */
export class SurpriseSpikesTrap implements Trap {
  readonly type = 'surpriseSpikes';
  id = '';
  readonly spikes: SpikeTrap;
  readonly span;

  constructor(scene: Phaser.Scene, cfg: SurpriseSpikesConfig) {
    this.spikes = new SpikeTrap(scene, {
      x: cfg.x * TILE,
      surfaceY: cfg.y * TILE,
      tiles: cfg.w,
      hidden: true,
      triggerFrom: (cfg.trigger?.from ?? cfg.x - 0.5) * TILE,
      triggerTo: (cfg.trigger?.to ?? cfg.x + cfg.w + 0.5) * TILE,
    });
    this.span = { left: cfg.x * TILE, right: (cfg.x + cfg.w) * TILE };
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (this.spikes.update(player)) ctx.fx.shake(120, 0.004);
    if (this.spikes.hits(player)) ctx.kill('spike', this);
  }
}
