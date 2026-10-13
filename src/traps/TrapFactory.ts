import { BaitCoinTrap } from './BaitCoinTrap';
import { FakeCheckpointTrap } from './FakeCheckpointTrap';
import { FakeFloorTrap } from './FakeFloorTrap';
import { FallingPlatformTrap } from './FallingPlatformTrap';
import { InvisibleWallTrap } from './InvisibleWallTrap';
import { ReverseControlsTrap } from './ReverseControlsTrap';
import { RunningPortalTrap } from './RunningPortalTrap';
import { SurpriseSpikesTrap } from './SurpriseSpikesTrap';
import type { Trap, TrapConfig } from './types';

/** Builds a trap from its config. Add new trap types here and in types.ts. */
export function createTrap(scene: Phaser.Scene, cfg: TrapConfig): Trap {
  switch (cfg.type) {
    case 'fakeFloor':
      return new FakeFloorTrap(scene, cfg);
    case 'surpriseSpikes':
      return new SurpriseSpikesTrap(scene, cfg);
    case 'runningPortal':
      return new RunningPortalTrap(cfg);
    case 'invisibleWall':
      return new InvisibleWallTrap(scene, cfg);
    case 'baitCoin':
      return new BaitCoinTrap(scene, cfg);
    case 'reverseControls':
      return new ReverseControlsTrap(scene, cfg);
    case 'fakeCheckpoint':
      return new FakeCheckpointTrap(scene, cfg);
    case 'fallingPlatform':
      return new FallingPlatformTrap(scene, cfg);
  }
}
