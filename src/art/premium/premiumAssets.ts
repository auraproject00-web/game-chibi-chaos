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
  // A single-file build can embed the pack (images as data URLs) instead of serving the folder.
  const embedded = (window as { __CANDY_MEADOW_PACK__?: unknown }).__CANDY_MEADOW_PACK__;
  if (embedded) {
    usePack(embedded);
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(PACK_URL, { signal: ctrl.signal, cache: 'no-cache' });
    window.clearTimeout(timer);
    if (!res.ok) return;
    usePack(await res.json());
  } catch {
    packFiles = [];
  }
}

/** Keeps the pack entries that name a manifest asset; anything malformed is ignored. */
function usePack(data: unknown): void {
  const known = new Set(manifest.assets.map((a) => premiumKey(a.id)));
  const files = (data as { candyMeadow?: { files?: unknown } } | null)?.candyMeadow?.files;
  packFiles = Array.isArray(files)
    ? files.filter((f): f is PackFile => !!f && typeof f.key === 'string' && typeof f.url === 'string' && known.has(f.key))
    : [];
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
  /**
   * The strip's left and right edges do not match: repeat it as image + mirrored image, which
   * always joins cleanly. Turn off once the art itself is seamless.
   */
  mirror?: boolean;
}

/** Rows of padding added above and below each backdrop strip (texture px). */
const LAYER_PAD = 4;
/** Texture rows hidden at the top and bottom of a padded strip, so filtering never wraps around. */
export const LAYER_INSET = 2;
/** Backdrop strips already prepared this session (their source image is freed afterwards). */
const preparedLayers = new Map<string, { key: string; bottomPad: number }>();

/** Texture px added below a prepared strip's own bottom edge (layout keeps the art where it was). */
export function layerBottomPad(layer: ParallaxLayer): number {
  return preparedLayers.get(layer.id)?.bottomPad ?? 0;
}

/** True when a backdrop layer's premium image is installed (or already prepared). */
export function hasLayer(scene: Phaser.Scene, layer: ParallaxLayer): boolean {
  return preparedLayers.has(layer.id) || hasPremium(scene, layer.id);
}

/**
 * Texture for a premium backdrop strip. Tile sprites wrap vertically too, so an opaque bottom row
 * would bleed in as a thin line along the strip's top edge: the strip is copied with transparent
 * rows above and its bottom row repeated below, and the layer shows only the inner rows
 * (see LAYER_INSET). Strips whose edges do not match are laid out as
 * image + mirror copy, which always joins cleanly. Built once; the original image is then freed.
 */
export function layerTexture(scene: Phaser.Scene, layer: ParallaxLayer): string {
  const ready = preparedLayers.get(layer.id);
  if (ready && scene.textures.exists(ready.key)) return ready.key;
  const key = premiumKey(layer.id);
  const out = `${key}_layer`;
  const img = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const { width: w, height: h } = img;
  const copies = layer.mirror ? 2 : 1;
  const bottomPad = LAYER_PAD;
  const ct = scene.textures.createCanvas(out, w * copies, h + LAYER_PAD + bottomPad);
  if (!ct) return key;
  const ctx = ct.getContext();
  for (let i = 0; i < copies; i++) {
    ctx.save();
    if (i === 1) {
      ctx.translate(w * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, 0, LAYER_PAD);
    ctx.drawImage(img, 0, h - 1, w, 1, 0, h + LAYER_PAD, w, bottomPad);
    ctx.restore();
  }
  ct.refresh();
  preparedLayers.set(layer.id, { key: out, bottomPad });
  scene.textures.remove(key);
  return out;
}

/**
 * Candy Meadow premium parallax, in 540-px-tall design units (the backdrop scales with the screen
 * height). Tune offsets here once the real images arrive; nothing else needs to change.
 */
export const CANDY_MEADOW_PARALLAX = {
  sky: { id: 'bg_sky', factor: 0, anchor: 'top', offset: 0 },
  clouds: { id: 'bg_clouds', factor: 0.03, anchor: 'top', offset: 0, drift: 0.006 },
  // Asset Pack V1: the castle and mountain strips do not join at their edges, so they mirror-repeat.
  far: { id: 'bg_castle', factor: 0.07, anchor: 'bottom', offset: 196, mirror: true },
  mid: { id: 'bg_mountains', factor: 0.16, anchor: 'bottom', offset: 150, mirror: true },
  near: { id: 'bg_trees', factor: 0.32, anchor: 'bottom', offset: 118 },
  foreground: { id: 'fg_flowers', factor: 1.15, anchor: 'bottom', offset: -6, alpha: 1 },
} satisfies Record<string, ParallaxLayer>;
