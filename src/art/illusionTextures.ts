import Phaser from 'phaser';

/**
 * Procedural art for the Illusion World (Level 03): backdrop, signs, truth tells (mint sprouts,
 * spike holes), mirrors, doors, ghost puzzle parts and reality-shift slabs. Drawn once into
 * cached textures, like the rest of the art. Pastel palette: mint, pink, lavender, butter, sky.
 */

const MINT = 0xb7f0c1;
const MINT_DARK = 0x5aa877;
const PINK = 0xffb3c1;
const LAVENDER = 0xcdb4ff;
const LAVENDER_DARK = 0x9d82e0;
const BUTTER = 0xfff1a8;
const SKY = 0x9ed8ff;
const INK = 0x4a3346;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

export function generateIllusionTextures(scene: Phaser.Scene): void {
  // ----- Backdrop -----
  make(scene, 'sky_illusion', 8, 256, (g) => {
    const top = 0xbfe3ff;
    const mid = 0xe9ddff;
    const bottom = 0xfff3cf;
    for (let y = 0; y < 256; y += 4) {
      const t = y / 255;
      const c = t < 0.55 ? lerpColor(top, mid, t / 0.55) : lerpColor(mid, bottom, (t - 0.55) / 0.45);
      g.fillStyle(c, 1);
      g.fillRect(0, y, 8, 4);
    }
  });
  // Far layer: soft hills with floating crystal shards and an upside-down twin of each hill.
  make(scene, 'hills_far_illusion', 512, 220, (g) => {
    for (const dx of [-512, 0, 512]) {
      g.fillStyle(0xe4d8ff, 1);
      g.fillCircle(90 + dx, 220, 120);
      g.fillCircle(320 + dx, 240, 150);
      g.fillCircle(490 + dx, 210, 110);
      // Floating crystals.
      for (const [x, y, s, c] of [
        [60, 70, 1, 0xd7efff],
        [200, 40, 0.8, 0xffd6e0],
        [330, 85, 1.2, 0xd8f6e2],
        [450, 50, 0.9, 0xfff1c4],
      ] as const) {
        g.fillStyle(c, 0.95);
        g.fillTriangle(x + dx, y - 22 * s, x + dx + 12 * s, y, x + dx, y + 22 * s);
        g.fillTriangle(x + dx, y - 22 * s, x + dx - 12 * s, y, x + dx, y + 22 * s);
        g.fillStyle(0xffffff, 0.6);
        g.fillTriangle(x + dx, y - 22 * s, x + dx + 5 * s, y - 4 * s, x + dx, y + 4 * s);
      }
    }
    g.fillStyle(0xe4d8ff, 1);
    g.fillRect(0, 196, 512, 24);
  });
  // Near layer: butter and mint hills with tall mirror panes.
  make(scene, 'hills_near_illusion', 512, 180, (g) => {
    for (const dx of [-512, 0, 512]) {
      for (const [x, h] of [
        [150, 74],
        [400, 60],
      ] as const) {
        g.fillStyle(0xffffff, 0.9);
        g.fillRoundedRect(x - 20 + dx, 130 - h, 40, h, 18);
        g.fillStyle(0xd7efff, 1);
        g.fillRoundedRect(x - 15 + dx, 135 - h, 30, h - 10, 14);
        g.fillStyle(0xffffff, 0.75);
        g.fillRect(x - 8 + dx, 142 - h, 4, h - 26);
        g.fillRect(x - 1 + dx, 146 - h, 2, h - 34);
      }
      g.fillStyle(0xfff0c2, 1);
      g.fillCircle(90 + dx, 195, 110);
      g.fillCircle(520 + dx, 185, 90);
      g.fillStyle(0xd3f5dd, 1);
      g.fillCircle(320 + dx, 205, 130);
    }
    g.fillStyle(0xe8f5df, 1);
    g.fillRect(0, 162, 512, 18);
  });

  // ----- Signs and truth tells -----
  // Tutorial sign board (text is added on top). Every sign looks equally trustworthy.
  make(scene, 'sign_board', 128, 84, (g) => {
    g.fillStyle(0xc99a6b, 1);
    g.fillRoundedRect(58, 40, 12, 44, 3);
    g.fillStyle(0xd9a873, 1);
    g.fillRoundedRect(2, 4, 124, 50, 10);
    g.fillStyle(0xfff6e0, 1);
    g.fillRoundedRect(7, 8, 114, 42, 8);
    g.lineStyle(2.5, 0xa8744a, 1);
    g.strokeRoundedRect(2, 4, 124, 50, 10);
    g.fillStyle(0xa8744a, 1);
    g.fillCircle(12, 13, 2);
    g.fillCircle(116, 13, 2);
  });
  // Mint sprouts: they only grow on ground that is really there.
  make(scene, 'sprout', 18, 14, (g) => {
    g.fillStyle(MINT_DARK, 1);
    g.fillRect(8, 6, 2, 8);
    g.fillStyle(0x8fe0a8, 1);
    g.fillEllipse(5, 6, 9, 6);
    g.fillEllipse(13, 4, 9, 6);
    g.fillStyle(0xd9ffe4, 1);
    g.fillEllipse(4, 5, 4, 2);
    g.fillEllipse(12, 3, 4, 2);
  });
  // Tiny holes in the ground: something sharp sleeps underneath.
  make(scene, 'holes', 32, 6, (g) => {
    g.fillStyle(0x7a6699, 0.85);
    for (const x of [6, 16, 26]) g.fillEllipse(x, 3, 5, 3);
  });

  // ----- Mirrors -----
  make(scene, 'mirror_panel', 84, 132, (g) => {
    g.fillStyle(LAVENDER_DARK, 1);
    g.fillRoundedRect(0, 0, 84, 132, 40);
    g.fillStyle(0xfff1c4, 1);
    g.fillRoundedRect(4, 4, 76, 124, 36);
    g.fillStyle(0xe5f4ff, 1);
    g.fillRoundedRect(10, 10, 64, 112, 30);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(20, 24, 6, 70);
    g.fillRect(30, 30, 3, 50);
    g.fillStyle(PINK, 1);
    g.fillCircle(42, 4, 6);
  });

  // ----- Doors (Zone 5) -----
  make(scene, 'door_frame', 72, 104, (g) => {
    g.fillStyle(0xb79be8, 1);
    g.fillRoundedRect(0, 0, 72, 104, { tl: 36, tr: 36, bl: 4, br: 4 });
    g.fillStyle(0x6d5a9c, 1);
    g.fillRoundedRect(8, 8, 56, 96, { tl: 28, tr: 28, bl: 0, br: 0 });
    g.lineStyle(3, 0x8f78c8, 1);
    g.strokeRoundedRect(1.5, 1.5, 69, 101, { tl: 35, tr: 35, bl: 4, br: 4 });
  });
  make(scene, 'door_panel', 28, 92, (g) => {
    g.fillStyle(0xf6e7ff, 1);
    g.fillRoundedRect(0, 0, 28, 92, 4);
    g.fillStyle(0xe5d4fb, 1);
    g.fillRoundedRect(4, 8, 20, 32, 3);
    g.fillRoundedRect(4, 48, 20, 36, 3);
    g.lineStyle(2, 0xa58fdc, 1);
    g.strokeRoundedRect(1, 1, 26, 90, 4);
  });
  make(scene, 'door_knob', 8, 8, (g) => {
    g.fillStyle(0xffd36b, 1);
    g.fillCircle(4, 4, 3.5);
  });

  // ----- Ghost puzzle -----
  make(scene, 'ghost_shrine', 44, 70, (g) => {
    g.fillStyle(0xd9cdf5, 1);
    g.fillRoundedRect(4, 50, 36, 20, 6);
    g.lineStyle(2, LAVENDER_DARK, 1);
    g.strokeRoundedRect(4, 50, 36, 20, 6);
    g.fillStyle(LAVENDER, 1);
    g.fillTriangle(22, 4, 36, 28, 22, 50);
    g.fillTriangle(22, 4, 8, 28, 22, 50);
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(22, 6, 29, 26, 22, 30);
  });
  make(scene, 'plate_up', 64, 12, (g) => {
    g.fillStyle(0x8f78c8, 1);
    g.fillRoundedRect(0, 6, 64, 6, 3);
    g.fillStyle(LAVENDER, 1);
    g.fillRoundedRect(6, 0, 52, 9, 4);
    g.fillStyle(0xffffff, 0.6);
    g.fillRoundedRect(10, 1.5, 44, 2.5, 1.2);
  });
  make(scene, 'plate_down', 64, 12, (g) => {
    g.fillStyle(0x8f78c8, 1);
    g.fillRoundedRect(0, 6, 64, 6, 3);
    g.fillStyle(MINT, 1);
    g.fillRoundedRect(6, 5, 52, 5, 3);
  });

  // ----- Shared small bits -----
  make(scene, 'lamp', 22, 22, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(11, 11, 9);
    g.lineStyle(2, INK, 0.5);
    g.strokeCircle(11, 11, 9.5);
  });
  make(scene, 'lamp_glow', 48, 48, (g) => {
    for (let r = 24; r > 0; r -= 3) {
      g.fillStyle(0xffffff, 0.06 + (24 - r) * 0.012);
      g.fillCircle(24, 24, r);
    }
  });
  // Butter/sky dots so the palette is all present (used by small pops of colour).
  make(scene, 'illusion_dot', 10, 10, (g) => {
    g.fillStyle(BUTTER, 1);
    g.fillCircle(5, 5, 4);
    g.fillStyle(SKY, 1);
    g.fillCircle(6, 4, 1.5);
  });
}

