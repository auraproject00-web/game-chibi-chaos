import Phaser from 'phaser';

/**
 * Light ambient particles for themed levels: a few soft sparkles and candy dots drifting up
 * through the visible part of the world. Emitted around the camera, so the count stays tiny
 * however long the level is. Purely visual.
 */
export class AmbientSparkles {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.emitter = scene.add.particles(0, 0, 'sparkle', {
      x: { min: 0, max: 1 },
      y: { min: 0, max: 1 },
      lifespan: 4200,
      speedY: { min: -22, max: -8 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.55, end: 0.15 },
      alpha: { start: 0.85, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffb3c1, 0xcdb4ff, 0xfff3d6, 0xb7f0c1],
      frequency: 320,
      quantity: 1,
      maxAliveParticles: 18,
      emitCallback: (p: Phaser.GameObjects.Particles.Particle) => {
        // Spawn anywhere in the current view.
        const v = cam.worldView;
        p.x = v.x + Math.random() * v.width;
        p.y = v.y + v.height * (0.35 + Math.random() * 0.6);
      },
    });
    this.emitter.setDepth(4);
  }

  destroy(): void {
    this.emitter.destroy();
  }
}
