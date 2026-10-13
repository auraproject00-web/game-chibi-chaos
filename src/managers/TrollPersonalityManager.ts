import { TILE } from '../config';
import {
  EventBus,
  GameEvents,
  type DeathContext,
  type LevelCompletePayload,
  type NarratorLine,
  type TrapPassedPayload,
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
  passedTrap: 20,
  idle: 10,
};

/** Lines per situation. The first line is the signature one and is used first. */
export const LINES: Record<Exclude<CommentKind, 'trapType'>, string[]> = {
  finishAfterManyDeaths: ['Akhirnya! Gua udah mau pensiun!', 'Selamat… gua sampe ketiduran nunggunya.'],
  nearFinish: ['WKWKWK TINGGAL SELANGKAH!', 'Portalnya udah kelihatan lho, wkwk', 'Dikit lagi… DIKIT LAGI! Yah.'],
  repeatTrap: ['Bro… jebakannya masih di situ 😭', 'Jebakan yang SAMA. Lagi.', 'Kamu sama jebakan itu jodoh ya?'],
  sameArea: ['Mau gua kasih tutorial lagi?', 'Area ini kayaknya kangen sama kamu.', 'Ini tempat favorit buat mati ya?'],
  quickDeath: ['LAH, BARU JUGA HIDUP?!', 'Rekor! Hidup paling singkat!', 'Respawn-nya aja belum kering!'],
  passedTrap: ['Yahh… kok bisa lolos?!', 'Hmph. Beruntung doang itu.', 'Oke oke, kali ini kamu menang.'],
  idle: ['Mochi, kita nunggu siapa nih?', 'Halo? Masih main kan?', 'Gua bosen nih. Gerak dong~'],
};

/** Lines for dying to a specific trap type the first time. */
export const TRAP_LINES: Record<string, string[]> = {
  fakeFloor: ['Percaya aja sama lantainya? 🤣', 'Retaknya udah kelihatan lho~'],
  fallingPlatform: ['Papan kayu kok dipercaya?', 'Turun bareng papannya, cie~'],
  surpriseSpikes: ['Kejutaaan! 🎉', 'Katanya aman, hehe.'],
  baitCoin: ['Koin gratis? Di game ini? 🤣', 'Serakah dikit, langsung kena.'],
  fakeCheckpoint: ['Bendera miring kok dipercaya?', 'Checkpoint-nya palsu, hehe.'],
  spike: ['Durinya kelihatan jelas lho…', 'Itu duri. Bukan bantal.'],
};

export const TUNING = {
  /** Global cooldown for every non-milestone comment. */
  cooldownMs: 8000,
  idleMs: 15000,
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
    EventBus.on(GameEvents.LevelComplete, this.onComplete, this);
  }

  /** Must be called when the scene shuts down or restarts. */
  destroy(): void {
    EventBus.off(GameEvents.PlayerDied, this.onDeath, this);
    EventBus.off(GameEvents.PlayerRespawned, this.onRespawn, this);
    EventBus.off(GameEvents.TrapPassed, this.onTrapPassed, this);
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
    if (!this.idleFired && this.idleMs >= TUNING.idleMs) {
      // Spent even if the cooldown blocks it: one try per still period.
      this.idleFired = true;
      this.say('idle', LINES.idle);
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
    if (d.distToFinish <= TUNING.nearFinishPx) {
      this.say('nearFinish', LINES.nearFinish);
    } else if (trapCount >= TUNING.repeatTrapEvery && trapCount % TUNING.repeatTrapEvery === 0) {
      this.say('repeatTrap', LINES.repeatTrap);
    } else if (areaCount % TUNING.sameAreaEvery === 0) {
      this.say('sameArea', LINES.sameArea);
    } else if (d.sinceRespawnMs !== null && d.sinceRespawnMs < TUNING.quickDeathMs) {
      this.say('quickDeath', LINES.quickDeath);
    } else if (firstOnThisTrap && d.trapType && TRAP_LINES[d.trapType]) {
      this.say('trapType', TRAP_LINES[d.trapType]);
    }
  }

  private onRespawn(): void {
    this.idleMs = 0;
    this.idleFired = false;
  }

  private onTrapPassed(p: TrapPassedPayload): void {
    if (this.passedCommented.has(p.trapId)) return;
    if ((this.deathsByTrap.get(p.trapId) ?? 0) < TUNING.hardTrapDeaths) return;
    if (this.say('passedTrap', LINES.passedTrap)) this.passedCommented.add(p.trapId);
  }

  private onComplete(p: LevelCompletePayload): void {
    if (p.deaths > TUNING.finishAfterDeaths) this.say('finishAfterManyDeaths', LINES.finishAfterManyDeaths, true);
  }

  // ----- Output -----

  /** Returns true if the line was sent. */
  private say(kind: CommentKind, lines: string[], ignoreCooldown = false): boolean {
    const t = this.now();
    if (t < this.quietUntil) return false;
    if (!ignoreCooldown && t - this.lastCommentAt < TUNING.cooldownMs) return false;
    const text = this.pick(lines);
    this.lastCommentAt = t;
    const line: NarratorLine = { text, priority: PRIORITY[kind], kind };
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
    const lines = kind === 'trapType' ? TRAP_LINES.fakeFloor : LINES[kind];
    this.lastCommentAt = -Infinity;
    this.quietUntil = -Infinity;
    this.say(kind, lines);
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
      cooldownLeftMs: Math.max(0, TUNING.cooldownMs - (this.now() - this.lastCommentAt)),
    };
  }
}
