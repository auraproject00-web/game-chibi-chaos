import type { LevelLines } from '../managers/trollLines';
import type { TrapConfigWithId } from '../traps/types';

/**
 * Data-driven level format. All coordinates are in tiles (see TILE in config.ts).
 * For objects that stand on the ground (spawn, spikes, checkpoints, finish, hints),
 * `y` is the tile row of the ground surface they stand on.
 */

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Always-visible spikes. Hidden ones are a trap: see `surpriseSpikes` in traps/types.ts. */
export interface SpikeDef {
  x: number;
  y: number;
  w: number;
}

export interface PointDef {
  x: number;
  y: number;
}

/** Controls the tutorial teaches. Once the player has shown a skill, its hint never returns. */
export type TutorialSkill = 'move' | 'jump' | 'highJump' | 'checkpoint';

export interface HintDef extends PointDef {
  text: string;
  /** Replacement text on touch devices. */
  touchText?: string;
  /**
   * Makes this a control hint: shown step by step (move, then jump, then high jump) and hidden
   * for good once the player has done it. Hints without `teach` just appear when MOCHI is near.
   */
  teach?: TutorialSkill;
}

/** Visual theme: platform style, backdrop and ambient particles. Default 'meadow'. */
export type LevelTheme = 'meadow' | 'candy' | 'illusion' | 'dimension';

/**
 * Scenery with no collision (Level 03's lying signs and its truth tells). `y` is the ground row.
 *  - `sign`: a tutorial-style board. Its text may lie; it never changes the level.
 *  - `sprouts`: mint sprouts over `w` tiles. They only grow on ground that is really there.
 *  - `holes`: tiny holes over `w` tiles, above spikes that sleep in the ground.
 */
export type DecorDef =
  | { kind: 'sign'; x: number; y: number; text: string }
  | { kind: 'sprouts'; x: number; y: number; w: number }
  | { kind: 'holes'; x: number; y: number; w: number };

export interface LevelData {
  id: number;
  name: string;
  theme?: LevelTheme;
  /** Level size in tiles. */
  width: number;
  height: number;
  spawn: PointDef;
  solids: TileRect[];
  spikes?: SpikeDef[];
  /**
   * Troll traps, built by traps/TrapFactory.ts. Introduce a few types per level, one at a time;
   * each must fire at the same spot every run so the player can learn it.
   */
  traps?: TrapConfigWithId[];
  checkpoints?: PointDef[];
  finish: PointDef;
  hints?: HintDef[];
  decor?: DecorDef[];
  /** Narrator lines only this level uses (per intensity and key), tried before the shared ones. */
  trollLines?: LevelLines;
}
