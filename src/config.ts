/** Global tuning values and the CHIBI CHAOS palette. */

export const TILE = 32;

/** Vertical slice of the world (in world px) the camera tries to show. */
export const VIEW_HEIGHT = 540;
/** Minimum horizontal slice of the world shown on narrow (portrait) screens. */
export const MIN_VIEW_WIDTH = 640;

export const FONT = '"Fredoka", "Baloo 2", "Trebuchet MS", "Segoe UI", sans-serif';

/** Main palette from the concept sheet. */
export const PALETTE = {
  mint: 0xb7f0c1,
  pink: 0xffb3c1,
  cream: 0xfff3d6,
  sky: 0x9ed8ff,
  lavender: 0xcdb4ff,
  peach: 0xffcf9b,
} as const;

/** Supporting tones derived from the palette. */
export const TONES = {
  ink: 0x3b2a3a,
  inkCss: '#4a3346',
  mintDark: 0x5aa877,
  mintShade: 0x93dca6,
  pinkDark: 0xe0809a,
  skyDark: 0x5fb1e6,
  lavenderDark: 0x9d82e0,
  peachDark: 0xe0a05f,
  creamDark: 0xe8d3a8,
  grass: 0x8fd99a,
  grassLight: 0xc4f5cb,
  dirt: 0xedc597,
  dirtDark: 0xd9a676,
  dirtOutline: 0xa8744d,
  spike: 0xff8fa3,
  spikeDark: 0xd9506e,
} as const;

export const PLAYER = {
  /** Hitbox in world px. */
  width: 26,
  height: 34,
  maxSpeed: 250,
  groundAccel: 2600,
  groundDecel: 3000,
  airAccel: 1800,
  airDecel: 900,
  /** Extra multiplier when reversing direction, makes turning snappy. */
  turnBoost: 1.6,
  gravity: 1900,
  jumpVelocity: 640,
  /** Vertical velocity is multiplied by this when jump is released early. */
  jumpCut: 0.45,
  maxFall: 950,
  coyoteMs: 100,
  jumpBufferMs: 130,
} as const;

export const TIMING = {
  respawnDelayMs: 550,
  completeDelayMs: 900,
} as const;
