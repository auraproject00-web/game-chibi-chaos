import Phaser from 'phaser';
import { TILE } from '../config';

/**
 * Level 01 "Candy Meadow" art (theme 'sweet'), drawn procedurally after the Candy Meadow concept
 * sheet: pastel sky with a rainbow, marshmallow clouds, floating candy islands and balloons, a
 * candy castle, frosted mountains with syrup waterfalls, lollipop and cotton-candy trees, cake /
 * wafer / biscuit / marshmallow platforms, candy spikes, a candy-cane checkpoint and a swirl portal.
 *
 * Everything is baked once into cached textures (no per-frame drawing, no image files). The
 * backdrop is only generated the first time Level 01 loads, so boot time is unchanged.
 */

type Pt = { x: number; y: number };
type G = Phaser.GameObjects.Graphics;

export const SWEET = {
  skyTop: 0x8ccfff,
  skyMid: 0xc6ebff,
  skyLow: 0xffe7f3,
  cloud: 0xffffff,
  cloudShade: 0xf6dcef,
  pink: 0xff9ec7,
  pinkLight: 0xffc8de,
  pinkDark: 0xe0679a,
  hotPink: 0xff6fa8,
  lavender: 0xcdb8ff,
  lavenderDark: 0x9f86e6,
  cream: 0xfff3d4,
  sponge: 0xf7d79f,
  spongeDark: 0xe2b26e,
  caramel: 0xd8955a,
  choco: 0x8a5a3c,
  chocoDark: 0x5e3b27,
  mint: 0x9fe8b8,
  mintDark: 0x5cc487,
  leaf: 0x7fd88f,
  sky: 0x9fd9ff,
  water: 0xb9ecff,
  lemon: 0xfff09a,
  peach: 0xffc49b,
  outline: 0x8a5a6e,
} as const;
const S = SWEET;

/** Sprinkle colors. */
const SPRINKLES = [0xff7aa8, 0x8fd3ff, 0xfff07a, 0x9fe8b8, 0xc8a8ff, 0xffffff];

function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Shared little drawings
// ---------------------------------------------------------------------------------------------

/** Puffy marshmallow cloud: soft shaded bottom, bright top. */
function cloud(g: G, x: number, y: number, s: number, alpha = 1): void {
  const puffs: [number, number, number][] = [
    [-34, 6, 20],
    [-12, -6, 26],
    [16, -10, 28],
    [40, 2, 20],
    [0, 10, 22],
    [26, 12, 18],
  ];
  g.fillStyle(S.cloudShade, alpha);
  for (const [dx, dy, r] of puffs) g.fillCircle(x + dx * s, y + (dy + 5) * s, r * s);
  g.fillStyle(S.cloud, alpha);
  for (const [dx, dy, r] of puffs) g.fillCircle(x + dx * s, y + dy * s, r * s * 0.94);
  g.fillStyle(0xffffff, alpha * 0.9);
  g.fillEllipse(x - 8 * s, y - 18 * s, 26 * s, 9 * s);
}

/** Swirl candy disc (lollipop head, balloon, portal). */
function swirl(g: G, cx: number, cy: number, r: number, base: number, stripe: number, rim: number = S.pinkDark, turns = 3): void {
  g.fillStyle(base, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(Math.max(1.5, r * 0.22), stripe, 1);
  g.beginPath();
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns;
    const rr = t * r * 0.92;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(cx - r * 0.38, cy - r * 0.42, r * 0.7, r * 0.34);
  g.lineStyle(Math.max(1.2, r * 0.07), rim, 1);
  g.strokeCircle(cx, cy, r);
}

/** Five-petal candy flower. */
function flower(g: G, x: number, y: number, r: number, petal: number, center: number = S.lemon): void {
  g.fillStyle(petal, 1);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    g.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8);
  }
  g.fillStyle(center, 1);
  g.fillCircle(x, y, r * 0.62);
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(x - r * 0.2, y - r * 0.25, r * 0.22);
}

/** Wavy icing edge with drips hanging below `y` from x0 to x1. */
function icingDrips(g: G, x0: number, x1: number, y: number, color: number, rand: () => number, maxDrip = 12): void {
  g.fillStyle(color, 1);
  let x = x0;
  while (x < x1) {
    const dw = 8 + rand() * 12;
    const dl = 3 + rand() * maxDrip;
    const cx = Math.min(x + dw / 2, x1 - 3);
    g.fillRoundedRect(cx - dw / 2 + 1, y - 2, dw - 2, dl, Math.min((dw - 2) / 2, dl / 2));
    g.fillCircle(cx, y + dl - dw / 4, (dw - 2) / 2.2);
    x += dw + rand() * 6;
  }
}

