import Phaser from 'phaser';

/**
 * MOCHI 2.0, drawn procedurally (no image files) after the MOCHI 2.0 character sheet:
 * a round, squishy mint blob with two little leaves, big dark oval eyes with shine, pink cheeks,
 * tiny arms and feet, soft shading and a soft dark outline.
 *
 * Art is laid out on a 64x68 grid and rendered at MOCHI_RES x for crisp edges on retina phones;
 * sprites using it scale by 1 / MOCHI_RES so the on-screen size is unchanged.
 */
export type MochiFrame =
  | 'idle'
  | 'blink'
  | 'walk1'
  | 'walk2'
  | 'run1'
  | 'run2'
  | 'run3'
  | 'run4'
  | 'prep'
  | 'jump'
  | 'fall'
  | 'land'
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
  'walk1',
  'walk2',
  'run1',
  'run2',
  'run3',
  'run4',
  'prep',
  'jump',
  'fall',
  'land',
  'panic',
  'dead',
  'happy',
  'shock',
  'angry',
  'cry',
  'dizzy',
  'defeat',
];

/** Four-step run cycle: arms swing, feet pass each other quickly. */
export const RUN_CYCLE: MochiFrame[] = ['run1', 'run2', 'run3', 'run4'];
/** Two-step walk: small waddle. */
export const WALK_CYCLE: MochiFrame[] = ['walk1', 'walk2'];

/** Texture resolution multiplier (art grid is 64x68). */
export const MOCHI_RES = 2;
export const MOCHI_TEX_W = 64 * MOCHI_RES;
export const MOCHI_TEX_H = 68 * MOCHI_RES;
/** Y (in texture px) where the feet touch the ground. */
export const MOCHI_FOOT_Y = 65 * MOCHI_RES;

export const mochiKey = (frame: MochiFrame): string => `mochi_${frame}`;

/** MOCHI 2.0 palette (from the character sheet). */
export const MOCHI_COLORS = {
  body: 0xb7f7d4,
  shade: 0x8ee6c1,
  cheek: 0xffc4d6,
  outline: 0x4a4a4a,
  eye: 0x3a2e2e,
  mouth: 0xff7b9c,
  leaf: 0x66d98e,
} as const;

const C = MOCHI_COLORS;
const EYE_LOW = 0x6e4b42;
const MOUTH_IN = 0x8f3550;
const LEAF_VEIN = 0xa6f2c2;
const TEAR = 0xbfe6ff;

type Pt = { x: number; y: number };
/** Feet [lx, ly, rx, ry] and arms [lx, ly, rx, ry] per frame (art faces right). */
type Pose = { feet: [number, number, number, number]; arms: [number, number, number, number] };

const POSES: Record<MochiFrame, Pose> = {
  idle: { feet: [24, 62, 40, 62], arms: [7, 46, 57, 46] },
  blink: { feet: [24, 62, 40, 62], arms: [7, 46, 57, 46] },
  walk1: { feet: [21, 62, 42, 61], arms: [8, 47, 57, 44] },
  walk2: { feet: [25, 61, 39, 62], arms: [7, 44, 56, 47] },
  run1: { feet: [18, 62, 46, 59], arms: [9, 49, 59, 41] },
  run2: { feet: [23, 61, 41, 62], arms: [7, 46, 57, 45] },
  run3: { feet: [27, 59, 37, 62], arms: [5, 42, 55, 49] },
  run4: { feet: [22, 62, 42, 61], arms: [7, 45, 57, 46] },
  prep: { feet: [21, 62, 43, 62], arms: [10, 50, 54, 50] },
  jump: { feet: [25, 60, 39, 60], arms: [8, 34, 56, 34] },
  fall: { feet: [21, 62, 43, 62], arms: [4, 38, 60, 38] },
  land: { feet: [19, 62, 45, 62], arms: [4, 50, 60, 50] },
  panic: { feet: [17, 61, 47, 61], arms: [4, 30, 60, 30] },
  dead: { feet: [22, 62, 42, 62], arms: [7, 48, 57, 48] },
  happy: { feet: [22, 62, 42, 62], arms: [6, 36, 58, 36] },
  shock: { feet: [18, 62, 46, 62], arms: [4, 40, 60, 40] },
  angry: { feet: [21, 62, 43, 62], arms: [8, 48, 56, 48] },
  cry: { feet: [24, 62, 40, 62], arms: [9, 46, 55, 46] },
  dizzy: { feet: [20, 62, 45, 61], arms: [5, 44, 59, 40] },
  defeat: { feet: [17, 62, 47, 62], arms: [5, 52, 59, 52] },
};

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

