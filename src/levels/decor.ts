import Phaser from 'phaser';
import { TILE } from '../config';
import { textStyle } from '../ui/text';
import type { DecorDef } from './types';

/**
 * Builds Level 03's scenery: lying tutorial signs and the truth tells (mint sprouts on real
 * ground, tiny holes over sleeping spikes). Static images with no collision, drawn once.
 */
export function buildDecor(scene: Phaser.Scene, defs: DecorDef[]): void {
  for (const d of defs) {
    const groundY = d.y * TILE;
    if (d.kind === 'sign') {
      const cx = d.x * TILE + TILE / 2;
      scene.add.image(cx, groundY + 2, 'sign_board').setOrigin(0.5, 1).setDepth(9);
      scene.add
        .text(cx, groundY - 55, d.text, textStyle(12, '#6b4a5f', { align: 'center', lineSpacing: -2, wordWrap: { width: 108 } }))
        .setOrigin(0.5)
        .setDepth(9);
    } else if (d.kind === 'sprouts') {
      // Deterministic spacing so every run looks the same.
      for (let i = 0; i < d.w; i++) {
        const x = (d.x + i) * TILE + 6 + ((i * 7) % 13);
        scene.add.image(x, groundY + 3, 'sprout').setOrigin(0.5, 1).setDepth(13).setFlipX(i % 2 === 1);
      }
    } else {
      scene.add
        .tileSprite(d.x * TILE, groundY + 4, d.w * TILE, 6, 'holes')
        .setOrigin(0, 0)
        .setDepth(13);
    }
  }
}
