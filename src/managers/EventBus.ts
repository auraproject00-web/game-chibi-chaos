import Phaser from 'phaser';

/** Events sent from the game world to the HUD. */
export const GameEvents = {
  DeathsChanged: 'deaths-changed',
  LevelComplete: 'level-complete',
  Paused: 'paused',
  Resumed: 'resumed',
  DeathReaction: 'death-reaction',
} as const;

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