const rad = Phaser.Math.DegToRad;

function arc(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, from: number, to: number): void {
  g.beginPath();
  g.arc(x, y, r, rad(from), rad(to));
  g.strokePath();
}

function wave(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, amp = 1.3): void {
  const pts: Pt[] = [];
  for (let i = 0; i <= 4; i++) pts.push({ x: x0 + ((x1 - x0) * i) / 4, y: y + (i % 2 ? -amp : 0) });
  g.strokePoints(pts, false);
}

/** Big dark oval eyes with a lighter lower glow and two shines (the 2.0 signature look). */
function eyes(g: Phaser.GameObjects.Graphics, w = 8.5, h = 11.5, dy = 0): void {
  for (const x of [24, 40]) {
    const y = 39 + dy;
    g.fillStyle(C.eye, 1);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(EYE_LOW, 1);
    g.fillEllipse(x + 0.4, y + h * 0.26, w * 0.62, h * 0.32);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(x - w * 0.2, y - h * 0.22, w * 0.5, h * 0.36);
    g.fillCircle(x + w * 0.22, y + h * 0.2, Math.max(0.8, w * 0.12));
  }
}

/** Open smiling mouth with a pink tongue. */
function openMouth(g: Phaser.GameObjects.Graphics, r = 4, y = 45): void {
  g.fillStyle(MOUTH_IN, 1);
  g.beginPath();
  g.arc(32, y, r, 0, Math.PI, false);
  g.closePath();
  g.fillPath();
  g.fillStyle(C.mouth, 1);
  g.fillEllipse(32, y + r * 0.62, r * 1.15, r * 0.58);
  g.lineStyle(1.5, C.outline, 1);
  g.beginPath();
  g.arc(32, y, r, 0, Math.PI, false);
  g.closePath();
  g.strokePath();
}

function roundMouth(g: Phaser.GameObjects.Graphics, w: number, h: number, y = 47): void {
  g.fillStyle(MOUTH_IN, 1);
  g.fillEllipse(32, y, w, h);
  g.fillStyle(C.mouth, 1);
  g.fillEllipse(32, y + h * 0.22, w * 0.6, h * 0.36);
  g.lineStyle(1.4, C.outline, 1);
  g.strokeEllipse(32, y, w, h);
}

function drawLimb(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(C.shade, 1);
  g.fillEllipse(x, y, w, h);
  g.fillStyle(C.body, 1);
  g.fillEllipse(x - w * 0.08, y - h * 0.12, w * 0.7, h * 0.6);
  g.lineStyle(2, C.outline, 1);
  g.strokeEllipse(x, y, w, h);
}

