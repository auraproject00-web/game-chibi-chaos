import type { TrapConfigWithId } from '../traps/types';
import type { LevelData, PointDef, SpikeDef, TileRect } from './types';

/**
 * Level 2 - "Trust Issues" (Candy Meadow), Nightmare balancing (target 8/10).
 *
 * MOCHI's reach, from PLAYER in config.ts (speed 250, gravity 1900, jump 640, hitbox 1 tile):
 * apex 3.37 tiles; horizontal travel of the hitbox center during a full jump is 5.26 tiles on the
 * flat, 4.84 when landing 1 row higher, 4.30 for 2 rows, 3.50 for 3 rows, 5.95 when landing 2 rows
 * lower. A gap of G tiles needs about G + 0.5 tiles of travel from the edge, so the gaps below keep
 * at least 0.75 tile to spare (more on the rising jumps) for touch controls. No jump needs coyote
 * time or a pixel-perfect take-off.
 *
 * Every number a designer may want to tune is in `L2`. Geometry is laid out left to right from a
 * running cursor, so changing a gap or width moves everything after it along.
 */
export const L2 = {
  // Platforms and gaps (tiles).
  stepW: 3,
  stepGap: 2,
  pillarW: 2,
  precisionGap: 3,
  // Area 1: fake floor (ms it wobbles before falling) and hidden spikes.
  fakeFloorDelayMs: 220,
  /** Hidden spikes fire when MOCHI's center is this many tiles before them. */
  hiddenSpikeLead: 0.7,
  // Area 2: the second spikes of the chain peek out this long before they shoot up.
  chainSpikeWarnMs: 260,
  coinSpikeDelayMs: 240,
  // Area 3: wafers (px per second, pause at each end in ms) and the collapsing plank.
  wafer1Speed: 90,
  wafer1WaitMs: 500,
  wafer2Speed: 70,
  wafer2WaitMs: 600,
  plankDelayMs: 320,
  // Area 4: the fake flag's spikes sit this many tiles after it.
  fakeFlagSpikeOffset: 2,
  // Area 5: decoy portals spring when MOCHI is this many tiles before them.
  decoyFleeLead: 2.5,
  decoyDropLead: 1.9,
  decoyFloorDelayMs: 200,
} as const;

const GROUND = 14;
const BOTTOM = 17;
const solids: TileRect[] = [];
const spikes: SpikeDef[] = [];
const traps: TrapConfigWithId[] = [];
const checkpoints: PointDef[] = [];
/** Key spots (tiles), for tests and debugging. */
export const L2_MARKS: Record<string, number> = {};

/** A solid block whose top is `row`, reaching down to the bottom of the level. */
const block = (x: number, w: number, row: number): TileRect => {
  const r = { x, y: row, w, h: BOTTOM - row };
  solids.push(r);
  return r;
};
/** A thin floating platform (1 tile). */
const ledge = (x: number, w: number, row: number): TileRect => {
  const r = { x, y: row, w, h: 1 };
  solids.push(r);
  return r;
};

// ---------- AREA 1: FALSE CONFIDENCE ----------
// Three honest steps, then a step that looks the same but is cracked (fake floor): land and hop
// off right away. The ground after it hides spikes (Fake Floor + Surprise Spikes).
let x = 0;
block(x, 11, GROUND);
x = 11 + L2.stepGap;
block(x, L2.stepW, 13);
x += L2.stepW + L2.stepGap + 1;
block(x, L2.stepW, 12);
x += L2.stepW + L2.stepGap + 1;
block(x, L2.stepW, 13);
x += L2.stepW + 3;
L2_MARKS.fakeFloor = x;
traps.push({ id: 'introFakeFloor', type: 'fakeFloor', x, y: 13, w: L2.stepW, h: BOTTOM - 13, delayMs: L2.fakeFloorDelayMs });
x += L2.stepW + 3;
const g1 = block(x, 23, GROUND);
traps.push({ id: 'introSpikes', type: 'surpriseSpikes', x: x + 4, y: GROUND, w: 2, trigger: { from: x + 4 - L2.hiddenSpikeLead, to: x + 6.5 } });
L2_MARKS.introSpikes = x + 4;
checkpoints.push({ x: x + 8, y: GROUND });

