import Phaser from 'phaser';
import manifest from './candyMeadowAssets.json';

/**
 * Optional premium art for Level 01 (Candy Meadow), loaded from local files under
 * public/assets/candy-meadow/. The procedural placeholders stay the default: any file that is
 * not in the pack, or fails to load, simply keeps its placeholder. Nothing here touches physics;
 * premium art only replaces what a texture key looks like.
 */

/** Premium files are drawn at this multiple of their in-game size. */
export const PREMIUM_RES: number = manifest.res;

const PACK_URL = `${manifest.folder}pack.json`;
const KEY_PREFIX = 'cm_';

/** Texture key of a premium asset id from the manifest (e.g. 'bg_sky' -> 'cm_bg_sky'). */
export const premiumKey = (id: string): string => `${KEY_PREFIX}${id}`;

export function hasPremium(scene: Phaser.Scene, id: string): boolean {
  return scene.textures.exists(premiumKey(id));
}

interface PackFile {
  key: string;
  url: string;
}

/** Files listed in pack.json (written by `npm run assets:pack`). Empty until a pack is installed. */
let packFiles: PackFile[] = [];
/** Keys that failed to load once; not requested again this session. */
const failed = new Set<string>();

/**
 * Reads pack.json once at boot. Never throws and never blocks for long: with no pack (for example
 * the single-file prototype) the game keeps every placeholder.
 */
export async function readPremiumPack(timeoutMs = 1500): Promise<void> {
  const known = new Set(manifest.assets.map((a) => premiumKey(a.id)));
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(PACK_URL, { signal: ctrl.signal, cache: 'no-cache' });
    window.clearTimeout(timer);
    if (!res.ok) return;
    const data = (await res.json()) as { candyMeadow?: { files?: unknown } };
    const files = data?.candyMeadow?.files;
    if (!Array.isArray(files)) return;
    packFiles = files.filter(
      (f): f is PackFile => !!f && typeof f.key === 'string' && typeof f.url === 'string' && known.has(f.key),
    );
  } catch {
    packFiles = [];
  }
}

/** Queues the pack's images on a scene's loader (call from preload). Already loaded keys are skipped. */
export function queuePremiumImages(scene: Phaser.Scene): void {
  const todo = packFiles.filter((f) => !scene.textures.exists(f.key) && !failed.has(f.key));
  if (todo.length === 0) return;
  const onError = (file: Phaser.Loader.File): void => {
    failed.add(file.key);
  };
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError));
  for (const f of todo) scene.load.image(f.key, f.url);
}

/**
 * Hazards and the checkpoint/portal keep their existing code (tweens, hit areas, scale), so their
 * premium images are baked down to the placeholder's exact size under `<placeholder>_premium`.
 * `themedKey` prefers that key when it exists.
 */
const BAKED: { id: string; target: string; w: number; h: number }[] = [
  { id: 'hz_spike', target: 'spike_sweet', w: 32, h: 24 },
  { id: 'hz_flag_off', target: 'flag_off_sweet', w: 48, h: 72 },
  { id: 'hz_flag_on', target: 'flag_on_sweet', w: 48, h: 72 },
  { id: 'hz_portal', target: 'portal_sweet', w: 72, h: 72 },
];

export function bakePremiumHazards(scene: Phaser.Scene): void {
  for (const b of BAKED) {
    const out = `${b.target}_premium`;
    if (!hasPremium(scene, b.id) || scene.textures.exists(out)) continue;
    const img = scene.textures.get(premiumKey(b.id)).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const ct = scene.textures.createCanvas(out, b.w, b.h);
    if (!ct) continue;
    const ctx = ct.getContext();
    ctx.imageSmoothingQuality = 'high';
    // Fit inside the placeholder box, bottom-centred, so anchors (pole base, spike base) line up.
    const s = Math.min(b.w / img.width, b.h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, (b.w - dw) / 2, b.h - dh, dw, dh);
    ct.refresh();
  }
}

/** Where one premium backdrop layer sits and how fast it follows the camera. */
export interface ParallaxLayer {
  /** Manifest id of the image. */
  id: string;
  /** Share of the camera movement the layer follows (0 = fixed, 1 = moves with the world). */
  factor: number;
  /** 'top': offset is a fraction of the screen height from the top; 'bottom': design px above the bottom. */
  anchor: 'top' | 'bottom';
  offset: number;
  /** Extra slow scroll per ms (clouds only). */
  drift?: number;
  alpha?: number;
}

/**
 * Candy Meadow premium parallax, in 540-px-tall design units (the backdrop scales with the screen
 * height). Tune offsets here once the real images arrive; nothing else needs to change.
 */
export const CANDY_MEADOW_PARALLAX = {
  sky: { id: 'bg_sky', factor: 0, anchor: 'top', offset: 0 },
  clouds: { id: 'bg_clouds', factor: 0.03, anchor: 'top', offset: 0, drift: 0.006 },
  far: { id: 'bg_castle', factor: 0.07, anchor: 'bottom', offset: 110 },
  mid: { id: 'bg_mountains', factor: 0.16, anchor: 'bottom', offset: 40 },
  near: { id: 'bg_trees', factor: 0.32, anchor: 'bottom', offset: -4 },
  foreground: { id: 'fg_flowers', factor: 1.15, anchor: 'bottom', offset: -6, alpha: 1 },
} satisfies Record<string, ParallaxLayer>;
