import Phaser from 'phaser';
import { MIN_VIEW_WIDTH, TIMING, VIEW_HEIGHT } from '../config';
import { Player } from '../entities/Player';
import { getLevel, hasLevel } from '../levels';
import { buildLevel, type BuiltLevel } from '../levels/LevelBuilder';
import type { LevelData } from '../levels/types';
import { AudioManager } from '../managers/AudioManager';
import { DeathReactionManager, type DeathCause, type DeathReaction } from '../managers/DeathReactionManager';
import { EventBus, GameEvents, type DeathReactionPayload, type LevelCompletePayload } from '../managers/EventBus';
import { FxManager } from '../managers/FxManager';
import { InputManager, type ControlFrame } from '../managers/InputManager';
import { SaveManager } from '../managers/SaveManager';
import { TutorialManager } from '../managers/TutorialManager';
import { TRAP_DATA_KEY, type Trap, type TrapContext } from '../traps/types';
import { isPortraitTouch } from '../ui/safeArea';
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
  private tutorial!: TutorialManager;
  controls!: InputManager;
  private deaths = 0;
  private respawnPoint = { x: 0, y: 0 };
  private state: PlayState = 'playing';
  private lookAhead = 0;
  private trapCtx!: TrapContext;
  /** Remaining time of swapped left/right controls (Reverse Controls trap). */
  private reversedMs = 0;
  private dizzyIcon!: Phaser.GameObjects.Image;
  private reactions = new DeathReactionManager();
  private pendingReaction: DeathReaction | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.levelId = data.levelId ?? 1;
    this.deaths = 0;
    this.state = 'playing';
    this.lookAhead = 0;
    this.reversedMs = 0;
    this.reactions = new DeathReactionManager();
    this.pendingReaction = null;
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
    this.tutorial = new TutorialManager(this.world.hints, this.player);
    this.physics.add.collider(this.player.hitbox, this.world.solids, this.onSolidContact, undefined, this);
    const trapBodies = this.world.traps.flatMap((t) => t.bodies ?? []);
    if (trapBodies.length) {
      this.physics.add.collider(this.player.hitbox, trapBodies, this.onSolidContact, undefined, this);
    }
    this.trapCtx = {
      scene: this,
      fx: this.fx,
      player: this.player,
      portal: this.world.portal,
      kill: (cause) => this.killPlayer(cause ?? 'trap'),
      reverseControls: (ms) => this.reverseControls(ms),
    };
    this.dizzyIcon = this.add.image(0, 0, 'swirl').setDepth(22).setScale(0.6).setVisible(false);

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

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur, this);
      this.controls.destroy();
      bg.setScrollSource(null);
    });
  }

  /**
   * Keeps roughly VIEW_HEIGHT world px visible vertically, so in landscape the ground and
   * traps fill the screen.
   */
  private applyZoom(): void {
    const { width, height } = this.scale;
    const zoom = Math.min(height / VIEW_HEIGHT, width / MIN_VIEW_WIDTH);
    this.cameras.main.setZoom(zoom);
  }

  /** Rotating a phone to portrait pauses the game; an overlay asks the player to rotate back. */
  private onResize(): void {
    this.applyZoom();
    const { width, height } = this.scale;
    if (isPortraitTouch(width, height, this.sys.game.device.input.touch) && this.state === 'playing') {
      this.pauseGame();
    }
  }

  private onBlur(): void {
    this.controls.reset();
    if (this.state !== 'complete') this.pauseGame();
  }

  /** Solid bodies that belong to a trap (fake floor, invisible wall, falling plank) report contact. */
  private onSolidContact(_player: unknown, other: unknown): void {
    const trap = (other as Phaser.GameObjects.GameObject).getData?.(TRAP_DATA_KEY) as Trap | undefined;
    trap?.onContact?.(this.trapCtx);
  }

  private reverseControls(ms: number): void {
    this.reversedMs = ms;
    this.dizzyIcon.setVisible(true).setAlpha(1);
  }

  private updateDizzy(dt: number): void {
    if (this.reversedMs <= 0) return;
    this.reversedMs -= dt;
    const b = this.player.bounds;
    this.dizzyIcon.setPosition(b.centerX, b.top - 22).setAngle(this.dizzyIcon.angle + dt * 0.4);
    // Blink during the last second so the player sees it is about to end.
    this.dizzyIcon.setAlpha(this.reversedMs < 1000 ? 0.4 + 0.6 * Math.abs(Math.sin(this.reversedMs / 90)) : 1);
    if (this.reversedMs <= 0) this.clearDizzy();
  }

  private clearDizzy(): void {
    this.reversedMs = 0;
    this.dizzyIcon.setVisible(false);
  }

  get controlsReversed(): boolean {
    return this.reversedMs > 0;
  }

  update(_time: number, delta: number): void {
    if (this.state !== 'playing') return;
    // Clamp delta so a long frame (tab switch) cannot tunnel the player through floors.
    const dt = Math.min(delta, 50);
    const input = this.controls.read();
    if (this.reversedMs > 0) input.moveX = (input.moveX === 0 ? 0 : -input.moveX) as ControlFrame['moveX'];
    this.player.update(dt, input);
    this.updateDizzy(dt);

    this.tutorial.update();
    const box = this.player.bounds;
    for (const spike of this.world.spikes) {
      if (spike.hits(box)) {
        this.killPlayer('spike');
        return;
      }
    }
    for (const trap of this.world.traps) {
      trap.update?.(box, this.trapCtx);
      if (this.state !== 'playing') return;
    }

    if (box.top > this.world.heightPx + 40) {
      this.killPlayer('fall');
      return;
    }

    for (const cp of this.world.checkpoints) {
      if (!cp.isActive && Phaser.Geom.Intersects.RectangleToRectangle(box, cp.area)) {
        cp.activate();
        this.respawnPoint = { x: cp.x, y: cp.bottomY };
        AudioManager.play('checkpoint');
        this.tutorial.onCheckpoint();
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

  private killPlayer(cause: DeathCause): void {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.deaths += 1;
    SaveManager.addDeath();
    EventBus.emit(GameEvents.DeathsChanged, this.deaths);

    // Death reaction: face, message and milestones. Never delays the respawn below.
    const reaction = this.reactions.react(SaveManager.totalDeaths, cause);
    this.pendingReaction = reaction;
    const payload: DeathReactionPayload = { message: reaction.message, title: reaction.milestone?.title };
    EventBus.emit(GameEvents.DeathReaction, payload);

    AudioManager.play('death');
    this.clearDizzy();
    this.fx.shake(220, 0.008);
    const b = this.player.bounds;
    this.player.die(reaction.deathFace);
    if (reaction.milestone) {
      AudioManager.play('hehe');
      if (reaction.milestone.confetti) this.fx.confetti(b.centerX, b.top);
    }
    this.time.delayedCall(TIMING.respawnDelayMs, () => this.respawn());
  }

  /** Milestone faces play right after the respawn pop, so the player sees MOCHI react. */
  private playMilestoneMood(): void {
    const m = this.pendingReaction?.milestone;
    this.pendingReaction = null;
    if (!m) return;
    this.player.showMood(m.mood, m.moodMs);
    const b = this.player.bounds;
    if (m.mood === 'cry') this.fx.tears(b.centerX, b.top + 14);
    else if (m.mood === 'angry') this.fx.puff(b.centerX + 14, b.top - 4);
    else if (m.mood === 'dizzy') this.fx.sparkle(b.centerX, b.top - 6, 8);
    else if (m.confetti) this.fx.confetti(b.centerX, b.top - 10, 30);
  }

  /** Dev/test helper: set the total death count so the next death hits a milestone. */
  debugSetTotalDeaths(n: number): void {
    SaveManager.setTotalDeaths(n);
  }

  private respawn(): void {
    this.world.traps.forEach((t) => t.onRespawn?.());
    this.player.respawn(this.respawnPoint.x, this.respawnPoint.y);
    this.playMilestoneMood();
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