// ---------- AREA 2: DOUBLE BETRAYAL ----------
// Visible spikes, and the landing spot after them hides a second row that peeks out first
// (chain: jump, land, jump again). Then a ledge with a bait coin above it: walk under it and
// jump from the far edge and it stays out of reach; jump early or go for it and spikes pop on
// the next ledge (Bait Coin + Hidden Trap).
x = g1.x + 12;
spikes.push({ x, y: GROUND, w: 2 });
L2_MARKS.visibleSpikes = x;
x += 5;
traps.push({ id: 'chainSpikes', type: 'surpriseSpikes', x, y: GROUND, w: 2, trigger: { from: x - 0.6, to: x + 2.5 }, warnMs: L2.chainSpikeWarnMs });
L2_MARKS.chainSpikes = x;
x = g1.x + g1.w + L2.stepGap;
const coinLedge = ledge(x, 5, 12);
L2_MARKS.coinLedge = x;
x += coinLedge.w + L2.precisionGap;
const spikeLedge = ledge(x, 3, 12);
L2_MARKS.spikeLedge = x;
traps.push({ id: 'baitCoin', type: 'baitCoin', x: coinLedge.x + 3, y: 9, spikes: { x: spikeLedge.x, y: 12, w: spikeLedge.w }, delayMs: L2.coinSpikeDelayMs });
x += spikeLedge.w + L2.stepGap;
const g2 = block(x, 8, GROUND);
checkpoints.push({ x: x + 2, y: GROUND });

// ---------- AREA 3: PRECISION PANIC ----------
// Small candy pillars, a wafer that carries MOCHI to a wooden plank that drops (Moving Platform +
// Collapsing Platform: hop off fast), then a wafer that rises to a high ledge (wait for it).
x = g2.x + g2.w + L2.precisionGap;
block(x, L2.pillarW, 13);
L2_MARKS.pillar1 = x;
x += L2.pillarW + L2.precisionGap;
const q2 = block(x, L2.pillarW, 12);
x = q2.x + q2.w + L2.stepGap;
traps.push({ id: 'wafer1', type: 'movingPlatform', x, y: 12, w: 3, toX: x + 6, speed: L2.wafer1Speed, waitMs: L2.wafer1WaitMs });
L2_MARKS.wafer1 = x;
x += 6 + 3 + L2.stepGap;
traps.push({ id: 'plank', type: 'fallingPlatform', x, y: 12, w: L2.pillarW, delayMs: L2.plankDelayMs });
L2_MARKS.plank = x;
x += L2.pillarW + L2.precisionGap;
const q3 = block(x, L2.pillarW, 11);
L2_MARKS.pillar3 = x;
x = q3.x + q3.w + L2.stepGap;
traps.push({ id: 'wafer2', type: 'movingPlatform', x, y: 13, w: 3, toX: x, toY: 9, speed: L2.wafer2Speed, waitMs: L2.wafer2WaitMs });
L2_MARKS.wafer2 = x;
x += 3 + L2.precisionGap;
const q4 = block(x, 3, 9);
L2_MARKS.highLedge = x;
x = q4.x + q4.w + L2.stepGap;

// ---------- AREA 4: CHECKPOINT MIND GAME ----------
// A real flag right after the precision part, then a fake one (crooked pole, sways) that pops
// spikes ahead and taunts (Fake Checkpoint + Troll Narrator), then the next real flag.
const g3 = block(x, 22, GROUND);
checkpoints.push({ x: x + 2, y: GROUND });
L2_MARKS.ground3 = x;
const fakeFlagX = x + 8;
traps.push({ id: 'fakeCheckpoint', type: 'fakeCheckpoint', x: fakeFlagX, y: GROUND, spikes: { x: fakeFlagX + L2.fakeFlagSpikeOffset, w: 2 } });
L2_MARKS.fakeFlag = fakeFlagX;
checkpoints.push({ x: x + 18, y: GROUND });
L2_MARKS.realFlag = x + 18;

