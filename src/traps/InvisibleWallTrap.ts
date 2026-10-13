import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { TRAP_DATA_KEY, type InvisibleWallConfig, type Trap, type TrapContext } from './types';

/** Invisible Wall: solid but unseen. The first bump makes it shimmer into view for good. */
export class InvisibleWallTrap implements Trap {
  readonly type = 'invisibleWall';
  id = '';
  readonly solids;
  private readonly zone: Phaser.GameObjects.Zone;
  private revealed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    cfg: InvisibleWallConfig,
  ) {
    const w = cfg.w * TILE;
    const h = cfg.h * TILE;
    this.zone = scene.add.zone(cfg.x * TILE + w / 2, cfg.y * TILE + h / 2, w, h);
    this.zone.setData(TRAP_DATA_KEY, this);
    this.solids = [this.zone];
  }

  get isRevealed(): boolean {
    return this.revealed;
  }

  onContact(ctx: TrapContext): void {
    if (this.revealed) return;
    this.revealed = true;
    const { x, y, width: w, height: h } = this.zone;
    const left = x - w / 2;
    const top = y - h / 2;
    const g = this.scene.add.graphics().setDepth(11).setAlpha(0);
    g.fillStyle(0xdff3ff, 0.35);
    g.fillRoundedRect(left, top, w, h, 6);
    g.lineStyle(2.5, 0xffffff, 0.95);
    g.strokeRoundedRect(left, top, w, h, 6);
    g.lineStyle(2, 0xffffff, 0.7);
    g.lineBetween(left + w * 0.3, top + 8, left + 6, top + 8 + w * 0.3);
    g.lineBetween(left + w * 0.7, top + 8, left + 6, top + 8 + w * 0.7);
    this.scene.tweens.add({ targets: g, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
    AudioManager.play('bonk');
    ctx.fx.shake(90, 0.003);
    const p = ctx.player.bounds;
    ctx.fx.pop(p.centerX, p.top - 26, 'Bonk!');
  }
}
