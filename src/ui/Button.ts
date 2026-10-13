import Phaser from 'phaser';
import { PALETTE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { darken, hex, textStyle } from './text';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fill?: number;
  fontSize?: number;
}

/** Chunky rounded pastel button with press feedback. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOptions = {}) {
    super(scene, x, y);
    const w = opts.width ?? 230;
    const h = opts.height ?? 58;
    const fill = opts.fill ?? PALETTE.pink;
    const shade = darken(fill, 22);
    const r = h / 2.4;

    this.bg = scene.add.graphics();
    this.bg.fillStyle(shade, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bg.fillStyle(0xffffff, 0.35);
    this.bg.fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.26, h * 0.13);
    this.bg.lineStyle(3, shade, 1);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    this.label = scene.add
      .text(0, 0, text, textStyle(opts.fontSize ?? 26, '#ffffff', { stroke: hex(darken(fill, 35)), strokeThickness: 5 }))
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerover', () => this.setScale(1.05));
    this.on('pointerout', () => {
      this.pressed = false;
      this.setScale(1);
    });
    this.on('pointerdown', () => {
      this.pressed = true;
      this.setScale(0.94);
    });
    this.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setScale(1);
      AudioManager.play('click');
      onClick();
    });
    scene.add.existing(this);
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }
}

/** Round icon button for the HUD. */
export class IconButton extends Phaser.GameObjects.Container {
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, icon: string, onClick: () => void, size = 52, fill: number = PALETTE.pink) {
    super(scene, x, y);
    const shade = darken(fill, 22);
    const g = scene.add.graphics();
    g.fillStyle(shade, 1);
    g.fillCircle(0, 3, size / 2);
    g.fillStyle(fill, 1);
    g.fillCircle(0, 0, size / 2);
    g.fillStyle(0xffffff, 0.3);
    g.fillEllipse(-size * 0.12, -size * 0.22, size * 0.5, size * 0.2);
    g.lineStyle(3, shade, 1);
    g.strokeCircle(0, 0, size / 2);
    const img = scene.add.image(0, 0, icon).setDisplaySize(size * 0.6, size * 0.6);
    this.add([g, img]);
    this.setSize(size, size);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      this.pressed = true;
      this.setScale(0.9);
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.setScale(1);
    });
    this.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setScale(1);
      AudioManager.play('click');
      onClick();
    });
    scene.add.existing(this);
  }
}