function sprinkles(g: G, x0: number, y0: number, w: number, h: number, n: number, rand: () => number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle(SPRINKLES[Math.floor(rand() * SPRINKLES.length)], 1);
    const x = x0 + rand() * w;
    const y = y0 + rand() * h;
    if (rand() > 0.5) g.fillRoundedRect(x, y, 5, 2.2, 1.1);
    else g.fillRoundedRect(x, y, 2.2, 5, 1.1);
  }
}

// ---------------------------------------------------------------------------------------------
// Platforms (same footprint as every other theme; the art follows the collision box exactly)
// ---------------------------------------------------------------------------------------------

/**
 * Picks the sweet for a platform's size: tall ground is layered cake, thin ledges are wafers,
 * small blocks are marshmallows, larger blocks are biscuits. Fake floors are a fragile biscuit
 * that keeps the usual small crack tell.
 */
export function drawSweetPlatform(g: G, w: number, h: number, cracked = false): void {
  const rand = seeded(Math.round(w * 37 + h * 11 + (cracked ? 5 : 0)));
  // A fake floor uses exactly the same sweet as a real one of its size; only the small crack differs.
  if (h <= TILE) drawWafer(g, w, h, rand);
  else if (h >= 3 * TILE) drawCake(g, w, h, rand);
  else if (w <= 3 * TILE) drawMarshmallow(g, w, h, rand);
  else drawBiscuit(g, w, h, rand, false);
  if (cracked) crack(g, w, h);
}

/** The usual small fake-floor tell: a thin crack near the middle of the top. */
function crack(g: G, w: number, h: number): void {
  const cx = w * 0.5;
  g.lineStyle(1.6, S.chocoDark, 0.85);
  g.strokePoints(
    [
      { x: cx - 6, y: 3 },
      { x: cx - 2, y: 8 },
      { x: cx - 5, y: 12 },
      { x: cx, y: Math.min(h - 3, 17) },
    ],
    false,
  );
}

function drawCake(g: G, w: number, h: number, rand: () => number): void {
  const r = Math.min(14, w / 2);
  // Sponge body with jam and cream layers.
  g.fillStyle(S.sponge, 1);
  g.fillRoundedRect(0, 6, w, h - 6, { tl: 6, tr: 6, bl: r, br: r });
  g.fillStyle(S.cream, 1);
  g.fillRect(2, 38, w - 4, 8);
  g.fillStyle(S.pink, 1);
  g.fillRect(2, 46, w - 4, 6);
  g.fillStyle(S.spongeDark, 0.55);
  for (let i = 0; i < (w * h) / 420; i++) g.fillEllipse(6 + rand() * (w - 12), 58 + rand() * Math.max(4, h - 70), 3 + rand() * 3, 2 + rand() * 2);
  g.fillStyle(S.spongeDark, 1);
  g.fillRoundedRect(0, h - 9, w, 9, { tl: 0, tr: 0, bl: r, br: r });
  // Candy flowers on the front face, low enough never to be read as a path.
  for (let x = 26 + rand() * 30; x < w - 20; x += 70 + rand() * 60) flower(g, x, h - 22 - rand() * 14, 3.4, rand() > 0.5 ? S.pinkLight : S.lavender);
  g.lineStyle(2, S.outline, 1);
  g.strokeRoundedRect(0, 6, w, h - 6, { tl: 6, tr: 6, bl: r, br: r });
  // Frosting top: a clear, bright walking surface with drips and sprinkles.
  icingDrips(g, 2, w - 2, 16, S.pink, rand, 14);
  g.fillStyle(S.pink, 1);
  g.fillRoundedRect(-2, 0, w + 4, 18, 8);
  g.fillStyle(S.pinkLight, 1);
  g.fillRoundedRect(3, 3, w - 6, 5, 2.5);
  sprinkles(g, 6, 8, w - 12, 8, Math.floor(w / 9), rand);
  g.lineStyle(2, S.pinkDark, 1);
  g.strokeRoundedRect(-2, 0, w + 4, 18, 8);
}

function drawWafer(g: G, w: number, h: number, rand: () => number): void {
  const top = 9;
  g.fillStyle(S.caramel, 1);
  g.fillRoundedRect(0, 4, w, h - 4, 6);
  g.fillStyle(S.sponge, 1);
  g.fillRoundedRect(2, top, w - 4, h - top - 3, 4);
  // Wafer grid.
  g.lineStyle(1.4, S.caramel, 0.85);
  for (let x = 10; x < w - 4; x += 10) g.lineBetween(x, top + 1, x, h - 4);
  g.lineBetween(3, top + (h - top) / 2, w - 3, top + (h - top) / 2);
  g.lineStyle(2, S.outline, 1);
  g.strokeRoundedRect(0, 4, w, h - 4, 6);
  // Mint icing cap.
  icingDrips(g, 2, w - 2, top, S.mint, rand, 6);
  g.fillStyle(S.mint, 1);
  g.fillRoundedRect(-1, 0, w + 2, top + 2, 5);
  g.fillStyle(0xffffff, 0.55);
  g.fillRoundedRect(3, 2, w - 6, 2.5, 1.2);
  g.lineStyle(1.8, S.mintDark, 1);
  g.strokeRoundedRect(-1, 0, w + 2, top + 2, 5);
}

