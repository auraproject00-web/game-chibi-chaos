import Phaser from 'phaser';
import { TILE } from '../../config';
import { PREMIUM_RES, premiumKey } from './premiumAssets';

/** How a platform's art is placed relative to its collision box (world px). */
export interface PlatformArt {
  key: string;
  /** Texture px per world px; the image is shown at 1 / res scale. */
  res: number;
  /** Art that sticks out left of / above the collision box. */
  padX: number;
  padY: number;
}

/** World px of frosting the tile art draws above the walkable surface. */
const OVERHANG = 16;
/** Largest texture side most phones accept. */
const MAX_TEXTURE = 4096;

/**
 * Builds a platform from the premium tilesets: the caps are drawn once at each end and the middle
 * tiles repeat, so any length or height keeps its proportions (no stretching). Ground uses a 3x3
 * set (top/middle/bottom rows), one-tile ledges a 3-slice. The result is cached per size, and the
 * collision box is untouched: it stays the separate zone built by the level.
 * Returns null when the needed tileset is not installed, so the placeholder is used instead.
 */
export function premiumPlatform(scene: Phaser.Scene, w: number, h: number, cracked: boolean): PlatformArt | null {
  const ledge = h <= TILE;
  const src = premiumKey(ledge ? 'tiles_ledge' : 'tiles_ground');
  if (!scene.textures.exists(src)) return null;
  const key = `platform_premium_${w}x${h}${cracked ? '_cracked' : ''}`;
  // Very long platforms fall back to 1x so the texture stays inside phone limits.
  const res = w * PREMIUM_RES <= MAX_TEXTURE ? PREMIUM_RES : 1;
  if (!scene.textures.exists(key)) {
    const ct = scene.textures.createCanvas(key, Math.ceil(w * res), Math.ceil((h + OVERHANG) * res));
    if (!ct) return null;
    const ctx = ct.getContext();
    ctx.imageSmoothingQuality = 'high';
    const img = scene.textures.get(src).getSourceImage() as CanvasImageSource;
    const cell = TILE * PREMIUM_RES;
    const topH = (TILE + OVERHANG) * PREMIUM_RES;
    const s = res / PREMIUM_RES;
    const cols = Math.max(1, Math.ceil(w / TILE));
    const rows = ledge ? 1 : Math.max(2, Math.ceil(h / TILE));
    for (let c = 0; c < cols; c++) {
      const col = cols === 1 ? 1 : c === 0 ? 0 : c === cols - 1 ? 2 : 1;
      // A last column narrower than a tile takes the left part of its cell.
      const part = Math.min(1, (w - c * TILE) / TILE);
      const sx = col * cell;
      const dx = c * TILE * res;
      for (let r = 0; r < rows; r++) {
        if (r === 0) {
          ctx.drawImage(img, sx, 0, cell * part, topH, dx, 0, cell * part * s, topH * s);
          continue;
        }
        const row = r === rows - 1 ? 2 : 1;
        const sy = topH + (row - 1) * cell;
        const rowPart = Math.min(1, (h - r * TILE) / TILE);
        ctx.drawImage(img, sx, sy, cell * part, cell * rowPart, dx, (OVERHANG + r * TILE) * res, cell * part * s, cell * rowPart * s);
      }
    }
    if (cracked) drawCrack(scene, ctx, w, res);
    ct.refresh();
  }
  return { key, res, padX: 0, padY: OVERHANG };
}

/** The fake floor's only tell: a small crack in the middle of the surface, same as the placeholder. */
function drawCrack(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, w: number, res: number): void {
  const crack = premiumKey('tiles_crack');
  const surface = OVERHANG * res;
  if (scene.textures.exists(crack)) {
    const img = scene.textures.get(crack).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const s = res / PREMIUM_RES;
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, (w * res - dw) / 2, surface - dh / 2, dw, dh);
    return;
  }
  // No crack art installed: a thin hairline so the trap keeps its fair, subtle tell.
  const cx = (w * res) / 2;
  ctx.strokeStyle = 'rgba(110, 70, 60, 0.75)';
  ctx.lineWidth = 1.4 * res;
  ctx.beginPath();
  ctx.moveTo(cx - 9 * res, surface + 2 * res);
  ctx.lineTo(cx - 3 * res, surface + 6 * res);
  ctx.lineTo(cx + 2 * res, surface + 3 * res);
  ctx.lineTo(cx + 8 * res, surface + 8 * res);
  ctx.stroke();
}
