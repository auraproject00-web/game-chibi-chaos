import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { textStyle } from './text';

let bubbleCount = 0;

/** Floating tutorial speech bubble placed in the world. The bubble shape is baked into a texture. */
export class HintBubble extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
    super(scene, x, y);
    const label = scene.add.text(0, 0, text, textStyle(15, TONES.inkCss, { align: 'center', wordWrap: { width: 230 } })).setOrigin(0.5);
    const w = Math.ceil(label.width + 28);
    const h = Math.ceil(label.height + 18);
    const pad = 3;
    const key = `hint_bubble_${bubbleCount++}`;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(pad, pad);
    g.fillStyle(0xffffff, 0.92);
    g.fillRoundedRect(0, 0, w, h, 14);
    g.fillTriangle(w / 2 - 8, h - 1, w / 2 + 8, h - 1, w / 2, h + 10);
    g.lineStyle(2.5, PALETTE.lavender, 1);
    g.strokeRoundedRect(0, 0, w, h, 14);
    g.generateTexture(key, w + pad * 2, h + 12 + pad * 2);
    g.destroy();
    const bg = scene.add.image(-w / 2 - pad, -h / 2 - pad, key).setOrigin(0);
    this.add([bg, label]);
    this.setDepth(15);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.textures.remove(key));
    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 1400 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
