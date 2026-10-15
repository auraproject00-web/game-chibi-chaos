import type { TrapConfigWithId } from '../traps/types';
import type { LevelData, PointDef, SpikeDef, TileRect } from './types';

/**
 * Level 4 - "Chaos Dimension" (Total Chaos), Nightmare 9/10.
 * Five connected zones, each teaching one mechanic before the last zone combines them:
 *  1. Gravity Betrayal: gates flip MOCHI's gravity (stand on floors and ceilings).
 *  2. Dimension Switch: the action button swaps Sweet <-> Glitch blocks and spikes.
 *  3. Time Echo: the ghost from Level 03 replays MOCHI; echo switches answer only to the ghost.
 *  4. Chaos Chase: a chaos wave chases MOCHI at a fixed fraction of MOCHI's real speed.
 *  5. Reality Collapse: gravity, dimensions, echo and crumbling ground, one section at a time.
 *
 * MOCHI's reach (PLAYER in config.ts, unchanged, and identical upside down): horizontal travel of
 * the hitbox center in a full jump is 5.26 tiles on the flat, 4.84 one row up, 4.30 two rows up,
 * 3.50 three rows up. A gap of G tiles needs about G + 0.5. Every required jump keeps >= 1 tile
 * spare. The level is one screen tall (floor row 10, ceilings down to row 3), so floor and ceiling
 * are always both in view. Rising from the floor to a ceiling after a gate takes ~0.44 s, about
 * 3.4 tiles at full speed: ceiling hazards start after that.
 *
 * Every number a designer may want to tune is in `L4`.
 */
export const L4 = {
  // Zone 1/5: a gate glows (and an icon pops over MOCHI) this close before a flip, in tiles.
  gravityWarnTiles: 2.5,
  // Zone 2/4/5: minimum time between two dimension switches.
  switchCooldownMs: 300,
  // Zone 3/5: the echo replays MOCHI this many ms later; gates/bridges blink this long before closing.
  echoDelayMs: 1200,
  echoWarnMs: 400,
  // Zone 4: the wave's speed as a fraction of MOCHI's top speed (250 px/s), its warning time, and
  // how far behind the trigger it appears (tiles).
  chaseSpeedRatio: 0.92,
  chaseWarnMs: 700,
  chaseLeadTiles: 3,
  // Zone 5: cracked ground wobbles this long before it falls.
  collapseDelayMs: 350,
} as const;

const BOTTOM = 12;
/** Ceilings hang from the top of the level down to this row (their underside). */
const CEIL = 3;
const solids: TileRect[] = [];
const spikes: SpikeDef[] = [];
const traps: TrapConfigWithId[] = [];
const checkpoints: PointDef[] = [];
/** Key spots (tiles), for tests and debugging. */
export const L4_MARKS: Record<string, number> = {};

/** A solid block whose top is `row`, reaching down to the bottom of the level. */
const block = (x: number, w: number, row: number): void => {
  solids.push({ x, y: row, w, h: BOTTOM - row });
};
/** A thin floating ledge (1 tile). */
const ledge = (x: number, w: number, row: number): void => {
  solids.push({ x, y: row, w, h: 1 });
};
/** A ceiling from the top of the level down to row CEIL. */
const ceil = (x: number, w: number): void => {
  solids.push({ x, y: 0, w, h: CEIL });
};

const gates: { x: number; top: number; bottom: number; right: 'up' | 'down' }[] = [];
const gravSpikes: { x: number; y: number; w: number; ceiling?: boolean }[] = [];
const gate = (x: number, right: 'up' | 'down'): void => {
  gates.push({ x, top: CEIL, bottom: 10, right });
};
const ceilSpikes = (x: number, w: number): void => {
  gravSpikes.push({ x, y: CEIL, w, ceiling: true });
};

const dimBlocks: { x: number; y: number; w: number; h?: number; dim: 'sweet' | 'glitch' }[] = [];
const dimSpikes: { x: number; y: number; w: number; dim: 'sweet' | 'glitch' }[] = [];

