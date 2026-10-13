import { TILE } from '../config';
import { currentIntensity, PROFILES, type IntensityProfile, type NarratorFace } from './TrollIntensity';
import { linesFor, type LineKey } from './trollLines';
import {
  EventBus,
  GameEvents,
  type DeathContext,
  type LevelCompletePayload,
  type NarratorLine,
  type TrapPassedPayload,
  type TrapSprungPayload,
} from './EventBus';

/** The situations the narrator reacts to. */
export type CommentKind =
  | 'finishAfterManyDeaths'
  | 'nearFinish'
  | 'repeatTrap'
  | 'sameArea'
  | 'quickDeath'
  | 'trapType'
  | 'passedTrap'
  | 'trapSprung'
  | 'idle';

/**
 * Priority of each kind (higher wins). Death Reaction milestones are 100 and always win.
 * Order from the design: milestone > near finish > repeated trap > quick death > trap type > idle.
 */
export const PRIORITY: Record<CommentKind, number> = {
  finishAfterManyDeaths: 90,
  nearFinish: 60,
  repeatTrap: 50,
  sameArea: 45,
  quickDeath: 40,
  trapType: 30,
  trapSprung: 25,
  passedTrap: 20,
  idle: 10,
};

/** Which narrator face (from the intensity profile) each kind uses. */
const FACE_OF: Record<CommentKind, keyof IntensityProfile['faces']> = {
  finishAfterManyDeaths: 'happy',
  nearFinish: 'happy',
  repeatTrap: 'tease',
  sameArea: 'tease',
  quickDeath: 'wow',
  trapType: 'tease',
  trapSprung: 'tease',
  passedTrap: 'wow',
  idle: 'bored',
};

/**
 * Shared tuning. The cooldown and idle time come from the current Troll Intensity profile
 * (Soft 15s, Chaos 8s, Savage 5s); the overrides below are for the dev debug panel only.
 */
export const TUNING = {
  /** Dev only: replaces the profile's idle time when set. */
  idleOverrideMs: null as number | null,
  /** Deaths on one trap that count as "again": fires at 3, 6, 9… */
  repeatTrapEvery: 3,
  /** Deaths in one area that fire the tutorial joke: 5, 10, 15… */
  sameAreaEvery: 5,
  areaWidthPx: 5 * TILE,
  quickDeathMs: 3000,
  nearFinishPx: 7 * TILE,
  /** Level deaths needed for the finish comment. */
  finishAfterDeaths: 20,
  /** A trap counts as "hard" once it has killed MOCHI this many times. */
  hardTrapDeaths: 1,
  /** Normal comments stay quiet this long after a Death Reaction milestone. */
  milestoneQuietMs: 2200,
  /** How many recent lines may not repeat. */
  noRepeat: 4,
};

export interface IdleSample {
  /** MOCHI is alive, standing still with no input. */
  still: boolean;
  /** Not on or next to any trap or hazard. */
  safe: boolean;
}

/**
 * The troll narrator's brain. Listens to gameplay events (deaths with their real cause and
 * trap id, respawns, traps passed, level complete), keeps the stats it needs, and asks the HUD to
 * show a line through `NarratorSay`. It never touches gameplay and never waits for anything.
 *
 * It works alongside DeathReactionManager: a death that hit a milestone is left to Death
 * Reaction, and normal comments stay quiet for a moment after it.
 */
export class TrollPersonalityManager {
  private readonly deathsByTrap = new Map<string, number>();
  private readonly deathsByArea = new Map<number, number>();
  private readonly passedCommented = new Set<string>();
  private readonly sprungCommented = new Set<string>();
  private readonly firstTrapDeath = new Set<string>();
  private readonly recent: string[] = [];
  private readonly used = new Set<string>();
  private lastCommentAt = -Infinity;
  private quietUntil = -Infinity;
  private idleMs = 0;
  private idleFired = false;

  constructor(private readonly now: () => number) {
    EventBus.on(GameEvents.PlayerDied, this.onDeath, this);
    EventBus.on(GameEvents.PlayerRespawned, this.onRespawn, this);
    EventBus.on(GameEvents.TrapPassed, this.onTrapPassed, this);
    EventBus.on(GameEvents.TrapSprung, this.onTrapSprung, this);
    EventBus.on(GameEvents.LevelComplete, this.onComplete, this);
  }

  /** Must be called when the scene shuts down or restarts. */
  destroy(): void {
    EventBus.off(GameEvents.PlayerDied, this.onDeath, this);
    EventBus.off(GameEvents.PlayerRespawned, this.onRespawn, this);
    EventBus.off(GameEvents.TrapPassed, this.onTrapPassed, this);
    EventBus.off(GameEvents.TrapSprung, this.onTrapSprung, this);
    EventBus.off(GameEvents.LevelComplete, this.onComplete, this);
  }

  /** Per-frame idle tracking. Fires the idle line at most once per still period. */
  update(deltaMs: number, sample: IdleSample): void {
    if (!sample.still) {
      this.idleMs = 0;
      this.idleFired = false;
      return;
    }
    if (!sample.safe) {
      this.idleMs = 0;
      return;
    }
    this.idleMs += deltaMs;
    if (!this.idleFired && this.idleMs >= (TUNING.idleOverrideMs ?? this.profile.idleMs)) {
      // Spent even if the cooldown blocks it: one try per still period.
      this.idleFired = true;
      this.say('idle', 'idle');
    }
  }

  // ----- Event handlers -----

