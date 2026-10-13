import Phaser from 'phaser';
import { PALETTE, TONES } from '../config';
import { TUNING, type CommentKind } from '../managers/TrollPersonalityManager';
import { Button } from './Button';
import { textStyle } from './text';

export interface DebugActions {
  say(kind: CommentKind): void;
  resetCooldown(): void;
  nextMilestone(): void;
  stats(): string;
}

const CHIPS: { label: string; kind: CommentKind }[] = [
  { label: 'Dekat finish', kind: 'nearFinish' },
  { label: 'Jebakan sama 3x', kind: 'repeatTrap' },
  { label: 'Area sama 5x', kind: 'sameArea' },
  { label: 'Mati < 3 detik', kind: 'quickDeath' },
  { label: 'Fake platform', kind: 'trapType' },
  { label: 'Lolos jebakan', kind: 'passedTrap' },
  { label: 'Diam 15 detik', kind: 'idle' },
  { label: 'Finish > 20 mati', kind: 'finishAfterManyDeaths' },
];

/**
 * Development-only panel (never created in production builds) to preview every narrator line
 * and tweak the timers so the real conditions are quick to reproduce.
 */
export class DebugPanel extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, actions: DebugActions, onClose: () => void) {
    super(scene, 0, 0);
    const W = 360;
    const H = 300;
    const bg = scene.add.graphics();
    bg.fillStyle(TONES.ink, 0.35);
    bg.fillRect(-2000, -2000, 4000, 4000);
    bg.fillStyle(PALETTE.cream, 0.98);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 20);
    bg.lineStyle(3, PALETTE.lavender, 1);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 20);
    const blocker = scene.add.zone(0, 0, 4000, 4000).setInteractive();
    const title = scene.add.text(0, -H / 2 + 18, 'Debug Narator (dev)', textStyle(16, TONES.inkCss)).setOrigin(0.5);
    const info = scene.add.text(0, -H / 2 + 38, actions.stats(), textStyle(11, '#7a6a80')).setOrigin(0.5);
    this.add([blocker, bg, title, info]);

    const run = (fn: () => void): void => {
      onClose();
      fn();
    };
    CHIPS.forEach((c, i) => {
      const x = i % 2 === 0 ? -86 : 86;
      const y = -H / 2 + 70 + Math.floor(i / 2) * 36;
      this.add(new Button(scene, x, y, c.label, () => run(() => actions.say(c.kind)), { width: 164, height: 30, fontSize: 14, fill: PALETTE.lavender }));
    });
    const row = -H / 2 + 70 + 4 * 36 + 6;
    const idleFast = TUNING.idleMs < 15000;
    this.add([
      new Button(scene, -86, row, 'Reset cooldown', () => run(actions.resetCooldown), { width: 164, height: 30, fontSize: 14, fill: 0x8fcbff }),
      new Button(scene, 86, row, idleFast ? 'Idle: 3 dtk' : 'Idle: 15 dtk', () => run(() => (TUNING.idleMs = idleFast ? 15000 : 3000)), {
        width: 164,
        height: 30,
        fontSize: 14,
        fill: 0x8fcbff,
      }),
      new Button(scene, -86, row + 36, 'Milestone +1', () => run(actions.nextMilestone), { width: 164, height: 30, fontSize: 14, fill: PALETTE.pink }),
      new Button(scene, 86, row + 36, 'Tutup', onClose, { width: 164, height: 30, fontSize: 14, fill: PALETTE.peach }),
    ]);
    scene.add.existing(this);
    this.setDepth(1200);
  }
}