/**
 * A white crystal slab (tinted per use) for reality-shift platforms and the ghost bridge. Kept
 * clearly different from ground: thin, glassy, with corner gems.
 */
export const SLAB_H = 20;
export function slabTexture(scene: Phaser.Scene, w: number): string {
  const key = `slab_${w}`;
  make(scene, key, w, SLAB_H + 2, (g) => {
    g.fillStyle(0xd9d9e6, 1);
    g.fillRoundedRect(0, 2, w, SLAB_H, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, SLAB_H, 8);
    g.fillStyle(0xf0f0f6, 1);
    for (let x = 14; x < w - 8; x += 18) g.fillTriangle(x, 4, x + 6, SLAB_H / 2, x, SLAB_H - 4);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(4, 3, w - 8, 3, 1.5);
    g.lineStyle(2, 0x9a9ab0, 1);
    g.strokeRoundedRect(1, 1, w - 2, SLAB_H - 2, 8);
  });
  return key;
}

/** Dashed outline of a slab: what a PHANTOM platform looks like (you can see it, you can't stand on it). */
export function slabOutlineTexture(scene: Phaser.Scene, w: number): string {
  const key = `slab_outline_${w}`;
  make(scene, key, w, SLAB_H, (g) => {
    g.fillStyle(0xffffff, 1);
    const dash = 8;
    for (let x = 4; x < w - 4; x += dash * 2) {
      g.fillRect(x, 0, Math.min(dash, w - 4 - x), 3);
      g.fillRect(x, SLAB_H - 3, Math.min(dash, w - 4 - x), 3);
    }
    for (let y = 4; y < SLAB_H - 4; y += 8) {
      g.fillRect(0, y, 3, 4);
      g.fillRect(w - 3, y, 3, 4);
    }
  });
  return key;
}

/** Light-bar gate (ghost puzzle). `h` in px. */
export function gateTexture(scene: Phaser.Scene, h: number): string {
  const key = `gate_${h}`;
  make(scene, key, 32, h, (g) => {
    g.fillStyle(0x8f78c8, 1);
    g.fillRoundedRect(2, 0, 28, h, 6);
    g.fillStyle(LAVENDER, 1);
    g.fillRoundedRect(5, 3, 22, h - 6, 5);
    g.fillStyle(0xffffff, 0.55);
    for (let y = 10; y < h - 8; y += 16) g.fillRoundedRect(8, y, 16, 5, 2.5);
    g.fillStyle(PINK, 1);
    g.fillCircle(16, 8, 3);
  });
  return key;
}
