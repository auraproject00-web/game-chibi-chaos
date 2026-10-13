import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { textStyle } from './text';

let bubbleCount = 0;

/**
 * Small tutorial speech bubble placed in the world. Starts hidden; the tutorial manager
 * fades it in and out. The bubble shape is baked into a texture to keep rendering cheap.
 */
export class HintBubble extends Phaser.GameObjects.Container {
  private shown = false;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
    super(scene, x, y);
    this.baseY = y;
    const label = scene.add
      .text(0, 0, text, textStyle(13, TONES.inkCss, { align: 'center', wordWrap: { width: 190 } }))
      .setOrigin(0.5);
    const w = Math.ceil(label.width + 20);
    const h = Math.ceil(label.height + 12);
    const pad = 3;
    const key = `hint_bubble_${bubbleCount++}`;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(pad, pad);
    g.fillStyle(0xffffff, 0.94);
    g.fillRoundedRect(0, 0, w, h, 10);
    g.fillTriangle(w / 2 - 6, h - 1, w / 2 + 6, h - 1, w / 2, h + 7);
    g.lineStyle(2, PALETTE.lavender, 1);
    g.strokeRoundedRect(0, 0, w, h, 10);
    g.generateTexture(key, w + pad * 2, h + 9 + pad * 2);
    g.destroy();
    const bg = scene.add.image(-w / 2 - pad, -h / 2 - pad, key).setOrigin(0);
    this.add([bg, label]);
    this.setDepth(15).setAlpha(0).setVisible(false);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.textures.remove(key));
  }

  get isShown(): boolean {
    return this.shown;
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.scene.tweens.killTweensOf(this);
    this.setVisible(true).setScale(0.7).setY(this.baseY + 8);
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, y: this.baseY, duration: 220, ease: 'Back.easeOut' });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.85,
      y: this.baseY - 6,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
  }
}