// ---------- ZONE 1: GRAVITY BETRAYAL ----------
// Teach: a gate lifts MOCHI onto the ceiling over a pit, the next one puts MOCHI back down.
// Then a gap in the ceiling (the sky is a pit too) and spikes hanging from it. Last, a pit too
// wide to jump: walk off the edge into the next gate.
block(0, 14, 10);
ceil(9, 29);
gate(12, 'up');
L4_MARKS.gateA = 12;
block(20, 13, 10);
gate(22, 'down');
gate(30, 'up');
L4_MARKS.gateC = 30;
// Ceiling gap 38-41.
L4_MARKS.skyGap = 38;
ceil(41, 9);
ceilSpikes(45, 2);
L4_MARKS.ceilSpikes1 = 45;
gate(49, 'down');
block(48, 9, 10);
// Pit 57-66: too wide to jump; the gate at 58 carries MOCHI over it on the ceiling.
gate(58, 'up');
ceil(58, 10);
ceilSpikes(64, 2);
gate(67, 'down');
block(66, 14, 10);
checkpoints.push({ x: 74, y: 10 });
L4_MARKS.cp1 = 74;

// ---------- ZONE 2: DIMENSION SWITCH ----------
// The crystal unlocks the action button (a short tip shows until the first switch).
// Teach: a Glitch bridge. Then hops over a pit on alternating blocks (switch in mid-air), and a
// Sweet wall followed by Glitch spikes too wide to jump: switch, pass the wall, switch back.
L4_MARKS.crystal = 77;
dimBlocks.push({ x: 80, y: 10, w: 5, dim: 'glitch' });
L4_MARKS.glitchBridge = 80;
block(85, 7, 10);
dimBlocks.push({ x: 93, y: 9, w: 2, dim: 'sweet' });
dimBlocks.push({ x: 97, y: 8, w: 2, dim: 'glitch' });
dimBlocks.push({ x: 101, y: 9, w: 2, dim: 'sweet' });
L4_MARKS.hops = 93;
block(105, 16, 10);
dimBlocks.push({ x: 109, y: 4, w: 1, h: 6, dim: 'sweet' });
L4_MARKS.wall = 109;
dimSpikes.push({ x: 112, y: 10, w: 5, dim: 'glitch' });
L4_MARKS.glitchSpikes = 112;
checkpoints.push({ x: 119, y: 10 });
L4_MARKS.cp2 = 119;

// ---------- ZONE 3: TIME ECHO ----------
// The ghost from Level 03 replays MOCHI 1.2 s later. Echo switches (ghost-tinted) ignore MOCHI.
// Puzzle A: an echo switch holds a bridge over a pit too wide to jump: wait on it, then go.
// Puzzle B: an echo switch on a ledge opens a tall gate (roofed, so it can't be jumped).
block(121, 9, 10);
block(136, 28, 10);
ledge(138, 2, 7);
solids.push({ x: 142, y: 0, w: 3, h: CEIL });
traps.push({
  id: 'echo1',
  type: 'ghostMochi',
  fromX: 122,
  toX: 152,
  delayMs: L4.echoDelayMs,
  warnMs: L4.echoWarnMs,
  shrine: { x: 123, y: 10 },
  plates: [
    { x: 128, y: 10, w: 2, echoOnly: true },
    { x: 138, y: 7, w: 2, echoOnly: true },
  ],
  gates: [{ x: 143, y: 10, h: 7, plate: 1 }],
  bridges: [{ x: 130, y: 10, w: 6, plate: 0 }],
});
L4_MARKS.echoPlate1 = 128;
L4_MARKS.echoBridge = 130;
L4_MARKS.echoLedge = 138;
L4_MARKS.echoGate = 143;
checkpoints.push({ x: 155, y: 10 });
L4_MARKS.cp3 = 155;

// ---------- ZONE 4: CHAOS CHASE ----------
// Past 158 the wave wakes up 3 tiles behind and chases at 92% of MOCHI's top speed. Route: a
// step up, a Glitch bridge, a Glitch wall (switch back to Sweet), a drop, then a gravity hop over
// a pit with a small gap in the ceiling. The wave dissolves at 214, before the checkpoint.
const chaseTrigger = 158;
L4_MARKS.chaseTrigger = chaseTrigger;
block(167, 8, 9);
dimBlocks.push({ x: 175, y: 9, w: 6, dim: 'glitch' });
block(181, 8, 9);
dimBlocks.push({ x: 186, y: 3, w: 1, h: 6, dim: 'glitch' });
L4_MARKS.chaseWall = 186;
block(192, 6, 10);
gate(196, 'up');
ceil(194, 9);
ceil(205, 5);
gate(208, 'down');
block(206, 17, 10);
L4_MARKS.chaseEnd = 214;
traps.push({
  id: 'chase',
  type: 'chaosChase',
  triggerX: chaseTrigger,
  startX: chaseTrigger - L4.chaseLeadTiles,
  endX: L4_MARKS.chaseEnd,
  speedRatio: L4.chaseSpeedRatio,
  warnMs: L4.chaseWarnMs,
});
checkpoints.push({ x: 217, y: 10 });
L4_MARKS.cp4 = 217;

