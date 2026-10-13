import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { EventBus, GameEvents, type LevelCompletePayload } from '../managers/EventBus';
import type { TouchRole } from '../managers/InputManager';
import { IconButton } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { getSafeArea, isPortraitTouch } from '../ui/safeArea';
import { textStyle } from '../ui/text';
import type { GameScene } from './GameScene';

const HUD_BUTTON = 40;
const PILL_H = 30;

/**
 * Minimal in-game HUD: pause, level label, death counter, restart, touch pads and modal menus.
 * Everything is placed inside the device safe area (iPhone notch and home indicator).
 */
export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  private pauseBtn!: IconButton;
  private restartBtn!: IconButton;
  private levelPill!: Phaser.GameObjects.Container;
  private levelPillBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private deathPill!: Phaser.GameObjects.Container;
  private deathPillBg!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;
  private touchHints: Partial<Record<TouchRole, Phaser.GameObjects.Container>> = {};
  private overlay: Overlay | null = null;
  private isTouch = false;
  private u = 1;

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.overlay = null;
    this.touchHints = {};
    this.isTouch = this.sys.game.device.input.touch;

    this.pauseBtn = new IconButton(this, 0, 0, 'icon_pause', () => this.game_.pauseGame(), HUD_BUTTON, PALETTE.lavender);
    this.restartBtn = new IconButton(this, 0, 0, 'icon_restart', () => this.game_.restartLevel(), HUD_BUTTON, 0x8fcbff);
    this.pauseBtn.setAlpha(0.92);
    this.restartBtn.setAlpha(0.92);

    const info = this.game_.levelInfo;
    this.levelPillBg = this.add.graphics();
    this.levelText = this.add.text(0, 0, `${info.id} · ${info.name}`, textStyle(15, TONES.inkCss)).setOrigin(0, 0.5);
    this.levelPill = this.add.container(0, 0, [this.levelPillBg, this.levelText]);

    this.deathPillBg = this.add.graphics();
    const skull = this.add.image(17, 0, 'skull').setDisplaySize(20, 20);
    this.deathText = this.add
      .text(32, 0, String(this.game_.deathCount), textStyle(17, '#ffffff', { stroke: '#4a3346', strokeThickness: 3 }))
      .setOrigin(0, 0.5);
    this.deathPill = this.add.container(0, 0, [this.deathPillBg, skull, this.deathText]);

    if (this.isTouch) this.createTouchHints();

    this.game_.controls.attachTouch(this);

    // Keyboard shortcuts live here because the game scene stops receiving input while paused.
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', this.togglePause, this);
    kb?.on('keydown-P', this.togglePause, this);
    kb?.on('keydown-R', () => {
      if (!this.overlay) this.game_.restartLevel();
    });

    EventBus.on(GameEvents.DeathsChanged, this.onDeaths, this);
    EventBus.on(GameEvents.Paused, this.showPause, this);
    EventBus.on(GameEvents.LevelComplete, this.showComplete, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DeathsChanged, this.onDeaths, this);
      EventBus.off(GameEvents.Paused, this.showPause, this);
      EventBus.off(GameEvents.LevelComplete, this.showComplete, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game_.controls?.detachTouch();
    });

    this.layout();

    // Started while held in portrait: wait paused until the phone is rotated.
    if (isPortraitTouch(this.scale.width, this.scale.height, this.isTouch)) this.game_.pauseGame();
  }

  /** Small translucent pads that show where to press; they sit low, over the ground. */
  private createTouchHints(): void {
    const make = (role: TouchRole, angle: number, radius: number): void => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(0, 0, radius);
      g.lineStyle(2.5, 0xffffff, 0.75);
      g.strokeCircle(0, 0, radius);
      const arrow = this.add.image(0, 0, 'arrow').setAngle(angle).setScale(radius / 40);
      this.touchHints[role] = this.add.container(0, 0, [g, arrow]).setDepth(5);
    };
    make('left', 0, 30);
    make('right', 180, 30);
    make('jump', 90, 34);
  }

  update(): void {
    if (!this.isTouch) return;
    const held = this.game_.controls?.heldRoles() ?? new Set<TouchRole>();
    for (const role of ['left', 'right', 'jump'] as TouchRole[]) {
      const hint = this.touchHints[role];
      if (!hint) continue;
      const on = held.has(role);
      hint.setAlpha(on ? 0.9 : 0.45).setScale(this.u * (on ? 0.9 : 1));
    }
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const inset = getSafeArea();
    const u = Phaser.Math.Clamp(Math.min(w / 900, h / 420), 0.75, 1.3);
    this.u = u;
    const m = 10 * u;
    const left = inset.left + m;
    const right = w - inset.right - m;
    const top = inset.top + m;
    const size = HUD_BUTTON * u;
    const rowY = top + size / 2;

    this.pauseBtn.setScale(u).setPosition(left + size / 2, rowY);
    this.restartBtn.setScale(u).setPosition(right - size / 2, rowY);

    // Level label pill.
    const lw = this.levelText.width + 24;
    this.levelPillBg.clear();
    this.levelPillBg.fillStyle(PALETTE.cream, 0.8);
    this.levelPillBg.fillRoundedRect(0, -PILL_H / 2, lw, PILL_H, PILL_H / 2);
    this.levelText.setPosition(12, 0);
    this.levelPill.setScale(u).setPosition(left + size + 8 * u, rowY);
    this.levelPill.setVisible(w > 480);

    // Death counter pill.
    const dw = this.deathText.width + 44;
    this.deathPillBg.clear();
    this.deathPillBg.fillStyle(TONES.ink, 0.45);
    this.deathPillBg.fillRoundedRect(0, -PILL_H / 2, dw, PILL_H, PILL_H / 2);
    this.deathPill.setScale(u).setPosition(right - size - 8 * u - dw * u, rowY);

    // Touch pads: thumb-sized, inside the safe area, low on the screen over the ground.
    const padY = h - inset.bottom - 44 * u;
    const leftPadX = inset.left + 52 * u;
    const rightPadX = leftPadX + 86 * u;
    this.touchHints.left?.setPosition(leftPadX, padY).setScale(u);
    this.touchHints.right?.setPosition(rightPadX, padY).setScale(u);
    this.touchHints.jump?.setPosition(right - 46 * u, padY).setScale(u);
    this.game_.controls?.setTouchLayout({
      splitX: (leftPadX + rightPadX) / 2,
      moveZoneEnd: Math.max(w * 0.4, rightPadX + 90 * u),
    });

    this.overlay?.layout(w, h);
  }

  private onDeaths(deaths: number): void {
    this.deathText.setText(String(deaths));
    this.layout();
    this.tweens.killTweensOf(this.deathText);
    this.deathText.setScale(1);
    this.tweens.add({ targets: this.deathText, scale: 1.5, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  private togglePause(): void {
    if (this.overlay) {
      if (this.scene.isPaused('Game')) this.resume();
      return;
    }
    this.game_.pauseGame();
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  private resume(): void {
    this.closeOverlay();
    this.game_.resumeGame();
  }

  private showPause(): void {
    this.closeOverlay();
    const soundLabel = (): string => `Sound: ${AudioManager.sfxEnabled ? 'ON' : 'OFF'}`;
    const overlay = new Overlay(this, {
      title: 'Paused',
      buttons: [
        { label: 'Resume', fill: 0x8fcbff, onClick: () => this.resume() },
        { label: 'Restart', fill: PALETTE.pink, onClick: () => this.game_.restartLevel() },
        {
          label: soundLabel(),
          fill: PALETTE.lavender,
          onClick: () => {
            AudioManager.setSfxEnabled(!AudioManager.sfxEnabled);
            overlay.getButton(2)?.setLabel(soundLabel());
          },
        },
        { label: 'Main Menu', fill: 0xf7b878, onClick: () => this.game_.quitTo('Menu') },
      ],
    });
    this.overlay = overlay;
  }

  private showComplete(p: LevelCompletePayload): void {
    this.closeOverlay();
    const deathsLine = p.deaths === 0 ? 'Tanpa mati sekali pun! Hebat!' : `Mati ${p.deaths}x  (terbaik: ${p.bestDeaths})`;
    const buttons = [
      ...(p.hasNext ? [{ label: 'Next Level', fill: PALETTE.mint, onClick: () => this.game_.nextLevel() }] : []),
      { label: 'Play Again', fill: PALETTE.pink, onClick: () => this.game_.restartLevel() },
      { label: 'Level Select', fill: 0x8fcbff, onClick: () => this.game_.quitTo('LevelSelect') },
    ];
    this.overlay = new Overlay(this, {
      title: 'Level Clear!',
      body: `${deathsLine}${p.hasNext ? '' : '\nLevel berikutnya sedang dibuat.'}`,
      buttons,
    });
  }
}
