import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';

export interface SpikeTrapOptions {
  /** Left edge in world px. */
  x: number;
  /** Ground surface the spikes stand on, in world px. */
  surfaceY: number;
  /** Width in tiles. */
  tiles: number;
  hidden: boolean;
  /**
   * Horizontal world px range (player center) that makes hidden spikes pop out by themselves.
   * Leave out for spikes another trap reveals (bait coin, fake checkpoint).
   */
  triggerFrom?: number;
  triggerTo?: number;
}

const SPIKE_H = 24;

/**
 * Visible spikes are always deadly. Hidden spikes wait inside the ground and pop up when
 * MOCHI walks over them; once revealed they stay visible so the player can learn the spot.
 */
export class SpikeTrap {
  private readonly sprite: Phaser.GameObjects.TileSprite;
  private readonly hitArea: Phaser.Geom.Rectangle;
  private revealed: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: SpikeTrapOptions,
  ) {
    const w = opts.tiles * TILE;
    this.revealed = !opts.hidden;
    const startY = opts.hidden ? opts.surfaceY + SPIKE_H + 2 : opts.surfaceY;
    // Hidden spikes render behind the ground so they are concealed until they rise.
    this.sprite = scene.add
      .tileSprite(opts.x, startY, w, SPIKE_H, 'spike')
      .setOrigin(0, 1)
      .setDepth(opts.hidden ? 5 : 11);
    // Forgiving hitbox: inset from the sides and only the upper part of the spikes.
    this.hitArea = new Phaser.Geom.Rectangle(opts.x + 5, opts.surfaceY - SPIKE_H + 6, w - 10, SPIKE_H - 6);
  }

  get left(): number {
    return this.opts.x;
  }

  get right(): number {
    return this.opts.x + this.opts.tiles * TILE;
  }

  get isRevealed(): boolean {
    return this.revealed;
  }

  /** Checks the trigger zone; returns true if the spikes popped this frame. */
  update(player: Phaser.Geom.Rectangle): boolean {
    const { triggerFrom, triggerTo } = this.opts;
    if (this.revealed || triggerFrom === undefined || triggerTo === undefined) return false;
    const cx = player.centerX;
    if (cx < triggerFrom || cx > triggerTo) return false;
    this.reveal();
    return true;
  }

  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    AudioManager.play('trap');
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.opts.surfaceY,
      duration: 70,
      ease: 'Back.easeOut',
    });
  }

  /** Pulls the spikes back into the ground (used by traps that reset on respawn). */
  hide(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.revealed = false;
    this.sprite.setY(this.opts.surfaceY + SPIKE_H + 2).setDepth(5);
  }

  hits(player: Phaser.Geom.Rectangle): boolean {
    return this.revealed && Phaser.Geom.Intersects.RectangleToRectangle(player, this.hitArea);
  }
}
