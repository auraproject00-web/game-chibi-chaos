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

export interface FakePlatformDef extends TileRect {
  /** How long it wobbles before falling. Default 350ms. */
  delayMs?: number;
}

export interface SpikeDef {
  x: number;
  y: number;
  w: number;
  /** Hidden spikes pop out of the ground when the player passes over them. */
  hidden?: boolean;
  /** Trigger range in tiles (player center). Defaults to the spike span plus half a tile. */
  trigger?: { from: number; to: number };
}

export interface PointDef {
  x: number;
  y: number;
}

export interface HintDef extends PointDef {
  text: string;
  /** Replacement text on touch devices. */
  touchText?: string;
}

export interface LevelData {
  id: number;
  name: string;
  /** Level size in tiles. */
  width: number;
  height: number;
  spawn: PointDef;
  solids: TileRect[];
  fakePlatforms?: FakePlatformDef[];
  spikes?: SpikeDef[];
  checkpoints?: PointDef[];
  finish: PointDef;
  hints?: HintDef[];
}