// ---------- ZONE 5: REALITY COLLAPSE ----------
// One mechanic per section, never all at once: gravity (ceiling gap + spikes), dimension hops
// (four mid-air switches), an echo gate, then crumbling ground to the real finish portal.
L4_MARKS.collapse = 220;
gate(222, 'up');
ceil(220, 9);
ceil(232, 9);
ceilSpikes(235, 2);
gate(239, 'down');
block(238, 8, 10);
dimBlocks.push({ x: 247, y: 9, w: 2, dim: 'sweet' });
dimBlocks.push({ x: 251, y: 8, w: 2, dim: 'glitch' });
dimBlocks.push({ x: 255, y: 9, w: 2, dim: 'sweet' });
dimBlocks.push({ x: 259, y: 10, w: 2, dim: 'glitch' });
L4_MARKS.collapseHops = 247;
block(262, 14, 10);
checkpoints.push({ x: 264, y: 10 });
L4_MARKS.cp5 = 264;
solids.push({ x: 272, y: 0, w: 3, h: CEIL });
traps.push({
  id: 'echo2',
  type: 'ghostMochi',
  fromX: 263,
  toX: 278,
  delayMs: L4.echoDelayMs,
  warnMs: L4.echoWarnMs,
  shrine: { x: 266, y: 10 },
  plates: [{ x: 268, y: 10, w: 2, echoOnly: true }],
  gates: [{ x: 273, y: 10, h: 7, plate: 0 }],
  bridges: [],
});
L4_MARKS.echoGate2 = 273;
traps.push({ id: 'crumble1', type: 'fakeFloor', x: 278, y: 10, w: 3, h: 1, delayMs: L4.collapseDelayMs });
traps.push({ id: 'crumble2', type: 'fakeFloor', x: 283, y: 9, w: 3, h: 1, delayMs: L4.collapseDelayMs });
block(288, 12, 9);
const finish = { x: 294, y: 9 };
traps.push({ id: 'collapse', type: 'realityCollapse', triggerX: L4_MARKS.collapse, finishX: 290 });

traps.push({ id: 'gravity', type: 'gravityFlip', gates, spikes: gravSpikes, warnTiles: L4.gravityWarnTiles });
traps.push({
  id: 'dimension',
  type: 'dimension',
  unlock: { x: L4_MARKS.crystal, y: 10 },
  cooldownMs: L4.switchCooldownMs,
  blocks: dimBlocks,
  spikes: dimSpikes,
});

export const level04: LevelData = {
  id: 4,
  name: 'Chaos Dimension',
  theme: 'dimension',
  width: 300,
  height: BOTTOM,
  spawn: { x: 2, y: 10 },
  solids,
  spikes,
  traps,
  checkpoints,
  finish,
  trollLines: {
    chaos: {
      'trap:ghostMochi': ['BAYANGAN LU LEBIH JAGO!', 'Bayangannya sabar, lu nggak.'],
      'trap:fakeFloor': ['REALITASNYA AJA UDAH NYERAH SAMA LU!', 'Lantainya retak, harapan juga.'],
      finishAfterManyDeaths: ['LAH, LU BENERAN BERHASIL?!', 'AKHIRNYA! GUA UDAH MAU PENSIUN!'],
    },
    soft: {
      'trap:ghostMochi': ['Bayanganmu lebih sabar, tunggu dia ya~'],
      'trap:fakeFloor': ['Lantainya retak, langsung lompat ya~'],
    },
    savage: {
      'trap:ghostMochi': ['Hantunya yang kerja, Mochi yang mati.'],
      'trap:fakeFloor': ['Realitasnya runtuh duluan sebelum lu.'],
    },
  },
};
