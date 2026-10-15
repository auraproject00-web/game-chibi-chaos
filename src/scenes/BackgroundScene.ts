import Phaser from 'phaser';
import type { LevelTheme } from '../levels/types';
import { ensureSweetTextures } from '../art/sweetTextures';
import { CANDY_MEADOW_PARALLAX, PREMIUM_RES, LAYER_INSET, hasLayer, hasPremium, layerBottomPad, layerTexture, premiumKey, type ParallaxLayer } from '../art/premium/premiumAssets';
import type { ForegroundScene } from './ForegroundScene';

const CLOUD_TINT: Record<LevelTheme, number> = { meadow: 0xffffff, candy: 0xffe6f2, illusion: 0xf3ecff, dimension: 0xffeef8, sweet: 0xffffff };

/**
 * Where each backdrop layer sits (bottom offsets in 540-px-tall design units) and how fast it
 * follows the camera. Themes without an entry use the original three-layer layout unchanged.
 * Level 01 (sweet) has five layers: sky, clouds, castle, mountains + waterfalls, trees.
 */
interface BackdropLayout {
  cloudsY: number;
  farBottom: number;
  midBottom: number;
  cloudsF: number;
  farF: number;
  midF: number;
  nearF: number;
}
const DEFAULT_LAYOUT: BackdropLayout = { cloudsY: 0.04, farBottom: 70, midBottom: 0, cloudsF: 0.05, farF: 0.15, midF: 0, nearF: 0.35 };
const LAYOUTS: Partial<Record<LevelTheme, BackdropLayout>> = {
  sweet: { cloudsY: 0.0, farBottom: 128, midBottom: 52, cloudsF: 0.03, farF: 0.07, midF: 0.16, nearF: 0.32 },
};

type Slot = 'clouds' | 'far' | 'mid' | 'near';

/**
 * Parallax backdrop rendered beneath every other scene, unaffected by the game camera zoom.
 * The game scene feeds it the camera scroll; menus let it drift slowly.
 * In Level 01 each layer switches to its premium image when one is installed (see
 * CANDY_MEADOW_PARALLAX); missing images keep the procedural layer.
 */
