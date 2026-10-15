import Phaser from 'phaser';

/**
 * Procedural art for the Chaos Dimension (Level 04): surreal pastel backdrop, gravity gates,
 * the dimension crystal and action icon, dimension blocks, the chaos wave and the cracked-world
 * overlay. Drawn once into cached textures, like the rest of the art.
 */

const PINK = 0xffb3c1;
const LAVENDER = 0xcdb4ff;
const PEACH = 0xffcf9b;
const MINT = 0xb7f0c1;
const SKY = 0x9ed8ff;
const INK = 0x4a3346;

/** Tints of the two dimensions: Sweet (bright pastel) and Glitch (lavender blue). */
export const DIM_TINT = { sweet: 0xffa9c6, glitch: 0x9fb2ff } as const;
export const DIM_LINE = { sweet: 0xe0709a, glitch: 0x6f7fe0 } as const;

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

export function generateDimensionTextures(scene: Phaser.Scene): void {
  // ----- Backdrop -----
  make(scene, 'sky_dimension', 8, 256, (g) => {
    const top = 0xd6c4ff;
    const mid = 0xffd9ec;
    const bottom = 0xfff0d2;
    for (let y = 0; y < 256; y += 4) {
      const t = y / 255;
      const c = t < 0.5 ? lerpColor(top, mid, t / 0.5) : lerpColor(mid, bottom, (t - 0.5) / 0.5);
      g.fillStyle(c, 1);
      g.fillRect(0, y, 8, 4);
    }
  });
  // Far layer: floating islands (some upside down), pastel planets and spirals.
  make(scene, 'hills_far_dimension', 512, 220, (g) => {
    for (const dx of [-512, 0, 512]) {
      // Planets.
      g.fillStyle(0xfff1c4, 0.9);
      g.fillCircle(70 + dx, 50, 22);
      g.lineStyle(3, 0xffc8dc, 0.9);
      g.strokeEllipse(70 + dx, 50, 64, 16);
      g.fillStyle(0xd7efff, 0.9);
      g.fillCircle(400 + dx, 34, 12);
      // Islands: a mound with a hanging root, and its upside-down twin above.
      for (const [x, y, s, flip] of [
        [190, 120, 1, false],
        [300, 52, 0.8, true],
        [470, 130, 0.9, false],
      ] as const) {
        const k = flip ? -1 : 1;
        g.fillStyle(0xe9dcff, 1);
        g.fillEllipse(x + dx, y, 70 * s, 22 * s);
        g.fillStyle(0xffd6e6, 1);
        g.fillTriangle(x + dx - 30 * s, y, x + dx + 30 * s, y, x + dx, y + k * 40 * s);
        g.fillStyle(0xd3f5dd, 1);
        g.fillEllipse(x + dx, y - k * 6 * s, 66 * s, 10 * s);
      }
      // Spirals.
      g.lineStyle(2.5, 0xffffff, 0.55);
      for (const [cx, cy] of [
        [120, 150],
        [350, 140],
      ] as const) {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let a = 0; a < Math.PI * 5; a += 0.3) pts.push({ x: cx + dx + Math.cos(a) * a * 2.2, y: cy + Math.sin(a) * a * 2.2 });
        g.strokePoints(pts, false);
      }
      g.fillStyle(0xe6d6ff, 1);
      g.fillCircle(90 + dx, 240, 110);
      g.fillCircle(330 + dx, 250, 140);
    }
    g.fillStyle(0xe6d6ff, 1);
    g.fillRect(0, 200, 512, 20);
  });
  // Near layer: checkerboard hills and melting clocks.
  make(scene, 'hills_near_dimension', 512, 180, (g) => {
    for (const dx of [-512, 0, 512]) {
      for (const [x, y] of [
        [140, 96],
        [410, 108],
      ] as const) {
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(x + dx, y, 20);
        g.fillTriangle(x + dx - 12, y + 12, x + dx + 4, y + 18, x + dx - 4, y + 36);
        g.lineStyle(2, LAVENDER, 1);
        g.strokeCircle(x + dx, y, 20);
        g.lineStyle(2.5, INK, 0.6);
        g.lineBetween(x + dx, y, x + dx, y - 12);
        g.lineBetween(x + dx, y, x + dx + 9, y + 4);
      }
      g.fillStyle(0xffe1ec, 1);
      g.fillCircle(80 + dx, 200, 110);
      g.fillCircle(510 + dx, 190, 95);
      g.fillStyle(0xe2f6ff, 1);
      g.fillCircle(300 + dx, 210, 125);
      // Checker band on the middle hill.
      for (let i = 0; i < 10; i++) {
        g.fillStyle(i % 2 ? 0xd9ccff : 0xfff3d6, 1);
        g.fillRect(230 + dx + i * 14, 120 + (i % 2) * 6, 14, 10);
      }
    }
    g.fillStyle(0xf1e8ff, 1);
    g.fillRect(0, 162, 512, 18);
  });

  // ----- Gravity gate -----
  // One cell of a gate beam: a soft column with an up-pointing chevron (flipped for "down").
  make(scene, 'grav_cell', 32, 48, (g) => {
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(4, 0, 24, 48, 8);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(16, 10, 27, 24, 5, 24);
    g.fillStyle(0xffffff, 0.75);
    g.fillRect(12, 24, 8, 12);
  });
  // Indicator over MOCHI before a flip.
  make(scene, 'grav_icon', 30, 30, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 15, 14);
    g.lineStyle(2.5, INK, 0.8);
    g.strokeCircle(15, 15, 13);
    g.fillStyle(0xb48cff, 1);
    g.fillTriangle(15, 5, 23, 14, 7, 14);
    g.fillTriangle(15, 25, 23, 16, 7, 16);
  });

  // ----- Dimension switch -----
  make(scene, 'dim_crystal', 44, 72, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(22, 66, 40, 10);
    g.fillStyle(DIM_TINT.sweet, 1);
    g.fillTriangle(22, 4, 38, 30, 22, 62);
    g.fillStyle(DIM_TINT.glitch, 1);
    g.fillTriangle(22, 4, 6, 30, 22, 62);
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(22, 8, 28, 26, 22, 40);
    g.lineStyle(2, INK, 0.55);
    g.strokePoints(
      [
        { x: 22, y: 4 },
        { x: 38, y: 30 },
        { x: 22, y: 62 },
        { x: 6, y: 30 },
      ],
      true,
    );
  });
  // HUD action icon: a split star (Sweet half and Glitch half).
  make(scene, 'icon_dimension', 40, 40, (g) => {
    const pts = (cx: number, cy: number, o: number, i: number): Phaser.Types.Math.Vector2Like[] => {
      const out: Phaser.Types.Math.Vector2Like[] = [];
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 4;
        const r = k % 2 ? i : o;
        out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return out;
    };
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts(20, 20, 18, 7), true);
    g.fillStyle(DIM_TINT.sweet, 1);
    g.fillTriangle(20, 6, 20, 34, 9, 20);
    g.fillStyle(DIM_TINT.glitch, 1);
    g.fillTriangle(20, 6, 20, 34, 31, 20);
    g.lineStyle(2, INK, 0.8);
    g.strokePoints(pts(20, 20, 18, 7), true);
  });
  make(scene, 'nope_x', 26, 26, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(13, 13, 12);
    g.lineStyle(4, 0xe0607e, 1);
    g.lineBetween(8, 8, 18, 18);
    g.lineBetween(18, 8, 8, 18);
  });

  // ----- Chaos wave -----
  make(scene, 'chaos_tile', 64, 64, (g) => {
    g.fillStyle(0x9a7ae6, 1);
    g.fillRect(0, 0, 64, 64);
    const rows = [0xff8fb8, 0x8fb2ff, 0xc39bff, 0xffb3d9, 0x7f6ad8];
    for (let y = 0; y < 64; y += 8) {
      for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 16) {
        g.fillStyle(rows[(x + y) % rows.length], 0.9);
        g.fillRect(x, y, 10 + ((x * 7 + y) % 9), 6);
      }
    }
    g.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 6; i++) g.fillRect((i * 23) % 60, (i * 37) % 60, 3, 3);
  });
  make(scene, 'chaos_edge', 40, 64, (g) => {
    g.fillStyle(0x9a7ae6, 1);
    g.fillRect(0, 0, 16, 64);
    g.fillCircle(16, 12, 14);
    g.fillCircle(20, 40, 16);
    g.fillStyle(0xff8fb8, 1);
    g.fillCircle(26, 22, 8);
    g.fillStyle(0x8fb2ff, 1);
    g.fillCircle(30, 50, 7);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(24, 10, 3);
    g.fillCircle(32, 36, 2.5);
  });
  make(scene, 'warn_icon', 30, 30, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(15, 2, 29, 27, 1, 27);
    g.lineStyle(2.5, 0xe0607e, 1);
    g.strokeTriangle(15, 2, 29, 27, 1, 27);
    g.fillStyle(0xe0607e, 1);
    g.fillRect(13.5, 10, 3, 9);
    g.fillCircle(15, 22.5, 2);
  });

  // ----- Reality collapse: light screen cracks -----
  make(scene, 'crack_overlay', 512, 288, (g) => {
    const crack = (pts: number[][], width: number): void => {
      g.lineStyle(width + 2, 0x7f6ad8, 0.35);
      g.strokePoints(pts.map(([x, y]) => ({ x, y })), false);
      g.lineStyle(width, 0xffffff, 0.9);
      g.strokePoints(pts.map(([x, y]) => ({ x, y })), false);
    };
    crack([[0, 40], [40, 52], [70, 44], [110, 70], [150, 66]], 2);
    crack([[70, 44], [86, 18], [84, 0]], 1.5);
    crack([[512, 230], [470, 222], [440, 240], [400, 236], [372, 262], [350, 288]], 2);
    crack([[440, 240], [452, 270], [446, 288]], 1.5);
    crack([[512, 30], [486, 44], [480, 72]], 1.5);
    crack([[0, 250], [26, 242], [44, 260]], 1.5);
  });
}

