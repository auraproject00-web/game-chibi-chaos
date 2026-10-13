import type { SfxName } from '../audio/sfx';
import { SaveManager } from './SaveManager';

/**
 * Troll Intensity: how often and how spicy the narrator is. It only changes comments, their
 * look and their sounds. Level difficulty, physics, traps and respawn are never touched.
 */
export type TrollIntensity = 'soft' | 'chaos' | 'savage';

export const INTENSITIES: TrollIntensity[] = ['soft', 'chaos', 'savage'];
export const DEFAULT_INTENSITY: TrollIntensity = 'chaos';

/** Narrator face icons (textures drawn in art/textures.ts). */
export type NarratorFace = 'nar_smile' | 'nar_smirk' | 'nar_laugh' | 'nar_shock' | 'nar_sleepy' | 'nar_devil';

export interface IntensityProfile {
  label: string;
  /** One short line for the Settings panel. */
  description: string;
  /** Cooldown between normal narrator comments (milestones ignore it). */
  cooldownMs: number;
  /** Standing still this long in a safe spot gets the idle comment. */
  idleMs: number;
  /** Comment on every trap death, not only the first one per trap. */
  trapLineEveryDeath: boolean;
  /**
   * Sounds a narrator popup picks from (one per popup). Only the choice changes per mode; every
   * sound has a fixed level, so the player's volume settings are never touched.
   */
  popupSfx: SfxName[];
  /** Bubble animation. */
  popup: 'simple' | 'bounce' | 'wild';
  /** How long the bubble stays fully visible (plus ~0.5s of in/out animation, ~1.65–1.7s total). */
  holdMs: number;
  /** Narrator faces this mode picks from (by comment kind, see faceFor). */
  faces: { happy: NarratorFace; tease: NarratorFace; wow: NarratorFace; bored: NarratorFace };
}

export const PROFILES: Record<TrollIntensity, IntensityProfile> = {
  soft: {
    label: 'Soft',
    description: 'Jarang ngomong, lucu dan suportif.',
    cooldownMs: 15000,
    idleMs: 20000,
    trapLineEveryDeath: false,
    popupSfx: ['narSoft'],
    popup: 'simple',
    holdMs: 1200,
    faces: { happy: 'nar_smile', tease: 'nar_smile', wow: 'nar_smile', bored: 'nar_sleepy' },
  },
  chaos: {
    label: 'Chaos',
    description: 'Jahil, lucu, sedikit nyebelin.',
    cooldownMs: 8000,
    idleMs: 15000,
    trapLineEveryDeath: false,
    popupSfx: ['blip', 'blip', 'boing'],
    popup: 'bounce',
    holdMs: 1150,
    faces: { happy: 'nar_laugh', tease: 'nar_smirk', wow: 'nar_shock', bored: 'nar_sleepy' },
  },
  savage: {
    label: 'Savage',
    description: 'Sering, absurd, dan pedas.',
    cooldownMs: 5000,
    idleMs: 12000,
    trapLineEveryDeath: true,
    popupSfx: ['narSavage', 'narSavage', 'hehe', 'boing'],
    popup: 'wild',
    holdMs: 1100,
    faces: { happy: 'nar_devil', tease: 'nar_laugh', wow: 'nar_shock', bored: 'nar_devil' },
  },
};

export function currentIntensity(): TrollIntensity {
  return SaveManager.trollIntensity;
}

export function currentProfile(): IntensityProfile {
  return PROFILES[currentIntensity()];
}
