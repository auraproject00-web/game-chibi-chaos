import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { DeathReactionManager } from '../managers/DeathReactionManager';
import { EventBus, GameEvents, type DeathReactionPayload, type LevelCompletePayload } from '../managers/EventBus';
import { SaveManager } from '../managers/SaveManager';
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
  private soundBtn!: IconButton;
  private soundIcon!: Phaser.GameObjects.Image;
  private levelPill!: Phaser.GameObjects.Container;
  private levelPillBg!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private deathPill!: Phaser.GameObjects.Container;
  private deathPillBg!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;
  private touchHints: Partial<Record<TouchRole, Phaser.GameObjects.Container>> = {};
  private overlay: Overlay | null = null;
  /** The one death-message popup on screen; a new death replaces it. */
  private toast: Phaser.GameObjects.Container | null = null;
  private toastY = 0;
  private isTouch = false;
  private u = 1;

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.overlay = null;
    this.toast = null;
    this.touchHints = {};
    this.isTouch = this.sys.game.device.input.touch;

    this.pauseBtn = new IconButton(this, 0, 0, 'icon_pause', () => this.game_.pauseGame(), HUD_BUTTON, PALETTE.lavender);
    this.restartBtn = new IconButton(this, 0, 0, 'icon_restart', () => this.game_.restartLevel(), HUD_BUTTON, 0x8fcbff);
    this.soundBtn = new IconButton(this, 0, 0, this.soundKey(), () => this.toggleSound(), HUD_BUTTON, PALETTE.peach);
    this.soundIcon = this.soundBtn.list.find((c) => c instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image;
    this.soundBtn.setAlpha(0.92);
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
    EventBus.on(GameEvents.DeathReaction, this.showDeathReaction, this);
    if (import.meta.env.DEV) this.installMilestoneCheat();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DeathsChanged, this.onDeaths, this);
      EventBus.off(GameEvents.Paused, this.showPause, this);
      EventBus.off(GameEvents.LevelComplete, this.showComplete, this);
      EventBus.off(GameEvents.DeathReaction, this.showDeathReaction, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game_.controls?.detachTouch();
    });

    this.layout();

    // Started while held in portrait: wait paused until the phone is rotated.
    if (isPortraitTouch(this.scale.width, this.scale.height, this.isTouch)) this.game_.pauseGame();
  }

  /**
   * Touch pads drawn for contrast on any background: a dark translucent disc with a white rim
   * and a white arrow outlined in dark ink. They light up pink while pressed.
   */
  private createTouchHints(): void {
    const make = (role: TouchRole, angle: number, radius: number): void => {
      const glow = this.add.graphics();
      glow.fillStyle(PALETTE.pink, 0.55);
      glow.fillCircle(0, 0, radius);
      glow.setVisible(false).setName('glow');
      const g = this.add.graphics();
      g.fillStyle(TONES.ink, 0.28);
      g.fillCircle(0, 0, radius);
      g.lineStyle(3, 0xffffff, 0.95);
      g.strokeCircle(0, 0, radius);
      g.lineStyle(1.5, TONES.ink, 0.35);
      g.strokeCircle(0, 0, radius + 2);
      const shadow = this.add.image(0, 2, 'arrow').setAngle(angle).setScale(radius / 38).setTint(TONES.ink).setAlpha(0.45);
      const arrow = this.add.image(0, 0, 'arrow').setAngle(angle).setScale(radius / 40);
      this.touchHints[role] = this.add.container(0, 0, [g, glow, shadow, arrow]).setDepth(5);
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
      (hint.getByName('glow') as Phaser.GameObjects.Graphics | null)?.setVisible(on);
      hint.setAlpha(on ? 1 : 0.8).setScale(this.u * (on ? 0.92 : 1));
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
    this.soundBtn.setScale(u).setPosition(right - size * 1.5 - 8 * u, rowY);

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
    this.deathPill.setScale(u).setPosition(right - size * 2 - 16 * u - dw * u, rowY);

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

    // Death popups sit just under the top HUD row: never over the touch pads at the bottom.
    this.toastY = top + size + 30 * u;
    this.toast?.setPosition(w / 2, this.toastY);

    this.overlay?.layout(w, h);
  }

  /**
   * Small pastel popup with the death message (about 1s), or a bigger one for milestones.
   * A new death clears the previous popup at once so they never stack.
   */
  private showDeathReaction(p: DeathReactionPayload): void {
    this.clearToast();
    const milestone = !!p.title;
    const children: Phaser.GameObjects.GameObject[] = [];
    const msg = this.add.text(0, 0, p.message, textStyle(milestone ? 17 : 16, TONES.inkCss)).setOrigin(0.5);
    let title: Phaser.GameObjects.Text | null = null;
    if (milestone) {
      title = this.add
        .text(0, 0, p.title!, textStyle(19, '#ffffff', { stroke: '#c0607a', strokeThickness: 4 }))
        .setOrigin(0.5);
    }
    const padX = 20;
    const w = Math.max(msg.width, title?.width ?? 0) + padX * 2 + (milestone ? 44 : 0);
    const h = milestone ? 72 : 40;
    const bg = this.add.graphics();
    bg.fillStyle(TONES.ink, 0.18);
    bg.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 18);
    bg.fillStyle(milestone ? PALETTE.pink : PALETTE.cream, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.5, milestone ? 0xffffff : PALETTE.lavender, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    children.push(bg);
    if (title) {
      title.setY(-14);
      msg.setY(16);
      const starL = this.add.image(-w / 2 + 22, 0, 'star').setDisplaySize(24, 24);
      const starR = this.add.image(w / 2 - 22, 0, 'star').setDisplaySize(24, 24);
      children.push(starL, starR, title);
      this.tweens.add({ targets: [starL, starR], angle: 360, duration: 1600, repeat: -1 });
    }
    children.push(msg);

    const toast = this.add.container(this.scale.width / 2, this.toastY, children).setDepth(20);
    const s = this.u;
    toast.setScale(s * 0.6).setAlpha(0);
    this.toast = toast;
    this.tweens.chain({
      targets: toast,
      tweens: [
        { alpha: 1, scale: s, duration: 160, ease: 'Back.easeOut' },
        { alpha: 0, y: this.toastY - 10, duration: 240, delay: milestone ? 1700 : 720, ease: 'Quad.easeIn' },
      ],
      onComplete: () => {
        if (this.toast === toast) this.toast = null;
        toast.destroy();
      },
    });
  }

  private clearToast(): void {
    if (!this.toast) return;
    this.tweens.killTweensOf(this.toast);
    this.toast.list.forEach((c) => this.tweens.killTweensOf(c));
    this.toast.destroy();
    this.toast = null;
  }

  /**
   * Dev builds only: long-press the death counter to jump the total deaths to just before the
   * next milestone (9, 24, 49, 99, 199…). Die once more to see the milestone.
   */
  private installMilestoneCheat(): void {
    this.deathPill.setSize(90, PILL_H);
    this.deathPill.setInteractive(new Phaser.Geom.Rectangle(0, -PILL_H / 2, 90, PILL_H), Phaser.Geom.Rectangle.Contains);
    let timer: Phaser.Time.TimerEvent | null = null;
    const cancel = (): void => {
      timer?.remove(false);
      timer = null;
    };
    this.deathPill.on('pointerdown', () => {
      cancel();
      timer = this.time.delayedCall(600, () => {
        const next = DeathReactionManager.nextMilestone(SaveManager.totalDeaths);
        this.game_.debugSetTotalDeaths(next - 1);
        this.showDeathReaction({ message: `Tes: total mati = ${next - 1}. Mati 1x lagi!` });
      });
    });
    this.deathPill.on('pointerup', cancel);
    this.deathPill.on('pointerout', cancel);
  }

  private soundKey(): string {
    return AudioManager.sfxEnabled ? 'icon_sound_on' : 'icon_sound_off';
  }

  private toggleSound(): void {
    AudioManager.setSfxEnabled(!AudioManager.sfxEnabled);
    this.soundIcon.setTexture(this.soundKey());
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
            this.soundIcon.setTexture(this.soundKey());
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
