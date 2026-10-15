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
  | FallingPlatformConfig
  | MovingPlatformConfig
  | FakeFinishConfig
  | DecoyPortalConfig
  | MirrorPlatformConfig
  | MirrorPanelConfig
  | GhostMochiConfig
  | RealityShiftConfig
  | LieDoorConfig
  | GravityFlipConfig
  | DimensionConfig
  | ChaosChaseConfig
  | RealityCollapseConfig;

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
  /** Spike warning: tips peek out this long (harmless) before the spikes shoot up. Default 0. */
  warnMs?: number;
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

/**
 * 9. A candy wafer that slides back and forth between two spots at a steady speed (always the
 * same rhythm, so it can be learned). MOCHI rides along when standing on it.
 */
export interface MovingPlatformConfig {
  type: 'movingPlatform';
  /** Start position: left tile and the row of its top surface. */
  x: number;
  y: number;
  w: number;
  /** Second end of the path (same units as x/y). */
  toX: number;
  toY?: number;
  /** Speed in px per second. Default 80. */
  speed?: number;
  /** Pause at each end (ms). Default 500. */
  waitMs?: number;
}

/**
 * 10. A decoy finish portal that hops away when MOCHI gets close, then vanishes. The real portal
 * (the level's `finish`) stays hidden until MOCHI passes `revealX`. Progress is never undone.
 */
export interface FakeFinishConfig {
  type: 'fakeFinish';
  /** Where the decoy first stands (ground row). */
  x: number;
  y: number;
  /** Each hop fires once, in order, when the player center passes `triggerX`. */
  hops: { triggerX: number; x: number; y: number }[];
  /** Player center tile that makes the decoy vanish (after its last hop). */
  vanishX: number;
  /** Player center tile that reveals the real portal. */
  revealX: number;
}

/**
 * 11. A look-alike finish portal (tells: spins the other way, pink glow) that springs a surprise
 * when MOCHI's center passes `triggerX`. It never completes the level and resets on respawn.
 */
export interface DecoyPortalConfig {
  type: 'decoyPortal';
  /** Where it stands (ground row). */
  x: number;
  y: number;
  triggerX: number;
  /** `flee`: hops to `fleeTo` and vanishes, popping `spikes`. `drop`: its `floor` collapses. */
  effect: 'flee' | 'drop';
  fleeTo?: { x: number; y: number };
  /** Hidden spikes (row defaults to `y`). `delayMs` after the trigger, then `warnMs` of peeking. */
  spikes?: { x: number; y?: number; w: number; delayMs?: number; warnMs?: number };
  /** Cracked ground under the decoy, top at row `y`. It wobbles `delayMs` (default 250) and falls. */
  floor?: { x: number; w: number; h?: number; delayMs?: number };
}

/**
 * 12. Illusion platform (Mirror Maze). Looks like the level's ground but has no collision. Tell:
 * it always shimmers (soft alpha pulse and a light waver) while real ground stays perfectly still.
 * It shatters into sparkles when MOCHI passes through it, and is back on respawn.
 */
export interface MirrorPlatformConfig {
  type: 'mirrorPlatform';
  x: number;
  /** Row of its top surface. */
  y: number;
  w: number;
  /** Height in tiles. Default 1. */
  h?: number;
}

/** 13. A tall mirror (scenery). MOCHI's reflection shows in it while MOCHI walks past. */
export interface MirrorPanelConfig {
  type: 'mirrorPanel';
  /** Center tile and the ground row it stands on. */
  x: number;
  y: number;
}

/**
 * 14. Ghost Mochi. While MOCHI is between `fromX` and `toX`, a ghost replays MOCHI's own moves
 * exactly `delayMs` later. Plates are pressed by MOCHI or the ghost. A gate is open (and a
 * bridge solid) while its plate is pressed. The ghost never hurts and has no collision; it is
 * a recording of the sprite, so it never touches the real player controller. Cleared on respawn.
 */
export interface GhostMochiConfig {
  type: 'ghostMochi';
  fromX: number;
  toX: number;
  delayMs: number;
  /** Crystal at the start of the zone (ground row). */
  shrine: { x: number; y: number };
  /** `echoOnly` plates (Level 04 Time Echo) ignore MOCHI: only the ghost can press them. */
  plates: { x: number; y: number; w: number; echoOnly?: boolean }[];
  /** A light gate standing on row `y`, `h` tiles tall, opened by plate index `plate`. */
  gates: { x: number; y: number; h: number; plate: number }[];
  /** A crystal bridge with its top at row `y`, solid while plate index `plate` is pressed. */
  bridges: { x: number; y: number; w: number; plate: number }[];
  /** A gate or bridge about to close blinks this long before. */
  warnMs: number;
}

/**
 * 15. Reality Shift. Crystal platforms in two phases (0 = mint, 1 = pink) turn SOLID or PHANTOM
 * on one fixed cycle. Phase 0 is solid for `solidMs` from the start of each `periodMs`; phase 1
 * the same, half a period later (so both are solid for a moment at each change). A platform
 * about to vanish blinks for `warnMs`; one about to appear fills in. The clock restarts on
 * respawn, so every try plays the same. A platform never turns solid inside MOCHI.
 */
