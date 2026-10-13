import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';

/**
 * MOCHI, drawn procedurally until final sprite sheets exist.
 * Design locked to the concept sheet: round mint body, big black eyes with highlights,
 * pink cheeks, tiny feet and a small leaf on top of the head.
 */
export type MochiFrame =
  | 'idle'
  | 'blink'
  | 'run1'
  | 'run2'
  | 'run3'
  | 'run4'
  | 'jump'
  | 'fall'
  | 'panic'
  | 'dead'
  | 'happy'
  | 'shock'
  | 'angry'
  | 'cry'
  | 'dizzy'
  | 'defeat';

export const MOCHI_FRAMES: MochiFrame[] = [
  'idle',
  'blink',
  'run1',
  'run2',
  'run3',
  'run4',
  'jump',
  'fall',
  'panic',
  'dead',
  'happy',
  'shock',
  'angry',
  'cry',
  'dizzy',
  'defeat',
];

/** Four-step run cycle: tiny feet alternate quickly. */
export const RUN_CYCLE: MochiFrame[] = ['run1', 'run2', 'run3', 'run4'];

export const MOCHI_TEX_W = 64;
export const MOCHI_TEX_H = 68;
/** Y (in texture px) where the feet touch the ground. */
export const MOCHI_FOOT_Y = 65;

export const mochiKey = (frame: MochiFrame): string => `mochi_${frame}`;

type Pt = { x: number; y: number };

function leafPoints(bx: number, by: number, tx: number, ty: number, width: number): Pt[] {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Pt[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(Math.PI * t) * width;
    pts.push({ x: bx + dx * t + nx * s, y: by + dy * t + ny * s });
  }
  for (let i = steps - 1; i > 0; i--) {
    const t = i / steps;
    const s = Math.sin(Math.PI * t) * width;
    pts.push({ x: bx + dx * t - nx * s, y: by + dy * t - ny * s });
  }
  return pts;
}

function drawEyesOpen(g: Phaser.GameObjects.Graphics, w = 9, h = 12): void {
  g.fillStyle(TONES.ink, 1);
  g.fillEllipse(23, 37, w, h);
  g.fillEllipse(41, 37, w, h);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(21.3, 33.6, 2.3);
  g.fillCircle(39.3, 33.6, 2.3);
  g.fillCircle(24.6, 40, 1);
  g.fillCircle(42.6, 40, 1);
}

