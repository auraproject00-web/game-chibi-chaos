import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { MOCHI_FOOT_Y, MOCHI_TEX_H, mochiKey } from '../art/mochi';
import { drawPlatform } from '../art/textures';
import { LEVELS } from '../levels';
import { AudioManager } from '../managers/AudioManager';
import { SaveManager } from '../managers/SaveManager';
import type { BackgroundScene } from './BackgroundScene';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { textStyle } from '../ui/text';

const TITLE_COLORS = ['#FF9FB6', '#9FE3AE', '#FFC98A', '#8FCBFF', '#C3A6FF', '#FF9FB6'];

export class MenuScene extends Phaser.Scene {
  private overlay: Overlay | null = null;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    (this.scene.get('Background') as BackgroundScene).setScrollSource(null);
    this.overlay = null;
    const { width: w, height: h } = this.scale;
    const landscape = w >= h * 1.05;
    const s = landscape
      ? Phaser.Math.Clamp(Math.min(w / 960, h / 540), 0.5, 1.6)
      : Phaser.Math.Clamp(Math.min(w / 480, h / 860), 0.5, 1.5);

    // Ground strip for MOCHI to stand on.
    const groundY = h - 70 * s;
    const ground = this.add.graphics({ x: -20, y: groundY });
    drawPlatform(ground, w + 40, 70 * s + 20);

    const titleX = landscape ? w * 0.32 : w / 2;
    const titleY = landscape ? h * 0.26 : h * 0.15;
    this.makeTitle(titleX, titleY, s);

    const tag = this.add
      .text(titleX, titleY + 118 * s, 'Cute Outside, Chaos Inside.', textStyle(22 * s, '#ffffff', { stroke: '#b07a9a', strokeThickness: 5 * s }))
      .setOrigin(0.5);
    this.tweens.add({ targets: tag, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // MOCHI hopping happily on the ground.
    const mochiX = landscape ? w * 0.32 : w * 0.5;
    const mochi = this.add
      .image(mochiX, groundY + 2, mochiKey('idle'))
      .setOrigin(0.5, MOCHI_FOOT_Y / MOCHI_TEX_H)
      .setScale(1.6 * s);
    this.tweens.add({
      targets: mochi,
      y: groundY - 40 * s,
      duration: 380,
      yoyo: true,
      repeat: -1,
      repeatDelay: 700,
      ease: 'Quad.easeOut',
      onYoyo: () => mochi.setTexture(mochiKey('jump')),
      onRepeat: () => mochi.setTexture(mochiKey('idle')),
    });

    // Buttons.
    const bx = landscape ? w * 0.72 : w / 2;
    const gap = 74 * s;
    const startY = landscape ? h * 0.5 - gap * 1.5 - 10 * s : h * 0.52;
    const btnOpts = { width: 250 * s, height: 60 * s, fontSize: 27 * s };
    new Button(this, bx, startY, 'Play', () => this.play(), { ...btnOpts, fill: PALETTE.pink });
    new Button(this, bx, startY + gap, 'Level Select', () => this.go('LevelSelect'), { ...btnOpts, fill: 0x8fcbff });
    new Button(this, bx, startY + gap * 2, 'Settings', () => this.openSettings(), { ...btnOpts, fill: PALETTE.lavender });
    new Button(this, bx, startY + gap * 3, 'Credits', () => this.openCredits(), { ...btnOpts, fill: 0xf7b878 });

    if (SaveManager.totalDeaths > 0) {
      this.add
        .text(w - 14, 12, `Total deaths: ${SaveManager.totalDeaths}`, textStyle(16 * Math.max(s, 0.8), TONES.inkCss))
        .setOrigin(1, 0)
        .setAlpha(0.75);
    }

    this.cameras.main.fadeIn(250, 255, 243, 214);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
  }

  private makeTitle(cx: number, cy: number, s: number): void {
    const lines = ['CHIBI', 'CHAOS!'];
    const size = 84 * s;
    lines.forEach((line, row) => {
      const letters = line.split('').map((ch, i) =>
        this.add
          .text(0, 0, ch, textStyle(size, TITLE_COLORS[(i + row * 2) % TITLE_COLORS.length], {
            stroke: '#7a4a5e',
            strokeThickness: 12 * s,
            shadow: { offsetX: 0, offsetY: 6 * s, color: '#7a4a5e', fill: true, stroke: true, blur: 0 },
          }))
          .setOrigin(0.5),
      );
      const total = letters.reduce((sum, t) => sum + t.width - 10 * s, 0);
      let x = cx - total / 2;
      const y = cy + (row === 0 ? -size * 0.45 : size * 0.5);
      letters.forEach((t, i) => {
        const lw = t.width - 10 * s;
        t.setPosition(x + lw / 2, y);
        t.setAngle((i % 2 === 0 ? -1 : 1) * 4);
        this.tweens.add({
          targets: t,
          y: y - 6 * s,
          duration: 700,
          delay: i * 90 + row * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        x += lw;
      });
    });
  }

  private play(): void {
    const unlocked = LEVELS.filter((l) => SaveManager.isUnlocked(l.id));
    const firstUnfinished = unlocked.find((l) => !SaveManager.getLevel(l.id).completed);
    const target = firstUnfinished ?? unlocked[unlocked.length - 1] ?? LEVELS[0];
    this.go('Game', { levelId: target.id });
  }

  private go(key: string, data?: object): void {
    this.cameras.main.fadeOut(180, 255, 243, 214);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  private openSettings(): void {
    this.closeOverlay();
    const label = (): string => `Sound FX: ${AudioManager.sfxEnabled ? 'ON' : 'OFF'}`;
    const overlay = new Overlay(this, {
      title: 'Settings',
      body: 'Musik latar menyusul setelah evaluasi MVP.',
      buttons: [
        {
          label: label(),
          fill: 0x8fcbff,
          onClick: () => {
            AudioManager.setSfxEnabled(!AudioManager.sfxEnabled);
            overlay.getButton(0)?.setLabel(label());
            AudioManager.play('click');
          },
        },
        { label: 'Close', onClick: () => this.closeOverlay() },
      ],
    });
    this.overlay = overlay;
  }

  private openCredits(): void {
    this.closeOverlay();
    this.overlay = new Overlay(this, {
      title: 'Credits',
      body: 'CHIBI CHAOS\nCute Outside, Chaos Inside.\n\nDibuat dengan Phaser 3, TypeScript & Vite.\nArt sementara digambar prosedural.',
      buttons: [{ label: 'Close', onClick: () => this.closeOverlay() }],
    });
  }

  private onResize(): void {
    this.resizeTimer?.remove(false);
    this.resizeTimer = this.time.delayedCall(150, () => this.scene.restart());
  }
}
