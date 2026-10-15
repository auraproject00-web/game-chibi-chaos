import { BaitCoinTrap } from './BaitCoinTrap';
import { ChaosChaseTrap } from './ChaosChaseTrap';
import { DimensionTrap } from './DimensionTrap';
import { GravityFlipTrap } from './GravityFlipTrap';
import { RealityCollapseTrap } from './RealityCollapseTrap';
import { DecoyPortalTrap } from './DecoyPortalTrap';
import { FakeCheckpointTrap } from './FakeCheckpointTrap';
import { FakeFinishTrap } from './FakeFinishTrap';
import { FakeFloorTrap } from './FakeFloorTrap';
import { FallingPlatformTrap } from './FallingPlatformTrap';
import { GhostMochiTrap } from './GhostMochiTrap';
import { LieDoorTrap } from './LieDoorTrap';
import { MirrorPanelTrap } from './MirrorPanelTrap';
import { MirrorPlatformTrap } from './MirrorPlatformTrap';
import { RealityShiftTrap } from './RealityShiftTrap';
import { InvisibleWallTrap } from './InvisibleWallTrap';
import { MovingPlatformTrap } from './MovingPlatformTrap';
import { ReverseControlsTrap } from './ReverseControlsTrap';
import { RunningPortalTrap } from './RunningPortalTrap';
import { SurpriseSpikesTrap } from './SurpriseSpikesTrap';
import type { Trap, TrapConfig, TrapConfigWithId } from './types';

/** Builds a trap from its config. Add new trap types here and in types.ts. */
export function createTrap(scene: Phaser.Scene, cfg: TrapConfigWithId, index: number): Trap {
  const trap = build(scene, cfg);
  trap.id = cfg.id ?? `${cfg.type}-${index}`;
  return trap;
}

function build(scene: Phaser.Scene, cfg: TrapConfig): Trap {
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
    case 'movingPlatform':
      return new MovingPlatformTrap(scene, cfg);
    case 'fakeFinish':
      return new FakeFinishTrap(scene, cfg);
    case 'decoyPortal':
      return new DecoyPortalTrap(scene, cfg);
    case 'mirrorPlatform':
      return new MirrorPlatformTrap(scene, cfg);
    case 'mirrorPanel':
      return new MirrorPanelTrap(scene, cfg);
    case 'ghostMochi':
      return new GhostMochiTrap(scene, cfg);
    case 'realityShift':
      return new RealityShiftTrap(scene, cfg);
    case 'lieDoor':
      return new LieDoorTrap(scene, cfg);
    case 'gravityFlip':
      return new GravityFlipTrap(scene, cfg);
    case 'dimension':
      return new DimensionTrap(scene, cfg);
    case 'chaosChase':
      return new ChaosChaseTrap(scene, cfg);
    case 'realityCollapse':
      return new RealityCollapseTrap(scene, cfg);
  }
}
