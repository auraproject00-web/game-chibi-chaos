import Phaser from 'phaser';

/** Events sent from the game world to the HUD. */
export const GameEvents = {
  DeathsChanged: 'deaths-changed',
  LevelComplete: 'level-complete',
  Paused: 'paused',
  Resumed: 'resumed',
  DeathReaction: 'death-reaction',
  /** Raw gameplay facts for the troll narrator (and anything else that wants them). */
  PlayerDied: 'player-died',
  PlayerRespawned: 'player-respawned',
  TrapPassed: 'trap-passed',
  /** A trap went off without a death (coin grabbed, fake flag touched, decoy portal gone). */
  TrapSprung: 'trap-sprung',
  /** The troll narrator wants to say something. */
  NarratorSay: 'narrator-say',
  /** The level's action button changed (Level 04 dimension switch). Payload: ActionInfo | null. */
  ActionState: 'action-state',
} as const;

/** Everything known about one death. Cause and trap come from the real gameplay event. */
export interface DeathContext {
  cause: 'spike' | 'fall' | 'trap';
  /** Stable trap id (e.g. `surpriseSpikes-1`, `spike-0` for static spikes), null for a plain pit. */
  trapId: string | null;
  /** Trap type, `spike` for static spikes, null for a plain pit. */
  trapType: string | null;
  x: number;
  y: number;
  /** Alive time since the last respawn (ms). `null` on the first life of the level. */
  sinceRespawnMs: number | null;
  /** Horizontal distance from MOCHI to the finish portal (px). */
  distToFinish: number;
  levelDeaths: number;
  totalDeaths: number;
  /** True when this death hit a Death Reaction milestone. */
  milestone: boolean;
}

export interface TrapPassedPayload {
  trapId: string;
  trapType: string;
}

export interface TrapSprungPayload {
  trapId: string;
  trapType: string;
  /** Which line set fits (e.g. `fakeFinish`, `realFinish`). */
  key: string;
}

export interface NarratorLine {
  text: string;
  /** Higher wins. Milestones (Death Reaction) use 100. */
  priority: number;
  kind: string;
  /** Troll Intensity the line was written for (drives bubble style). */
  intensity: 'soft' | 'chaos' | 'savage';
  /** Narrator face icon texture key. */
  face: string;
}

export interface DeathReactionPayload {
  message: string;
  /** Milestone title, when this death hit one. */
  title?: string;
}

export interface LevelCompletePayload {
  levelId: number;
  deaths: number;
  bestDeaths: number;
  hasNext: boolean;
}

/** Shared emitter so scenes can talk without holding direct references. */
export const EventBus = new Phaser.Events.EventEmitter();
