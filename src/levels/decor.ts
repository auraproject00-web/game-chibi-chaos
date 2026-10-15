import Phaser from 'phaser';
import { TILE } from '../config';
import { sweetPropKey } from '../art/sweetTextures';
import { textStyle } from '../ui/text';
import type { DecorDef } from './types';

/**
 * Builds level scenery: Level 03's lying signs and truth tells (mint sprouts on real ground, tiny
 * holes over sleeping spikes) and Level 01's Candy Meadow props. Static images with no collision.
 */
export function buildDecor(scene: Phaser.Scene, defs: DecorDef[]): void {
  for (const d of defs) {
    const groundY = d.y * TILE;
    if (d.kind === 'prop') {
      // Behind the platforms (depth 10): the base tucks under the frosting, hazards stay on top.
      scene.add
        .image(d.x * TILE, groundY + 6, sweetPropKey(d.prop))
        .setOrigin(0.5, 1)
        .setScale(d.scale ?? 1)
        .setFlipX(!!d.flip)
        .setDepth(9);
      continue;
    }
    if (d.kind === 'floater') {
      // Far behind the action (below the ambient sparkles), with a gentle deterministic bob.
      const img = scene.add.image(d.x * TILE, groundY, sweetPropKey(d.prop)).setScale(d.scale ?? 1).setDepth(3).setAlpha(0.95);
      scene.tweens.add({ targets: img, y: groundY - 7, angle: { from: -6, to: 6 }, duration: 1700 + ((d.x * 97) % 900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      continue;
    }
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
