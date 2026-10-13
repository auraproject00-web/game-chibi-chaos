import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { EventBus, GameEvents, type LevelCompletePayload } from '../managers/EventBus';
import { MOVE_ZONE, type TouchRole } from '../managers/InputManager';
import { IconButton } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { textStyle } from '../ui/text';
import type { GameScene } from './GameScene';

/** In-game HUD: level pill, death counter, pause/restart, touch hints and modal menus. */
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
  private rotateHint!: Phaser.GameObjects.Text;
  private overlay: Overlay | null = null;
  private isTouch = false;
  private u = 1;

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.overlay = null;
    this.isTouch = this.sys.game.device.input.touch;

    this.pauseBtn = new IconButton(this, 0, 0, 'icon_pause', () => this.game_.pauseGame(), 52, PALETTE.lavender);
    this.restartBtn = new IconButton(this, 0, 0, 'icon_restart', () => this.game_.restartLevel(), 52, 0x8fcbff);

    const info = this.game_.levelInfo;
    this.levelPillBg = this.add.graphics();
    this.levelText = this.add.text(0, 0, `Level ${info.id} · ${info.name}`, textStyle(20, TONES.inkCss)).setOrigin(0, 0.5);
    this.levelPill = this.add.container(0, 0, [this.levelPillBg, this.levelText]);

    this.deathPillBg = this.add.graphics();
    const skull = this.add.image(22, 0, 'skull').setDisplaySize(26, 26).setTint(0xffffff);
    this.deathText = this.add.text(42, 0, String(this.game_.deathCount), textStyle(22, '#ffffff', { stroke: '#4a3346', strokeThickness: 4 })).setOrigin(0, 0.5);
    this.deathPill = this.add.container(0, 0, [this.deathPillBg, skull, this.deathText]);

    this.rotateHint = this.add
      .text(0, 0, 'Putar HP ke mode landscape untuk pengalaman terbaik', textStyle(16, '#ffffff', { stroke: '#4a3346', strokeThickness: 4, align: 'center', wordWrap: { width: 300 } }))
      .setOrigin(0.5, 0);

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
  }

  private createTouchHints(): void {
    const make = (role: TouchRole, angle: number): Phaser.GameObjects.Container => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(0, 0, 34);
      g.lineStyle(3, 0xffffff, 0.7);
      g.strokeCircle(0, 0, 34);
      const arrow = this.add.image(0, 0, 'arrow').setAngle(angle).setAlpha(0.9).setScale(0.8);
      const c = this.add.container(0, 0, [g, arrow]).setAlpha(0.55).setDepth(5);
      this.touchHints[role] = c;
      return c;
    };
    make('left', 0);
    make('right', 180);
    make('jump', 90);
  }

  update(): void {
    if (!this.isTouch) return;
    const held = this.game_.controls?.heldRoles() ?? new Set<TouchRole>();
    for (const role of ['left', 'right', 'jump'] as TouchRole[]) {
      const hint = this.touchHints[role];
      if (!hint) continue;
      const on = held.has(role);
      hint.setAlpha(on ? 0.95 : 0.5).setScale(this.u * (on ? 0.92 : 1));
    }
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const u = Phaser.Math.Clamp(Math.min(w / 900, h / 500), 0.65, 1.35);
    this.u = u;
    const m = 14 * u;
    const size = 52 * u;

    this.pauseBtn.setScale(u).setPosition(m + size / 2, m + size / 2);
    this.restartBtn.setScale(u).setPosition(w - m - size / 2, m + size / 2);

    // Level pill.
    const lw = this.levelText.width + 32;
    this.levelPillBg.clear();
    this.levelPillBg.fillStyle(PALETTE.cream, 0.92);
    this.levelPillBg.fillRoundedRect(0, -20, lw, 40, 20);
    this.levelPillBg.lineStyle(3, PALETTE.lavender, 1);
    this.levelPillBg.strokeRoundedRect(0, -20, lw, 40, 20);
    this.levelText.setPosition(16, 0);
    this.levelPill.setScale(u).setPosition(m * 2 + size, m + size / 2);
    // Hide the pill on very narrow screens where it would collide with the counter.
    this.levelPill.setVisible(w > 420);

    // Death pill.
    this.layoutDeathPill();
    const dw = (this.deathText.width + 60) * u;
    this.deathPill.setScale(u).setPosition(w - m * 2 - size - dw, m + size / 2);

    const portrait = this.isTouch && h > w;
    this.rotateHint.setVisible(portrait).setPosition(w / 2, m + size + 16 * u);

    // Touch hints sit inside their zones, near the bottom.
    const hy = h - 58 * u;
    this.touchHints.left?.setPosition(w * (MOVE_ZONE.leftEnd / 2), hy).setScale(u);
    this.touchHints.right?.setPosition(w * ((MOVE_ZONE.leftEnd + MOVE_ZONE.rightEnd) / 2), hy).setScale(u);
    this.touchHints.jump?.setPosition(w - 70 * u, hy).setScale(u);

    this.overlay?.layout(w, h);
  }

  private layoutDeathPill(): void {
    const dw = this.deathText.width + 60;
    this.deathPillBg.clear();
    this.deathPillBg.fillStyle(TONES.ink, 0.55);
    this.deathPillBg.fillRoundedRect(0, -20, dw, 40, 20);
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
