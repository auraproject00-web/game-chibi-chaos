import Phaser from 'phaser';
import { PLATFORM_PAD, platformTexture } from '../art/textures';
import { AudioManager } from '../managers/AudioManager';
import type { FxManager } from '../managers/FxManager';

/**
 * A platform made of light: the level's own platform art, but with no collision. Its tell never
 * changes: it shimmers (alpha pulse and a light waver) while real ground stays still. MOCHI falls
 * through it, and it shatters into sparkles. `reset()` puts it back.
 */
export class IllusionPlatform {
  readonly rect: Phaser.Geom.Rectangle;
  private readonly img: Phaser.GameObjects.Image;
  private readonly home: Phaser.Math.Vector2;
  /** Little glints that twinkle on light-made platforms (part of the shimmer tell). */
  private readonly glints: Phaser.GameObjects.Image[];
  private broken = false;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const tex = platformTexture(scene, w, h);
    const frame = scene.textures.getFrame(tex);
    this.home = new Phaser.Math.Vector2(x - PLATFORM_PAD.x + frame.width / 2, y - PLATFORM_PAD.y + frame.height / 2);
    this.img = scene.add.image(this.home.x, this.home.y, tex).setDepth(10);
    this.rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const n = Math.max(1, Math.round(w / 48));
    this.glints = [];
    for (let i = 0; i < n; i++) {
      this.glints.push(scene.add.image(x + ((i + 0.5) * w) / n, y + 2, 'sparkle').setDepth(11).setScale(0.55).setAlpha(0));
    }
    this.shimmer();
  }

  get isBroken(): boolean {
    return this.broken;
  }

  private shimmer(): void {
    this.scene.tweens.add({
      targets: this.img,
      alpha: { from: 0.95, to: 0.62 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.img,
      x: { from: this.home.x - 1.5, to: this.home.x + 1.5 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.glints.forEach((gl, i) =>
      this.scene.tweens.add({
        targets: gl,
        alpha: { from: 0, to: 0.95 },
        angle: { from: 0, to: 90 },
        duration: 600,
        delay: i * 450,
        yoyo: true,
        repeat: -1,
        repeatDelay: 700,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  /**
   * True when MOCHI is really inside it (sinking through it), not just brushing an edge while
   * standing on the real ground next to it.
   */
  touches(box: Phaser.Geom.Rectangle): boolean {
    const r = this.rect;
    return !this.broken && box.right > r.left && box.left < r.right && box.bottom > r.top + 2 && box.top < r.bottom;
  }

  shatter(fx: FxManager): void {
    if (this.broken) return;
    this.broken = true;
    AudioManager.play('mirror');
    this.scene.tweens.killTweensOf([this.img, ...this.glints]);
    this.glints.forEach((gl) => gl.setAlpha(0));
    fx.sparkle(this.rect.centerX, this.rect.top + 6, 14);
    this.scene.tweens.add({ targets: this.img, alpha: 0, scaleY: 0.4, duration: 220, ease: 'Quad.easeIn' });
  }

  reset(): void {
    this.broken = false;
    this.scene.tweens.killTweensOf([this.img, ...this.glints]);
    this.img.setPosition(this.home.x, this.home.y).setAlpha(1).setScale(1);
    this.shimmer();
  }
}