function drawMarshmallow(g: G, w: number, h: number, rand: () => number): void {
  g.fillStyle(S.pinkLight, 1);
  g.fillRoundedRect(0, 2, w, h - 2, 14);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 2, w, Math.min(26, h * 0.45), { tl: 14, tr: 14, bl: 4, br: 4 });
  g.fillStyle(0xffffff, 0.7);
  g.fillEllipse(w * 0.32, 9, w * 0.4, 6);
  // Soft dimples.
  g.fillStyle(S.cloudShade, 1);
  for (let i = 0; i < (w * h) / 600; i++) g.fillCircle(8 + rand() * (w - 16), 30 + rand() * Math.max(2, h - 38), 2);
  g.lineStyle(2, S.outline, 1);
  g.strokeRoundedRect(0, 2, w, h - 2, 14);
  sprinkles(g, 6, 5, w - 12, 8, Math.floor(w / 12), rand);
}

function drawBiscuit(g: G, w: number, h: number, rand: () => number, _cracked: boolean): void {
  g.fillStyle(S.caramel, 1);
  g.fillRoundedRect(0, 2, w, h - 2, 8);
  g.fillStyle(lerpColor(S.sponge, S.caramel, 0.35), 1);
  g.fillRoundedRect(3, 4, w - 6, h - 9, 6);
  // Docking holes.
  g.fillStyle(S.caramel, 1);
  for (let y = 14; y < h - 8; y += 16) for (let x = 12; x < w - 8; x += 18) g.fillCircle(x + (y % 32 ? 6 : 0), y, 2.2);
  g.lineStyle(2, S.outline, 1);
  g.strokeRoundedRect(0, 2, w, h - 2, 8);
  // Chocolate glaze top.
  icingDrips(g, 3, w - 3, 8, S.choco, rand, 7);
  g.fillStyle(S.choco, 1);
  g.fillRoundedRect(-1, 0, w + 2, 10, 5);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(3, 2, w - 6, 2.5, 1.2);
  sprinkles(g, 5, 3, w - 10, 5, Math.floor(w / 10), rand);
  g.lineStyle(1.8, S.chocoDark, 1);
  g.strokeRoundedRect(-1, 0, w + 2, 10, 5);
}

// ---------------------------------------------------------------------------------------------
// Hazards and interactive skins (same sizes and anchors as the default textures)
// ---------------------------------------------------------------------------------------------