/** A dimension block of any size (white, tinted per dimension). */
export function dimBlockTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `dimblock_${w}x${h}`;
  make(scene, key, w, h, (g) => {
    g.fillStyle(0xd9d9e6, 1);
    g.fillRoundedRect(0, 2, w, h - 2, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h - 3, 8);
    g.fillStyle(0xf0f0f6, 1);
    for (let y = 8; y < h - 8; y += 16) {
      for (let x = (y / 8) % 4 ? 12 : 4; x < w - 8; x += 16) g.fillRect(x, y, 8, 8);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(4, 3, w - 8, 3, 1.5);
    g.lineStyle(2, 0x9a9ab0, 1);
    g.strokeRoundedRect(1, 1, w - 2, h - 4, 8);
  });
  return key;
}

/** Dashed outline of a dimension block: what a block from the other dimension looks like. */
export function dimOutlineTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `dimoutline_${w}x${h}`;
  make(scene, key, w, h, (g) => {
    g.fillStyle(0xffffff, 1);
    const dash = 8;
    for (let x = 4; x < w - 4; x += dash * 2) {
      g.fillRect(x, 0, Math.min(dash, w - 4 - x), 3);
      g.fillRect(x, h - 3, Math.min(dash, w - 4 - x), 3);
    }
    for (let y = 4; y < h - 4; y += dash * 2) {
      g.fillRect(0, y, 3, Math.min(dash, h - 4 - y));
      g.fillRect(w - 3, y, 3, Math.min(dash, h - 4 - y));
    }
  });
  return key;
}

