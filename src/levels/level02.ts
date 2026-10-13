import type { LevelData } from './types';

/**
 * Level 2 - "Trust Issues" (Candy Meadow).
 * Five parts, each built around one lesson, every trap firing at the same spot every run:
 *  1. Intro: warm-up hops, then one fake floor (tell: crack) to jump across.
 *  2. Bait coin: a coin floating at jump height. Walking under it is safe; grabbing it pops
 *     spikes underneath. Then a row of visible spikes to hop.
 *  3. Fake checkpoint: a real flag first (so its look is known), then a crooked fake one that
 *     pops spikes right after it. A real flag follows; the fake one never saves.
 *  4. Moving platforms: two candy wafers with a steady rhythm and an island with hidden spikes
 *     in its middle (land on the left part, hop to the right part), then hidden spikes on the road.
 *  5. Fake finish: the "finish" portal runs away twice and vanishes; the real one appears only
 *     after the last row of spikes is cleared.
 */
export const level02: LevelData = {
  id: 2,
  name: 'Trust Issues',
  theme: 'candy',
  width: 200,
  height: 17,
  spawn: { x: 3, y: 14 },
  solids: [
    // 1. Intro.
    { x: 0, y: 14, w: 20, h: 3 },
    { x: 23, y: 14, w: 10, h: 3 },
    { x: 34, y: 12, w: 2, h: 1 },
    { x: 37, y: 14, w: 10, h: 3 },
    // (fake floor 47–51 bridges to here)
    // 2. Bait coin.
    { x: 51, y: 14, w: 31, h: 3 },
    // 3. Fake checkpoint.
    { x: 85, y: 14, w: 27, h: 3 },
    // 4. Moving platforms: island between the two wafers, then the landing road.
    { x: 123, y: 13, w: 8, h: 4 },
    { x: 141, y: 14, w: 28, h: 3 },
    // 5. Fake finish: step and ledge where the decoy makes its last stand, then the final road.
    { x: 172, y: 14, w: 8, h: 3 },
    { x: 177, y: 12, w: 2, h: 2 },
    { x: 180, y: 11, w: 5, h: 6 },
    { x: 185, y: 14, w: 15, h: 3 },
  ],
  spikes: [
    { x: 70, y: 14, w: 2 },
    { x: 189, y: 14, w: 2 },
  ],
  traps: [
    // 1. One fake floor in the ground itself. It drops fast, so walking across falls; jump to its far
    //    end (or past it) and keep running.
    { id: 'introFakeFloor', type: 'fakeFloor', x: 47, y: 14, w: 4, h: 3, delayMs: 200 },
    // 2. Bait coin above the road. Hidden spikes cover the ground right under it.
    { id: 'baitCoin', type: 'baitCoin', x: 61, y: 11, spikes: { x: 60, y: 14, w: 3 } },
    // 3. Crooked flag; touching it pops spikes two tiles ahead. It stays exposed after a death.
    { id: 'fakeCheckpoint', type: 'fakeCheckpoint', x: 96, y: 14, spikes: { x: 98, w: 2 } },
    // 4. Wafer 1 shuttles over the first pit, wafer 2 over the second.
    { id: 'wafer1', type: 'movingPlatform', x: 113, y: 13, w: 3, toX: 118, speed: 80, waitMs: 600 },
    { id: 'islandSpikes', type: 'surpriseSpikes', x: 126, y: 13, w: 2, trigger: { from: 125.9, to: 128.4 } },
    { id: 'wafer2', type: 'movingPlatform', x: 132, y: 13, w: 3, toX: 137, speed: 90, waitMs: 500 },
    { id: 'roadSpikes', type: 'surpriseSpikes', x: 145, y: 14, w: 2 },
    // 5. Decoy portal: hops at 154 and 163.5, vanishes at 179; the real one appears past 191.5.
    {
      id: 'fakeFinish',
      type: 'fakeFinish',
      x: 158,
      y: 14,
      hops: [
        { triggerX: 154, x: 167, y: 14 },
        { triggerX: 163.5, x: 182, y: 11 },
      ],
      vanishX: 179,
      revealX: 191.5,
    },
  ],
  checkpoints: [
    { x: 53, y: 14 },
    { x: 87, y: 14 },
    { x: 108, y: 14 },
    { x: 150, y: 14 },
  ],
  finish: { x: 197, y: 14 },
};