  private onDeath(d: DeathContext): void {
    this.idleMs = 0;
    this.idleFired = false;

    // Stats first, so they stay accurate whatever gets said.
    let trapCount = 0;
    if (d.trapId) {
      trapCount = (this.deathsByTrap.get(d.trapId) ?? 0) + 1;
      this.deathsByTrap.set(d.trapId, trapCount);
    }
    const area = Math.floor(d.x / TUNING.areaWidthPx);
    const areaCount = (this.deathsByArea.get(area) ?? 0) + 1;
    this.deathsByArea.set(area, areaCount);
    const firstOnThisTrap = !!d.trapId && !this.firstTrapDeath.has(d.trapId);
    if (d.trapId) this.firstTrapDeath.add(d.trapId);

    if (d.milestone) {
      // Death Reaction owns this moment.
      this.quietUntil = this.now() + TUNING.milestoneQuietMs;
      return;
    }

    // Highest priority that applies wins; lower ones are not tried after it.
    const trapKey: LineKey | null = d.trapType ? `trap:${d.trapType}` : null;
    if (d.distToFinish <= TUNING.nearFinishPx) {
      this.say('nearFinish', 'nearFinish');
    } else if (trapCount >= TUNING.repeatTrapEvery && trapCount % TUNING.repeatTrapEvery === 0) {
      this.say('repeatTrap', 'repeatTrap');
    } else if (areaCount % TUNING.sameAreaEvery === 0) {
      this.say('sameArea', 'sameArea');
    } else if (d.sinceRespawnMs !== null && d.sinceRespawnMs < TUNING.quickDeathMs) {
      this.say('quickDeath', 'quickDeath');
    } else if (trapKey && (firstOnThisTrap || this.profile.trapLineEveryDeath)) {
      this.say('trapType', trapKey);
    }
  }

  private onRespawn(): void {
    this.idleMs = 0;
    this.idleFired = false;
  }

  private onTrapPassed(p: TrapPassedPayload): void {
    if (this.passedCommented.has(p.trapId)) return;
    if ((this.deathsByTrap.get(p.trapId) ?? 0) < TUNING.hardTrapDeaths) return;
    if (this.say('passedTrap', 'passedTrap')) this.passedCommented.add(p.trapId);
  }

  /**
   * A trap went off without a death. Each one is commented at most once per level visit.
   * One-time story beats (fake flag, decoy portal, real portal) skip the cooldown; a bait coin
   * that can be grabbed again respects it.
   */
  private onTrapSprung(p: TrapSprungPayload): void {
    const tag = `${p.trapId}:${p.key}`;
    if (this.sprungCommented.has(tag)) return;
    const once = p.key !== 'baitCoin';
    if (this.say('trapSprung', `sprung:${p.key}`, once)) this.sprungCommented.add(tag);
  }

  private onComplete(p: LevelCompletePayload): void {
    if (p.deaths > TUNING.finishAfterDeaths) this.say('finishAfterManyDeaths', 'finishAfterManyDeaths', true);
  }

  // ----- Output -----

  /** Current Troll Intensity profile, read live so a Settings change applies right away. */
  private get profile(): IntensityProfile {
    return PROFILES[currentIntensity()];
  }

  /** Returns true if the line was sent. */
  private say(kind: CommentKind, key: LineKey, ignoreCooldown = false): boolean {
    const t = this.now();
    if (t < this.quietUntil) return false;
    const profile = this.profile;
    if (!ignoreCooldown && t - this.lastCommentAt < profile.cooldownMs) return false;
    const intensity = currentIntensity();
    const lines = linesFor(intensity, key);
    if (!lines?.length) return false;
    const text = this.pick(lines);
    this.lastCommentAt = t;
    const face: NarratorFace = profile.faces[FACE_OF[kind]];
    const line: NarratorLine = { text, priority: PRIORITY[kind], kind, intensity, face };
    EventBus.emit(GameEvents.NarratorSay, line);
    return true;
  }

  /** Signature line first, then variants that were not said recently. */
  private pick(lines: string[]): string {
    const fresh = lines.filter((l) => !this.used.has(l));
    const pool = fresh.length ? fresh : lines.filter((l) => !this.recent.includes(l));
    const text = (pool.length ? pool : lines)[fresh.length ? 0 : Math.floor(Math.random() * Math.max(1, pool.length))] ?? lines[0];
    this.used.add(text);
    this.recent.push(text);
    if (this.recent.length > TUNING.noRepeat) this.recent.shift();
    return text;
  }

  // ----- Dev / debug -----

  /** Dev only: say a line of any kind right away, skipping cooldown (to preview the bubble). */
  debugSay(kind: CommentKind): void {
    this.lastCommentAt = -Infinity;
    this.quietUntil = -Infinity;
    this.say(kind, kind === 'trapType' ? 'trap:fakeFloor' : kind === 'trapSprung' ? 'sprung:fakeFinish' : kind);
  }

  /** Dev only: forget the cooldown so the next real event can comment. */
  debugResetCooldown(): void {
    this.lastCommentAt = -Infinity;
    this.quietUntil = -Infinity;
  }

  get stats(): { byTrap: Record<string, number>; byArea: Record<string, number>; idleMs: number; cooldownLeftMs: number } {
    return {
      byTrap: Object.fromEntries(this.deathsByTrap),
      byArea: Object.fromEntries(this.deathsByArea),
      idleMs: this.idleMs,
      cooldownLeftMs: Math.max(0, this.profile.cooldownMs - (this.now() - this.lastCommentAt)),
    };
  }
}