function generateSkins(scene: Phaser.Scene): void {
  // Candy spikes: striped sugar cones, two per tile (same shape as the default spike).
  make(scene, 'spike_sweet', TILE, 24, (g) => {
    for (let i = 0; i < 2; i++) {
      const x0 = i * 16;
      const tri: Pt[] = [
        { x: x0 + 1, y: 24 },
        { x: x0 + 8, y: 1 },
        { x: x0 + 15, y: 24 },
      ];
      g.fillStyle(0xe83a6a, 1);
      g.fillPoints(tri, true);
      g.fillStyle(0xffffff, 0.95);
      g.fillPoints(
        [
          { x: x0 + 3.2, y: 17 },
          { x: x0 + 12.8, y: 17 },
          { x: x0 + 11.9, y: 13.5 },
          { x: x0 + 4.1, y: 13.5 },
        ],
        true,
      );
      g.fillPoints(
        [
          { x: x0 + 5.4, y: 9.5 },
          { x: x0 + 10.6, y: 9.5 },
          { x: x0 + 9.8, y: 6.5 },
          { x: x0 + 6.2, y: 6.5 },
        ],
        true,
      );
      g.fillStyle(0xffffff, 0.5);
      g.fillPoints(
        [
          { x: x0 + 4.6, y: 22 },
          { x: x0 + 8, y: 4 },
          { x: x0 + 8.6, y: 22 },
        ],
        true,
      );
      g.lineStyle(2.4, 0x7d1f45, 1);
      g.strokePoints(tri, true);
    }
  });

  // Checkpoint: candy-cane pole, gumdrop base, checkered candy flag.
  const flag = (key: string, color: number, dark: number, on: boolean): void =>
    make(scene, key, 48, 72, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(10, 8, 5, 60, 2);
      g.fillStyle(0xff6f91, 1);
      for (let y = 12; y < 66; y += 9) g.fillPoints([{ x: 10, y }, { x: 15, y: y - 4 }, { x: 15, y: y + 1 }, { x: 10, y: y + 5 }], true);
      g.lineStyle(1.4, 0xc2457a, 1);
      g.strokeRoundedRect(10, 8, 5, 60, 2);
      swirl(g, 12.5, 7, 5, S.pinkLight, 0xffffff, 0xc2457a, 2);
      const tri: Pt[] = [
        { x: 15, y: 12 },
        { x: 44, y: 22 },
        { x: 15, y: 34 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(tri, true);
      if (on) {
        g.fillStyle(0xffffff, 1);
        for (const [cx, cy] of [
          [19, 17],
          [27, 21],
          [19, 27],
          [35, 21.5],
          [23, 30],
        ])
          g.fillRect(cx - 2.5, cy - 2.5, 5, 5);
      }
      g.lineStyle(2, dark, 1);
      g.strokePoints(tri, true);
      // Gumdrop base.
      g.fillStyle(on ? S.mint : S.lavender, 1);
      g.fillEllipse(12.5, 68, 22, 9);
      g.fillStyle(0xffffff, 0.5);
      g.fillEllipse(8.5, 66, 7, 3);
      g.lineStyle(1.6, on ? S.mintDark : S.lavenderDark, 1);
      g.strokeEllipse(12.5, 68, 22, 9);
    });
  flag('flag_off_sweet', 0xe9def7, 0xb3a3d0, false);
  flag('flag_on_sweet', S.hotPink, 0xc2457a, true);

  // Finish portal: a giant swirl lollipop disc with a sugar rim and sparkles.
  make(scene, 'portal_sweet', 72, 72, (g) => {
    g.fillStyle(S.lavender, 1);
    g.fillCircle(36, 36, 34);
    swirl(g, 36, 36, 29, S.pinkLight, 0xffffff, S.hotPink, 3);
    g.fillStyle(0xffffff, 0.9);
    for (const [x, y, r] of [
      [14, 18, 3],
      [58, 22, 2.4],
      [55, 56, 3],
      [18, 54, 2.2],
    ])
      g.fillPoints(starPoints(x, y, r * 1.6, r * 0.6, 4), true);
    g.lineStyle(2.5, S.lavenderDark, 1);
    g.strokeCircle(36, 36, 34);
  });
}

// ---------------------------------------------------------------------------------------------
// Props placed in the level (no collision; drawn behind platforms so they never hide a hazard)
// ---------------------------------------------------------------------------------------------

export type SweetProp =
  | 'lolliTree'
  | 'cottonTree'
  | 'flowers'
  | 'fence'
  | 'sign'
  | 'bush'
  | 'balloon'
  | 'candyCane'
  | 'cupcake'
  | 'wrapped'
  | 'starCandy'
  | 'gumdrop';

export const sweetPropKey = (p: SweetProp): string => `sw_${p}`;

function generateProps(scene: Phaser.Scene): void {
  make(scene, sweetPropKey('lolliTree'), 64, 132, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(29, 50, 7, 80, 3);
    g.fillStyle(0xff8fb8, 1);
    for (let y = 56; y < 128; y += 12) g.fillPoints([{ x: 29, y }, { x: 36, y: y - 5 }, { x: 36, y: y + 1 }, { x: 29, y: y + 6 }], true);
    g.lineStyle(1.5, S.outline, 1);
    g.strokeRoundedRect(29, 50, 7, 80, 3);
    swirl(g, 32, 31, 28, S.pink, 0xffffff, S.pinkDark, 3);
  });
  make(scene, sweetPropKey('cottonTree'), 100, 128, (g) => {
    g.fillStyle(0xa8714d, 1);
    g.fillPoints([{ x: 44, y: 128 }, { x: 58, y: 128 }, { x: 55, y: 60 }, { x: 47, y: 60 }], true);
    g.lineStyle(2, 0x7a4e35, 1);
    g.strokePoints([{ x: 44, y: 128 }, { x: 58, y: 128 }, { x: 55, y: 60 }, { x: 47, y: 60 }], true);
    const puffs: [number, number, number][] = [
      [50, 40, 30],
      [26, 54, 22],
      [76, 52, 22],
      [34, 28, 20],
      [68, 26, 20],
      [50, 16, 18],
    ];
    g.fillStyle(S.pinkDark, 0.5);
    for (const [x, y, r] of puffs) g.fillCircle(x, y + 4, r);
    g.fillStyle(S.pinkLight, 1);
    for (const [x, y, r] of puffs) g.fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.55);
    for (const [x, y, r] of puffs) g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.32);
    const rand = seeded(91);
    for (let i = 0; i < 9; i++) g.fillStyle(SPRINKLES[i % SPRINKLES.length], 1).fillCircle(22 + rand() * 56, 14 + rand() * 50, 2);
  });
  make(scene, sweetPropKey('flowers'), 72, 30, (g) => {
    g.fillStyle(S.leaf, 1);
    for (const x of [10, 24, 38, 52, 64]) g.fillEllipse(x, 26, 12, 7);
    g.lineStyle(2, S.mintDark, 1);
    for (const x of [12, 28, 44, 58]) g.lineBetween(x, 28, x, 16);
    flower(g, 12, 13, 4.2, S.pink);
    flower(g, 28, 9, 4.6, S.lavender);
    flower(g, 44, 14, 4, 0xffffff, S.hotPink);
    flower(g, 58, 10, 4.4, S.peach);
  });
  make(scene, sweetPropKey('fence'), 104, 40, (g) => {
    g.fillStyle(0xe8b07a, 1);
    g.fillRoundedRect(2, 14, 100, 6, 3);
    g.fillRoundedRect(2, 26, 100, 6, 3);
    for (let x = 6; x < 100; x += 24) {
      g.fillStyle(0xf5c58e, 1);
      g.fillRoundedRect(x, 6, 12, 34, 3);
      g.fillStyle(S.pink, 1);
      g.fillCircle(x + 6, 7, 6);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(x + 4, 5, 2);
      g.lineStyle(1.6, S.caramel, 1);
      g.strokeRoundedRect(x, 6, 12, 34, 3);
    }
  });
  make(scene, sweetPropKey('sign'), 56, 64, (g) => {
    g.fillStyle(0xa8714d, 1);
    g.fillRoundedRect(25, 26, 7, 38, 2);
    const board: Pt[] = [
      { x: 4, y: 8 },
      { x: 40, y: 8 },
      { x: 52, y: 20 },
      { x: 40, y: 32 },
      { x: 4, y: 32 },
    ];
    g.fillStyle(0xd99a63, 1);
    g.fillPoints(board, true);
    g.fillStyle(0xe9b27c, 1);
    g.fillRect(8, 12, 30, 3);
    g.lineStyle(2, 0x7a4e35, 1);
    g.strokePoints(board, true);
    // Arrow only (no words): a direction, never a hint about traps.
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 14, y: 17 }, { x: 28, y: 17 }, { x: 28, y: 13 }, { x: 38, y: 20 }, { x: 28, y: 27 }, { x: 28, y: 23 }, { x: 14, y: 23 }], true);
    g.fillStyle(S.pink, 1);
    g.fillCircle(8, 10, 3);
  });
  make(scene, sweetPropKey('bush'), 76, 44, (g) => {
    const puffs: [number, number, number][] = [
      [20, 28, 16],
      [38, 20, 20],
      [56, 28, 16],
      [38, 32, 16],
    ];
    g.fillStyle(0x7c6bd6, 0.45);
    for (const [x, y, r] of puffs) g.fillCircle(x, y + 3, r);
    g.fillStyle(S.lavender, 1);
    for (const [x, y, r] of puffs) g.fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(30, 12, 16, 6);
    flower(g, 22, 22, 3.4, S.pink);
    flower(g, 46, 16, 3.6, 0xffffff, S.hotPink);
    flower(g, 56, 30, 3.2, S.peach);
  });
  make(scene, sweetPropKey('balloon'), 44, 76, (g) => {
    g.lineStyle(1.2, 0xa8714d, 1);
    g.lineBetween(15, 40, 18, 58);
    g.lineBetween(29, 40, 26, 58);
    swirl(g, 22, 22, 20, S.pinkLight, 0xffffff, S.pinkDark, 2);
    g.fillStyle(0xd99a63, 1);
    g.fillRoundedRect(15, 58, 14, 11, 3);
    g.lineStyle(1.5, 0x7a4e35, 1);
    g.strokeRoundedRect(15, 58, 14, 11, 3);
  });
  make(scene, sweetPropKey('candyCane'), 30, 76, (g) => {
    g.lineStyle(8, 0xffffff, 1);
    g.beginPath();
    g.arc(15, 16, 9, Math.PI, 0, false);
    g.strokePath();
    g.lineBetween(24, 16, 24, 74);
    g.lineStyle(8, 0xff6f91, 1);
    for (let y = 22; y < 72; y += 12) g.lineBetween(24, y, 24, y + 5);
    g.beginPath();
    g.arc(15, 16, 9, Math.PI * 1.15, Math.PI * 1.45, false);
    g.strokePath();
    g.beginPath();
    g.arc(15, 16, 9, Math.PI * 1.7, Math.PI * 1.95, false);
    g.strokePath();
  });
  make(scene, sweetPropKey('cupcake'), 44, 46, (g) => {
    g.fillStyle(0xf5c58e, 1);
    g.fillPoints([{ x: 8, y: 26 }, { x: 36, y: 26 }, { x: 32, y: 46 }, { x: 12, y: 46 }], true);
    g.lineStyle(1.4, S.caramel, 1);
    for (let x = 12; x < 34; x += 5) g.lineBetween(x, 27, x + 1, 45);
    g.fillStyle(S.pinkLight, 1);
    g.fillCircle(14, 24, 8);
    g.fillCircle(30, 24, 8);
    g.fillCircle(22, 17, 10);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(18, 13, 3);
    g.fillStyle(0xff4f7a, 1);
    g.fillCircle(23, 6, 4);
  });
  make(scene, sweetPropKey('wrapped'), 30, 18, (g) => {
    g.fillStyle(S.lemon, 1);
    g.fillPoints([{ x: 1, y: 2 }, { x: 9, y: 9 }, { x: 1, y: 16 }], true);
    g.fillPoints([{ x: 29, y: 2 }, { x: 21, y: 9 }, { x: 29, y: 16 }], true);
    g.fillStyle(S.hotPink, 1);
    g.fillEllipse(15, 9, 14, 12);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(12, 6, 5, 3);
  });
  make(scene, sweetPropKey('starCandy'), 22, 22, (g) => {
    g.fillStyle(S.lemon, 1);
    g.fillPoints(starPoints(11, 11.5, 10, 4.6), true);
    g.lineStyle(1.6, 0xe0b040, 1);
    g.strokePoints(starPoints(11, 11.5, 10, 4.6), true);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(8.5, 8.5, 1.8);
  });
  make(scene, sweetPropKey('gumdrop'), 20, 18, (g) => {
    g.fillStyle(S.mint, 1);
    g.fillRoundedRect(1, 3, 18, 15, { tl: 9, tr: 9, bl: 3, br: 3 });
    g.fillStyle(0xffffff, 0.8);
    for (const [x, y] of [
      [6, 7],
      [12, 6],
      [9, 11],
      [14, 12],
    ])
      g.fillCircle(x, y, 1.1);
  });
}

