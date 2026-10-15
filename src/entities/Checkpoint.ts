import Phaser from 'phaser';
import { themedKey } from '../art/textures';

/** Flag that becomes the respawn point once touched. */
export class Checkpoint {
  readonly sprite: Phaser.GameObjects.Image;
  readonly area: Phaser.Geom.Rectangle;
  private activated = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly bottomY: number,
  ) {
    this.sprite = scene.add.image(x, bottomY + 2, themedKey(scene, 'flag_off')).setOrigin(0.26, 1).setDepth(12);
    // Tall trigger column so jumping over the flag still counts.
    this.area = new Phaser.Geom.Rectangle(x - 22, bottomY - 260, 48, 260);
  }

  get isActive(): boolean {
    return this.activated;
  }

  /** Returns true the first time it is touched. */
  activate(): boolean {
    if (this.activated) return false;
    this.activated = true;
    this.sprite.setTexture(themedKey(this.scene, 'flag_on'));
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: 0.6, to: 1 },
      scaleX: { from: 1.25, to: 1 },
      duration: 420,
      ease: 'Back.easeOut',
    });
    return true;
  }
}