/** Platform style for the Chaos Dimension: cream body with pastel diamonds and a pink-lavender cap. */
export function drawDimensionPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, cracked = false): void {
  const r = Math.min(12, h / 2, w / 2);
  const capH = Math.min(13, h - 4);
  g.fillStyle(0xfff0e6, 1);
  g.fillRoundedRect(0, 4, w, h - 4, { tl: 4, tr: 4, bl: r, br: r });
  // Diamonds in alternating rows.
  const colors = [LAVENDER, PEACH, SKY, MINT];
  let i = 0;
  for (let y = capH + 12; y < h - 8; y += 18) {
    for (let x = (i % 2) * 14 + 10; x < w - 8; x += 28) {
      g.fillStyle(colors[(i + Math.floor(x / 28)) % colors.length], 0.85);
      g.fillTriangle(x, y - 6, x + 6, y, x, y + 6);
      g.fillTriangle(x, y - 6, x - 6, y, x, y + 6);
    }
    i++;
  }
  if (h > 28) {
    g.fillStyle(0xf2d6e8, 1);
    g.fillRoundedRect(0, h - 8, w, 8, { tl: 0, tr: 0, bl: r, br: r });
  }
  if (cracked) {
    g.lineStyle(1.6, 0xb0609a, 0.85);
    const cx = w * 0.5;
    g.strokePoints(
      [
        { x: cx - 6, y: capH + 2 },
        { x: cx - 2, y: capH + 7 },
        { x: cx - 5, y: capH + 11 },
        { x: cx, y: Math.min(h - 3, capH + 16) },
      ],
      false,
    );
  }
  g.lineStyle(2, 0xd59cc4, 1);
  g.strokeRoundedRect(0, 4, w, h - 4, { tl: 4, tr: 4, bl: r, br: r });
  // Cap: pink with a lavender drip edge.
  g.fillStyle(0xffc4dc, 1);
  g.fillRoundedRect(-2, 0, w + 4, capH, Math.min(7, capH / 2));
  for (let x = 6; x < w; x += 14) {
    g.fillStyle(x % 28 < 14 ? PINK : 0xe2d2ff, 1);
    g.fillCircle(x, capH - 1, 4.5);
  }
  g.fillStyle(0xfff3f8, 1);
  g.fillRoundedRect(3, 2.5, w - 6, 3.5, 1.8);
  g.lineStyle(2, 0xe48ab4, 1);
  g.strokeRoundedRect(-2, 0, w + 4, capH, Math.min(7, capH / 2));
}
