import Phaser from 'phaser';
import { TILE } from '../config';
import type { MirrorPanelConfig, Trap, TrapContext } from './types';

const PANEL_W = 84;
const PANEL_H = 132;

/**
 * A tall mirror in the Mirror Maze (scenery, no collision). While MOCHI walks past, a soft
 * mirrored copy of MOCHI shows inside the glass: same pose, flipped, mirrored across its center.
 * One reused sprite; nothing is created per frame.
 */
export class MirrorPanelTrap implements Trap {
  readonly type = 'mirrorPanel';
  id = '';
  private readonly cx: number;
  private readonly top: number;
  private readonly bottom: number;
  private readonly reflection: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, cfg: MirrorPanelConfig) {
    this.cx = cfg.x * TILE + TILE / 2;
    this.bottom = cfg.y * TILE;
    this.top = this.bottom - PANEL_H;
    scene.add.image(this.cx, this.bottom, 'mirror_panel').setOrigin(0.5, 1).setDepth(6);
    this.reflection = scene.add.image(0, 0, 'mochi_idle').setDepth(7).setAlpha(0.45).setTint(0xd9ccff).setVisible(false);
  }

  update(_player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const s = ctx.player.sprite;
    const rx = 2 * this.cx - s.x;
    const inside = Math.abs(rx - this.cx) < PANEL_W / 2 - 16 && s.y > this.top + 30 && s.y < this.bottom + 40;
    this.reflection.setVisible(inside);
    if (!inside) return;
    this.reflection
      .setTexture(s.texture.key)
      .setPosition(rx, Math.min(s.y, this.bottom - 12))
      .setOrigin(s.originX, s.originY)
      .setScale(s.scaleX * 0.9, s.scaleY * 0.9)
      .setFlipX(!s.flipX)
      .setRotation(-s.rotation);
  }

  onRespawn(): void {
    this.reflection.setVisible(false);
  }
}
