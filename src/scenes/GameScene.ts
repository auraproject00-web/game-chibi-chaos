import Phaser from 'phaser';
import { MIN_VIEW_WIDTH, TILE, TIMING, VIEW_HEIGHT } from '../config';
import { Player } from '../entities/Player';
import { getLevel, hasLevel } from '../levels';
import { buildLevel, type BuiltLevel } from '../levels/LevelBuilder';
import type { LevelData } from '../levels/types';
import { AudioManager } from '../managers/AudioManager';
import { DeathReactionManager, type DeathCause, type DeathReaction } from '../managers/DeathReactionManager';
import {
  EventBus,
  GameEvents,
  type DeathContext,
  type DeathReactionPayload,
  type LevelCompletePayload,
  type TrapPassedPayload,
  type TrapSprungPayload,
} from '../managers/EventBus';
import { AmbientSparkles } from '../managers/AmbientSparkles';
import { FxManager } from '../managers/FxManager';
import { InputManager, type ControlFrame } from '../managers/InputManager';
import { SaveManager } from '../managers/SaveManager';
import { TrollPersonalityManager } from '../managers/TrollPersonalityManager';
import { TutorialManager } from '../managers/TutorialManager';
import { TRAP_DATA_KEY, type ActionInfo, type Trap, type TrapContext } from '../traps/types';
import { isPortraitTouch } from '../ui/safeArea';
import type { BackgroundScene } from './BackgroundScene';

type PlayState = 'playing' | 'dead' | 'complete';

export interface GameSceneData {
  levelId?: number;
  /** Dev only: start at this checkpoint (1-based), e.g. `?level=2&cp=3`. */
  devCheckpoint?: number;
}