export interface RealityShiftConfig {
  type: 'realityShift';
  /** Sounds play only while MOCHI is in this range (tiles). */
  fromX: number;
  toX: number;
  periodMs: number;
  solidMs: number;
  warnMs: number;
  platforms: { x: number; y: number; w: number; phase: 0 | 1 }[];
  /** Phase lamps in the safe area, to read the rhythm before going. */
  lamps?: { x: number; y: number };
}

/**
 * 16. The Final Lie: a door. `trap` stands on an illusion floor (it shimmers) that drops MOCHI.
 * `warp` sends MOCHI back to `warpTo` (no death). `true` hides the level's real finish portal
 * and opens when MOCHI comes close. Labels may lie; the doors always behave the same.
 */
export interface LieDoorConfig {
  type: 'lieDoor';
  /** Door center tile and the row it stands on. */
  x: number;
  y: number;
  kind: 'trap' | 'warp' | 'true';
  label: string;
  /** `trap`: the illusion floor under the door (left tile and width). */
  floor?: { x: number; w: number };
  /** `warp`: where MOCHI lands (ground row). */
  warpTo?: { x: number; y: number };
}

/**
 * 17. Gravity gates (Level 04). Crossing a gate's column sets MOCHI's gravity to the gate's
 * `right` direction when moving right, and to the opposite when moving left, so walking back
 * always undoes it. A gate glows and an icon pops over MOCHI just before a flip. `spikes` hang
 * from ceilings (or stand on floors) in the gravity area; deaths on them count for this trap.
 * Gravity is always normal again on respawn.
 */
export interface GravityFlipConfig {
  type: 'gravityFlip';
  gates: { x: number; top: number; bottom: number; right: 'up' | 'down' }[];
  spikes?: { x: number; y: number; w: number; ceiling?: boolean }[];
  /** How close (tiles) MOCHI must be for the warning to show. */
  warnTiles: number;
}

export type Dimension = 'sweet' | 'glitch';

/**
 * 18. Dimension Switch (Level 04). Touching the crystal at `unlock` enables the action button.
 * Each press swaps Sweet <-> Glitch (after `cooldownMs`): blocks and spikes of the active
 * dimension are real, the others are faint outlines. A switch that would put MOCHI inside a
 * block or on spikes is cancelled with a "nope". The dimension is saved at each checkpoint and
 * restored on respawn.
 */
export interface DimensionConfig {
  type: 'dimension';
  unlock: { x: number; y: number };
  cooldownMs: number;
  /** Blocks with their top at row `y`. `h` in tiles; leave out for a thin slab. */
  blocks: { x: number; y: number; w: number; h?: number; dim: Dimension }[];
  spikes?: { x: number; y: number; w: number; dim: Dimension; ceiling?: boolean }[];
}

/**
 * 19. Chaos Chase (Level 04). When MOCHI's center passes `triggerX`, a chaos wave appears at
 * `startX` (warning for `warnMs`: rumble, siren, icon), then sweeps right at a fixed
 * `speedRatio` of MOCHI's top speed until `endX`, where it dissolves. Touching it is a death.
 * It resets on respawn. Never random: same start, same speed, every try.
 */
export interface ChaosChaseConfig {
  type: 'chaosChase';
  triggerX: number;
  startX: number;
  endX: number;
  speedRatio: number;
  warnMs: number;
}

/**
 * 20. Reality Collapse (Level 04). Story beats: when MOCHI passes `triggerX` the world cracks
 * (rumble, light crack overlay, narrator); passing `finishX` makes the narrator react to the
 * finish. Purely presentational: it never kills.
 */
export interface RealityCollapseConfig {
  type: 'realityCollapse';
  triggerX: number;
  finishX: number;
}

/** State of the level's action button (null when the level has none yet). */
export interface ActionInfo {
  mode: Dimension;
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
  /**
   * A trap went off without killing anyone (coin grabbed, fake flag touched, decoy portal gone).
   * The narrator may comment. `key` picks the line set (defaults to the trap type).
   */
  sprung(source: Trap, key?: string): void;
  /** Shows, updates or hides the HUD action button (Level 04 dimension switch). */
  setAction(info: ActionInfo | null): void;
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
  /** Called once after the level is built, before the first frame. */
  init?(ctx: TrapContext): void;
  /** Called every frame while MOCHI is alive, with MOCHI's hitbox. */
  update?(player: Phaser.Geom.Rectangle, ctx: TrapContext): void;
  /** Called when MOCHI collides with one of this trap's bodies. */
  onContact?(ctx: TrapContext): void;
  /** Called when MOCHI respawns. Traps that should be retried go back to their start state. */
  onRespawn?(): void;
  /** Called when MOCHI activates a checkpoint (save what respawn should restore). */
  onCheckpoint?(): void;
  /** Called when the action button/key is pressed. */
  onAction?(ctx: TrapContext): void;
}

/** Collision bodies point back at their trap through this data key. */
export const TRAP_DATA_KEY = 'trap';
