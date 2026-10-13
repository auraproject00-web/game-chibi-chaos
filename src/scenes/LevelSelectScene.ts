import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { PLANNED_LEVELS, getLevel, hasLevel } from '../levels';
import { AudioManager } from '../managers/AudioManager';
import { SaveManager } from '../managers/SaveManager';
import type { BackgroundScene } from './BackgroundScene';
import { Button } from '../ui/Button';
import { darken, hex, textStyle } from '../ui/text';

const TILE_COLORS = [PALETTE.mint, PALETTE.pink, 0x8fcbff, PALETTE.lavender, PALETTE.peach];

export class LevelSelectScene extends Phaser.Scene {
  private resizeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('LevelSelect');
  }

  create(): void {
    (this.scene.get('Background') as BackgroundScene).setScrollSource(null);
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const cols = portrait ? 3 : 5;
    const rows = Math.ceil(PLANNED_LEVELS / cols);
    const s = Phaser.Math.Clamp(Math.min(w / (cols * 130 + 60), (h - 200) / (rows * 130)), 0.45, 1.4);

    // Panel.
    const tile = 96 * s;
    const gap = 22 * s;
    const gridW = cols * tile + (cols - 1) * gap;
    const gridH = rows * (tile + 26 * s) + (rows - 1) * gap;
    const panelW = gridW + 60 * s;
    const panelH = gridH + 120 * s;
    const cy = h / 2 - 20 * s;
    const g = this.add.graphics();
    g.fillStyle(TONES.creamDark, 1);
    g.fillRoundedRect(w / 2 - panelW / 2, cy - panelH / 2 + 8 * s, panelW, panelH, 30 * s);
    g.fillStyle(PALETTE.cream, 0.97);
    g.fillRoundedRect(w / 2 - panelW / 2, cy - panelH / 2, panelW, panelH, 30 * s);
    g.lineStyle(4, PALETTE.lavender, 1);
    g.strokeRoundedRect(w / 2 - panelW / 2, cy - panelH / 2, panelW, panelH, 30 * s);

    this.add
      .text(w / 2, cy - panelH / 2 + 40 * s, 'Level Select', textStyle(38 * s, '#ffffff', { stroke: '#8f72d4', strokeThickness: 8 * s }))
      .setOrigin(0.5);

    const gx = w / 2 - gridW / 2 + tile / 2;
    const gy = cy - panelH / 2 + 90 * s + tile / 2;
    for (let i = 0; i < PLANNED_LEVELS; i++) {
      const id = i + 1;
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.makeTile(gx + col * (tile + gap), gy + row * (tile + 26 * s + gap), tile, id, s);
    }

    new Button(this, w / 2, Math.min(h - 40 * s, cy + panelH / 2 + 50 * s), 'Back', () => this.go('Menu'), {
      width: 180 * s,
      height: 54 * s,
      fontSize: 24 * s,
      fill: 0x8fcbff,
    });

    this.cameras.main.fadeIn(200, 255, 243, 214);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
  }

  private makeTile(x: number, y: number, size: number, id: number, s: number): void {
    const playable = hasLevel(id) && SaveManager.isUnlocked(id);
    const progress = SaveManager.getLevel(id);
    const fill = playable ? TILE_COLORS[(id - 1) % TILE_COLORS.length] : 0xe5dcf3;
    const shade = darken(fill, 20);
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(shade, 1);
    g.fillRoundedRect(-size / 2, -size / 2 + 6 * s, size, size, 20 * s);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-size / 2, -size / 2, size, size, 20 * s);
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(-size / 2 + 8 * s, -size / 2 + 7 * s, size - 16 * s, size * 0.2, 8 * s);
    g.lineStyle(3, shade, 1);
    g.strokeRoundedRect(-size / 2, -size / 2, size, size, 20 * s);
    c.add(g);

    if (playable) {
      c.add(
        this.add
          .text(0, -2 * s, String(id), textStyle(44 * s, '#ffffff', { stroke: hex(darken(fill, 35)), strokeThickness: 7 * s }))
          .setOrigin(0.5),
      );
      if (progress.completed) {
        c.add(this.add.image(size / 2 - 8 * s, -size / 2 + 8 * s, 'star').setScale(0.8 * s));
      }
      c.setSize(size, size).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => c.setScale(0.93));
      c.on('pointerout', () => c.setScale(1));
      c.on('pointerup', () => {
        c.setScale(1);
        AudioManager.play('click');
        this.go('Game', { levelId: id });
      });
    } else {
      c.add(this.add.image(0, 0, 'lock').setScale(1.3 * s).setTint(0xb3a3d0));
    }

    const name = getLevel(id)?.name;
    const caption = progress.completed && progress.bestDeaths !== null ? `Best: ${progress.bestDeaths} deaths` : playable ? name ?? '' : hasLevel(id) ? 'Locked' : 'Coming soon';
    this.add.text(x, y + size / 2 + 20 * s, caption, textStyle(14 * s, TONES.inkCss)).setOrigin(0.5).setAlpha(0.8);
  }

  private go(key: string, data?: object): void {
    this.cameras.main.fadeOut(180, 255, 243, 214);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private onResize(): void {
    this.resizeTimer?.remove(false);
    this.resizeTimer = this.time.delayedCall(150, () => this.scene.restart());
  }
}
