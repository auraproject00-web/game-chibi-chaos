import Phaser from 'phaser';
import { TILE } from '../config';
import { WAFER_H, waferTexture } from '../art/textures';
import { TRAP_DATA_KEY, type MovingPlatformConfig, type Trap, type TrapContext } from './types';

/**
 * Moving Platform: a candy wafer sliding between two spots at a steady speed with a short pause
 * at each end, so its rhythm can be learned. It moves by velocity, so Arcade carries MOCHI along
 * when standing on it (immovable body friction). It restarts from its first spot on respawn,
 * which makes every retry look the same.
 */
export class MovingPlatformTrap implements Trap {
  readonly type = 'movingPlatform';
  id = '';
  readonly bodies;
  readonly span;
  private readonly wafer: Phaser.Physics.Arcade.Image;
  private readonly a: Phaser.Math.Vector2;
  private readonly b: Phaser.Math.Vector2;
  private readonly speed: number;
  private readonly waitMs: number;
  private target: Phaser.Math.Vector2;
  private waitLeft = 0;

  constructor(scene: Phaser.Scene, cfg: MovingPlatformConfig) {
    const w = cfg.w * TILE;
    this.a = new Phaser.Math.Vector2(cfg.x * TILE + w / 2, cfg.y * TILE + WAFER_H / 2);
    this.b = new Phaser.Math.Vector2(cfg.toX * TILE + w / 2, (cfg.toY ?? cfg.y) * TILE + WAFER_H / 2);
    this.speed = cfg.speed ?? 80;
    this.waitMs = cfg.waitMs ?? 500;
    this.target = this.b;
    this.waitLeft = this.waitMs;
    this.wafer = scene.physics.add.image(this.a.x, this.a.y, waferTexture(scene, w)).setDepth(10);
    const body = this.wafer.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    body.setFriction(1, 0);
    this.wafer.setData(TRAP_DATA_KEY, this);
    this.bodies = [this.wafer];
    this.span = { left: Math.min(cfg.x, cfg.toX) * TILE, right: (Math.max(cfg.x, cfg.toX) + cfg.w) * TILE };
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this));
  }

  private get body(): Phaser.Physics.Arcade.Body {
    return this.wafer.body as Phaser.Physics.Arcade.Body;
  }

  /** Steers toward the current end; flips (after a pause) when it gets there. */
  private tick(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.waitLeft > 0) {
      this.waitLeft -= dt;
      this.body.setVelocity(0, 0);
      return;
    }
    const pos = new Phaser.Math.Vector2(this.wafer.x, this.wafer.y);
    const to = this.target.clone().subtract(pos);
    const dist = to.length();
    const step = (this.speed * dt) / 1000;
    if (dist <= step) {
      this.body.reset(this.target.x, this.target.y);
      this.target = this.target === this.b ? this.a : this.b;
      this.waitLeft = this.waitMs;
      return;
    }
    to.normalize().scale(this.speed);
    this.body.setVelocity(to.x, to.y);
  }

  onContact(ctx: TrapContext): void {
    // Standing on it: a fall right after leaving it is credited to this platform.
    if (ctx.player.body.bottom <= this.body.top + 4) ctx.triggered(this);
  }

  onRespawn(): void {
    this.body.reset(this.a.x, this.a.y);
    this.target = this.b;
    this.waitLeft = this.waitMs;
  }
}
