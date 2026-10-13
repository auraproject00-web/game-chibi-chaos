import Phaser from 'phaser';
import { PALETTE, TILE, TONES } from '../config';
import { generateMochiTextures } from './mochi';

/**
 * Procedural placeholder art. Everything is drawn once at boot into textures so the
 * prototype has no external image dependencies. Replace keys with real images later
 * by loading files under public/assets with the same texture keys.
 */

type Pt = { x: number; y: number };

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Deterministic pseudo random so platforms look the same every run. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
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

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/**
 * Draws a rounded grassy platform into a Graphics object at local (0, 0).
 * `cracked` adds a subtle tell used by fake platforms so the trap stays learnable.
 */
export function drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, cracked = false): void {
  const rand = seeded(Math.round(w * 31 + h * 17));
  const r = Math.min(12, h / 2, w / 2);
  const grassH = Math.min(14, h - 4);

  // Dirt body.
  g.fillStyle(TONES.dirt, 1);
  g.fillRoundedRect(0, 4, w, h - 4, { tl: 4, tr: 4, bl: r, br: r });
  if (h > 28) {
    g.fillStyle(TONES.dirtDark, 1);
    g.fillRoundedRect(0, h - 8, w, 8, { tl: 0, tr: 0, bl: r, br: r });
  }
  // Dirt pebbles.
  const pebbles = Math.floor((w * h) / 700);
  g.fillStyle(TONES.dirtDark, 0.8);
  for (let i = 0; i < pebbles; i++) {
    const px = 6 + rand() * (w - 12);
    const py = grassH + 6 + rand() * Math.max(1, h - grassH - 14);
    g.fillEllipse(px, py, 5 + rand() * 4, 3 + rand() * 2);
  }
  if (cracked) {
    g.lineStyle(1.6, TONES.dirtOutline, 0.75);
    const cx = w * 0.5;
    g.strokePoints(
      [
        { x: cx - 6, y: grassH + 2 },
        { x: cx - 2, y: grassH + 7 },
        { x: cx - 5, y: grassH + 11 },
        { x: cx, y: Math.min(h - 3, grassH + 16) },
      ],
      false,
    );
  }
  g.lineStyle(2, TONES.dirtOutline, 1);
  g.strokeRoundedRect(0, 4, w, h - 4, { tl: 4, tr: 4, bl: r, br: r });

  // Grass cap with scalloped edge.
  g.fillStyle(TONES.grass, 1);
  g.fillRoundedRect(-2, 0, w + 4, grassH, Math.min(7, grassH / 2));
  for (let x = 6; x < w; x += 12) g.fillCircle(x, grassH, 5);
  g.fillStyle(TONES.grassLight, 1);
  g.fillRoundedRect(2, 2.5, w - 4, 4, 2);
  g.lineStyle(2, TONES.mintDark, 1);
  g.strokeRoundedRect(-2, 0, w + 4, grassH, Math.min(7, grassH / 2));

  // A few tiny flowers.
  const flowers = Math.floor(w / 90);
  for (let i = 0; i < flowers; i++) {
    const fx = 12 + rand() * (w - 24);
    g.fillStyle(rand() > 0.5 ? PALETTE.pink : PALETTE.cream, 1);
    g.fillCircle(fx, 1, 2.6);
    g.fillStyle(PALETTE.peach, 1);
    g.fillCircle(fx, 1, 1.1);
  }
}

/** Pixels of padding around a baked platform texture (grass cap and flowers overhang the box). */
export const PLATFORM_PAD = { x: 2, y: 3 } as const;

/**
 * Bakes a platform of the given size into a cached texture. Static art as textures is far cheaper
 * to render than Graphics, which WebGL re-tessellates every frame.
 */
export function platformTexture(scene: Phaser.Scene, w: number, h: number, cracked = false): string {
  const key = `platform_${w}x${h}${cracked ? '_cracked' : ''}`;
  if (!scene.textures.exists(key)) {
    make(scene, key, w + PLATFORM_PAD.x * 2, h + PLATFORM_PAD.y, (g) => {
      g.translateCanvas(PLATFORM_PAD.x, PLATFORM_PAD.y);
      drawPlatform(g, w, h, cracked);
    });
  }
  return key;
}

/** Height in px of a falling-platform plank. */
export const PLANK_H = 18;

