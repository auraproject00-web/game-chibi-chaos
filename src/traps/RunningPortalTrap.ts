import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import type { RunningPortalConfig, Trap, TrapContext } from './types';

/**
 * Running Portal: the finish portal hops away when MOCHI gets close. Each hop happens once and
 * the portal never comes back, so dying does not undo the progress.
 */
export class RunningPortalTrap implements Trap {
  readonly type = 'runningPortal';
  private next = 0;

  constructor(private readonly cfg: RunningPortalConfig) {}

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const hop = this.cfg.hops[this.next];
    if (!hop || player.centerX < hop.triggerX * TILE) return;
    this.next += 1;
    const from = ctx.portal.center.clone();
    ctx.portal.runTo(ctx.scene, hop.x * TILE + TILE / 2, hop.y * TILE);
    AudioManager.play('whoosh');
    ctx.fx.sparkle(from.x, from.y, 10);
    ctx.fx.pop(from.x, from.y - 50, 'Hehe!');
  }
}
