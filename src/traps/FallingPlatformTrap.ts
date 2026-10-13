import Phaser from 'phaser';
import { TILE } from '../config';
import { PLANK_H, plankTexture } from '../art/textures';
import { AudioManager } from '../managers/AudioManager';
import { TRAP_DATA_KEY, type FallingPlatformConfig, type Trap, type TrapContext } from './types';

type PlankState = 'idle' | 'wobble' | 'falling' | 'gone';

const FALL_ACCEL = 900;
const MAX_FALL = 620;

/**
 * Falling Platform: a wooden plank (clearly not grass) that wobbles once stood on and then drops,
 * carrying MOCHI with it. Jump off in time. It returns to its spot on respawn.
 */
export class FallingPlatformTrap implements Trap {
  readonly type = 'fallingPlatform';
  id = '';
  readonly bodies;
  readonly span;
  private readonly plank: Phaser.Physics.Arcade.Image;
  private readonly home: Phaser.Math.Vector2;
  private state: PlankState = 'idle';
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: FallingPlatformConfig,
  ) {
    const w = cfg.w * TILE;
    this.home = new Phaser.Math.Vector2(cfg.x * TILE + w / 2, cfg.y * TILE + PLANK_H / 2);
    this.plank = scene.physics.add.image(this.home.x, this.home.y, plankTexture(scene, w)).setDepth(10);
    const body = this.plank.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setMaxVelocityY(MAX_FALL);
    this.plank.setData(TRAP_DATA_KEY, this);
    this.bodies = [this.plank];
    this.span = { left: cfg.x * TILE, right: (cfg.x + cfg.w) * TILE };
  }

  private get body(): Phaser.Physics.Arcade.Body {
    return this.plank.body as Phaser.Physics.Arcade.Body;
  }

  get currentState(): PlankState {
    return this.state;
  }

  onContact(ctx: TrapContext): void {
    if (this.state !== 'idle' || ctx.player.body.bottom > this.body.top + 4) return;
    this.state = 'wobble';
    ctx.triggered(this);
    AudioManager.play('trap');
    this.scene.tweens.add({ targets: this.plank, angle: { from: -2.5, to: 2.5 }, duration: 60, yoyo: true, repeat: -1 });
    this.timer = this.scene.time.delayedCall(this.cfg.delayMs ?? 450, () => this.drop());
  }

  private drop(): void {
    this.state = 'falling';
    this.scene.tweens.killTweensOf(this.plank);
    this.plank.setAngle(0);
    this.body.setAccelerationY(FALL_ACCEL);
    AudioManager.play('crumble');
    this.timer = this.scene.time.delayedCall(1800, () => {
      this.state = 'gone';
      this.body.stop();
      this.body.enable = false;
      this.plank.setVisible(false);
    });
  }

  onRespawn(): void {
    this.timer?.remove(false);
    this.timer = null;
    this.scene.tweens.killTweensOf(this.plank);
    this.body.enable = true;
    this.body.setAcceleration(0, 0);
    this.body.reset(this.home.x, this.home.y);
    this.plank.setAngle(0).setVisible(true);
    this.state = 'idle';
  }
}
