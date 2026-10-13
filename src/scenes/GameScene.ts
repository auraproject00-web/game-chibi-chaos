import Phaser from 'phaser';
import { MIN_VIEW_WIDTH, TIMING, VIEW_HEIGHT } from '../config';
import { Player } from '../entities/Player';
import { getLevel, hasLevel } from '../levels';
import { buildLevel, type BuiltLevel } from '../levels/LevelBuilder';
import type { LevelData } from '../levels/types';
import { AudioManager } from '../managers/AudioManager';
import { EventBus, GameEvents, type LevelCompletePayload } from '../managers/EventBus';
import { FxManager } from '../managers/FxManager';
import { InputManager } from '../managers/InputManager';
import { SaveManager } from '../managers/SaveManager';
import type { FakePlatform } from '../traps/FakePlatform';
import type { BackgroundScene } from './BackgroundScene';

type PlayState = 'playing' | 'dead' | 'complete';

export interface GameSceneData {
  levelId?: number;
}

/** Runs one level: builds it from data, steps the player, resolves traps, deaths and completion. */
export class GameScene extends Phaser.Scene {
  private levelId = 1;
  private level!: LevelData;
  private world!: BuiltLevel;
  private player!: Player;
  private fx!: FxManager;
  controls!: InputManager;
  private deaths = 0;
  private respawnPoint = { x: 0, y: 0 };
  private state: PlayState = 'playing';
  private lookAhead = 0;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.levelId = data.levelId ?? 1;
    this.deaths = 0;
    this.state = 'playing';
    this.lookAhead = 0;
  }

  get levelInfo(): { id: number; name: string } {
    return { id: this.level.id, name: this.level.name };
  }

  get deathCount(): number {
    return this.deaths;
  }

  create(): void {
    const level = getLevel(this.levelId);
    if (!level) {
      this.scene.start('LevelSelect');
      return;
    }
    this.level = level;

    const touch = this.sys.game.device.input.touch;
    this.fx = new FxManager(this);
    this.world = buildLevel(this, level, touch);
    this.respawnPoint = { ...this.world.spawn };

    this.physics.world.setBounds(0, 0, this.world.widthPx, this.world.heightPx + 400, true, true, false, false);
    this.player = new Player(this, this.respawnPoint.x, this.respawnPoint.y, this.fx);
    this.physics.add.collider(this.player.hitbox, this.world.solids, this.onSolidContact, undefined, this);

    // Camera follows smoothly with a small look-ahead in the facing direction.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.widthPx, this.world.heightPx);
    cam.startFollow(this.player.hitbox, false, 0.12, 0.12);
    cam.setDeadzone(30, 70);
    this.applyZoom();
    cam.fadeIn(250, 255, 243, 214);

    this.controls = new InputManager(this);

    const bg = this.scene.get('Background') as BackgroundScene;
    bg.setScrollSource(() => cam.worldView.x);

    // HUD on top. It reads the touch controls too.
    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.scene.launch('UI');

    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur, this);
      this.controls.destroy();
      bg.setScrollSource(null);
    });
  }

  /** Keeps roughly VIEW_HEIGHT world px visible vertically on any screen. */
  private applyZoom(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(height / VIEW_HEIGHT, width / MIN_VIEW_WIDTH);
    this.cameras.main.setZoom(zoom);
  }

  private onBlur(): void {
    this.controls.reset();
    if (this.state !== 'complete') this.pauseGame();
  }

  private onSolidContact(_player: unknown, other: unknown): void {
    const fake = (other as Phaser.GameObjects.Zone).getData?.('fake') as FakePlatform | undefined;
    if (fake && this.player.body.touching.down) fake.trigger();
  }

  update(_time: number, delta: number): void {
    if (this.state !== 'playing') return;
    // Clamp delta so a long frame (tab switch) cannot tunnel the player through floors.
    const dt = Math.min(delta, 50);
    this.player.update(dt, this.controls.read());

    const box = this.player.bounds;
    for (const spike of this.world.spikes) {
      if (spike.update(box)) this.fx.shake(120, 0.004);
      if (spike.hits(box)) {
        this.killPlayer();
        return;
      }
    }

    if (box.top > this.world.heightPx + 40) {
      this.killPlayer();
      return;
    }

    for (const cp of this.world.checkpoints) {
      if (!cp.isActive && Phaser.Geom.Intersects.RectangleToRectangle(box, cp.area)) {
        cp.activate();
        this.respawnPoint = { x: cp.x, y: cp.bottomY };
        AudioManager.play('checkpoint');
        this.fx.sparkle(cp.x + 10, cp.bottomY - 50);
      }
    }

    if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.world.portal.area)) {
      this.completeLevel();
      return;
    }

    // Look-ahead follow offset.
    const target = -this.player.facingDir * 70;
    this.lookAhead += (target - this.lookAhead) * Math.min(1, dt / 400);
    this.cameras.main.setFollowOffset(this.lookAhead, 20);
  }

  private killPlayer(): void {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.deaths += 1;
    SaveManager.addDeath();
    EventBus.emit(GameEvents.DeathsChanged, this.deaths);
    AudioManager.play('death');
    this.fx.shake(220, 0.008);
    this.player.die();
    this.time.delayedCall(TIMING.respawnDelayMs, () => this.respawn());
  }

  private respawn(): void {
    this.world.fakePlatforms.forEach((fp) => fp.reset());
    this.player.respawn(this.respawnPoint.x, this.respawnPoint.y);
    this.lookAhead = 0;
    this.state = 'playing';
  }

  private completeLevel(): void {
    this.state = 'complete';
    this.controls.enabled = false;
    this.player.celebrate();
    this.world.portal.absorb(this);
    AudioManager.play('victory');
    const c = this.world.portal.center;
    this.fx.sparkle(c.x, c.y, 30);
    const best = SaveManager.completeLevel(this.level.id, this.deaths);
    const payload: LevelCompletePayload = {
      levelId: this.level.id,
      deaths: this.deaths,
      bestDeaths: best,
      hasNext: hasLevel(this.level.id + 1),
    };
    this.time.delayedCall(TIMING.completeDelayMs, () => EventBus.emit(GameEvents.LevelComplete, payload));
  }

  // ----- Called by the HUD -----

  pauseGame(): void {
    if (this.state === 'complete' || !this.scene.isActive()) return;
    this.controls.reset();
    this.scene.pause();
    EventBus.emit(GameEvents.Paused);
  }

  resumeGame(): void {
    this.controls.reset();
    this.scene.resume();
    EventBus.emit(GameEvents.Resumed);
  }

  restartLevel(): void {
    this.scene.restart({ levelId: this.levelId } satisfies GameSceneData);
  }

  nextLevel(): void {
    this.scene.restart({ levelId: this.levelId + 1 } satisfies GameSceneData);
  }

  quitTo(sceneKey: 'Menu' | 'LevelSelect'): void {
    this.scene.stop('UI');
    this.scene.start(sceneKey);
  }
}
