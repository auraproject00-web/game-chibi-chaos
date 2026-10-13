import Phaser from 'phaser';
import { TILE } from '../config';
import { FinishPortal } from '../entities/FinishPortal';
import { AudioManager } from '../managers/AudioManager';
import { FakePlatform } from './FakePlatform';
import { SpikeTrap } from './SpikeTrap';
import type { DecoyPortalConfig, Trap, TrapContext } from './types';

/**
 * Decoy Portal (Triple Fake Finish): a portal that looks almost like the real one (tells: it
 * spins the other way and glows pink). When MOCHI gets close it springs its own surprise:
 *  - `flee`: hops away and vanishes, and hidden spikes pop where it stood;
 *  - `drop`: the cracked ground under it wobbles and falls away.
 * It never completes the level. It resets on respawn, so it springs the same way every time.
 */
export class DecoyPortalTrap implements Trap {
  readonly type = 'decoyPortal';
  id = '';
  readonly span;
  readonly solids;
  private readonly decoy: FinishPortal;
  private readonly home: { x: number; bottomY: number };
  private readonly spikes: SpikeTrap | null;
  private readonly floor: FakePlatform | null;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private sprung = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: DecoyPortalConfig,
  ) {
    this.home = { x: cfg.x * TILE + TILE / 2, bottomY: cfg.y * TILE };
    this.decoy = new FinishPortal(scene, this.home.x, this.home.bottomY, { decoy: true });
    this.spikes = cfg.spikes
      ? new SpikeTrap(scene, { x: cfg.spikes.x * TILE, surfaceY: (cfg.spikes.y ?? cfg.y) * TILE, tiles: cfg.spikes.w, hidden: true })
      : null;
    this.floor = cfg.floor
      ? new FakePlatform(scene, cfg.floor.x * TILE, cfg.y * TILE, cfg.floor.w * TILE, (cfg.floor.h ?? 1) * TILE, cfg.floor.delayMs ?? 250)
      : null;
    this.solids = this.floor ? [this.floor.zone] : [];
    const left = Math.min(cfg.x, cfg.triggerX, cfg.spikes?.x ?? cfg.x, cfg.floor?.x ?? cfg.x);
    const right = Math.max(cfg.x + 1, cfg.spikes ? cfg.spikes.x + cfg.spikes.w : 0, cfg.floor ? cfg.floor.x + cfg.floor.w : 0);
    this.span = { left: left * TILE, right: right * TILE };
  }

  /** Has it gone off during this life (tests and debugging). */
  get isSprung(): boolean {
    return this.sprung;
  }

  get decoyCenter(): Phaser.Math.Vector2 {
    return this.decoy.center;
  }

  update(player: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    if (!this.sprung && player.centerX >= this.cfg.triggerX * TILE) this.spring(ctx);
    if (this.spikes?.hits(player)) ctx.kill('spike', this);
  }

  private spring(ctx: TrapContext): void {
    this.sprung = true;
    const from = this.decoy.center.clone();
    AudioManager.playTroll('hehe');
    ctx.fx.pop(from.x, from.y - 60, this.cfg.effect === 'flee' ? 'Hehe!' : 'PALSU!');
    ctx.sprung(this, 'decoyPortal');
    if (this.cfg.effect === 'flee') {
      const to = this.cfg.fleeTo ?? { x: this.cfg.x + 3, y: this.cfg.y - 3 };
      this.decoy.runTo(this.scene, to.x * TILE + TILE / 2, to.y * TILE);
      AudioManager.play('whoosh');
      this.later(520, () => {
        ctx.fx.sparkle(this.decoy.center.x, this.decoy.center.y, 12);
        this.decoy.vanish(this.scene);
      });
      const spikes = this.spikes;
      const s = this.cfg.spikes;
      if (spikes && s) {
        this.later(s.delayMs ?? 0, () => {
          if (s.warnMs) spikes.warn(s.warnMs);
          else spikes.reveal();
          ctx.fx.shake(120, 0.004);
        });
      }
    } else {
      // The ground goes first; the decoy falls away with it.
      ctx.triggered(this);
      this.floor?.trigger();
      this.later(this.cfg.floor?.delayMs ?? 250, () => this.decoy.vanish(this.scene));
    }
  }

  private later(ms: number, fn: () => void): void {
    if (ms <= 0) fn();
    else this.timers.push(this.scene.time.delayedCall(ms, fn));
  }

  onRespawn(): void {
    this.timers.forEach((t) => t.remove(false));
    this.timers.length = 0;
    this.sprung = false;
    this.decoy.resetTo(this.scene, this.home.x, this.home.bottomY);
    this.spikes?.hide();
    this.floor?.reset();
  }
}
