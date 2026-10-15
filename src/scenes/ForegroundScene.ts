import Phaser from 'phaser';
import { PREMIUM_RES, type ParallaxLayer } from '../art/premium/premiumAssets';
import type { BackgroundScene } from './BackgroundScene';

/**
 * Parallax layer drawn in front of the gameplay (below the HUD), e.g. Level 01's foreground
 * flowers. Only runs while a premium foreground image is installed; it has no input and no physics.
 */
export class ForegroundScene extends Phaser.Scene {
  private strip: Phaser.GameObjects.TileSprite | null = null;
  private key: string | null = null;
  private layer: ParallaxLayer | null = null;

  constructor() {
    super('Foreground');
  }

  /** Called by the backdrop when a level with a foreground starts (may run before create). */
  setLayer(key: string, layer: ParallaxLayer): void {
    this.key = key;
    this.layer = layer;
    if (this.strip) this.strip.setTexture(key);
    this.layout();
  }

  create(): void {
    if (!this.key) return;
    this.strip = this.add.tileSprite(0, 0, 512, 80, this.key).setOrigin(0, 1);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.strip = null;
    });
  }

  private layout(): void {
    if (!this.strip || !this.key || !this.layer) return;
    const { width: w, height: h } = this.scale;
    const k = Math.max(0.5, h / 540);
    const s = k / PREMIUM_RES;
    const th = this.textures.getFrame(this.key).height;
    this.strip
      .setScale(s)
      .setSize(Math.ceil(w / s) + 2, th)
      .setPosition(0, h - this.layer.offset * k)
      .setAlpha(this.layer.alpha ?? 1);
  }

  update(): void {
    if (!this.strip || !this.layer) return;
    const bg = this.scene.get('Background') as BackgroundScene;
    this.strip.tilePositionX = bg.scrollX * this.layer.factor * PREMIUM_RES;
  }
}
