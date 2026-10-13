import Phaser from 'phaser';
import { PLAYER } from '../config';
import { MOCHI_FOOT_Y, MOCHI_TEX_H, RUN_CYCLE, mochiKey, type MochiFrame } from '../art/mochi';
import type { ControlFrame } from '../managers/InputManager';
import type { FxManager } from '../managers/FxManager';
import { AudioManager } from '../managers/AudioManager';

/** Visual scale of the 64px MOCHI texture (about 25% larger than the first prototype). */
const BASE_SCALE = 0.98;

/** Jelly spring for squash & stretch: stiff enough to snap back, soft enough to wobble. */
const JELLY_STIFFNESS = 340;
const JELLY_DAMPING = 13;
/** Falling faster than this (px/s) switches MOCHI to the panic face. */
const PANIC_FALL_SPEED = 420;

/**
 * MOCHI. Physics lives on an invisible zone (stable hitbox); the visible sprite follows it
 * so squash & stretch and every other animation never change the collision box.
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
  private squashVX = 0;
  private squashVY = 0;
  /** Multiplier animated by the respawn "pop" tween. */
  popScale = 1;
  /** Extra lift animated by the victory hop. */
  hopY = 0;
  /** Reaction face shown for a while (death reactions). Visual only. */
  private mood: MochiFrame | null = null;
  private moodMs = 0;
  private jumpStartY = 0;
  /** Simple stats the tutorial reads; they never feed back into movement. */
  jumpCount = 0;
  bestRise = 0;

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
    this.kick(0.72, 1.32);
    this.jumpCount += 1;
    this.jumpStartY = this.body.bottom;
    this.fx.dust(this.body.center.x, this.body.bottom, 5);
    AudioManager.play('jump');
  }

  private onLand(): void {
    const impact = Phaser.Math.Clamp(this.peakFallSpeed / PLAYER.maxFall, 0.25, 1);
    this.kick(1 + 0.38 * impact, 1 - 0.32 * impact);
    if (this.peakFallSpeed > 250) {
      this.fx.dust(this.body.center.x, this.body.bottom, Math.round(4 + 6 * impact));
      AudioManager.play('land');
    }
    this.peakFallSpeed = 0;
  }

  /** Sets the jelly shape instantly; the spring then wobbles it back to round. */
  private kick(sx: number, sy: number): void {
    this.squashX = sx;
    this.squashY = sy;
    this.squashVX = 0;
    this.squashVY = 0;
  }

  /** Runs after physics so the sprite matches the resolved hitbox this frame. Visual only. */
  private syncVisual(time: number, deltaMs: number): void {
    if (!this.alive) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const body = this.body;
    const grounded = this.onGround;

    if (!grounded) this.bestRise = Math.max(this.bestRise, this.jumpStartY - body.bottom);

    // Damped spring back to a round shape: overshoot gives the jelly wobble.
    this.squashVX += (-(this.squashX - 1) * JELLY_STIFFNESS - this.squashVX * JELLY_DAMPING) * dt;
    this.squashVY += (-(this.squashY - 1) * JELLY_STIFFNESS - this.squashVY * JELLY_DAMPING) * dt;
    this.squashX += this.squashVX * dt;
    this.squashY += this.squashVY * dt;

    let frame: MochiFrame;
    let bob = 0;
    let shapeX = 1;
    let shapeY = 1;
    let jitter = 0;
    if (this.moodMs > 0) this.moodMs -= deltaMs;
    if (this.frozen) {
      frame = 'happy';
    } else if (this.mood && this.moodMs > 0) {
      // Reaction face: overrides the normal faces only; movement is untouched.
      frame = this.mood;
      if (!grounded) this.idleTime = 0;
    } else if (!grounded) {
      this.idleTime = 0;
      if (body.velocity.y < 0) {
        frame = 'jump';
        // Stretch a little while rising fast.
        shapeY = 1 + Math.min(0.08, -body.velocity.y / 8000);
      } else if (body.velocity.y > PANIC_FALL_SPEED) {
        frame = 'panic';
        jitter = Math.sin(time / 22) * 1.2;
      } else {
        frame = 'fall';
      }
    } else if (Math.abs(body.velocity.x) > 25) {
      // Quick little steps: four-frame cycle driven by distance, plus a springy hop.
      const step = Math.floor(this.runDistance / 13);
      frame = RUN_CYCLE[step % RUN_CYCLE.length];
      const phase = Math.abs(Math.sin(this.runDistance / 8.3));
      bob = phase * 3.5;
      shapeY = 0.95 + phase * 0.08;
      shapeX = 1.04 - phase * 0.06;
      this.idleTime = 0;
    } else {
      // Idle: soft jelly breathing, wider when low and taller when high.
      this.idleTime += deltaMs;
      this.blinkMs -= deltaMs;
      frame = 'idle';
      if (this.blinkMs < 0) {
        frame = 'blink';
        if (this.blinkMs < -130) this.blinkMs = 2200 + Math.random() * 2200;
      }
      const t = this.idleTime / 1000;
      const breathe = Math.sin(t * 2.6) * 0.035 + Math.sin(t * 5.2 + 1) * 0.008;
      shapeY = 1 + breathe;
      shapeX = 1 - breathe * 0.8;
    }

    const sx = BASE_SCALE * this.popScale * this.squashX * shapeX;
    const sy = BASE_SCALE * this.popScale * this.squashY * shapeY;
    this.sprite.setTexture(mochiKey(frame));
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(body.center.x + jitter, body.bottom - bob - this.hopY);
    this.sprite.setScale(sx, sy);
    this.sprite.setRotation((body.velocity.x / PLAYER.maxSpeed) * 0.07);
  }

  /** Shows a reaction face for `ms` with a little jelly kick. Never touches the hitbox. */
  showMood(face: MochiFrame, ms: number): void {
    this.mood = face;
    this.moodMs = ms;
    this.kick(1.2, 0.82);
  }

  /** Funny death: quick flatten, reaction face pops up, spin away; plus a small puff of particles. */
  die(face: MochiFrame = 'dead'): void {
    if (!this.alive) return;
    this.alive = false;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    const { x, y } = this.sprite;
    const dir = this.facing;
    this.mood = null;
    this.moodMs = 0;
    this.sprite.setTexture(mochiKey(face)).setRotation(0);
    this.sprite.setScale(BASE_SCALE * 1.35, BASE_SCALE * 0.6);
    this.fx.burst(x, y - 22, 14);
    this.fx.puff(x, y - 22);
    this.scene.tweens.chain({
      targets: this.sprite,
      tweens: [
        { scaleX: BASE_SCALE * 0.9, scaleY: BASE_SCALE * 1.2, y: y - 50, duration: 190, ease: 'Back.easeOut' },
        { angle: 25 * dir, duration: 90, ease: 'Sine.easeInOut' },
        {
          y: y + 40,
          angle: 220 * dir,
          alpha: 0,
          scaleX: BASE_SCALE * 0.5,
          scaleY: BASE_SCALE * 0.5,
          duration: 240,
          ease: 'Quad.easeIn',
        },
      ],
    });
  }

  respawn(x: number, bottomY: number): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this);
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
    this.kick(1, 1);
    this.sprite.setAlpha(1).setAngle(0).setPosition(x, bottomY).setTexture(mochiKey('idle'));
    // Pop in: grow from nothing with an overshoot, then a jelly wobble.
    this.popScale = 0;
    this.scene.tweens.add({
      targets: this,
      popScale: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => this.kick(1.18, 0.86),
    });
    this.fx.puff(x, bottomY - 22);
    this.fx.dust(x, bottomY, 6);
  }

  /** Stops control and plays the victory hop. */
  celebrate(): void {
    this.frozen = true;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.kick(0.7, 1.35);
    this.scene.tweens.add({
      targets: this,
      hopY: 28,
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
