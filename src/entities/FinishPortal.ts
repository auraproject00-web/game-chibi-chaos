import Phaser from 'phaser';

/** Swirling goal portal. Touching it completes the level. */
export class FinishPortal {
  readonly area: Phaser.Geom.Rectangle;
  readonly center: Phaser.Math.Vector2;
  private readonly portal: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, bottomY: number) {
    const cy = bottomY - 46;
    this.center = new Phaser.Math.Vector2(x, cy);
    const glow = scene.add.image(x, cy, 'glow').setDepth(11).setTint(0xcdb4ff).setScale(1.3);
    this.portal = scene.add.image(x, cy, 'portal').setDepth(12);
    scene.tweens.add({ targets: this.portal, angle: 360, duration: 3200, repeat: -1 });
    scene.tweens.add({
      targets: glow,
      scale: { from: 1.15, to: 1.45 },
      alpha: { from: 0.9, to: 0.5 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.portal,
      scaleX: { from: 1, to: 0.92 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.area = new Phaser.Geom.Rectangle(x - 22, cy - 34, 44, 80);
  }

  /** Little "gulp" when MOCHI enters. */
  absorb(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.portal, scale: 1.35, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }
}
