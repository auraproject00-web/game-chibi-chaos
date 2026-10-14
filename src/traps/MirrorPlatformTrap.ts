import Phaser from 'phaser';
import { TILE } from '../config';
import { IllusionPlatform } from './IllusionPlatform';
import type { MirrorPlatformConfig, Trap, TrapContext } from './types';

/**
 * Mirror Maze illusion platform: real-looking but made of light (tell: it always shimmers).
 * MOCHI falls through and it shatters; a fall right after is credited to it. Back on respawn.
 */
export class MirrorPlatformTrap implements Trap {
  readonly type = 'mirrorPlatform';
  id = '';
  readonly span;
  private readonly plat: IllusionPlatform;

  constructor(scene: Phaser.Scene, cfg: MirrorPlatformConfig) {
    this.plat = new IllusionPlatform(scene, cfg.x * TILE, cfg.y * TILE, cfg.w * TILE, (cfg.h ?? 1) * TILE);
    this.span = { left: cfg.x * TILE, right: (cfg.x + cfg.w) * TILE };
  }

  get isBroken(): boolean {
    return this.plat.isBroken;
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (this.plat.touches(player)) {
      this.plat.shatter(ctx.fx);
      ctx.triggered(this);
    }
  }

  onRespawn(): void {
    this.plat.reset();
  }
}
