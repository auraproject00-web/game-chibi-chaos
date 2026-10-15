import Phaser from 'phaser';
import type { LevelTheme } from '../levels/types';

const CLOUD_TINT: Record<LevelTheme, number> = { meadow: 0xffffff, candy: 0xffe6f2, illusion: 0xf3ecff };

/**
 * Parallax backdrop rendered beneath every other scene, unaffected by the game camera zoom.
 * The game scene feeds it the camera scroll; menus let it drift slowly.
 */
export class BackgroundScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private clouds!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
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
    this.sky.setTexture(`sky${sfx}`);
    this.far.setTexture(`hills_far${sfx}`);
    this.near.setTexture(`hills_near${sfx}`);
    this.clouds.setTint(CLOUD_TINT[theme]);
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
    this.sky.setDisplaySize(w, h);
    this.clouds.setScale(k).setSize(Math.ceil(w / k) + 2, 160).setPosition(0, h * 0.04);
    this.far.setScale(k).setSize(Math.ceil(w / k) + 2, 220).setPosition(0, h - 70 * k);
    this.near.setScale(k).setSize(Math.ceil(w / k) + 2, 180).setPosition(0, h + 4);
  }

  update(time: number, delta: number): void {
    let x: number;
    if (this.source) {
      x = this.source();
    } else {
      this.drift += delta * 0.04;
      x = this.drift;
    }
    this.clouds.tilePositionX = x * 0.05 + time * 0.006;
    this.far.tilePositionX = x * 0.15;
    this.near.tilePositionX = x * 0.35;
  }
}
