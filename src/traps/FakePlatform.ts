import Phaser from 'phaser';
import { PLATFORM_PAD, platformTexture } from '../art/textures';
import { AudioManager } from '../managers/AudioManager';

type FakeState = 'idle' | 'shaking' | 'fallen';

/**
 * Looks like a normal platform (with a tiny crack as a tell). After MOCHI lands on it,
 * it wobbles for `delayMs` and then drops. Keep moving and you survive.
 */
export class FakePlatform {
  readonly zone: Phaser.GameObjects.Zone;
  private readonly gfx: Phaser.GameObjects.Image;
  private readonly home: Phaser.Math.Vector2;
  private state: FakeState = 'idle';
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    private readonly delayMs: number,
  ) {
    // Image origin is its center so it can tilt while falling.
    const tex = platformTexture(scene, w, h, true);
    const frame = scene.textures.getFrame(tex);
    this.home = new Phaser.Math.Vector2(x - PLATFORM_PAD.x + frame.width / 2, y - PLATFORM_PAD.y + frame.height / 2);
    this.gfx = scene.add.image(this.home.x, this.home.y, tex).setDepth(10);
    this.zone = scene.add.zone(x + w / 2, y + h / 2, w, h);
    scene.physics.add.existing(this.zone, true);
  }

  private get staticBody(): Phaser.Physics.Arcade.StaticBody {
    return this.zone.body as Phaser.Physics.Arcade.StaticBody;
  }

  get top(): number {
    return this.staticBody.top;
  }

  /** Called when MOCHI stands on top. */
  /** Returns true when this call started the crumble. */
  trigger(): boolean {
    if (this.state !== 'idle') return false;
    this.state = 'shaking';
    this.scene.tweens.add({
      targets: this.gfx,
      x: { from: this.home.x - 2, to: this.home.x + 2 },
      duration: 45,
      yoyo: true,
      repeat: -1,
    });
    this.timer = this.scene.time.delayedCall(this.delayMs, () => this.fall());
    return true;
  }

  private fall(): void {
    this.state = 'fallen';
    this.scene.tweens.killTweensOf(this.gfx);
    this.staticBody.enable = false;
    AudioManager.play('crumble');
    this.scene.tweens.add({
      targets: this.gfx,
      y: this.home.y + 420,
      angle: Phaser.Math.Between(-12, 12),
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeIn',
    });
  }

  reset(): void {
    this.timer?.remove(false);
    this.timer = null;
    this.scene.tweens.killTweensOf(this.gfx);
    this.gfx.setPosition(this.home.x, this.home.y).setAngle(0).setAlpha(1);
    this.staticBody.enable = true;
    this.state = 'idle';
  }
}