// ---------------------------------------------------------------------------------------------
// Backdrop layers (1024 px wide tiles: sky, clouds, castle, mountains + waterfalls, trees)
// ---------------------------------------------------------------------------------------------

const BW = 1024;
/** Things near a tile's edge are drawn again one tile left and right, so the repeat is seamless. */
const WRAP = [-BW, 0, BW];

function generateBackdrop(scene: Phaser.Scene): void {
  // Layer 1: sky with a soft rainbow and a warm glow.
  make(scene, 'sky_sweet', 256, 540, (g) => {
    for (let y = 0; y < 540; y += 6) {
      const t = y / 539;
      g.fillStyle(t < 0.55 ? lerpColor(S.skyTop, S.skyMid, t / 0.55) : lerpColor(S.skyMid, S.skyLow, (t - 0.55) / 0.45), 1);
      g.fillRect(0, y, 256, 6);
    }
  });
  make(scene, 'clouds_sweet', BW, 240, (g) => {
    // Rainbow arc (static on the cloud layer so it drifts slowly).
    const bands = [0xffb3c7, 0xffd6a5, 0xfff3a8, 0xc8f5c4, 0xb8e2ff, 0xd8c6ff];
    bands.forEach((c, i) => {
      g.lineStyle(7, c, 0.42);
      g.beginPath();
      g.arc(760, 250, 190 - i * 7, Math.PI, Math.PI * 2, false);
      g.strokePath();
    });
    for (const [x, y, s] of [
      [80, 70, 1.1],
      [330, 40, 0.8],
      [520, 110, 0.7],
      [640, 50, 1.0],
      [920, 90, 0.85],
      [1010, 60, 0.6],
      [-10, 140, 0.6],
    ] as const)
      for (const o of WRAP) cloud(g, x + o, y, s);
    // Floating candy islands.
    for (const [x, y, s] of [
      [440, 150, 1],
      [880, 175, 0.7],
    ] as const) {
      g.fillStyle(S.pinkLight, 1);
      g.fillPoints([{ x: x - 40 * s, y }, { x: x + 40 * s, y }, { x: x + 10 * s, y: y + 34 * s }, { x: x - 6 * s, y: y + 40 * s }], true);
      g.fillStyle(S.pink, 1);
      g.fillRoundedRect(x - 42 * s, y - 8 * s, 84 * s, 12 * s, 6 * s);
      g.fillStyle(S.leaf, 1);
      g.fillCircle(x - 14 * s, y - 16 * s, 12 * s);
      g.fillCircle(x + 6 * s, y - 20 * s, 14 * s);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x + 2 * s, y - 26 * s, 4 * s);
    }
    // Candy balloons.
    for (const [x, y, s, c] of [
      [250, 120, 0.9, S.pinkLight],
      [740, 30, 0.6, S.lavender],
    ] as const) {
      g.lineStyle(1, 0xa8714d, 0.9);
      g.lineBetween(x - 8 * s, y + 16 * s, x - 4 * s, y + 30 * s);
      g.lineBetween(x + 8 * s, y + 16 * s, x + 4 * s, y + 30 * s);
      swirl(g, x, y, 18 * s, c, 0xffffff, S.pinkDark, 2);
      g.fillStyle(0xd99a63, 1);
      g.fillRoundedRect(x - 6 * s, y + 30 * s, 12 * s, 8 * s, 2);
    }
  });

  // Layer 2: distant candy castle and hazy hills (pale, low contrast).
  make(scene, 'hills_far_sweet', BW, 300, (g) => {
    const haze = (c: number): number => lerpColor(c, S.skyMid, 0.35);
    g.fillStyle(haze(0xc9d6ff), 1);
    for (const [x, r] of [
      [60, 130],
      [300, 160],
      [560, 120],
      [820, 170],
    ])
      for (const o of WRAP) g.fillCircle(x + o, 300, r);
    // Castle.
    const cx = 610;
    const wall = haze(0xffe4f0);
    const roof = haze(S.hotPink);
    const tower = (x: number, top: number, w: number): void => {
      g.fillStyle(wall, 1);
      g.fillRect(x - w / 2, top, w, 300 - top);
      g.fillStyle(roof, 1);
      g.fillTriangle(x - w / 2 - 5, top + 2, x, top - w * 1.25, x + w / 2 + 5, top + 2);
      g.fillStyle(haze(0xffffff), 1);
      g.fillTriangle(x - 3, top - w * 0.9, x, top - w * 1.25, x + 2, top - w * 0.8);
      g.lineStyle(1.5, haze(0xa98ac9), 1);
      g.lineBetween(x, top - w * 1.25, x, top - w * 1.25 - 14);
      g.fillStyle(haze(S.pink), 1);
      g.fillTriangle(x, top - w * 1.25 - 14, x + 12, top - w * 1.25 - 10, x, top - w * 1.25 - 6);
      g.fillStyle(haze(S.lavender), 1);
      g.fillRoundedRect(x - 4, top + 14, 8, 12, { tl: 4, tr: 4, bl: 0, br: 0 });
    };
    g.fillStyle(wall, 1);
    g.fillRect(cx - 90, 200, 180, 100);
    for (let x = cx - 90; x < cx + 90; x += 16) g.fillRect(x, 192, 9, 10);
    tower(cx - 96, 150, 30);
    tower(cx + 96, 150, 30);
    tower(cx - 44, 120, 34);
    tower(cx + 44, 126, 30);
    tower(cx, 82, 40);
    g.fillStyle(haze(S.lavender), 1);
    g.fillRoundedRect(cx - 18, 246, 36, 54, { tl: 18, tr: 18, bl: 0, br: 0 });
    // Icing drips on the castle wall.
    g.fillStyle(haze(0xffffff), 1);
    g.fillRect(cx - 90, 200, 180, 6);
    for (let x = cx - 86; x < cx + 86; x += 14) g.fillRoundedRect(x, 202, 8, 8 + ((x * 7) % 9), 4);
    // Small far tower on the left.
    tower(170, 190, 26);
    tower(196, 210, 20);
  });

  // Layer 3: frosted candy mountains, wafer hill and syrup waterfalls.
  make(scene, 'hills_mid_sweet', BW, 260, (g) => {
    const rand = seeded(17);
    const mountain = (x: number, top: number, w: number, bodyIn: number, cap: number): void => {
      const body = lerpColor(bodyIn, S.skyMid, 0.22);
      // Dome: a big circle whose top is at `top`; the icing is the same circle shifted up.
      const r = w / 2;
      const cy = top + r;
      const capD = 18;
      g.fillStyle(lerpColor(body, 0x9f86e6, 0.18), 1);
      g.fillCircle(x + 6, cy + 4, r);
      g.fillStyle(cap, 1);
      g.fillCircle(x, cy, r);
      g.fillStyle(body, 1);
      g.fillCircle(x, cy + capD, r);
      // Drips hang from the icing edge (top of the body circle).
      g.fillStyle(cap, 1);
      for (let dx = -r * 0.7; dx < r * 0.7; dx += 12 + rand() * 10) {
        const edge = cy + capD - Math.sqrt(Math.max(0, r * r - dx * dx));
        const len = 6 + rand() * 16;
        g.fillRoundedRect(x + dx - 4, edge - 2, 8, len, 4);
        g.fillCircle(x + dx, edge + len - 3, 4.6);
      }
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(x - r * 0.35, top + 10, r * 0.45, 7);
      sprinkles(g, x - r * 0.5, top + 6, r, 10, 12, rand);
    };
    for (const o of WRAP) {
      mountain(130 + o, 60, 260, 0xffc6dc, 0xffffff);
      mountain(400 + o, 30, 300, 0xd9c8ff, 0xfff5fb);
      mountain(700 + o, 70, 260, 0xffd2b0, 0xffffff);
      mountain(930 + o, 40, 280, 0xffbfd8, 0xfff5fb);
    }
    // Wafer hill.
    g.fillStyle(0xf1c88f, 1);
    g.fillRoundedRect(540, 150, 120, 110, { tl: 50, tr: 50, bl: 0, br: 0 });
    g.lineStyle(2, 0xd8a066, 0.8);
    for (let x = 552; x < 660; x += 14) g.lineBetween(x, 160, x, 260);
    for (let y = 172; y < 260; y += 14) g.lineBetween(542, y, 658, y);
    // Waterfalls between mountains (pale blue syrup with foam).
    for (const [x, top, w] of [
      [262, 110, 34],
      [822, 120, 30],
    ] as const) {
      g.fillStyle(S.water, 1);
      g.fillRect(x - w / 2, top, w, 260 - top);
      g.fillStyle(0xffffff, 0.75);
      for (let i = 0; i < 6; i++) g.fillRect(x - w / 2 + 3 + i * (w / 6), top + (i % 3) * 14, 2.5, 260 - top - 20);
      g.fillStyle(0xffffff, 0.95);
      for (let i = 0; i < 6; i++) g.fillCircle(x - w / 2 + (i * w) / 5, 248, 9);
    }
    // Low pastel hill band so layers blend.
    g.fillStyle(0xbfeccd, 1);
    for (let x = 0; x <= BW; x += 128) g.fillCircle(x + 40, 290, 70);
  });

  // Layer 4: lollipop trees, cotton-candy trees, candy bushes and a grassy band.
  make(scene, 'hills_near_sweet', BW, 220, (g) => {
    const rand = seeded(29);
    const lolly = (x: number, top: number, r: number, c: number): void => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 3, top + r, 6, 220 - top - r);
      swirl(g, x, top, r, c, 0xffffff, S.pinkDark, 2.5);
    };
    const cotton = (x: number, top: number, s: number, c: number): void => {
      g.fillStyle(0xb57e58, 1);
      g.fillRect(x - 5 * s, top + 20 * s, 10 * s, 220 - top);
      g.fillStyle(lerpColor(c, 0x9b6fb0, 0.25), 1);
      for (const [dx, dy, r] of [
        [0, 4, 30],
        [-24, 18, 22],
        [24, 18, 22],
      ])
        g.fillCircle(x + dx * s, top + (dy + 4) * s, r * s);
      g.fillStyle(c, 1);
      for (const [dx, dy, r] of [
        [0, 0, 30],
        [-24, 14, 22],
        [24, 14, 22],
        [-12, -14, 18],
        [14, -12, 18],
      ])
        g.fillCircle(x + dx * s, top + dy * s, r * s);
      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(x - 10 * s, top - 16 * s, 7 * s);
    };
    for (const o of WRAP) {
      cotton(90 + o, 70, 1, S.pinkLight);
      lolly(220 + o, 80, 26, S.pink);
      cotton(360 + o, 90, 0.8, 0xc8b4ff);
      lolly(470 + o, 110, 18, S.lavender);
      cotton(610 + o, 64, 1.1, S.pinkLight);
      lolly(760 + o, 90, 24, 0xffc49b);
      cotton(900 + o, 84, 0.9, 0xffd6e8);
      lolly(990 + o, 120, 16, S.pink);
    }
    // Bushes and the grassy candy band.
    g.fillStyle(0xa9e5b6, 1);
    for (let x = 0; x <= BW; x += 64) g.fillCircle(x + 20, 214 + ((x / 64) % 2) * 4, 40);
    g.fillStyle(0xc3f0cb, 1);
    for (let x = 0; x <= BW; x += 64) g.fillCircle(x + 6, 206, 18);
    for (let i = 0; i < 26; i++) flower(g, rand() * BW, 186 + rand() * 26, 3.4, [S.pink, 0xffffff, S.lavender, S.peach][i % 4]);
  });
}

/** Builds the Candy Meadow textures once (called when Level 01 loads; cached afterwards). */
export function ensureSweetTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('sky_sweet')) return;
  generateBackdrop(scene);
  generateSkins(scene);
  generateProps(scene);
}
