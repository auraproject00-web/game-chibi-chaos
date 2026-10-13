import Phaser from 'phaser';
import { PALETTE } from '../config';

/** Particles and camera juice shared by the gameplay objects. */
export class FxManager {
  private readonly dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly burstEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    this.dustEmitter = scene.add
      .particles(0, 0, 'dot', {
        lifespan: { min: 260, max: 420 },
        speed: { min: 30, max: 110 },
        angle: { min: 195, max: 345 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, PALETTE.cream],
        gravityY: -60,
        emitting: false,
      })
      .setDepth(25);

    this.burstEmitter = scene.add
      .particles(0, 0, 'dot', {
        lifespan: { min: 450, max: 750 },
        speed: { min: 140, max: 340 },
        scale: { start: 0.8, end: 0 },
        tint: [PALETTE.mint, PALETTE.pink, PALETTE.cream, PALETTE.lavender],
        gravityY: 600,
        emitting: false,
      })
      .setDepth(25);

    this.sparkleEmitter = scene.add
      .particles(0, 0, 'sparkle', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 60, max: 200 },
        scale: { start: 0.7, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: [PALETTE.pink, PALETTE.peach, PALETTE.cream, PALETTE.sky],
        gravityY: 120,
        emitting: false,
      })
      .setDepth(25);
  }

  dust(x: number, y: number, count = 6): void {
    this.dustEmitter.explode(count, x, y);
  }

  burst(x: number, y: number, count = 26): void {
    this.burstEmitter.explode(count, x, y);
  }

  sparkle(x: number, y: number, count = 18): void {
    this.sparkleEmitter.explode(count, x, y);
  }

  shake(duration = 180, intensity = 0.006): void {
    this.scene.cameras.main.shake(duration, intensity);
  }
}
