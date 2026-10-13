import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import type { ReverseControlsConfig, Trap, TrapContext } from './types';

/** Reverse Controls: a dizzy swirl pickup that swaps left and right for a few seconds. */
export class ReverseControlsTrap implements Trap {
  readonly type = 'reverseControls';
  id = '';
  private readonly swirl: Phaser.GameObjects.Image;
  private readonly area: Phaser.Geom.Rectangle;
  private used = false;

  constructor(
    scene: Phaser.Scene,
    private readonly cfg: ReverseControlsConfig,
  ) {
    const cx = cfg.x * TILE + TILE / 2;
    const cy = cfg.y * TILE - 22;
    this.swirl = scene.add.image(cx, cy, 'swirl').setDepth(13);
    scene.tweens.add({ targets: this.swirl, angle: 360, duration: 1400, repeat: -1 });
    scene.tweens.add({ targets: this.swirl, y: cy - 6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.area = new Phaser.Geom.Rectangle(cx - 14, cy - 16, 28, 32);
  }

  get isUsed(): boolean {
    return this.used;
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (this.used || !Phaser.Geom.Intersects.RectangleToRectangle(player, this.area)) return;
    this.used = true;
    this.swirl.setVisible(false);
    AudioManager.play('dizzy');
    ctx.fx.puff(this.swirl.x, this.swirl.y);
    ctx.fx.pop(player.centerX, player.top - 26, 'Kebalik!');
    ctx.reverseControls(this.cfg.durationMs ?? 3000);
  }

  onRespawn(): void {
    this.used = false;
    this.swirl.setVisible(true);
  }
}
