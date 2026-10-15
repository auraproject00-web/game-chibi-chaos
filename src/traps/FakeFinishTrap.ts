import Phaser from 'phaser';
import { TILE } from '../config';
import { FinishPortal } from '../entities/FinishPortal';
import { AudioManager } from '../managers/AudioManager';
import type { FakeFinishConfig, Trap, TrapContext } from './types';

/**
 * Fake Finish: a decoy portal that looks like the real one. It hops away each time MOCHI gets
 * close, then vanishes. The real portal stays hidden until MOCHI gets past the last challenge
 * (`revealX`). Nothing here kills, and nothing is undone by dying.
 */
export class FakeFinishTrap implements Trap {
  readonly type = 'fakeFinish';
  id = '';
  private readonly decoy: FinishPortal;
  private next = 0;
  private vanished = false;
  private revealed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: FakeFinishConfig,
  ) {
    this.decoy = new FinishPortal(scene, cfg.x * TILE + TILE / 2, cfg.y * TILE);
  }

  get stage(): 'decoy' | 'vanished' | 'revealed' {
    return this.revealed ? 'revealed' : this.vanished ? 'vanished' : 'decoy';
  }

  /** Decoy center (tests and debugging). */
  get decoyCenter(): Phaser.Math.Vector2 {
    return this.decoy.center;
  }

  init(ctx: TrapContext): void {
    ctx.portal.hide();
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    const px = player.centerX;
    const hop = this.cfg.hops[this.next];
    if (hop && px >= hop.triggerX * TILE) {
      this.next += 1;
      const from = this.decoy.center.clone();
      this.decoy.runTo(this.scene, hop.x * TILE + TILE / 2, hop.y * TILE);
      AudioManager.play('whoosh');
      ctx.fx.sparkle(from.x, from.y, 10);
      ctx.fx.pop(from.x, from.y - 50, 'Hehe!');
      if (this.next === 1) ctx.sprung(this, 'fakeFinish');
    }
    if (!this.vanished && !hop && px >= this.cfg.vanishX * TILE) {
      this.vanished = true;
      const c = this.decoy.center;
      this.decoy.vanish(this.scene);
      AudioManager.playTroll('hehe');
      ctx.fx.sparkle(c.x, c.y, 14);
      ctx.fx.pop(c.x, c.y - 60, 'PALSU!');
    }
    if (this.vanished && !this.revealed && px >= this.cfg.revealX * TILE) {
      this.revealed = true;
      ctx.portal.reveal(this.scene);
      AudioManager.play('reveal');
      ctx.fx.sparkle(ctx.portal.center.x, ctx.portal.center.y, 24);
      ctx.sprung(this, 'realFinish');
    }
  }
}
