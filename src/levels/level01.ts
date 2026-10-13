import type { LevelData } from './types';

/**
 * Level 1 - "Hello Mochi!" (tutorial).
 * Teaches: move, jump, variable jump height, checkpoints, then introduces the two
 * troll traps (a fake platform and hidden spikes) in a forgiving way.
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
  ],
  fakePlatforms: [{ x: 65, y: 12, w: 3, h: 1, delayMs: 350 }],
  spikes: [
    { x: 84, y: 14, w: 3, hidden: true, trigger: { from: 83.6, to: 87.4 } },
    { x: 107, y: 14, w: 3 },
    { x: 124, y: 14, w: 2, hidden: true, trigger: { from: 123.6, to: 126.4 } },
  ],
  checkpoints: [
    { x: 47, y: 14 },
    { x: 77, y: 14 },
    { x: 100, y: 14 },
  ],
  finish: { x: 131, y: 14 },
  hints: [
    { x: 7, y: 14, text: 'A / D  atau  ← →  untuk bergerak', touchText: 'Tahan tombol kiri bawah untuk bergerak' },
    { x: 17, y: 14, text: 'Space / ↑  untuk lompat', touchText: 'Tap di mana saja di sisi kanan untuk lompat' },
    { x: 28, y: 14, text: 'Tahan lompat lebih lama = lompat lebih tinggi!' },
    { x: 47, y: 14, text: 'Bendera = checkpoint. Jatuh? Balik ke sini!' },
    { x: 55, y: 14, text: 'Tidak semua tanah bisa dipercaya...' },
    { x: 80, y: 14, text: 'Jalan ini 100% aman :)' },
    { x: 116, y: 14, text: 'Portal di depan! Lurus aja :)' },
  ],
};
