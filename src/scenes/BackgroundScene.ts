import Phaser from 'phaser';
import type { LevelTheme } from '../levels/types';
import { ensureSweetTextures } from '../art/sweetTextures';

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

/**
 * Parallax backdrop rendered beneath every other scene, unaffected by the game camera zoom.
 * The game scene feeds it the camera scroll; menus let it drift slowly.
 */
export class BackgroundScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private clouds!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  /** Extra layer between `far` and `near`, only for themes that have one. */
  private mid!: Phaser.GameObjects.TileSprite;
  private look: BackdropLayout = DEFAULT_LAYOUT;
  /** Source texture of each tiled layer (tile sprites render through their own canvas). */
  private keys = new Map<Phaser.GameObjects.TileSprite, string>();
  private source: (() => number) | null = null;
  private drift = 0;
  private k = 1;

  constructor() {
    super('Background');
  }

  create(): void {
    this.sky = this.add.image(0, 0, 'sky').setOrigin(0);
    this.clouds = this.add.tileSprite(0, 0, 512, 160, 'clouds').setOrigin(0, 0).setAlpha(0.95);
    this.far = this.add.tileSprite(0, 0, 512, 220, 'hills_far').setOrigin(0, 1);
    this.mid = this.add.tileSprite(0, 0, 512, 220, 'hills_far').setOrigin(0, 1).setVisible(false);
    this.keys = new Map([
      [this.clouds, 'clouds'],
      [this.far, 'hills_far'],
      [this.mid, 'hills_far'],
      [this.near, 'hills_near'],
    ]);
    this.near = this.add.tileSprite(0, 0, 512, 180, 'hills_near').setOrigin(0, 1);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  /** Swaps the backdrop art for a level theme (menus and Level 01 use 'meadow'). */
  setTheme(theme: LevelTheme): void {
    if (!this.sky) return;
    const sfx = theme === 'meadow' ? '' : `_${theme}`;
    if (this.sky.texture.key === `sky${sfx}`) return;
    if (theme === 'sweet') ensureSweetTextures(this);
    const has = (key: string): boolean => this.textures.exists(key);
    const tex = (t: Phaser.GameObjects.TileSprite, key: string): void => {
      t.setTexture(key);
      this.keys.set(t, key);
    };
    this.sky.setTexture(`sky${sfx}`);
    tex(this.far, `hills_far${sfx}`);
    tex(this.near, `hills_near${sfx}`);
    tex(this.clouds, has(`clouds${sfx}`) ? `clouds${sfx}` : 'clouds');
    this.clouds.setTint(CLOUD_TINT[theme]);
    const midKey = `hills_mid${sfx}`;
    this.mid.setVisible(has(midKey));
    if (has(midKey)) tex(this.mid, midKey);
    this.look = LAYOUTS[theme] ?? DEFAULT_LAYOUT;
    this.layout();
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
    // Each layer is as tall as its texture (160/220/180 for the original art).
    const th = (t: Phaser.GameObjects.TileSprite): number => this.textures.getFrame(this.keys.get(t) ?? '__DEFAULT').height;
    this.sky.setDisplaySize(w, h);
    this.clouds.setScale(k).setSize(Math.ceil(w / k) + 2, th(this.clouds)).setPosition(0, h * L.cloudsY);
    this.far.setScale(k).setSize(Math.ceil(w / k) + 2, th(this.far)).setPosition(0, h - L.farBottom * k);
    this.mid.setScale(k).setSize(Math.ceil(w / k) + 2, th(this.mid)).setPosition(0, h - L.midBottom * k);
    this.near.setScale(k).setSize(Math.ceil(w / k) + 2, th(this.near)).setPosition(0, h + 4);
  }

  update(time: number, delta: number): void {
    let x: number;
    if (this.source) {
      x = this.source();
    } else {
      this.drift += delta * 0.04;
      x = this.drift;
    }
    const L = this.look;
    this.clouds.tilePositionX = x * L.cloudsF + time * 0.006;
    this.far.tilePositionX = x * L.farF;
    if (this.mid.visible) this.mid.tilePositionX = x * L.midF;
    this.near.tilePositionX = x * L.nearF;
  }
}