/** Runs one level: builds it from data, steps the player, resolves traps, deaths and completion. */
export class GameScene extends Phaser.Scene {
  private levelId = 1;
  private devCheckpoint = 0;
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
  personality!: TrollPersonalityManager;
  /** Alive time since the last respawn; null during the first life of the level. */
  private aliveMs: number | null = null;
  /** Last trap MOCHI set off (crumbling floor, wobbling plank), to credit a fall that follows. */
  private lastTriggered: { trap: Trap; at: number } | null = null;
  private ambient: AmbientSparkles | null = null;
  /** Game time (sum of clamped frame deltas): consistent with physics even on slow frames. */
  private gameMs = 0;
  /** Traps MOCHI was in front of during this life; passing one emits TrapPassed. */
  private approached = new Set<Trap>();
  /** The level's action button (Level 04), or null when there is none. Read by the HUD. */
  private action: ActionInfo | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.levelId = data.levelId ?? 1;
    this.devCheckpoint = import.meta.env.DEV ? (data.devCheckpoint ?? 0) : 0;
    this.deaths = 0;
    this.state = 'playing';
    this.lookAhead = 0;
    this.reversedMs = 0;
    this.reactions = new DeathReactionManager();
    this.pendingReaction = null;
    this.aliveMs = null;
    this.lastTriggered = null;
    this.gameMs = 0;
    this.approached = new Set();
    this.action = null;
  }

  get levelInfo(): { id: number; name: string } {
    return { id: this.level.id, name: this.level.name };
  }

  get deathCount(): number {
    return this.deaths;
  }

  get actionInfo(): ActionInfo | null {
    return this.action;
  }

  create(): void {
    const level = getLevel(this.levelId);
    if (!level) {
      this.scene.start('LevelSelect');
      return;
    }
    this.level = level;
    AudioManager.playMusic('game');

    const touch = this.sys.game.device.input.touch;
    this.fx = new FxManager(this);
    this.world = buildLevel(this, level, touch);
    this.respawnPoint = { ...this.world.spawn };
    const devCp = this.world.checkpoints[this.devCheckpoint - 1];
    if (devCp) {
      devCp.activate();
      this.respawnPoint = { x: devCp.x, y: devCp.bottomY };
    }

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
      kill: (cause, source) => this.killPlayer(cause ?? 'trap', source),
      triggered: (source) => {
        this.lastTriggered = { trap: source, at: this.gameMs };
      },
      reverseControls: (ms) => this.reverseControls(ms),
      sprung: (source, key) => {
        const payload: TrapSprungPayload = { trapId: source.id, trapType: source.type, key: key ?? source.type };
        EventBus.emit(GameEvents.TrapSprung, payload);
      },
      setAction: (info) => {
        this.action = info;
        EventBus.emit(GameEvents.ActionState, info);
      },
    };
    this.world.traps.forEach((t) => t.init?.(this.trapCtx));
    this.dizzyIcon = this.add.image(0, 0, 'swirl').setDepth(22).setScale(0.6).setVisible(false);

    // Camera follows smoothly with a small look-ahead in the facing direction.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.widthPx, this.world.heightPx);
    cam.startFollow(this.player.hitbox, false, 0.12, 0.12);
    cam.setDeadzone(30, 70);
    this.applyZoom();
    cam.fadeIn(250, 255, 243, 214);

    this.controls = new InputManager(this);
    this.personality = new TrollPersonalityManager(() => this.gameMs, level.trollLines);

    const bg = this.scene.get('Background') as BackgroundScene;
    bg.setScrollSource(() => cam.worldView.x);
    bg.setTheme(level.theme ?? 'meadow');
    if (level.theme === 'candy' || level.theme === 'illusion' || level.theme === 'dimension') this.ambient = new AmbientSparkles(this);

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
      this.personality.destroy();
      this.ambient?.destroy();
      this.ambient = null;
      bg.setScrollSource(null);
      bg.setTheme('meadow');
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
    const noInput = input.moveX === 0 && !input.jumpHeld;
    if (this.reversedMs > 0) input.moveX = (input.moveX === 0 ? 0 : -input.moveX) as ControlFrame['moveX'];
    if (input.actionPressed) this.world.traps.forEach((t) => t.onAction?.(this.trapCtx));
    this.player.update(dt, input);
    this.updateDizzy(dt);

    this.tutorial.update();
    const box = this.player.bounds;
    this.gameMs += dt;
    if (this.aliveMs !== null) this.aliveMs += dt;
    for (const [i, spike] of this.world.spikes.entries()) {
      if (spike.hits(box)) {
        this.killPlayer('spike', undefined, i);
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
    // Upside down (Level 04 gravity), the sky is a pit too.
    if (this.player.gravityDir < 0 && box.bottom < -40) {
      this.killPlayer('fall');
      return;
    }

    for (const cp of this.world.checkpoints) {
      if (!cp.isActive && Phaser.Geom.Intersects.RectangleToRectangle(box, cp.area)) {
        cp.activate();
        this.respawnPoint = { x: cp.x, y: cp.bottomY };
        this.world.traps.forEach((t) => t.onCheckpoint?.());
        AudioManager.play('checkpoint');
        this.tutorial.onCheckpoint();
        this.fx.sparkle(cp.x + 10, cp.bottomY - 50);
      }
    }

    if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.world.portal.area)) {
      this.completeLevel();
      return;
    }

    this.trackTrapsPassed(box);
    this.personality.update(dt, {
      still: noInput && this.player.onGround && Math.abs(this.player.body.velocity.x) < 5,
      safe: this.isSafeSpot(box),
    });

    // Look-ahead follow offset.
    const target = -this.player.facingDir * 70;
    this.lookAhead += (target - this.lookAhead) * Math.min(1, dt / 400);
    this.cameras.main.setFollowOffset(this.lookAhead, 20 * this.player.gravityDir);
  }

  /** Emits TrapPassed once when MOCHI gets past a trap it was in front of during this life. */
  private trackTrapsPassed(box: Phaser.Geom.Rectangle): void {
    for (const trap of this.world.traps) {
      if (!trap.span) continue;
      if (box.centerX < trap.span.left) this.approached.add(trap);
      else if (box.left > trap.span.right + 4 && this.approached.delete(trap)) {
        const payload: TrapPassedPayload = { trapId: trap.id, trapType: trap.type };
        EventBus.emit(GameEvents.TrapPassed, payload);
      }
    }
  }

  /** Not on or right next to a trap or spikes: the only places an idle comment may happen. */
  private isSafeSpot(box: Phaser.Geom.Rectangle): boolean {
    const margin = 1.5 * TILE;
    const near = (l: number, r: number): boolean => box.right > l - margin && box.left < r + margin;
    if (this.world.traps.some((t) => t.span && near(t.span.left, t.span.right))) return false;
    if (this.world.spikes.some((s) => near(s.left, s.right))) return false;
    return this.reversedMs <= 0;
  }

  private killPlayer(cause: DeathCause, source?: Trap, staticSpikeIndex?: number): void {
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

    // Narrator facts: the real cause and trap, never guessed from position when known.
    const b0 = this.player.bounds;
    let trapId: string | null = null;
    let trapType: string | null = null;
    if (source) {
      trapId = source.id;
      trapType = source.type;
    } else if (staticSpikeIndex !== undefined) {
      trapId = `spike-${staticSpikeIndex}`;
      trapType = 'spike';
    } else if (cause === 'fall' && this.lastTriggered && this.gameMs - this.lastTriggered.at < 3000) {
      trapId = this.lastTriggered.trap.id;
      trapType = this.lastTriggered.trap.type;
    }
    const ctx: DeathContext = {
      cause,
      trapId,
      trapType,
      x: b0.centerX,
      y: b0.bottom,
      sinceRespawnMs: this.aliveMs,
      distToFinish: Math.abs(b0.centerX - this.world.portal.center.x),
      levelDeaths: this.deaths,
      totalDeaths: SaveManager.totalDeaths,
      milestone: !!reaction.milestone,
    };
    EventBus.emit(GameEvents.PlayerDied, ctx);
    this.lastTriggered = null;

    AudioManager.play('death');
    this.clearDizzy();
    this.fx.shake(220, 0.008);
    const b = this.player.bounds;
    this.player.die(reaction.deathFace);
    if (reaction.milestone) {
      AudioManager.playTroll('hehe');
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
    this.aliveMs = 0;
    this.approached.clear();
    EventBus.emit(GameEvents.PlayerRespawned);
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
