import Phaser from 'phaser';
import { TILE } from '../config';
import { SLAB_H, slabOutlineTexture, slabTexture } from '../art/illusionTextures';
import { AudioManager } from '../managers/AudioManager';
import { TRAP_DATA_KEY, type RealityShiftConfig, type Trap, type TrapContext } from './types';

const PHASE_TINT = [0xa8ecbf, 0xffb3c8] as const;
const PHASE_LINE = [0x5aa877, 0xe0809a] as const;

interface ShiftPlatform {
  zone: Phaser.GameObjects.Zone;
  img: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  phase: 0 | 1;
  solid: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Reality Shift (Zone 4). Crystal platforms in two phases switch between SOLID and PHANTOM on
 * one deterministic clock. Each phase is solid for `solidMs` of every `periodMs`; phase 1 runs
 * half a period behind phase 0, so both are solid for a short moment at each change. Tells:
 * a platform about to vanish blinks, one about to appear fills in, and the phase lamps in the
 * safe area show the rhythm. The clock restarts on respawn (every try plays the same: mint
 * solid, pink phantom), and a
 * platform never turns solid while MOCHI is inside it.
 */
export class RealityShiftTrap implements Trap {
  readonly type = 'realityShift';
  id = '';
  readonly span;
  readonly solids: Phaser.GameObjects.Zone[] = [];
  private readonly platforms: ShiftPlatform[];
  private readonly lamps: Phaser.GameObjects.Image[] = [];
  private clock = 0;
  private readonly phaseSolid: [boolean, boolean] = [true, false];
  private readonly phaseWarned: [boolean, boolean] = [false, false];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: RealityShiftConfig,
  ) {
    this.platforms = cfg.platforms.map((p) => {
      const w = p.w * TILE;
      const left = p.x * TILE;
      const top = p.y * TILE;
      const zone = scene.add.zone(left + w / 2, top + SLAB_H / 2, w, SLAB_H);
      scene.physics.add.existing(zone, true);
      zone.setData(TRAP_DATA_KEY, this);
      this.solids.push(zone);
      const img = scene.add.image(left, top, slabTexture(scene, w)).setOrigin(0).setDepth(10).setTint(PHASE_TINT[p.phase]);
      const outline = scene.add.image(left, top, slabOutlineTexture(scene, w)).setOrigin(0).setDepth(10).setTint(PHASE_LINE[p.phase]);
      return { zone, img, outline, phase: p.phase, solid: true, left, right: left + w, top, bottom: top + SLAB_H };
    });
    if (cfg.lamps) {
      const lx = cfg.lamps.x * TILE + TILE / 2;
      const ly = cfg.lamps.y * TILE;
      for (const phase of [0, 1] as const) {
        this.lamps.push(scene.add.image(lx + phase * 30, ly, 'lamp').setDepth(9).setTint(PHASE_TINT[phase]));
      }
    }
    const left = Math.min(...cfg.platforms.map((p) => p.x));
    const right = Math.max(...cfg.platforms.map((p) => p.x + p.w));
    this.span = { left: left * TILE, right: right * TILE };
    this.clock = this.startClock;
    this.applyClock(null, null, true);
  }

  // ----- Tests and debugging -----

  get time(): number {
    return this.clock;
  }

  /** Solid flags per platform, in config order. */
  get solidStates(): boolean[] {
    return this.platforms.map((p) => p.solid);
  }

  /** Is `phase` solid at clock time `t` (ms)? Pure function of the config. */
  phaseSolidAt(phase: 0 | 1, t: number): boolean {
    return this.phaseTime(phase, t) < this.cfg.solidMs;
  }

  // ----- Clock -----

  /** Time since this phase last turned solid. */
  private phaseTime(phase: 0 | 1, t: number): number {
    const { periodMs } = this.cfg;
    const offset = phase === 0 ? 0 : periodMs / 2;
    return (((t - offset) % periodMs) + periodMs) % periodMs;
  }

  /**
   * Clock value at (re)spawn: just after the overlap, so mint is solid and pink is phantom. Every
   * try starts the same way (with the default numbers pink appears 1.2 s later).
   */
  private get startClock(): number {
    return Math.max(0, this.cfg.solidMs - this.cfg.periodMs / 2);
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    this.clock += Math.min(this.scene.game.loop.delta, 50);
    this.applyClock(box, ctx, false);
  }

  private applyClock(box: Phaser.Geom.Rectangle | null, ctx: TrapContext | null, force: boolean): void {
    const { solidMs, warnMs, periodMs } = this.cfg;
    const near = !!box && box.centerX >= this.cfg.fromX * TILE && box.centerX <= this.cfg.toX * TILE;
    const blinkOn = Math.floor(this.clock / 100) % 2 === 0;
    for (const phase of [0, 1] as const) {
      const pt = this.phaseTime(phase, this.clock);
      const solid = pt < solidMs;
      // Warning window: the last `warnMs` before this phase vanishes or appears.
      const warning = solid ? pt >= solidMs - warnMs : pt >= periodMs - warnMs;
      if (warning && !this.phaseWarned[phase]) {
        this.phaseWarned[phase] = true;
        if (near && solid) AudioManager.play('shiftWarn');
      } else if (!warning) {
        this.phaseWarned[phase] = false;
      }
      if (solid !== this.phaseSolid[phase] || force) {
        if (!force && near) AudioManager.play('shift');
        this.phaseSolid[phase] = solid;
      }
      const lamp = this.lamps[phase];
      if (lamp) lamp.setAlpha(solid ? (warning && !blinkOn ? 0.4 : 1) : warning ? 0.6 : 0.2);
    }

    for (const p of this.platforms) {
      const want = this.phaseSolid[p.phase];
      if (want !== p.solid || force) {
        if (want) {
          // Never turn solid inside MOCHI: wait until MOCHI is clear.
          if (!force && box && box.right > p.left && box.left < p.right && box.bottom > p.top && box.top < p.bottom) continue;
          this.setSolid(p, true);
        } else {
          if (box && ctx && box.right > p.left && box.left < p.right && Math.abs(box.bottom - p.top) <= 4) ctx.triggered(this);
          this.setSolid(p, false);
        }
      }
      if (!force) {
        const pt = this.phaseTime(p.phase, this.clock);
        if (p.solid) {
          p.img.setAlpha(pt >= solidMs - warnMs && !blinkOn ? 0.45 : 1);
        } else {
          const toAppear = periodMs - pt;
          p.img.setAlpha(toAppear <= warnMs ? 0.55 : 0.15);
          p.outline.setAlpha(toAppear <= warnMs ? 1 : 0.7);
        }
      }
    }
  }

  private setSolid(p: ShiftPlatform, solid: boolean): void {
    p.solid = solid;
    (p.zone.body as Phaser.Physics.Arcade.StaticBody).enable = solid;
    p.img.setAlpha(solid ? 1 : 0.15);
    p.outline.setAlpha(solid ? 0 : 0.7);
  }

  onContact(ctx: TrapContext): void {
    // Standing on a shift platform: a fall right after is credited to it.
    ctx.triggered(this);
  }

  onRespawn(): void {
    this.clock = this.startClock;
    this.phaseWarned[0] = false;
    this.phaseWarned[1] = false;
    this.applyClock(null, null, true);
  }
}
