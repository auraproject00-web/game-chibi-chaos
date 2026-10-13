import Phaser from 'phaser';
import { TONES } from '../config';
import { DeathReactionManager } from '../managers/DeathReactionManager';
import { SaveManager } from '../managers/SaveManager';
import type { GameScene } from '../scenes/GameScene';
import { DebugPanel } from './DebugPanel';
import { textStyle } from './text';

/** What the HUD lends to the debug tools. */
export interface DebugHost {
  scene: Phaser.Scene;
  game: GameScene;
  deathPill: Phaser.GameObjects.Container;
  deathPillWidth: number;
  deathPillHeight: number;
  isMenuOpen(): boolean;
  notify(message: string): void;
  metrics(): { u: number; left: number; top: number; button: number };
}

/**
 * Development-only tools, imported dynamically by the HUD under `import.meta.env.DEV`, so none of
 * this ships in a production build:
 * - long-press the death counter: total deaths jump to one below the next milestone;
 * - "DBG" chip under the pause button: narrator debug panel.
 */
export function installDebugTools(host: DebugHost): void {
  const { scene } = host;
  const jumpToMilestone = (): void => {
    const next = DeathReactionManager.nextMilestone(SaveManager.totalDeaths);
    host.game.debugSetTotalDeaths(next - 1);
    host.notify(`Tes: total mati = ${next - 1}. Mati 1x lagi!`);
  };

  // Long-press on the death counter.
  const pill = host.deathPill;
  pill.setSize(host.deathPillWidth, host.deathPillHeight);
  pill.setInteractive(
    new Phaser.Geom.Rectangle(0, -host.deathPillHeight / 2, host.deathPillWidth, host.deathPillHeight),
    Phaser.Geom.Rectangle.Contains,
  );
  let timer: Phaser.Time.TimerEvent | null = null;
  const cancel = (): void => {
    timer?.remove(false);
    timer = null;
  };
  pill.on('pointerdown', () => {
    cancel();
    timer = scene.time.delayedCall(600, jumpToMilestone);
  });
  pill.on('pointerup', cancel);
  pill.on('pointerout', cancel);

  // "DBG" chip and panel.
  const g = scene.add.graphics();
  g.fillStyle(TONES.ink, 0.5);
  g.fillRoundedRect(-20, -11, 40, 22, 11);
  const t = scene.add.text(0, 0, 'DBG', textStyle(12, '#ffffff')).setOrigin(0.5);
  const btn = scene.add.container(0, 0, [g, t]).setSize(40, 22).setInteractive({ useHandCursor: true });
  let panel: DebugPanel | null = null;

  const layout = (): void => {
    const m = host.metrics();
    btn.setScale(m.u).setPosition(m.left + m.button / 2, m.top + m.button + 26 * m.u);
    panel?.setScale(Math.min(m.u, (scene.scale.height - 20) / 300)).setPosition(scene.scale.width / 2, scene.scale.height / 2);
  };

  const close = (): void => {
    panel?.destroy();
    panel = null;
    host.game.controls.reset();
    scene.scene.resume('Game');
  };

  btn.on('pointerup', () => {
    if (panel || host.isMenuOpen()) return;
    host.game.controls.reset();
    scene.scene.pause('Game');
    const p = host.game.personality;
    panel = new DebugPanel(
      scene,
      {
        say: (kind) => p.debugSay(kind),
        resetCooldown: () => p.debugResetCooldown(),
        nextMilestone: jumpToMilestone,
        stats: () => {
          const s = p.stats;
          const trap = Object.entries(s.byTrap).map(([k, v]) => `${k}:${v}`).join(' ') || '-';
          return `mati/jebakan: ${trap}  ·  cooldown ${Math.ceil(s.cooldownLeftMs / 1000)}s`;
        },
      },
      close,
    );
    layout();
  });

  scene.scale.on(Phaser.Scale.Events.RESIZE, layout);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, layout));
  layout();

  // Tests reach the panel through these.
  (scene as unknown as { debugBtn: Phaser.GameObjects.Container }).debugBtn = btn;
  Object.defineProperty(scene, 'debugPanel', { get: () => panel, configurable: true });
}