/** Wooden plank for falling platforms: warm peach wood, so it never reads as solid grass. */
export function plankTexture(scene: Phaser.Scene, w: number): string {
  const key = `plank_${w}`;
  if (!scene.textures.exists(key)) {
    make(scene, key, w, PLANK_H, (g) => {
      g.fillStyle(0xf2b880, 1);
      g.fillRoundedRect(0, 0, w, PLANK_H, 6);
      g.fillStyle(0xffd6a8, 1);
      g.fillRoundedRect(3, 2, w - 6, 4, 2);
      g.lineStyle(1.5, 0xc98a5a, 0.8);
      for (let x = 24; x < w - 8; x += 26) g.lineBetween(x, 5, x, PLANK_H - 4);
      g.fillStyle(0xa86f45, 1);
      g.fillCircle(7, PLANK_H / 2 + 1, 2);
      g.fillCircle(w - 7, PLANK_H / 2 + 1, 2);
      g.lineStyle(2, 0xa86f45, 1);
      g.strokeRoundedRect(1, 1, w - 2, PLANK_H - 2, 6);
    });
  }
  return key;
}

export function generateTextures(scene: Phaser.Scene): void {
  generateMochiTextures(scene);

  // Particles.
  make(scene, 'dot', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
  });
  make(scene, 'ring', 64, 64, (g) => {
    g.lineStyle(5, 0xffffff, 1);
    g.strokeCircle(32, 32, 26);
    g.lineStyle(2, PALETTE.pink, 0.9);
    g.strokeCircle(32, 32, 21);
  });
  make(scene, 'confetti', 10, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 10, 6, 2);
  });
  make(scene, 'sparkle', 20, 20, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints(starPoints(10, 10, 9, 3.5, 4), true);
  });

  // Spikes: one tile wide, two points.
  make(scene, 'spike', TILE, 24, (g) => {
    for (let i = 0; i < 2; i++) {
      const x0 = i * 16;
      const tri: Pt[] = [
        { x: x0 + 1, y: 24 },
        { x: x0 + 8, y: 2 },
        { x: x0 + 15, y: 24 },
      ];
      g.fillStyle(TONES.spike, 1);
      g.fillPoints(tri, true);
      g.fillStyle(0xffffff, 0.45);
      g.fillPoints(
        [
          { x: x0 + 5, y: 20 },
          { x: x0 + 8, y: 6 },
          { x: x0 + 8.8, y: 20 },
        ],
        true,
      );
      g.lineStyle(2, TONES.spikeDark, 1);
      g.strokePoints(tri, true);
    }
  });

  // Checkpoint flags.
  const flag = (key: string, color: number, dark: number, star: boolean): void =>
    make(scene, key, 48, 72, (g) => {
      g.fillStyle(0x9c6b4a, 1);
      g.fillRoundedRect(10, 8, 5, 62, 2);
      g.fillStyle(PALETTE.cream, 1);
      g.fillCircle(12.5, 8, 4.5);
      g.lineStyle(1.5, 0x7a5038, 1);
      g.strokeCircle(12.5, 8, 4.5);
      const tri: Pt[] = [
        { x: 15, y: 12 },
        { x: 44, y: 22 },
        { x: 15, y: 34 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(tri, true);
      g.lineStyle(2, dark, 1);
      g.strokePoints(tri, true);
      if (star) {
        g.fillStyle(0xffffff, 1);
        g.fillPoints(starPoints(25, 23, 5, 2.2), true);
      }
      g.fillStyle(TONES.grass, 1);
      g.fillEllipse(12.5, 70, 22, 6);
    });
  flag('flag_off', 0xe5dcf3, 0xb3a3d0, false);
  flag('flag_on', PALETTE.pink, TONES.pinkDark, true);

  // Fake checkpoint: same colors as an unused flag, but the pole leans (the learnable tell).
  // Once exposed it becomes a cheeky flag sticking its tongue out.
  const crookedFlag = (key: string, color: number, dark: number, troll: boolean): void =>
    make(scene, key, 48, 72, (g) => {
      g.fillStyle(0x9c6b4a, 1);
      g.fillPoints(
        [
          { x: 10, y: 70 },
          { x: 15, y: 70 },
          { x: 19, y: 8 },
          { x: 14, y: 8 },
        ],
        true,
      );
      g.fillStyle(PALETTE.cream, 1);
      g.fillCircle(16.5, 8, 4.5);
      g.lineStyle(1.5, 0x7a5038, 1);
      g.strokeCircle(16.5, 8, 4.5);
      const tri: Pt[] = [
        { x: 19, y: 12 },
        { x: 46, y: 24 },
        { x: 18, y: 34 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(tri, true);
      g.lineStyle(2, dark, 1);
      g.strokePoints(tri, true);
      if (troll) {
        g.fillStyle(TONES.ink, 1);
        g.fillCircle(25, 20, 1.8);
        g.fillCircle(31, 21, 1.8);
        g.fillStyle(0xff6f91, 1);
        g.fillEllipse(28.5, 28, 6, 5);
      }
      g.fillStyle(TONES.grass, 1);
      g.fillEllipse(12.5, 70, 22, 6);
    });
  crookedFlag('flag_fake', 0xe5dcf3, 0xb3a3d0, false);
  crookedFlag('flag_troll', PALETTE.peach, 0xd98b4a, true);

  // Bait coin.
  make(scene, 'coin', 26, 26, (g) => {
    g.fillStyle(0xe0a83a, 1);
    g.fillCircle(13, 13, 12);
    g.fillStyle(0xffd86b, 1);
    g.fillCircle(13, 13, 9.5);
    g.fillStyle(0xfff1b8, 1);
    g.fillPoints(starPoints(13, 13, 6, 2.6), true);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(8.5, 8, 4, 2.5);
    g.lineStyle(1.5, 0xb57f22, 1);
    g.strokeCircle(13, 13, 12);
  });

  // Reverse-controls swirl.
  make(scene, 'swirl', 34, 34, (g) => {
    g.fillStyle(PALETTE.lavender, 1);
    g.fillCircle(17, 17, 15);
    g.lineStyle(2, TONES.lavenderDark, 1);
    g.strokeCircle(17, 17, 15);
    g.lineStyle(2.6, 0xffffff, 1);
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = i * 0.32;
      const r = 1.5 + i * 0.3;
      const px = 17 + Math.cos(a) * r;
      const py = 17 + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  });

  // Finish portal.
  make(scene, 'portal', 72, 72, (g) => {
    const rings = [PALETTE.lavender, PALETTE.sky, 0xc8ecff, PALETTE.cream, 0xffffff];
    rings.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillCircle(36, 36, 34 - i * 6.5);
    });
    g.lineStyle(3, 0xffffff, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(36, 36, 22, a, a + 1.2);
      g.strokePath();
    }
    g.lineStyle(2.5, TONES.lavenderDark, 1);
    g.strokeCircle(36, 36, 34);
  });
  make(scene, 'glow', 128, 128, (g) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle(0xffffff, 0.05);
      g.fillCircle(64, 64, 64 - i * 4);
    }
  });

  // HUD icons.
  make(scene, 'icon_pause', 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(8, 6, 6, 20, 3);
    g.fillRoundedRect(18, 6, 6, 20, 3);
  });
  make(scene, 'icon_restart', 32, 32, (g) => {
    g.lineStyle(4, 0xffffff, 1);
    g.beginPath();
    g.arc(16, 17, 9, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(230));
    g.strokePath();
    g.fillStyle(0xffffff, 1);
    g.fillPoints(
      [
        { x: 18, y: 2 },
        { x: 27, y: 9 },
        { x: 17, y: 14 },
      ],
      true,
    );
  });
  const speaker = (g: Phaser.GameObjects.Graphics): void => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(5, 12, 6, 8);
    g.fillTriangle(9, 16, 18, 6, 18, 26);
  };
  make(scene, 'icon_sound_on', 32, 32, (g) => {
    speaker(g);
    g.lineStyle(2.6, 0xffffff, 1);
    g.beginPath();
    g.arc(18, 16, 6, -0.9, 0.9);
    g.strokePath();
    g.beginPath();
    g.arc(18, 16, 11, -0.9, 0.9);
    g.strokePath();
  });
  make(scene, 'icon_sound_off', 32, 32, (g) => {
    speaker(g);
    g.lineStyle(3, 0xffffff, 1);
    g.lineBetween(21, 11, 29, 21);
    g.lineBetween(29, 11, 21, 21);
  });
  make(scene, 'skull', 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 14, 11);
    g.fillRoundedRect(9, 18, 14, 10, 3);
    g.fillStyle(TONES.ink, 1);
    g.fillCircle(11.5, 14, 3.4);
    g.fillCircle(20.5, 14, 3.4);
    g.fillTriangle(16, 18, 14, 21.5, 18, 21.5);
    g.fillRect(12.5, 24, 1.6, 4);
    g.fillRect(15.2, 24, 1.6, 4);
    g.fillRect(17.9, 24, 1.6, 4);
  });
  make(scene, 'star', 40, 40, (g) => {
    const pts = starPoints(20, 21, 18, 8.5);
    g.fillStyle(0xffd66b, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2.5, 0xe0a33a, 1);
    g.strokePoints(pts, true);
  });
  make(scene, 'lock', 32, 32, (g) => {
    g.lineStyle(4, 0xffffff, 1);
    g.beginPath();
    g.arc(16, 13, 6.5, Math.PI, 0);
    g.strokePath();
    g.lineBetween(9.5, 13, 9.5, 16);
    g.lineBetween(22.5, 13, 22.5, 16);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(6, 15, 20, 14, 4);
    g.fillStyle(0xb3a3d0, 1);
    g.fillCircle(16, 21, 2.4);
  });
  make(scene, 'arrow', 48, 48, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints(
      [
        { x: 34, y: 10 },
        { x: 34, y: 38 },
        { x: 12, y: 24 },
      ],
      true,
    );
  });

  generateBackgroundTextures(scene);
}

