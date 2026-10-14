import type { TrapConfigWithId } from '../traps/types';
import type { DecorDef, LevelData, PointDef, SpikeDef, TileRect } from './types';

/**
 * Level 3 - "The Game Is Lying" (Illusion World), Nightmare 8.5/10.
 * "Don't trust what the game tells you. Trust what you learn."
 *
 * Tells the level teaches and never breaks:
 *  - signs may lie; mint sprouts only grow on ground that is really there;
 *  - tiny holes in the ground mean spikes sleep under it;
 *  - anything that shimmers (alpha pulse, light waver) is an illusion with no collision.
 *
 * MOCHI's reach (PLAYER in config.ts, unchanged): horizontal travel of the hitbox center in a full
 * jump is 5.26 tiles on the flat, 4.84 one row up, 4.30 two rows up, 3.50 three rows up. A gap of
 * G tiles needs about G + 0.5. Every jump below keeps at least 0.75 tile spare (most keep 1+).
 *
 * Every number a designer may want to tune is in `L3`.
 */
export const L3 = {
  // Zone 1: the "safe path" bridge crumbles this fast; the "rest here" spikes peek this long.
  bridgeDelayMs: 150,
  restSpikeWarnMs: 220,
  // Zone 3: the ghost replays MOCHI this many ms later. Gates/bridges blink this long before closing.
  ghostDelayMs: 1500,
  ghostWarnMs: 450,
  // Zone 4: one cycle; each phase is solid `shiftSolidMs` of it (both overlap at each change).
  shiftPeriodMs: 3200,
  shiftSolidMs: 2000,
  shiftWarnMs: 500,
} as const;

const BOTTOM = 17;
const solids: TileRect[] = [];
const spikes: SpikeDef[] = [];
const traps: TrapConfigWithId[] = [];
const checkpoints: PointDef[] = [];
const decor: DecorDef[] = [];
/** Key spots (tiles), for tests and debugging. */
export const L3_MARKS: Record<string, number> = {};

/** A solid block whose top is `row`, reaching down to the bottom of the level. */
const block = (x: number, w: number, row: number): void => {
  solids.push({ x, y: row, w, h: BOTTOM - row });
};
/** A thin floating platform (1 tile). */
const ledge = (x: number, w: number, row: number): void => {
  solids.push({ x, y: row, w, h: 1 });
};
const sign = (x: number, y: number, text: string): void => {
  decor.push({ kind: 'sign', x, y, text });
};
const sprouts = (x: number, y: number, w: number): void => {
  decor.push({ kind: 'sprouts', x, y, w });
};
const illusion = (id: string, x: number, y: number, w: number): void => {
  traps.push({ id, type: 'mirrorPlatform', x, y, w });
};

// ---------- ZONE 1: FAKE TUTORIAL ----------
// A tutorial whose signs lie. "Don't jump" before a gap; "safe path" pointing at a cracked
// bridge (the real way is the sprouted ledges above it); "rest here" over sleeping spikes (holes
// in the ground); "checkpoint" pointing back while the real flag is ahead.
block(0, 12, 14);
sign(4, 14, 'TUTORIAL RESMI\nSemua papan JUJUR!');
sign(10, 14, 'JANGAN LOMPAT!');
block(15, 8, 14);
sprouts(15, 14, 7);
L3_MARKS.ground2 = 15;
sign(21, 14, 'JALUR AMAN →');
traps.push({ id: 'safeBridge', type: 'fakeFloor', x: 23, y: 14, w: 9, h: BOTTOM - 14, delayMs: L3.bridgeDelayMs });
L3_MARKS.safeBridge = 23;
ledge(24, 2, 11);
sprouts(24, 11, 2);
ledge(28, 2, 10);
sprouts(28, 10, 2);
L3_MARKS.ledge2 = 28;
block(32, 14, 13);
sprouts(32, 13, 4);
sign(37, 13, 'ISTIRAHAT\nDI SINI ✓');
traps.push({ id: 'restSpikes', type: 'surpriseSpikes', x: 36, y: 13, w: 3, trigger: { from: 35.4, to: 39.5 }, warnMs: L3.restSpikeWarnMs });
decor.push({ kind: 'holes', x: 36, y: 13, w: 3 });
L3_MARKS.restSpikes = 36;
sprouts(39, 13, 7);
sign(40, 13, '← CHECKPOINT');
checkpoints.push({ x: 43, y: 13 });

// ---------- ZONE 2: MIRROR MAZE ----------
// Pairs of platforms over the void: one real (still), one illusion (shimmers). The real one
// alternates between low and high, then a stepping stone that is only light, and a floor gap
// filled with light. Mirrors show MOCHI's reflection.
ledge(49, 3, 14);
illusion('mirrorHigh1', 49, 11, 3);
L3_MARKS.maze1 = 49;
ledge(54, 3, 11);
illusion('mirrorLow2', 54, 14, 3);
L3_MARKS.maze2 = 54;
ledge(59, 3, 12);
illusion('mirrorHigh3', 59, 9, 3);
L3_MARKS.maze3 = 59;
illusion('mirrorStone', 63, 12, 1);
ledge(65, 3, 12);
L3_MARKS.maze4 = 65;
block(70, 8, 13);
traps.push({ id: 'mirrorPanel1', type: 'mirrorPanel', x: 72, y: 13 });
checkpoints.push({ x: 75, y: 13 });
L3_MARKS.ground4 = 70;
ledge(80, 2, 10);
illusion('mirrorLow5', 80, 13, 3);
L3_MARKS.maze5 = 80;
ledge(84, 2, 13);
illusion('mirrorHigh6', 84, 9, 2);
L3_MARKS.maze6 = 84;
illusion('mirrorGap', 86, 13, 2);