function drawMochi(g: Phaser.GameObjects.Graphics, frame: MochiFrame): void {
  const pose = POSES[frame];
  const [lfx, lfy, rfx, rfy] = pose.feet;
  const [lax, lay, rax, ray] = pose.arms;

  // Feet first: the body overlaps them.
  drawLimb(g, lfx, lfy, 12, 7.5);
  drawLimb(g, rfx, rfy, 12, 7.5);

  // Leaves: two small leaves on a short stem.
  g.lineStyle(2.4, C.outline, 1);
  g.lineBetween(32, 20, 32, 13);
  for (const [bx, by, tx, ty, w] of [
    [31.2, 13.8, 19, 6, 5.6],
    [32.8, 13.8, 46, 4.5, 6.2],
  ] as const) {
    const leaf = leafPoints(bx, by, tx, ty, w);
    g.fillStyle(C.leaf, 1);
    g.fillPoints(leaf, true);
    g.lineStyle(1.2, LEAF_VEIN, 0.9);
    g.lineBetween(bx + (tx - bx) * 0.2, by + (ty - by) * 0.2, bx + (tx - bx) * 0.75, by + (ty - by) * 0.75);
    g.lineStyle(2, C.outline, 1);
    g.strokePoints(leaf, true);
  }

  // Body: shade base, lighter body up-left, glossy highlight, soft dark outline.
  g.fillStyle(C.shade, 1);
  g.fillEllipse(32, 40.5, 54, 43);
  g.fillStyle(C.body, 1);
  g.fillEllipse(30.6, 38.2, 48.5, 37);
  g.fillStyle(0xffffff, 0.6);
  g.fillEllipse(19.5, 27.5, 13, 7);
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(29, 23.5, 1.9);
  g.lineStyle(2.6, C.outline, 1);
  g.strokeEllipse(32, 40.5, 54, 43);

  // Tiny arms on the body's sides.
  drawLimb(g, lax, lay, 9, 10);
  drawLimb(g, rax, ray, 9, 10);

  // Cheeks.
  const angryCheeks = frame === 'angry';
  g.fillStyle(angryCheeks ? 0xff9fb6 : C.cheek, 0.95);
  g.fillEllipse(14.5, 46.5, angryCheeks ? 11 : 9.5, angryCheeks ? 6.5 : 5.5);
  g.fillEllipse(49.5, 46.5, angryCheeks ? 11 : 9.5, angryCheeks ? 6.5 : 5.5);

  // Face.
  g.lineStyle(2.2, C.outline, 1);
  switch (frame) {
    case 'idle':
    case 'walk1':
    case 'walk2':
    case 'run1':
    case 'run2':
    case 'run3':
    case 'run4':
      eyes(g);
      openMouth(g, 4.2);
      break;
    case 'blink':
      g.lineStyle(2.4, C.eye, 1);
      arc(g, 24, 37.5, 4, 25, 155);
      arc(g, 40, 37.5, 4, 25, 155);
      openMouth(g, 4.2);
      break;
    case 'prep':
      // Getting ready: determined brows, eyes a bit narrowed, small set mouth.
      eyes(g, 8, 9.5, 0.5);
      g.lineStyle(2.4, C.outline, 1);
      g.lineBetween(19, 31, 27.5, 33.5);
      g.lineBetween(45, 31, 36.5, 33.5);
      g.lineStyle(2, C.outline, 1);
      g.lineBetween(29, 46.5, 35, 46.5);
      break;
    case 'jump':
      eyes(g, 9, 12);
      openMouth(g, 4.6);
      break;
    case 'fall':
      eyes(g, 9.5, 13);
      roundMouth(g, 5, 6.5);
      break;
    case 'land':
      // Squish: happy squeezed eyes and a wide smile.
      g.lineStyle(2.6, C.eye, 1);
      arc(g, 24, 40.5, 4.2, 200, 340);
      arc(g, 40, 40.5, 4.2, 200, 340);
      openMouth(g, 4.2);
      break;
    case 'happy':
      g.lineStyle(2.6, C.eye, 1);
      arc(g, 24, 40, 4.5, 200, 340);
      arc(g, 40, 40, 4.5, 200, 340);
      openMouth(g, 5.4, 44);
      break;
    case 'panic': {
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(24, 37, 11.5, 13.5);
      g.fillEllipse(40, 37, 11.5, 13.5);
      g.lineStyle(2, C.outline, 1);
      g.strokeEllipse(24, 37, 11.5, 13.5);
      g.strokeEllipse(40, 37, 11.5, 13.5);
      g.fillStyle(C.eye, 1);
      g.fillCircle(24, 38, 2.6);
      g.fillCircle(40, 38, 2.6);
      g.lineStyle(2, C.outline, 1);
      g.lineBetween(18, 28, 26, 26.5);
      g.lineBetween(46, 28, 38, 26.5);
      roundMouth(g, 9, 7, 48.5);
      const drop = [
        { x: 54, y: 19 },
        { x: 57.5, y: 26 },
        { x: 56, y: 29 },
        { x: 52, y: 29 },
        { x: 50.5, y: 26 },
      ];
      g.fillStyle(TEAR, 1);
      g.fillPoints(drop, true);
      g.lineStyle(1.5, 0x5fb1e6, 1);
      g.strokePoints(drop, true);
      break;
    }
    case 'shock':
      g.fillStyle(0xffffff, 1);
      g.fillCircle(24, 37, 6.5);
      g.fillCircle(40, 37, 6.5);
      g.lineStyle(2, C.outline, 1);
      g.strokeCircle(24, 37, 6.5);
      g.strokeCircle(40, 37, 6.5);
      g.fillStyle(C.eye, 1);
      g.fillCircle(24, 37, 2.2);
      g.fillCircle(40, 37, 2.2);
      roundMouth(g, 6, 8, 48.5);
      g.lineStyle(2, C.outline, 1);
      g.lineBetween(8, 19, 12, 24);
      g.lineBetween(13, 15, 15.5, 21);
      g.lineBetween(56, 19, 52, 24);
      g.lineBetween(51, 15, 48.5, 21);
      break;
    case 'angry':
      eyes(g, 8, 9, 1);
      g.lineStyle(2.8, C.outline, 1);
      g.lineBetween(18, 30, 28, 34);
      g.lineBetween(46, 30, 36, 34);
      g.lineStyle(2.2, C.outline, 1);
      arc(g, 32, 50.5, 4.5, 200, 340);
      g.lineStyle(2, 0xe0456a, 1);
      g.lineBetween(46, 18, 50, 22);
      g.lineBetween(50, 18, 46, 22);
      g.lineBetween(48, 16.5, 48, 23.5);
      break;
    case 'cry':
      g.lineStyle(2.6, C.eye, 1);
      arc(g, 24, 37.5, 4.5, 20, 160);
      arc(g, 40, 37.5, 4.5, 20, 160);
      g.fillStyle(TEAR, 0.95);
      g.fillRoundedRect(20.5, 42, 5, 14, 2.5);
      g.fillRoundedRect(38.5, 42, 5, 14, 2.5);
      g.fillStyle(MOUTH_IN, 1);
      g.fillEllipse(32, 49.5, 9, 5);
      g.lineStyle(2, C.outline, 1);
      wave(g, 27, 37, 48.5);
      break;
    case 'dizzy':
      g.lineStyle(2, C.eye, 1);
      for (const cx of [24, 40]) {
        g.beginPath();
        for (let i = 0; i <= 26; i++) {
          const a = i * 0.48;
          const r = 0.6 + i * 0.22;
          const px = cx + Math.cos(a) * r;
          const py = 38 + Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      g.lineStyle(2.2, C.outline, 1);
      wave(g, 26, 38, 49);
      break;
    case 'defeat':
      g.lineStyle(2.6, C.eye, 1);
      g.lineBetween(19, 34, 27, 38);
      g.lineBetween(27, 38, 19, 42);
      g.lineBetween(45, 34, 37, 38);
      g.lineBetween(37, 38, 45, 42);
      roundMouth(g, 12, 9, 49);
      break;
    case 'dead':
      g.lineStyle(2.6, C.eye, 1);
      g.lineBetween(20, 35, 28, 43);
      g.lineBetween(28, 35, 20, 43);
      g.lineBetween(36, 35, 44, 43);
      g.lineBetween(44, 35, 36, 43);
      g.lineStyle(2.2, C.outline, 1);
      wave(g, 26, 38, 49.5);
      break;
  }
}

export function generateMochiTextures(scene: Phaser.Scene): void {
  for (const frame of MOCHI_FRAMES) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(MOCHI_RES, MOCHI_RES);
    drawMochi(g, frame);
    g.generateTexture(mochiKey(frame), MOCHI_TEX_W, MOCHI_TEX_H);
    g.destroy();
  }
}
