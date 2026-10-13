import type { LevelData } from './types';

/**
 * Level 1 - "Hello Mochi!" (tutorial).
 * Teaches: move, jump, variable jump height, checkpoints, then introduces three troll traps
 * one at a time: Fake Floor, then Surprise Spikes (twice), then the Running Portal at the end.
 */
export const level01: LevelData = {
  id: 1,
  name: 'Hello Mochi!',
  width: 136,
  height: 17,
  spawn: { x: 3, y: 14 },
  solids: [
    // Section 1: flat ground, first small gap.
    { x: 0, y: 14, w: 22, h: 3 },
    { x: 25, y: 14, w: 16, h: 3 },
    // Steps that need a higher (held) jump.
    { x: 31, y: 12, w: 3, h: 2 },
    { x: 35, y: 10, w: 4, h: 4 },
    // Section 2: checkpoint, then the fake-platform pit.
    { x: 44, y: 14, w: 15, h: 3 },
    { x: 60, y: 12, w: 3, h: 1 },
    { x: 70, y: 12, w: 3, h: 1 },
    // Section 3: "safe" road with hidden spikes.
    { x: 75, y: 14, w: 20, h: 3 },
    // Section 4: visible spikes, final troll, portal.
    { x: 98, y: 14, w: 38, h: 3 },
    // Ledge the running portal escapes to.
    { x: 132, y: 12, w: 4, h: 2 },
  ],
  spikes: [{ x: 107, y: 14, w: 3 }],
  traps: [
    // Trap 1: Fake Floor in the middle of the pit (tell: crack). Keep moving and it is harmless.
    { type: 'fakeFloor', x: 65, y: 12, w: 3, delayMs: 350 },
    // Trap 2: Surprise Spikes on the "100% safe" road, then once more right before the portal.
    { type: 'surpriseSpikes', x: 84, y: 14, w: 3, trigger: { from: 83.6, to: 87.4 } },
    { type: 'surpriseSpikes', x: 124, y: 14, w: 2, trigger: { from: 123.6, to: 126.4 } },
    // Trap 3: the portal runs up onto the ledge when MOCHI gets close. It stays there after a death.
    { type: 'runningPortal', hops: [{ triggerX: 128.5, x: 134, y: 12 }] },
  ],
  checkpoints: [
    { x: 47, y: 14 },
    { x: 77, y: 14 },
    { x: 100, y: 14 },
  ],
  finish: { x: 130, y: 14 },
  hints: [
    { x: 4, y: 14, teach: 'move', text: 'A / D  atau  ← →  untuk jalan', touchText: 'Tahan ◀ ▶ di kiri bawah untuk jalan' },
    { x: 17, y: 14, teach: 'jump', text: 'Space / ↑  untuk lompat', touchText: 'Tap sisi kanan layar untuk lompat' },
    { x: 28, y: 14, teach: 'highJump', text: 'Tahan lompat = lompat lebih tinggi' },
    { x: 47, y: 14, teach: 'checkpoint', text: 'Bendera = checkpoint' },
  ],
};
