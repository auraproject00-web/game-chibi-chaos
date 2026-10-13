import { level01 } from './level01';
import { trapLab } from './trapLab';
import type { LevelData } from './types';

/** Planned level count (shown in level select). Only levels present in LEVELS are playable. */
export const PLANNED_LEVELS = 10;

/** Register new levels here. Order = progression. */
export const LEVELS: LevelData[] = [level01];

/** Dev-only levels: reachable by id, never listed in level select. */
const DEV_LEVELS: LevelData[] = import.meta.env.DEV ? [trapLab] : [];

export function getLevel(id: number): LevelData | undefined {
  return LEVELS.find((l) => l.id === id) ?? DEV_LEVELS.find((l) => l.id === id);
}

export function hasLevel(id: number): boolean {
  return LEVELS.some((l) => l.id === id);
}
