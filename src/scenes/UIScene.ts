import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { AudioManager, type SfxName } from '../managers/AudioManager';
import { EventBus, GameEvents, type DeathReactionPayload, type LevelCompletePayload, type NarratorLine } from '../managers/EventBus';
import type { TouchRole } from '../managers/InputManager';
import { PROFILES } from '../managers/TrollIntensity';
import { IconButton } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { openSettingsOverlay } from '../ui/SettingsOverlay';
import { getSafeArea, isPortraitTouch } from '../ui/safeArea';
import type { DebugHost } from '../ui/DebugTools';
import { textStyle } from '../ui/text';
import type { GameScene } from './GameScene';

const HUD_BUTTON = 40;
/** Speech-slot priorities. Narrator lines use the values from TrollPersonalityManager (10–90). */
const MILESTONE_PRIORITY = 100;
const DEATH_PRIORITY = 5;

interface BubbleRequest {
  style: 'death' | 'milestone' | 'narrator';
  text: string;
  title?: string;
  priority: number;
  holdMs: number;
  /** Narrator only: entrance animation and face icon (from the Troll Intensity profile). */
  popup?: 'simple' | 'bounce' | 'wild';
  face?: string;
}
/** A plain death message right after another bubble is skipped, so rapid deaths don't flicker popups. */
const DEATH_MIN_GAP_MS = 1100;
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
  private toastPriority = 0;
  private toastW = 0;
  private toastReq: BubbleRequest | null = null;
  private toastShownAt = -Infinity;
  private isTouch = false;
  private u = 1;

  constructor() {
    super('UI');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.overlay = null;
    this.toast = null;
    this.toastPriority = 0;
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
    EventBus.on(GameEvents.NarratorSay, this.showNarrator, this);
    if (import.meta.env.DEV) {
      // Loaded on demand and dropped from production builds entirely.
      void import('../ui/DebugTools').then((m) => {
        if (this.sys.isActive()) m.installDebugTools(this.debugHost());
      });
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DeathsChanged, this.onDeaths, this);
      EventBus.off(GameEvents.Paused, this.showPause, this);
      EventBus.off(GameEvents.LevelComplete, this.showComplete, this);
      EventBus.off(GameEvents.DeathReaction, this.showDeathReaction, this);
      EventBus.off(GameEvents.NarratorSay, this.showNarrator, this);
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
    if (this.toast) {
      const pos = this.bubblePos();
      this.toast.setPosition(pos.x, pos.y);
    }

    this.overlay?.layout(w, h);
  }

  /**
   * Death Reaction popup: a small cream pill with the death message (about 1s), or a bigger pink
   * one for milestones. Shares the single speech slot with the narrator.
   */
  private showDeathReaction(p: DeathReactionPayload): void {
    const milestone = !!p.title;
    this.showBubble({
      style: milestone ? 'milestone' : 'death',
      text: p.message,
      title: p.title,
      priority: milestone ? MILESTONE_PRIORITY : DEATH_PRIORITY,
      holdMs: milestone ? 1700 : 720,
    });
  }

  /** Troll narrator line: lavender bubble with a pink "Narator" tag and a face; style follows the intensity. */
  private showNarrator(line: NarratorLine): void {
    const profile = PROFILES[line.intensity] ?? PROFILES.chaos;
    const shown = this.showBubble({
      style: 'narrator',
      text: line.text,
      priority: line.priority,
      holdMs: profile.holdMs,
      popup: profile.popup,
      face: line.face,
    });
    if (shown && profile.sfxChance > 0 && Math.random() < profile.sfxChance) {
      const pool: SfxName[] = line.intensity === 'savage' ? ['boing', 'hehe', 'blip'] : ['boing', 'blip'];
      AudioManager.playTroll(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  /**
   * One speech slot under the top HUD, so popups never stack and never cover the touch pads.
   * A new bubble replaces the current one unless the current one has a higher priority.
   */
  private showBubble(b: BubbleRequest): boolean {
    if (this.toast && this.toastPriority > b.priority) return false;
    if (b.style === 'death' && this.toast && this.time.now - this.toastShownAt < DEATH_MIN_GAP_MS) return false;
    this.clearToast();
    this.toastReq = b;
    const children: Phaser.GameObjects.GameObject[] = [];
    const isMilestone = b.style === 'milestone';
    const isNarrator = b.style === 'narrator';
    const msg = this.add.text(0, 0, b.text, textStyle(isMilestone || isNarrator ? 17 : 16, TONES.inkCss, { align: 'center' })).setOrigin(0.5);
    // Beside a menu panel there is less room: wrap the text so the bubble fits next to it.
    const side = this.sideRoom();
    if (side !== null && msg.width + 40 > side) msg.setWordWrapWidth(Math.max(110, side - 40));
    let title: Phaser.GameObjects.Text | null = null;
    if (b.title) {
      title = this.add
        .text(0, 0, b.title, textStyle(19, '#ffffff', { stroke: '#c0607a', strokeThickness: 4 }))
        .setOrigin(0.5);
    }
    const padX = 20;
    const faceW = isNarrator && b.face && this.textures.exists(b.face) ? 36 : 0;
    const w = Math.max(msg.width, title?.width ?? 0) + padX * 2 + (isMilestone ? 44 : 0) + faceW;
    const h = Math.max(isMilestone ? 72 : isNarrator ? 44 : 40, msg.height + (isMilestone ? 44 : 20));
    const fill = isMilestone ? PALETTE.pink : isNarrator ? PALETTE.lavender : PALETTE.cream;
    const stroke = isMilestone ? 0xffffff : isNarrator ? PALETTE.pink : PALETTE.lavender;
    const bg = this.add.graphics();
    bg.fillStyle(TONES.ink, 0.18);
    bg.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 18);
    bg.fillStyle(fill, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    if (isNarrator) {
      // Little speech tail pointing down-left.
      bg.fillTriangle(-w / 2 + 26, h / 2 - 1, -w / 2 + 44, h / 2 - 1, -w / 2 + 24, h / 2 + 11);
    }
    bg.lineStyle(2.5, stroke, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    children.push(bg);
    if (isNarrator) {
      const tag = this.add.text(0, 0, 'Narator', textStyle(12, '#ffffff')).setOrigin(0.5);
      const tw = tag.width + 16;
      const tagBg = this.add.graphics();
      tagBg.fillStyle(0xf28aa8, 1);
      tagBg.fillRoundedRect(-tw / 2, -10, tw, 20, 10);
      const tagBox = this.add.container(-w / 2 + tw / 2 + 10, -h / 2 - 2, [tagBg, tag]);
      children.push(tagBox);
      msg.setY(2);
      if (faceW) {
        const face = this.add.image(-w / 2 + 12 + faceW / 2, 1, b.face!).setDisplaySize(30, 30);
        msg.setX(faceW / 2 - 2);
        children.push(face);
        // Small head-bob so the narrator feels alive.
        this.tweens.add({ targets: face, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      }
    }
    if (title) {
      title.setY(-14);
      msg.setY(16);
      const starL = this.add.image(-w / 2 + 22, 0, 'star').setDisplaySize(24, 24);
      const starR = this.add.image(w / 2 - 22, 0, 'star').setDisplaySize(24, 24);
      children.push(starL, starR, title);
      this.tweens.add({ targets: [starL, starR], angle: 360, duration: 1600, repeat: -1 });
    }
    children.push(msg);

    this.toastW = w;
    const pos = this.bubblePos();
    const toast = this.add.container(pos.x, pos.y, children).setDepth(1100);
    const s = this.u;
    toast.setScale(s * 0.6).setAlpha(0);
    this.toast = toast;
    this.toastPriority = b.priority;
    this.toastShownAt = this.time.now;
    let intro: object[];
    if (!isNarrator) {
      intro = [{ alpha: 1, scale: s, duration: 160, ease: 'Back.easeOut' }];
    } else if (b.popup === 'simple') {
      // Soft: a calm fade in.
      toast.setScale(s * 0.92);
      intro = [{ alpha: 1, scale: s, duration: 200, ease: 'Sine.easeOut' }];
    } else if (b.popup === 'wild') {
      // Savage: bigger bounce with a wiggle and a couple of sparkles.
      toast.setScale(s * 0.4);
      intro = [
        { alpha: 1, scale: s * 1.14, angle: -4, duration: 170, ease: 'Back.easeOut' },
        { scale: s, angle: 3, duration: 90, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 80, ease: 'Sine.easeOut' },
      ];
      this.sparkle(toast, w, h);
    } else {
      // Chaos: pop and a light bounce.
      intro = [
        { alpha: 1, scale: s * 1.06, duration: 150, ease: 'Back.easeOut' },
        { scale: s, duration: 120, ease: 'Sine.easeInOut' },
      ];
    }
    this.tweens.chain({
      targets: toast,
      tweens: [
        ...intro,
        { alpha: 0, y: pos.y - 10, duration: 240, delay: b.holdMs, ease: 'Quad.easeIn' },
      ],
      onComplete: () => {
        if (this.toast === toast) this.toast = null;
        toast.destroy();
      },
    });
    return true;
  }

  /** Two tiny stars that pop out of the bubble corners (Savage popup). They live inside the bubble. */
  private sparkle(toast: Phaser.GameObjects.Container, w: number, h: number): void {
    for (const side of [-1, 1]) {
      const star = this.add.image((side * w) / 2, -h / 2, 'star').setDisplaySize(16, 16).setAlpha(0);
      toast.add(star);
      this.tweens.add({
        targets: star,
        x: (side * w) / 2 + side * 14,
        y: -h / 2 - 12,
        alpha: { from: 1, to: 0 },
        angle: side * 180,
        duration: 520,
        delay: 80,
        ease: 'Quad.easeOut',
      });
    }
  }

  /**
   * Normally top center under the HUD. While a menu panel is open (e.g. Level Clear), the bubble
   * moves to the free space left of the panel so it never covers the title or buttons.
   */
  private bubblePos(): { x: number; y: number } {
    const { width: w, height: h } = this.scale;
    const side = this.sideRoom();
    if (side !== null && this.toastW <= side) {
      const left = getSafeArea().left + 12;
      return { x: left + (this.toastW * this.u) / 2, y: h * 0.42 };
    }
    return { x: w / 2, y: this.toastY };
  }

  /** Free width (in bubble units) left of an open menu panel, or null when no panel is open. */
  private sideRoom(): number | null {
    if (!this.overlay) return null;
    const panelLeft = this.scale.width / 2 - 200 * this.overlay.scaleX;
    const room = (panelLeft - getSafeArea().left - 24) / this.u;
    return room >= 150 ? room : null;
  }

  private clearToast(): void {
    if (!this.toast) return;
    this.tweens.killTweensOf(this.toast);
    this.toast.list.forEach((c) => this.tweens.killTweensOf(c));
    this.toast.destroy();
    this.toast = null;
  }

  /** What the dev-only debug tools may use. */
  private debugHost(): DebugHost {
    return {
      scene: this,
      game: this.game_,
      deathPill: this.deathPill,
      deathPillWidth: 90,
      deathPillHeight: PILL_H,
      isMenuOpen: () => !!this.overlay,
      notify: (message) => this.showDeathReaction({ message }),
      metrics: () => {
        const inset = getSafeArea();
        return { u: this.u, left: inset.left + 10 * this.u, top: inset.top + 10 * this.u, button: HUD_BUTTON * this.u };
      },
    };
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
    const overlay = new Overlay(this, {
      title: 'Paused',
      buttons: [
        { label: 'Resume', fill: 0x8fcbff, onClick: () => this.resume() },
        { label: 'Restart', fill: PALETTE.pink, onClick: () => this.game_.restartLevel() },
        { label: 'Settings', fill: PALETTE.lavender, onClick: () => this.showSettings() },
        { label: 'Main Menu', fill: 0xf7b878, onClick: () => this.game_.quitTo('Menu') },
      ],
    });
    this.overlay = overlay;
  }

  /** Settings from the pause menu; Close goes back to the pause menu (the game stays paused). */
  private showSettings(): void {
    this.closeOverlay();
    this.overlay = openSettingsOverlay(this, () => this.showPause(), () => this.soundIcon.setTexture(this.soundKey()));
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
    // A narrator line said at the same moment is re-laid out beside the panel.
    if (this.toast && this.toastReq) {
      const req = this.toastReq;
      this.clearToast();
      this.showBubble(req);
    }
  }
}