// ---------- ZONE 3: GHOST MOCHI ----------
// Past the crystal, a ghost replays MOCHI 1.5 s late. A plate up on a ledge opens a tall gate only
// while pressed, and the gate is too far to reach from the plate: stand on it long enough, then
// go, and the ghost holds it for you. Then a plate on the path keeps a crystal bridge over the
// void solid: cross it while the ghost is standing where you stood.
block(88, 16, 13);
ledge(93, 3, 10);
checkpoints.push({ x: 89, y: 13 });
L3_MARKS.ground5 = 88;
traps.push({
  id: 'ghost',
  type: 'ghostMochi',
  fromX: 90.5,
  toX: 112,
  delayMs: L3.ghostDelayMs,
  warnMs: L3.ghostWarnMs,
  shrine: { x: 91, y: 13 },
  plates: [
    { x: 93.5, y: 10, w: 2 },
    { x: 101, y: 13, w: 2 },
  ],
  gates: [{ x: 99, y: 13, h: 5, plate: 0 }],
  bridges: [{ x: 104, y: 13, w: 6, plate: 1 }],
});
L3_MARKS.plate1 = 93.5;
L3_MARKS.gate = 99;
L3_MARKS.plate2 = 101;
L3_MARKS.bridge = 104;

// ---------- ZONE 4: REALITY SHIFT ----------
// A safe ledge with two phase lamps to read the rhythm, then crystal platforms that are SOLID or
// PHANTOM on one fixed cycle (mint, then pink). A vanishing platform blinks; an appearing one
// fills in. Jump when the next one lights up.
block(110, 9, 13);
checkpoints.push({ x: 112, y: 13 });
L3_MARKS.ground6 = 110;
traps.push({
  id: 'shift',
  type: 'realityShift',
  fromX: 110,
  toX: 150,
  periodMs: L3.shiftPeriodMs,
  solidMs: L3.shiftSolidMs,
  warnMs: L3.shiftWarnMs,
  lamps: { x: 115, y: 10 },
  platforms: [
    { x: 121, y: 13, w: 3, phase: 0 },
    { x: 126, y: 12, w: 3, phase: 1 },
    { x: 131, y: 11, w: 2, phase: 0 },
    { x: 135, y: 10, w: 2, phase: 1 },
    { x: 139, y: 12, w: 3, phase: 0 },
    { x: 144, y: 13, w: 3, phase: 1 },
  ],
});
L3_MARKS.shift1 = 121;

// ---------- ZONE 5: THE FINAL LIE ----------
// Three doors. A ("FINISH") stands on shimmering floor: an illusion. B ("PINTU ASLI"), up on the
// ledge with a crooked frame, sends MOCHI back to the Reality Shift's safe ledge. C ("BUKAN
// FINISH"), with sprouts at its feet, is the real one, at the top of the pillars.
block(149, 10, 13);
checkpoints.push({ x: 150, y: 13 });
L3_MARKS.ground7 = 149;
sign(157, 13, 'FINISH LURUS\nAJA →');
ledge(152, 4, 10);
traps.push({ id: 'doorB', type: 'lieDoor', x: 154, y: 10, kind: 'warp', label: 'PINTU ASLI ✓', warpTo: { x: 113, y: 13 } });
L3_MARKS.doorB = 154;
traps.push({ id: 'doorA', type: 'lieDoor', x: 160, y: 13, kind: 'trap', label: 'FINISH ✓', floor: { x: 159, w: 3 } });
L3_MARKS.doorA = 160;
block(162, 2, 12);
L3_MARKS.pillar1 = 162;
block(166, 2, 10);
block(170, 5, 9);
sprouts(171, 9, 3);
traps.push({ id: 'doorC', type: 'lieDoor', x: 172, y: 9, kind: 'true', label: 'BUKAN FINISH ✕' });
L3_MARKS.doorC = 172;
const finish = { x: 172, y: 9 };

export const level03: LevelData = {
  id: 3,
  name: 'The Game Is Lying',
  theme: 'illusion',
  width: 177,
  height: BOTTOM,
  spawn: { x: 2, y: 14 },
  solids,
  spikes,
  traps,
  checkpoints,
  finish,
  decor,
  // Level 03's own lines come first; anything not listed falls back to the shared sets.
  trollLines: {
    soft: {
      'trap:fakeFloor': ['Papannya bohong, hehe. Ikuti tunas mint~'],
      'trap:surpriseSpikes': ['Ada lubang kecil di tanahnya, lho~'],
    },
    chaos: {
      'trap:fakeFloor': ['BRO, LU PERCAYA SAMA TULISAN?', 'Jalur aman katanya. Hehe.'],
      'trap:surpriseSpikes': ['BRO, LU PERCAYA SAMA TULISAN?', 'Istirahatnya kelamaan, bro.'],
      nearFinish: ['FINISH BENERAN? COBA AJA!', 'DIKIT LAGI PADAHAL!'],
      repeatTrap: ['WKWKWK KETIPU LAGI!', 'Jebakan yang SAMA. Lagi. Serius?'],
    },
    savage: {
      'trap:fakeFloor': ['Baca papan doang, nggak baca situasi.', 'Papannya bohong, lu percaya. Klasik.'],
      'trap:surpriseSpikes': ['Istirahat abadi, hehe.', 'Papannya bilang aman. Papannya bohong.'],
    },
  },
};
