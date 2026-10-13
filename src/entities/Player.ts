import Phaser from 'phaser';
import { PLAYER } from '../config';
import { MOCHI_FOOT_Y, MOCHI_TEX_H, mochiKey, type MochiFrame } from '../art/mochi';
import type { ControlFrame } from '../managers/InputManager';
import type { FxManager } from '../managers/FxManager';
import { AudioManager } from '../managers/AudioManager';

const BASE_SCALE = 0.78;

/**
 * MOCHI. Physics lives on an invisible zone (stable hitbox); the visible sprite follows it
 * so squash & stretch never changes the collision box.
 */
export class Player {
  readonly hitbox: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly sprite: Phaser.GameObjects.Sprite;

  private alive = true;
  private frozen = false;
  private facing: 1 | -1 = 1;
  private coyoteMs = 0;
  private jumpBufferMs = 0;
  private jumping = false;
  private wasOnGround = false;
  private peakFallSpeed = 0;
  private runDistance = 0;
  private blinkMs = 2500;
  private idleTime = 0;
  private squashX = 1;
  private squashY = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    bottomY: number,
    private readonly fx: FxManager,
  ) {
    this.hitbox = scene.add.zone(x, bottomY - PLAYER.height / 2, PLAYER.width, PLAYER.height);
    scene.physics.add.existing(this.hitbox);
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    this.body.setMaxVelocity(2000, PLAYER.maxFall);
    this.body.setCollideWorldBounds(true);

    this.sprite = scene.add
      .sprite(x, bottomY, mochiKey('idle'))
      .setOrigin(0.5, MOCHI_FOOT_Y / MOCHI_TEX_H)
      .setScale(BASE_SCALE)
      .setDepth(20);

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
    });
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  get facingDir(): 1 | -1 {
    return this.facing;
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(deltaMs: number, input: ControlFrame): void {
    if (!this.alive || this.frozen) return;
    const dt = deltaMs / 1000;
    const body = this.body;
    const grounded = this.onGround;

    // Landing.
    if (grounded && !this.wasOnGround) this.onLand();
    if (!grounded) this.peakFallSpeed = Math.max(this.peakFallSpeed, body.velocity.y);

    // Coyote time and jump buffer.
    this.coyoteMs = grounded ? PLAYER.coyoteMs : this.coyoteMs - deltaMs;
    this.jumpBufferMs = input.jumpPressed ? PLAYER.jumpBufferMs : this.jumpBufferMs - deltaMs;

    // Horizontal movement with acceleration curves.
    const target = input.moveX * PLAYER.maxSpeed;
    let accel: number;
    if (input.moveX !== 0) {
      accel = grounded ? PLAYER.groundAccel : PLAYER.airAccel;
      if (Math.sign(body.velocity.x) === -input.moveX) accel *= PLAYER.turnBoost;
      this.facing = input.moveX;
    } else {
      accel = grounded ? PLAYER.groundDecel : PLAYER.airDecel;
    }
    const vx = approach(body.velocity.x, target, accel * dt);
    body.setVelocityX(vx);

    // Jump.
    if (this.jumpBufferMs > 0 && this.coyoteMs > 0) {
      body.setVelocityY(-PLAYER.jumpVelocity);
      this.jumpBufferMs = 0;
      this.coyoteMs = 0;
      this.jumping = true;
      this.onJump();
    }

    // Variable jump height: releasing early cuts the ascent.
    if (this.jumping && !input.jumpHeld && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * PLAYER.jumpCut);
      this.jumping = false;
    }
    if (body.velocity.y >= 0) this.jumping = false;

    if (grounded) this.runDistance += Math.abs(vx) * dt;
    this.wasOnGround = grounded;
  }

  private onJump(): void {
    this.squashX = 0.72;
    this.squashY = 1.3;
    this.fx.dust(this.body.center.x, this.body.bottom, 5);
    AudioManager.play('jump');
  }

  private onLand(): void {
    const impact = Phaser.Math.Clamp(this.peakFallSpeed / PLAYER.maxFall, 0.25, 1);
    this.squashX = 1 + 0.35 * impact;
    this.squashY = 1 - 0.3 * impact;
    if (this.peakFallSpeed > 250) {
      this.fx.dust(this.body.center.x, this.body.bottom, Math.round(4 + 6 * impact));
      AudioManager.play('land');
    }
    this.peakFallSpeed = 0;
  }

  /** Runs after physics so the sprite matches the resolved hitbox this frame. */
  private syncVisual(_time: number, deltaMs: number): void {
    if (!this.alive) return;
    const dt = deltaMs / 1000;
    const body = this.body;
    const grounded = this.onGround;

    // Ease squash back to neutral.
    const k = 1 - Math.exp(-dt * 14);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;

    let frame: MochiFrame;
    let bob = 0;
    let breathe = 0;
    if (this.frozen) {
      frame = 'happy';
    } else if (!grounded) {
      frame = body.velocity.y < 0 ? 'jump' : 'fall';
      this.idleTime = 0;
    } else if (Math.abs(body.velocity.x) > 25) {
      frame = Math.floor(this.runDistance / 22) % 2 === 0 ? 'run1' : 'run2';
      bob = Math.abs(Math.sin(this.runDistance / 7)) * 2.5;
      this.idleTime = 0;
    } else {
      this.idleTime += deltaMs;
      this.blinkMs -= deltaMs;
      frame = 'idle';
      if (this.blinkMs < 0) {
        frame = 'blink';
        if (this.blinkMs < -130) this.blinkMs = 2200 + Math.random() * 2200;
      }
      breathe = Math.sin(this.idleTime / 260) * 0.03;
    }

    this.sprite.setTexture(mochiKey(frame));
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(body.center.x, body.bottom - bob);
    this.sprite.setScale(BASE_SCALE * this.squashX * (1 - breathe * 0.5), BASE_SCALE * this.squashY * (1 + breathe));
    this.sprite.setRotation((body.velocity.x / PLAYER.maxSpeed) * 0.07);
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    const { x, y } = this.sprite;
    this.sprite.setTexture(mochiKey('dead')).setRotation(0);
    this.fx.burst(x, y - 18);
    this.scene.tweens.add({
      targets: this.sprite,
      y: y - 46,
      scaleX: BASE_SCALE * 1.15,
      scaleY: BASE_SCALE * 1.15,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.sprite,
          y: y + 30,
          angle: 200 * this.facing,
          alpha: 0,
          scaleX: BASE_SCALE * 0.6,
          scaleY: BASE_SCALE * 0.6,
          duration: 300,
          ease: 'Quad.easeIn',
        });
      },
    });
  }

  respawn(x: number, bottomY: number): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.body.enable = true;
    this.body.reset(x, bottomY - PLAYER.height / 2);
    this.alive = true;
    this.frozen = false;
    this.jumping = false;
    this.wasOnGround = false;
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
    this.peakFallSpeed = 0;
    this.facing = 1;
    this.squashX = 0.5;
    this.squashY = 1.5;
    this.sprite.setAlpha(1).setAngle(0).setPosition(x, bottomY).setTexture(mochiKey('idle'));
    this.fx.dust(x, bottomY, 8);
  }

  /** Stops control and plays the victory hop. */
  celebrate(): void {
    this.frozen = true;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.squashX = 0.7;
    this.squashY = 1.35;
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 28,
      duration: 220,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeOut',
    });
  }
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return value;
}
