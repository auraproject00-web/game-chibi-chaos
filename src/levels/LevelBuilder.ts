import Phaser from 'phaser';
import { TILE } from '../config';
import { PLATFORM_PAD, platformTexture } from '../art/textures';
import { Checkpoint } from '../entities/Checkpoint';
import { FinishPortal } from '../entities/FinishPortal';
import { FakePlatform } from '../traps/FakePlatform';
import { SpikeTrap } from '../traps/SpikeTrap';
import { HintBubble } from '../ui/HintBubble';
import type { PlacedHint } from '../managers/TutorialManager';
import type { LevelData } from './types';

export interface BuiltLevel {
  widthPx: number;
  heightPx: number;
  spawn: { x: number; y: number };
  solids: Phaser.Physics.Arcade.StaticGroup;
  fakePlatforms: FakePlatform[];
  spikes: SpikeTrap[];
  checkpoints: Checkpoint[];
  portal: FinishPortal;
  hints: PlacedHint[];
}

/** Turns level data into game objects. Gameplay systems never read raw level data directly. */
export function buildLevel(scene: Phaser.Scene, data: LevelData, touchHints: boolean): BuiltLevel {
  const solids = scene.physics.add.staticGroup();

  for (const r of data.solids) {
    const x = r.x * TILE;
    const y = r.y * TILE;
    const w = r.w * TILE;
    const h = r.h * TILE;
    scene.add
      .image(x - PLATFORM_PAD.x, y - PLATFORM_PAD.y, platformTexture(scene, w, h))
      .setOrigin(0)
      .setDepth(10);
    const zone = scene.add.zone(x + w / 2, y + h / 2, w, h);
    solids.add(zone);
  }

  const fakePlatforms = (data.fakePlatforms ?? []).map((f) => {
    const fp = new FakePlatform(scene, f.x * TILE, f.y * TILE, f.w * TILE, f.h * TILE, f.delayMs ?? 350);
    solids.add(fp.zone);
    return fp;
  });

  const spikes = (data.spikes ?? []).map(
    (s) =>
      new SpikeTrap(scene, {
        x: s.x * TILE,
        surfaceY: s.y * TILE,
        tiles: s.w,
        hidden: !!s.hidden,
        triggerFrom: (s.trigger?.from ?? s.x - 0.5) * TILE,
        triggerTo: (s.trigger?.to ?? s.x + s.w + 0.5) * TILE,
      }),
  );

  const checkpoints = (data.checkpoints ?? []).map((c) => new Checkpoint(scene, c.x * TILE + TILE / 2, c.y * TILE));

  const portal = new FinishPortal(scene, data.finish.x * TILE + TILE / 2, data.finish.y * TILE);

  const hints: PlacedHint[] = (data.hints ?? []).map((def) => {
    const text = touchHints && def.touchText ? def.touchText : def.text;
    return { def, bubble: new HintBubble(scene, def.x * TILE + TILE / 2, def.y * TILE - 96, text) };
  });

  return {
    widthPx: data.width * TILE,
    heightPx: data.height * TILE,
    spawn: { x: data.spawn.x * TILE + TILE / 2, y: data.spawn.y * TILE },
    solids,
    fakePlatforms,
    spikes,
    checkpoints,
    portal,
    hints,
  };
}
