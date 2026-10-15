import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import type { RealityCollapseConfig, Trap, TrapContext } from './types';

/**
 * Reality Collapse (Level 04, Zone 5) story beats. Passing `triggerX`: a rumble, the screen gets
 * light cracks and the narrator speaks. Passing `finishX`: the narrator reacts to the finish.
 * Presentation only; it never kills and never changes collision, so nothing resets on respawn.
 */
export class RealityCollapseTrap implements Trap {
  readonly type = 'realityCollapse';
  id = '';
  private collapsed = false;
  private finished = false;
  private readonly cracks: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: RealityCollapseConfig,
  ) {
    const { width, height } = scene.scale;
    this.cracks = scene.add
      .image(width / 2, height / 2, 'crack_overlay')
      .setScrollFactor(0)
      .setDepth(41)
      .setAlpha(0)
      .setVisible(false);
  }

  get isCollapsed(): boolean {
    return this.collapsed;
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (!this.collapsed && box.centerX >= this.cfg.triggerX * TILE) {
      this.collapsed = true;
      AudioManager.play('collapse');
      this.scene.cameras.main.shake(380, 0.006);
      // Sized to the current view each time (the camera zoom scales scroll-free objects too).
      const cam = this.scene.cameras.main;
      this.cracks
        .setPosition(cam.width / 2, cam.height / 2)
        .setDisplaySize(cam.width / cam.zoom, cam.height / cam.zoom)
        .setVisible(true);
      this.scene.tweens.add({ targets: this.cracks, alpha: 0.32, duration: 500 });
      ctx.sprung(this, 'collapse');
    }
    if (!this.finished && box.centerX >= this.cfg.finishX * TILE) {
      this.finished = true;
      ctx.sprung(this, 'chaosFinish');
    }
  }

  // No onRespawn: once reality has cracked it stays cracked for this visit (nothing to retry).
}