function drawMochi(g: Phaser.GameObjects.Graphics, frame: MochiFrame): void {
  const outline = TONES.mintDark;

  // Feet (drawn first so the body overlaps them).
  const feet: Record<MochiFrame, [number, number, number, number]> = {
    idle: [23, 61, 41, 61],
    blink: [23, 61, 41, 61],
    // Run cycle: front foot reaches forward and lifts, then the feet pass each other.
    run1: [19, 62, 46, 59],
    run2: [23, 61, 41, 62],
    run3: [26, 59, 38, 62],
    run4: [22, 62, 42, 61],
    jump: [25, 59, 39, 59],
    fall: [21, 62, 43, 62],
    panic: [17, 60, 47, 60],
    dead: [22, 61, 42, 61],
    happy: [22, 61, 42, 61],
    shock: [18, 61, 46, 61],
    angry: [21, 62, 43, 62],
    cry: [24, 61, 40, 61],
    dizzy: [20, 62, 45, 60],
    defeat: [17, 62, 47, 62],
  };
  const [lx, ly, rx, ry] = feet[frame];
  g.fillStyle(0x7cc98e, 1);
  g.lineStyle(2, outline, 1);
  g.fillEllipse(lx, ly, 13, 8);
  g.strokeEllipse(lx, ly, 13, 8);
  g.fillEllipse(rx, ry, 13, 8);
  g.strokeEllipse(rx, ry, 13, 8);

  // Leaf stem and leaf.
  g.lineStyle(2.5, outline, 1);
  g.lineBetween(32, 19, 33.5, 11);
  const leaf = leafPoints(33.5, 12, 47, 3, 5.5);
  g.fillStyle(0x7ed687, 1);
  g.fillPoints(leaf, true);
  g.lineStyle(2, outline, 1);
  g.strokePoints(leaf, true);
  g.lineStyle(1.2, outline, 0.7);
  g.lineBetween(35, 10.5, 44, 5);

  // Body with soft shading: darker base, lighter main shape up-left, highlight.
  g.fillStyle(TONES.mintShade, 1);
  g.fillEllipse(32, 39, 52, 44);
  g.fillStyle(PALETTE.mint, 1);
  g.fillEllipse(30.5, 36.5, 46, 38);
  g.fillStyle(0xffffff, 0.55);
  g.fillEllipse(21, 26, 14, 7);
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(31, 23, 2);
  g.lineStyle(2.6, outline, 1);
  g.strokeEllipse(32, 39, 52, 44);

  // Cheeks.
  g.fillStyle(PALETTE.pink, 0.95);
  g.fillEllipse(14.5, 44, 10, 6);
  g.fillEllipse(49.5, 44, 10, 6);

  // Face.
  g.lineStyle(2.2, TONES.ink, 1);
  switch (frame) {
    case 'idle':
    case 'run1':
    case 'run2':
    case 'run3':
    case 'run4':
      drawEyesOpen(g);
      g.beginPath();
      g.arc(32, 42.5, 3.6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      break;
    case 'blink':
      g.lineBetween(19, 38, 27, 38);
      g.lineBetween(37, 38, 45, 38);
      g.beginPath();
      g.arc(32, 42.5, 3.6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      break;
    case 'jump':
      drawEyesOpen(g);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 45, 8, 6);
      g.fillStyle(0xff8fab, 1);
      g.fillEllipse(32, 46.5, 4.5, 2.5);
      break;
    case 'fall':
      drawEyesOpen(g, 10, 13.5);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 46, 5, 6.5);
      break;
    case 'panic': {
      // Shocked white eyes with tiny pupils, wobbly open mouth and a sweat drop.
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(23, 35, 12, 14);
      g.fillEllipse(41, 35, 12, 14);
      g.lineStyle(2, TONES.ink, 1);
      g.strokeEllipse(23, 35, 12, 14);
      g.strokeEllipse(41, 35, 12, 14);
      g.fillStyle(TONES.ink, 1);
      g.fillCircle(23, 36, 2.6);
      g.fillCircle(41, 36, 2.6);
      g.lineStyle(2, TONES.ink, 1);
      g.lineBetween(17, 26, 25, 24.5);
      g.lineBetween(47, 26, 39, 24.5);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 47, 9, 7);
      g.fillStyle(0xff8fab, 1);
      g.fillEllipse(32, 49, 5, 2.5);
      const drop = [
        { x: 53, y: 18 },
        { x: 56.5, y: 25 },
        { x: 55, y: 28 },
        { x: 51, y: 28 },
        { x: 49.5, y: 25 },
      ];
      g.fillStyle(0xbfe6ff, 1);
      g.fillPoints(drop, true);
      g.lineStyle(1.5, 0x5fb1e6, 1);
      g.strokePoints(drop, true);
      break;
    }
    case 'happy':
      g.lineStyle(2.6, TONES.ink, 1);
      g.beginPath();
      g.arc(23, 39, 4.5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.beginPath();
      g.arc(41, 39, 4.5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.fillStyle(0x8a3550, 1);
      g.beginPath();
      g.arc(32, 42, 6, 0, Math.PI, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xff8fab, 1);
      g.fillEllipse(32, 46, 6, 3);
      break;
    case 'shock': {
      // Tiny pupils in big white eyes, round "O" mouth and surprise marks.
      g.fillStyle(0xffffff, 1);
      g.fillCircle(23, 35, 6.5);
      g.fillCircle(41, 35, 6.5);
      g.lineStyle(2, TONES.ink, 1);
      g.strokeCircle(23, 35, 6.5);
      g.strokeCircle(41, 35, 6.5);
      g.fillStyle(TONES.ink, 1);
      g.fillCircle(23, 35, 2);
      g.fillCircle(41, 35, 2);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 47, 6, 7.5);
      g.lineStyle(2, TONES.ink, 1);
      g.lineBetween(8, 18, 12, 23);
      g.lineBetween(13, 14, 15.5, 20);
      g.lineBetween(56, 18, 52, 23);
      g.lineBetween(51, 14, 48.5, 20);
      break;
    }
    case 'angry': {
      // Furrowed brows, puffed frown and a little anger mark.
      drawEyesOpen(g, 8, 9);
      g.lineStyle(2.8, TONES.ink, 1);
      g.lineBetween(17, 28, 27, 32);
      g.lineBetween(47, 28, 37, 32);
      g.lineStyle(2.2, TONES.ink, 1);
      g.beginPath();
      g.arc(32, 49, 4.5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.fillStyle(0xff8a9a, 1);
      g.fillEllipse(14.5, 44, 12, 7);
      g.fillEllipse(49.5, 44, 12, 7);
      g.lineStyle(2, 0xe0456a, 1);
      g.lineBetween(46, 17, 50, 21);
      g.lineBetween(50, 17, 46, 21);
      g.lineBetween(48, 15.5, 48, 22.5);
      break;
    }
    case 'cry': {
      // Squeezed eyes, wobbly mouth and two tear streams.
      g.lineStyle(2.6, TONES.ink, 1);
      g.beginPath();
      g.arc(23, 36, 4.5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      g.beginPath();
      g.arc(41, 36, 4.5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      g.fillStyle(0xbfe6ff, 0.95);
      g.fillRoundedRect(19.5, 40, 5, 15, 2.5);
      g.fillRoundedRect(39.5, 40, 5, 15, 2.5);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 48, 9, 5);
      g.lineStyle(2, TONES.ink, 1);
      g.strokePoints(
        [
          { x: 27, y: 47 },
          { x: 29.5, y: 45.5 },
          { x: 32, y: 47 },
          { x: 34.5, y: 45.5 },
          { x: 37, y: 47 },
        ],
        false,
      );
      break;
    }
    case 'dizzy': {
      // Spiral eyes and a wavy mouth.
      g.lineStyle(2, TONES.ink, 1);
      for (const cx of [23, 41]) {
        g.beginPath();
        for (let i = 0; i <= 26; i++) {
          const a = i * 0.48;
          const r = 0.6 + i * 0.22;
          const px = cx + Math.cos(a) * r;
          const py = 36 + Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      g.lineStyle(2.2, TONES.ink, 1);
      g.strokePoints(
        [
          { x: 25, y: 47 },
          { x: 28.5, y: 45 },
          { x: 32, y: 47 },
          { x: 35.5, y: 45 },
          { x: 39, y: 47 },
        ],
        false,
      );
      break;
    }
    case 'defeat': {
      // Dramatic defeat: ">  <" eyes, big wailing mouth.
      g.lineStyle(2.6, TONES.ink, 1);
      g.lineBetween(18, 32, 26, 36);
      g.lineBetween(26, 36, 18, 40);
      g.lineBetween(46, 32, 38, 36);
      g.lineBetween(38, 36, 46, 40);
      g.fillStyle(0x8a3550, 1);
      g.fillEllipse(32, 47, 12, 9);
      g.fillStyle(0xff8fab, 1);
      g.fillEllipse(32, 50, 7, 3);
      break;
    }
    case 'dead':
      g.lineStyle(2.6, TONES.ink, 1);
      g.lineBetween(19, 33, 27, 41);
      g.lineBetween(27, 33, 19, 41);
      g.lineBetween(37, 33, 45, 41);
      g.lineBetween(45, 33, 37, 41);
      g.lineStyle(2.2, TONES.ink, 1);
      g.strokePoints(
        [
          { x: 26, y: 47 },
          { x: 29, y: 44.5 },
          { x: 32, y: 47 },
          { x: 35, y: 44.5 },
          { x: 38, y: 47 },
        ],
        false,
      );
      break;
  }
}

export function generateMochiTextures(scene: Phaser.Scene): void {
  for (const frame of MOCHI_FRAMES) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    drawMochi(g, frame);
    g.generateTexture(mochiKey(frame), MOCHI_TEX_W, MOCHI_TEX_H);
    g.destroy();
  }
}