// ---------- AREA 5: TRIPLE FAKE FINISH ----------
// Three look-alike portals. Tells: the fakes spin the other way and glow pink. Fake 1 hops away
// and pops spikes where it stood (jump them). Fake 2 stands on cracked ground that falls away
// (jump from the solid part). The real one waits at the top of three small pillars
// (Fake Finish + Precision Jump).
x = g3.x + g3.w + L2.precisionGap;
const g4 = block(x, 14, GROUND);
const decoy1 = g4.x + 9;
traps.push({
  id: 'decoyFlee',
  type: 'decoyPortal',
  x: decoy1,
  y: GROUND,
  triggerX: decoy1 - L2.decoyFleeLead,
  effect: 'flee',
  fleeTo: { x: decoy1 + 3, y: 10 },
  spikes: { x: decoy1 - 1, w: 3 },
});
L2_MARKS.decoy1 = decoy1;
x = g4.x + g4.w + L2.precisionGap;
const step = block(x, 3, 13);
L2_MARKS.decoyStep = x;
const decoy2 = step.x + step.w + 1;
traps.push({
  id: 'decoyDrop',
  type: 'decoyPortal',
  x: decoy2,
  y: 13,
  triggerX: decoy2 + 0.5 - L2.decoyDropLead,
  effect: 'drop',
  floor: { x: step.x + step.w, w: 3, h: BOTTOM - 13, delayMs: L2.decoyFloorDelayMs },
});
L2_MARKS.decoy2 = decoy2;
x = step.x + step.w + 3 + 1;
block(x, L2.pillarW, 13);
L2_MARKS.finalPillar1 = x;
x += L2.pillarW + L2.stepGap;
block(x, L2.pillarW, 11);
x += L2.pillarW + L2.stepGap;
block(x, L2.pillarW, 9);
L2_MARKS.finalPillar3 = x;
x += L2.pillarW + L2.stepGap;
const top = block(x, 4, 9);
const finish = { x: top.x + 2, y: 9 };
L2_MARKS.finish = finish.x;

export const level02: LevelData = {
  id: 2,
  name: 'Trust Issues',
  theme: 'candy',
  width: top.x + top.w + 2,
  height: BOTTOM,
  spawn: { x: 3, y: GROUND },
  solids,
  spikes,
  traps,
  checkpoints,
  finish,
  // Chaos (the default) uses Level 02's own lines first; the other modes keep the shared ones.
  trollLines: {
    chaos: {
      repeatTrap: ['WKWKWK KENA LAGI!', 'Jebakan yang SAMA. Lagi. Serius?', 'Jebakannya sampe hafal muka Mochi.'],
      'trap:fakeFloor': ['LU PERCAYA SAMA LANTAI ITU?', 'LANTAINYA CUMA PURA-PURA SETIA.'],
      quickDeath: ['BRO, BARU JUGA MULAI!', 'LAH, BARU JUGA RESPAWN?!', 'Respawn-nya aja belum kering!'],
      sameArea: ['MOCHI UDAH CAPEK SAMA LU!', 'Area ini kayaknya kangen sama lu.', 'Udah kayak rumah sendiri ya di sini.'],
      nearFinish: ['DIKIT LAGI PADAHAL!', 'WKWKWK TINGGAL DIKIT LAGI!', 'PORTALNYA UDAH MELAMBAI, LHO!'],
      'trap:decoyPortal': ['FINISH? YAKIN NIH?', 'Portal KW kok dipercaya?'],
      'sprung:decoyPortal': ['FINISH? YAKIN NIH?', 'Portalnya cuma cosplay, bro.'],
    },
  },
};
