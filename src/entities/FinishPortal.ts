import Phaser from 'phaser';
import { themedKey } from '../art/textures';

export interface PortalLook {
  /**
   * Decoy look (Triple Fake Finish): nearly the same portal, but it spins the other way and its
   * glow is pink instead of lavender. Small, consistent tells a player can learn.
   */
  decoy?: boolean;
}

/** Swirling goal portal. Touching it completes the level. */
export class FinishPortal {
  readonly area: Phaser.Geom.Rectangle;
  readonly center: Phaser.Math.Vector2;
  private readonly portal: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private hop: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    bottomY: number,
    private readonly look: PortalLook = {},
  ) {
    const cy = bottomY - 46;
    this.center = new Phaser.Math.Vector2(x, cy);
    this.glow = scene.add.image(x, cy, 'glow').setDepth(11).setTint(look.decoy ? 0xffb3c1 : 0xcdb4ff).setScale(1.3);
    // Decoys keep the default art: their tells are spin direction and glow color.
    this.portal = scene.add.image(x, cy, look.decoy ? 'portal' : themedKey(scene, 'portal')).setDepth(12);
    this.startIdle(scene);
    this.area = new Phaser.Geom.Rectangle(x - 22, cy - 34, 44, 80);
  }

  /** Endless spin, glow pulse and wobble. */
  private startIdle(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.portal, angle: this.look.decoy ? -360 : 360, duration: 3200, repeat: -1 });
    scene.tweens.add({
      targets: this.glow,
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
  }

  /** Decoy only: back to a spot, visible and idle again (used when a decoy resets on respawn). */
  resetTo(scene: Phaser.Scene, x: number, bottomY: number): void {
    const cy = bottomY - 46;
    this.hop?.stop();
    this.hop = null;
    scene.tweens.killTweensOf([this.portal, this.glow]);
    this.center.set(x, cy);
    this.portal.setPosition(x, cy).setVisible(true).setScale(1).setAngle(0).setAlpha(1);
    this.glow.setPosition(x, cy).setVisible(true).setScale(1.3).setAngle(0).setAlpha(1);
    this.area.setTo(x - 22, cy - 34, 44, 80);
    this.startIdle(scene);
  }

  /**
   * Running Portal: hops in an arc to a new spot. It cannot be entered while in the air,
   * so MOCHI never "wins" by accident halfway through the hop.
   */
  runTo(scene: Phaser.Scene, x: number, bottomY: number): void {
    const cy = bottomY - 46;
    const sx = this.center.x;
    const sy = this.center.y;
    this.area.setEmpty();
    const arc = Math.max(70, Math.abs(cy - sy) + 60);
    const state = { t: 0 };
    this.hop = scene.tweens.add({
      targets: state,
      t: 1,
      duration: 460,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const px = sx + (x - sx) * state.t;
        const py = sy + (cy - sy) * state.t - Math.sin(Math.PI * state.t) * arc;
        this.portal.setPosition(px, py);
        this.glow.setPosition(px, py);
      },
      onComplete: () => {
        this.center.set(x, cy);
        this.area.setTo(x - 22, cy - 34, 44, 80);
        this.portal.setPosition(x, cy);
        this.glow.setPosition(x, cy);
      },
    });
  }

  get isHidden(): boolean {
    return !this.portal.visible;
  }

  /** Hidden and not enterable (Fake Finish keeps the real portal secret until it is earned). */
  hide(): void {
    this.area.setEmpty();
    this.portal.setVisible(false);
    this.glow.setVisible(false);
  }

  /** Pops into view and becomes enterable. */
  reveal(scene: Phaser.Scene): void {
    const { x, y } = this.center;
    this.portal.setVisible(true).setScale(0.1);
    this.glow.setVisible(true).setAlpha(0);
    scene.tweens.add({ targets: this.portal, scale: 1, duration: 420, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.glow, alpha: 0.9, duration: 420 });
    this.area.setTo(x - 22, y - 34, 44, 80);
  }

  /** Decoy only: shrinks away for good. */
  vanish(scene: Phaser.Scene): void {
    this.area.setEmpty();
    scene.tweens.killTweensOf([this.portal, this.glow]);
    scene.tweens.add({
      targets: [this.portal, this.glow],
      scale: 0,
      angle: 540,
      alpha: 0,
      duration: 380,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.portal.setVisible(false);
        this.glow.setVisible(false);
      },
    });
  }

  /** Little "gulp" when MOCHI enters. */
  absorb(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.portal, scale: 1.35, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }
}