function generateBackgroundTextures(scene: Phaser.Scene): void {
  // Vertical sky gradient.
  make(scene, 'sky', 8, 256, (g) => {
    const top = 0xa9dcff;
    const mid = 0xd9efff;
    const bottom = 0xffe6ef;
    for (let y = 0; y < 256; y += 4) {
      const t = y / 255;
      const c = t < 0.6 ? lerpColor(top, mid, t / 0.6) : lerpColor(mid, bottom, (t - 0.6) / 0.4);
      g.fillStyle(c, 1);
      g.fillRect(0, y, 8, 4);
    }
  });

  // Clouds strip (tiles horizontally, 512 wide).
  make(scene, 'clouds', 512, 160, (g) => {
    const cloud = (x: number, y: number, s: number): void => {
      for (const dx of [-512, 0, 512]) {
        g.fillStyle(0xffffff, 0.92);
        g.fillCircle(x + dx, y, 22 * s);
        g.fillCircle(x + dx + 24 * s, y - 12 * s, 26 * s);
        g.fillCircle(x + dx + 52 * s, y - 2 * s, 22 * s);
        g.fillRoundedRect(x + dx - 18 * s, y, 88 * s, 18 * s, 9 * s);
      }
    };
    cloud(40, 60, 1);
    cloud(230, 110, 0.75);
    cloud(380, 50, 1.1);
  });

  // Far hills: lavender with a pink castle silhouette, tiles horizontally.
  make(scene, 'hills_far', 512, 220, (g) => {
    g.fillStyle(0xe2d4ff, 1);
    for (const dx of [-512, 0, 512]) {
      g.fillCircle(80 + dx, 210, 120);
      g.fillCircle(300 + dx, 230, 150);
      g.fillCircle(470 + dx, 200, 110);
    }
    g.fillRect(0, 190, 512, 30);
    // Castle.
    g.fillStyle(0xf7d3e2, 1);
    g.fillRect(330, 70, 60, 90);
    g.fillRect(318, 50, 18, 110);
    g.fillRect(384, 50, 18, 110);
    g.fillRect(350, 30, 20, 50);
    g.fillStyle(0xf0b8cf, 1);
    g.fillTriangle(316, 52, 327, 26, 338, 52);
    g.fillTriangle(382, 52, 393, 26, 404, 52);
    g.fillTriangle(347, 32, 360, 4, 373, 32);
  });

  // Near hills: mint with round trees, tiles horizontally.
  make(scene, 'hills_near', 512, 180, (g) => {
    for (const dx of [-512, 0, 512]) {
      g.fillStyle(0x7fcf97, 1);
      g.fillRect(150 + dx, 70, 8, 50);
      g.fillStyle(PALETTE.pink, 1);
      g.fillCircle(154 + dx, 62, 26);
      g.fillCircle(138 + dx, 74, 18);
      g.fillCircle(172 + dx, 74, 18);
      g.fillStyle(0x7fcf97, 1);
      g.fillRect(420 + dx, 80, 8, 40);
      g.fillStyle(0xa5e3b2, 1);
      g.fillCircle(424 + dx, 72, 24);
      g.fillStyle(0xb9edc4, 1);
      g.fillCircle(100 + dx, 190, 110);
      g.fillCircle(330 + dx, 200, 130);
      g.fillCircle(520 + dx, 180, 90);
    }
    g.fillStyle(0xb9edc4, 1);
    g.fillRect(0, 160, 512, 20);
  });
}