export class BackgroundScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private clouds!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  /** Extra layer between `far` and `near`, only for themes that have one. */
  private mid!: Phaser.GameObjects.TileSprite;
  private look: BackdropLayout = DEFAULT_LAYOUT;
  private theme: LevelTheme = 'meadow';
  /** Source texture of each tiled layer (tile sprites render through their own canvas). */
  private keys = new Map<Phaser.GameObjects.TileSprite, string>();
  /** Premium placement per layer; layers without one use `look`. */
  private premium = new Map<Phaser.GameObjects.TileSprite, ParallaxLayer>();
  private skyCover = false;
  private source: (() => number) | null = null;
  private drift = 0;
  private k = 1;
  /** Last camera x fed to the layers (the foreground scene follows it too). */
  scrollX = 0;

  constructor() {
    super('Background');
  }

  create(): void {
    this.sky = this.add.image(0, 0, 'sky').setOrigin(0);
    this.clouds = this.add.tileSprite(0, 0, 512, 160, 'clouds').setOrigin(0, 0).setAlpha(0.95);
    this.far = this.add.tileSprite(0, 0, 512, 220, 'hills_far').setOrigin(0, 1);
    this.mid = this.add.tileSprite(0, 0, 512, 220, 'hills_far').setOrigin(0, 1).setVisible(false);
    this.near = this.add.tileSprite(0, 0, 512, 180, 'hills_near').setOrigin(0, 1);
    this.keys = new Map([
      [this.clouds, 'clouds'],
      [this.far, 'hills_far'],
      [this.mid, 'hills_far'],
      [this.near, 'hills_near'],
    ]);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  /** Swaps the backdrop art for a level theme (menus use 'meadow', Level 01 'sweet'). */
  setTheme(theme: LevelTheme): void {
    if (!this.sky || this.theme === theme) return;
    this.theme = theme;
    const sfx = theme === 'meadow' ? '' : `_${theme}`;
    if (theme === 'sweet') ensureSweetTextures(this);
    const has = (key: string): boolean => this.textures.exists(key);
    const tex = (t: Phaser.GameObjects.TileSprite, key: string): void => {
      t.setTexture(key);
      this.keys.set(t, key);
    };
    this.premium.clear();
    // Level 01 premium layers, one by one; anything not installed keeps its placeholder.
    const pick = (t: Phaser.GameObjects.TileSprite | null, layer: ParallaxLayer, fallback: () => void): void => {
      if (theme === 'sweet' && hasLayer(this, layer)) {
        if (t) {
          tex(t, layerTexture(this, layer));
          this.premium.set(t, layer);
        }
      } else {
        fallback();
      }
    };
    const P = CANDY_MEADOW_PARALLAX;
    this.skyCover = theme === 'sweet' && hasPremium(this, P.sky.id);
    this.sky.setTexture(this.skyCover ? premiumKey(P.sky.id) : `sky${sfx}`);
    pick(this.far, P.far, () => tex(this.far, `hills_far${sfx}`));
    pick(this.near, P.near, () => tex(this.near, `hills_near${sfx}`));
    pick(this.clouds, P.clouds, () => tex(this.clouds, has(`clouds${sfx}`) ? `clouds${sfx}` : 'clouds'));
    this.clouds.setTint(CLOUD_TINT[theme]);
    const midKey = `hills_mid${sfx}`;
    this.mid.setVisible(has(midKey) || (theme === 'sweet' && hasLayer(this, P.mid)));
    // A hidden mid layer goes back to a stock texture so no level keeps another level's art.
    pick(this.mid, P.mid, () => tex(this.mid, has(midKey) ? midKey : 'hills_far'));
    this.look = LAYOUTS[theme] ?? DEFAULT_LAYOUT;
    this.layout();

    // Layer 5 (in front of the gameplay) only exists as premium art.
    const fgOn = theme === 'sweet' && hasLayer(this, P.foreground);
    if (fgOn && !this.scene.isActive('Foreground')) this.scene.launch('Foreground');
    const fg = this.scene.get('Foreground') as ForegroundScene | null;
    if (fgOn) fg?.setLayer(layerTexture(this, P.foreground), P.foreground);
    else if (this.scene.isActive('Foreground')) this.scene.stop('Foreground');
  }

  /** Pass a function returning the world camera's x, or null to drift on its own. */
  setScrollSource(source: (() => number) | null): void {
    this.source = source;
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    this.k = Math.max(0.5, h / 540);
    const k = this.k;
    const L = this.look;
    if (this.skyCover) {
      // Premium sky keeps its proportions and covers the screen.
      const f = this.sky.frame;
      const s = Math.max(w / f.width, h / f.height);
      this.sky.setScale(s).setPosition((w - f.width * s) / 2, h - f.height * s);
    } else {
      this.sky.setScale(1).setPosition(0, 0).setDisplaySize(w, h);
    }
    const place: Record<Slot, [Phaser.GameObjects.TileSprite, number]> = {
      clouds: [this.clouds, h * L.cloudsY],
      far: [this.far, h - L.farBottom * k],
      mid: [this.mid, h - L.midBottom * k],
      near: [this.near, h + 4],
    };
    for (const [t, y] of Object.values(place)) {
      const p = this.premium.get(t);
      // Premium images are PREMIUM_RES times larger than the design units.
      const r = p ? PREMIUM_RES : 1;
      const s = k / r;
      // Each layer is as tall as its texture (160/220/180 for the original art).
      const th = this.textures.getFrame(this.keys.get(t) ?? '__DEFAULT').height;
      // Padded premium strips skip their outer rows (no wrap-around line at the edges).
      const inset = p ? LAYER_INSET : 0;
      t.setScale(s).setSize(Math.ceil(w / s) + 2, th - inset * 2);
      t.tilePositionY = inset;
      if (!p) t.setPosition(0, y).setAlpha(t === this.clouds ? 0.95 : 1);
      // Prepared strips carry extra rows below their art; shift down so the art stays put.
      else t.setPosition(0, p.anchor === 'top' ? h * p.offset : h - p.offset * k + (layerBottomPad(p) - inset) * s).setAlpha(p.alpha ?? 1);
    }
  }

  update(time: number, delta: number): void {
    let x: number;
    if (this.source) {
      x = this.source();
    } else {
      this.drift += delta * 0.04;
      x = this.drift;
    }
    this.scrollX = x;
    const L = this.look;
    const move = (t: Phaser.GameObjects.TileSprite, factor: number, drift = 0): void => {
      const p = this.premium.get(t);
      // tilePosition is in texture px, so premium layers move PREMIUM_RES texture px per design px.
      t.tilePositionX = p ? (x * p.factor + time * (p.drift ?? 0)) * PREMIUM_RES : x * factor + time * drift;
    };
    move(this.clouds, L.cloudsF, 0.006);
    move(this.far, L.farF);
    if (this.mid.visible) move(this.mid, L.midF);
    move(this.near, L.nearF);
  }
}
