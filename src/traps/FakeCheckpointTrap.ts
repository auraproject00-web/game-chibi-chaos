import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { SpikeTrap } from './SpikeTrap';
import type { FakeCheckpointConfig, Trap, TrapContext } from './types';

/**
 * Fake Checkpoint: looks like a flag (tell: its pole is crooked) but never saves. Touching it
 * turns it into a cheeky troll flag and can pop hidden spikes. Once exposed it stays exposed.
 */
export class FakeCheckpointTrap implements Trap {
  readonly type = 'fakeCheckpoint';
  id = '';
  readonly span;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly area: Phaser.Geom.Rectangle;
  private readonly spikes: SpikeTrap | null;
  private exposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    cfg: FakeCheckpointConfig,
  ) {
    const x = cfg.x * TILE + TILE / 2;
    const bottomY = cfg.y * TILE;
    this.sprite = scene.add.image(x, bottomY + 2, 'flag_fake').setOrigin(0.26, 1).setDepth(12);
    // Same tall trigger column as a real checkpoint.
    this.area = new Phaser.Geom.Rectangle(x - 22, bottomY - 260, 48, 260);
    this.spikes = cfg.spikes
      ? new SpikeTrap(scene, { x: cfg.spikes.x * TILE, surfaceY: bottomY, tiles: cfg.spikes.w, hidden: true })
      : null;
    this.span = { left: cfg.x * TILE, right: (cfg.spikes ? Math.max(cfg.x + 1, cfg.spikes.x + cfg.spikes.w) : cfg.x + 1) * TILE };
  }

  get isExposed(): boolean {
    return this.exposed;
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (!this.exposed && Phaser.Geom.Intersects.RectangleToRectangle(player, this.area)) this.expose(ctx);
    if (this.spikes?.hits(player)) ctx.kill('spike', this);
  }

  private expose(ctx: TrapContext): void {
    this.exposed = true;
    this.sprite.setTexture('flag_troll');
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: 0.6, to: 1 },
      scaleX: { from: 1.3, to: 1 },
      duration: 420,
      ease: 'Back.easeOut',
    });
    AudioManager.play('hehe');
    ctx.fx.pop(this.sprite.x + 10, this.sprite.y - 90, 'Hehe! Palsu!');
    if (this.spikes) {
      this.spikes.reveal();
      ctx.fx.shake(120, 0.004);
    }
  }
}
