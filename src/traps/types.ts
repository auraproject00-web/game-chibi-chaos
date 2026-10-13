import type Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { FinishPortal } from '../entities/FinishPortal';
import type { DeathCause } from '../managers/DeathReactionManager';
import type { FxManager } from '../managers/FxManager';

/**
 * Troll trap configs, written in level data. All coordinates are in tiles. For things that
 * stand on the ground, `y` is the tile row of the ground surface (same rule as level data).
 * Every trap is deterministic: it always fires at the same spot, so it can be learned.
 */
export type TrapConfig =
  | FakeFloorConfig
  | SurpriseSpikesConfig
  | RunningPortalConfig
  | InvisibleWallConfig
  | BaitCoinConfig
  | ReverseControlsConfig
  | FakeCheckpointConfig
  | FallingPlatformConfig;

export type TrapType = TrapConfig['type'];

/** Every trap config may also set a stable `id` (default `<type>-<index>`). */
export type TrapConfigWithId = TrapConfig & { id?: string };

/** 1. Looks like ground, crumbles shortly after MOCHI lands on it. Tell: a small crack. */
export interface FakeFloorConfig {
  type: 'fakeFloor';
  x: number;
  y: number;
  w: number;
  h?: number;
  /** How long it wobbles before falling. Default 350ms. */
  delayMs?: number;
}

/** 2. Spikes hidden in the ground that pop up when MOCHI walks over them. */
export interface SurpriseSpikesConfig {
  type: 'surpriseSpikes';
  x: number;
  y: number;
  w: number;
  /** Player-center range (tiles) that pops them. Default: the span plus half a tile. */
  trigger?: { from: number; to: number };
}

/** 3. The finish portal runs away when MOCHI gets close. It never runs back. */
export interface RunningPortalConfig {
  type: 'runningPortal';
  /** Each hop fires once, in order, when the player center passes `triggerX`. */
  hops: { triggerX: number; x: number; y: number }[];
}

/** 4. A solid wall nobody can see until they bump into it. */
export interface InvisibleWallConfig {
  type: 'invisibleWall';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 5. A shiny coin. Grab it and the linked hidden spikes pop up a moment later. */
export interface BaitCoinConfig {
  type: 'baitCoin';
  /** Coin center tile. Put it above head height (y <= ground - 3) so only a jump grabs it. */
  x: number;
  y: number;
  /** Hidden spikes that pop when the coin is taken (ground surface row `y`). */
  spikes: { x: number; y: number; w: number };
  /** Delay between taking the coin and the spikes popping. Default 240ms. */
  delayMs?: number;
}

/** 6. A swirl pickup that swaps left and right for a few seconds. */
export interface ReverseControlsConfig {
  type: 'reverseControls';
  x: number;
  y: number;
  /** Default 3000ms. */
  durationMs?: number;
}

/** 7. Looks like a checkpoint (tell: a crooked pole) but never saves. */
export interface FakeCheckpointConfig {
  type: 'fakeCheckpoint';
  x: number;
  y: number;
  /** Optional hidden spikes that pop when the fake flag is touched. */
  spikes?: { x: number; w: number };
}

/** 8. A wooden plank that drops (carrying MOCHI) shortly after being stood on. */
export interface FallingPlatformConfig {
  type: 'fallingPlatform';
  x: number;
  y: number;
  w: number;
  /** Wobble time before it drops. Default 450ms. */
  delayMs?: number;
}

/** What a trap may touch in the running game. */
export interface TrapContext {
  readonly scene: Phaser.Scene;
  readonly fx: FxManager;
  readonly player: Player;
  readonly portal: FinishPortal;
  /** Kills MOCHI (no-op if already dead). `source` is the trap responsible, when there is one. */
  kill(cause?: DeathCause, source?: Trap): void;
  /**
   * A trap fired because of MOCHI (floor started crumbling, plank started wobbling). Lets a fall
   * that follows be credited to that trap instead of guessing from position.
   */
  triggered(source: Trap): void;
  /** Swaps left/right input for `ms` milliseconds. */
  reverseControls(ms: number): void;
}

export interface Trap {
  readonly type: TrapType;
  /** Stable id: the config's `id`, or `<type>-<index in the level's traps>`. Set by TrapFactory. */
  id: string;
  /** Horizontal world px range the trap covers (used to notice MOCHI getting past it). */
  readonly span?: { left: number; right: number };
  /** Static bodies that belong in the level's solid group. */
  readonly solids?: Phaser.GameObjects.GameObject[];
  /** Moving bodies that need their own collider with the player. */
  readonly bodies?: Phaser.GameObjects.GameObject[];
  /** Called every frame while MOCHI is alive, with MOCHI's hitbox. */
  update?(player: Phaser.Geom.Rectangle, ctx: TrapContext): void;
  /** Called when MOCHI collides with one of this trap's bodies. */
  onContact?(ctx: TrapContext): void;
  /** Called when MOCHI respawns. Traps that should be retried go back to their start state. */
  onRespawn?(): void;
}

/** Collision bodies point back at their trap through this data key. */
export const TRAP_DATA_KEY = 'trap';
