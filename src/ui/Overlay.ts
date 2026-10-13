import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { Button } from './Button';
import { textStyle } from './text';

export interface OverlayButton {
  label: string;
  onClick: () => void;
  fill?: number;
}

export interface OverlayOptions {
  title: string;
  body?: string;
  buttons: OverlayButton[];
}

/**
 * Modal panel (pause, level complete, settings, credits). A dim layer swallows taps so they
 * never reach the game controls underneath.
 */
export class Overlay extends Phaser.GameObjects.Container {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly buttons: Button[] = [];
  private readonly panelH: number;

  constructor(scene: Phaser.Scene, opts: OverlayOptions) {
    super(scene, 0, 0);
    this.dim = scene.add.rectangle(0, 0, 10, 10, 0x3b2a3a, 0.45).setOrigin(0).setInteractive();
    this.panel = scene.add.container(0, 0);

    const panelW = 380;
    const bodyText = opts.body
      ? scene.add.text(0, 0, opts.body, textStyle(20, TONES.inkCss, { align: 'center', wordWrap: { width: panelW - 60 } })).setOrigin(0.5, 0)
      : null;
    const bodyH = bodyText ? bodyText.height + 18 : 0;
    const btnGap = 70;
    const panelH = 96 + bodyH + opts.buttons.length * btnGap;
    this.panelH = panelH;

    const g = scene.add.graphics();
    g.fillStyle(TONES.creamDark, 1);
    g.fillRoundedRect(-panelW / 2, -panelH / 2 + 8, panelW, panelH, 28);
    g.fillStyle(PALETTE.cream, 1);
    g.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
    g.lineStyle(4, PALETTE.lavender, 1);
    g.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
    // Title ribbon.
    g.fillStyle(PALETTE.lavender, 1);
    g.fillRoundedRect(-130, -panelH / 2 - 24, 260, 56, 22);
    g.lineStyle(3, TONES.lavenderDark, 1);
    g.strokeRoundedRect(-130, -panelH / 2 - 24, 260, 56, 22);
    this.panel.add(g);

    const title = scene.add
      .text(0, -panelH / 2 + 4, opts.title, textStyle(30, '#ffffff', { stroke: '#8f72d4', strokeThickness: 6 }))
      .setOrigin(0.5);
    this.panel.add(title);

    let y = -panelH / 2 + 60;
    if (bodyText) {
      bodyText.setY(y);
      this.panel.add(bodyText);
      y += bodyH;
    }
    y += 34;
    for (const b of opts.buttons) {
      const btn = new Button(scene, 0, y, b.label, b.onClick, { fill: b.fill ?? PALETTE.pink, width: 250, height: 54, fontSize: 24 });
      this.buttons.push(btn);
      this.panel.add(btn);
      y += btnGap;
    }

    this.add([this.dim, this.panel]);
    this.setDepth(1000);
    scene.add.existing(this);
    this.layout(scene.scale.width, scene.scale.height);

    const target = this.panel.scale;
    this.panel.setScale(target * 0.8);
    scene.tweens.add({ targets: this.panel, scale: target, duration: 260, ease: 'Back.easeOut' });
  }

  getButton(index: number): Button | undefined {
    return this.buttons[index];
  }

  private fitScale(w: number, h: number): number {
    return Phaser.Math.Clamp(Math.min((w - 32) / 400, (h - 40) / (this.panelH + 40)), 0.45, 1.25);
  }

  layout(w: number, h: number): void {
    this.dim.setSize(w, h);
    this.dim.input?.hitArea.setTo(0, 0, w, h);
    this.panel.setPosition(w / 2, h / 2 + 10);
    this.panel.setScale(this.fitScale(w, h));
  }
}
