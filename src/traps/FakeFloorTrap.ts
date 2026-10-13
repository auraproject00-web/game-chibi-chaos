import { TILE } from '../config';
import { FakePlatform } from './FakePlatform';
import { TRAP_DATA_KEY, type FakeFloorConfig, type Trap, type TrapContext } from './types';

/** Fake Floor: crumbles shortly after MOCHI lands on it, comes back on respawn. */
export class FakeFloorTrap implements Trap {
  readonly type = 'fakeFloor';
  readonly solids;
  private readonly platform: FakePlatform;

  constructor(scene: Phaser.Scene, cfg: FakeFloorConfig) {
    this.platform = new FakePlatform(scene, cfg.x * TILE, cfg.y * TILE, cfg.w * TILE, (cfg.h ?? 1) * TILE, cfg.delayMs ?? 350);
    this.platform.zone.setData(TRAP_DATA_KEY, this);
    this.solids = [this.platform.zone];
  }

  onContact(ctx: TrapContext): void {
    // Only standing on top counts, not bumping the side.
    if (ctx.player.body.bottom <= this.platform.top + 4) this.platform.trigger();
  }

  onRespawn(): void {
    this.platform.reset();
  }
}
