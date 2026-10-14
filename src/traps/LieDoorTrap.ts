import Phaser from 'phaser';
import { TILE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { textStyle } from '../ui/text';
import { IllusionPlatform } from './IllusionPlatform';
import type { LieDoorConfig, Trap, TrapContext } from './types';

const PANEL_W = 28;
/** The true door opens when MOCHI is this close (tiles): already from the pillar below it. */
const OPEN_DIST = 6;
const OPEN_ROWS = 2;

/**
 * The Final Lie (Zone 5). Three doors with labels that may lie, each always doing the same thing:
 *  - `trap`: it stands on an illusion floor (it shimmers, like the Mirror Maze) that drops MOCHI;
 *  - `warp`: walk in and MOCHI is sent back to an earlier safe point (no death);
 *  - `true`: hides the real finish portal and opens when MOCHI comes close.
 * Nothing is random: the same door is the real one on every try.
 */
export class LieDoorTrap implements Trap {
  readonly type = 'lieDoor';
  id = '';
  readonly span;
  private readonly cx: number;
  private readonly bottom: number;
  private readonly door: Phaser.GameObjects.Container;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  private readonly knobs: Phaser.GameObjects.Image[];
  private readonly floor: IllusionPlatform | null;
  private opened = false;
  private sprung = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: LieDoorConfig,
  ) {
    this.cx = cfg.x * TILE + TILE / 2;
    this.bottom = cfg.y * TILE;
    this.floor = cfg.kind === 'trap' && cfg.floor ? new IllusionPlatform(scene, cfg.floor.x * TILE, this.bottom, cfg.floor.w * TILE, TILE) : null;

    const isTrue = cfg.kind === 'true';
    // The true door's frame sits behind the real portal, so the portal shows once the panels open.
    const frame = isTrue
      ? scene.add.image(this.cx, this.bottom + 2, 'door_frame').setOrigin(0.5, 1).setDepth(9)
      : scene.add.image(0, 2, 'door_frame').setOrigin(0.5, 1);
    this.left = scene.add.image(-PANEL_W, 0, 'door_panel').setOrigin(0, 1);
    this.right = scene.add.image(PANEL_W, 0, 'door_panel').setOrigin(1, 1);
    const knobL = scene.add.image(-6, -42, 'door_knob');
    const knobR = scene.add.image(6, -42, 'door_knob');
    const label = scene.add
      .text(0, -114, cfg.label, textStyle(13, '#ffffff', { stroke: '#6d5a9c', strokeThickness: 4, align: 'center' }))
      .setOrigin(0.5);
    this.knobs = [knobL, knobR];
    const parts = isTrue ? [this.left, this.right, knobL, knobR, label] : [frame, this.left, this.right, knobL, knobR, label];
    this.door = scene.add.container(this.cx, this.bottom, parts).setDepth(isTrue ? 13 : 9);
    if (cfg.kind === 'warp') this.door.setAngle(-4);
    if (cfg.kind === 'trap') this.shimmer();

    const l = Math.min(cfg.x - 1, cfg.floor?.x ?? cfg.x);
    const r = Math.max(cfg.x + 2, cfg.floor ? cfg.floor.x + cfg.floor.w : 0);
    this.span = { left: l * TILE, right: r * TILE };
  }

  get kind(): LieDoorConfig['kind'] {
    return this.cfg.kind;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  get isSprung(): boolean {
    return this.sprung;
  }

  /** The illusion door wavers like every other lie made of light. */
  private shimmer(): void {
    this.scene.tweens.add({
      targets: this.door,
      alpha: { from: 1, to: 0.7 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  init(ctx: TrapContext): void {
    if (this.cfg.kind === 'true') ctx.portal.hide();
  }

  update(box: Phaser.Geom.Rectangle, ctx: TrapContext): void {
    switch (this.cfg.kind) {
      case 'trap':
        if (this.floor?.touches(box)) {
          this.floor.shatter(ctx.fx);
          ctx.triggered(this);
          if (!this.sprung) {
            this.sprung = true;
            AudioManager.play('fakeDoor');
            ctx.fx.pop(this.cx, this.bottom - 130, 'HEHE!');
            this.slam();
          }
        }
        break;
      case 'warp':
        if (this.inDoorway(box)) this.warp(ctx);
        break;
      case 'true':
        if (!this.opened && Math.abs(box.centerX - this.cx) <= OPEN_DIST * TILE && Math.abs(box.bottom - this.bottom) <= OPEN_ROWS * TILE) {
          this.open(ctx);
        }
        break;
    }
  }

  /** MOCHI's hitbox well inside the door's opening. */
  private inDoorway(box: Phaser.Geom.Rectangle): boolean {
    return Math.abs(box.centerX - this.cx) <= 14 && box.bottom > this.bottom - 40 && box.top < this.bottom;
  }

  private slam(): void {
    this.scene.tweens.add({ targets: [this.left, this.right], scaleX: 0.7, duration: 90, yoyo: true, repeat: 1 });
  }

  private warp(ctx: TrapContext): void {
    const to = this.cfg.warpTo;
    if (!to || !ctx.player.isAlive) return;
    this.sprung = true;
    AudioManager.play('fakeDoor');
    ctx.fx.pop(this.cx, this.bottom - 130, 'WKWK!');
    ctx.fx.sparkle(this.cx, this.bottom - 40, 12);
    this.slam();
    this.scene.cameras.main.flash(260, 243, 236, 255);
    ctx.player.respawn(to.x * TILE + TILE / 2, to.y * TILE);
    ctx.sprung(this, 'lieDoor');
  }

  private open(ctx: TrapContext): void {
    this.opened = true;
    AudioManager.play('trueDoor');
    this.scene.tweens.add({ targets: [this.left, this.right], scaleX: 0.08, duration: 360, ease: 'Back.easeIn' });
    this.scene.tweens.add({ targets: this.knobs, alpha: 0, duration: 200 });
    ctx.portal.reveal(this.scene);
    ctx.fx.sparkle(this.cx, this.bottom - 50, 16);
    ctx.sprung(this, 'trueDoor');
  }

  onRespawn(): void {
    // The true door stays open once found (progress is never undone); the others reset.
    if (this.cfg.kind === 'trap') {
      this.sprung = false;
      this.floor?.reset();
      this.scene.tweens.killTweensOf([this.door, this.left, this.right]);
      this.left.setScale(1);
      this.right.setScale(1);
      this.shimmer();
    } else if (this.cfg.kind === 'warp') {
      this.sprung = false;
    }
  }
}
