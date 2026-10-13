import type { LevelData } from './types';

/**
 * Dev-only test level with one of each troll trap in a row, for checking them in isolation.
 * Registered only in dev builds (see index.ts); open with `?traplab` in the URL.
 */
export const trapLab: LevelData = {
  id: 99,
  name: 'Trap Lab',
  width: 104,
  height: 17,
  spawn: { x: 2, y: 14 },
  solids: [
    { x: 0, y: 14, w: 8, h: 3 },
    { x: 12, y: 14, w: 50, h: 3 },
    { x: 70, y: 14, w: 34, h: 3 },
  ],
  checkpoints: [{ x: 74, y: 14 }],
  finish: { x: 88, y: 14 },
  traps: [
    { type: 'fakeFloor', x: 8, y: 14, w: 4 },
    { type: 'surpriseSpikes', x: 17, y: 14, w: 2 },
    { type: 'invisibleWall', x: 24, y: 11, w: 1, h: 3 },
    { type: 'baitCoin', x: 32, y: 11, spikes: { x: 31, y: 14, w: 3 } },
    { type: 'reverseControls', x: 40, y: 14, durationMs: 3000 },
    { type: 'fakeCheckpoint', x: 52, y: 14, spikes: { x: 54, w: 2 } },
    { type: 'fallingPlatform', x: 64, y: 13, w: 3 },
    { type: 'runningPortal', hops: [{ triggerX: 85, x: 96, y: 14 }] },
  ],
};
