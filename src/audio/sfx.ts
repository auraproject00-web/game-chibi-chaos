/**
 * Sound effect recipes, synthesized with Web Audio (no files). Each recipe schedules a few short
 * nodes and returns how long it rings, so the AudioManager can count active voices.
 * Levels here are fixed per sound: Troll Intensity only chooses which sound plays, never the volume.
 */

export type SfxName =
  | 'jump'
  | 'land'
  | 'death'
  | 'respawn'
  | 'trap'
  | 'spike'
  | 'fakeFloor'
  | 'crumble'
  | 'checkpoint'
  | 'victory'
  | 'click'
  | 'coin'
  | 'whoosh'
  | 'bonk'
  | 'dizzy'
  | 'hehe'
  | 'blip'
  | 'boing'
  | 'narSoft'
  | 'narSavage'
  | 'reveal'
  | 'mirror'
  | 'ghost'
  | 'shiftWarn'
  | 'shift'
  | 'fakeDoor'
  | 'trueDoor'
  | 'gravity'
  | 'dimension'
  | 'dimNope'
  | 'chaseWarn'
  | 'chase'
  | 'collapse';

/** The same sound is skipped if it was played less than this many ms ago. */
export const MIN_GAP_MS: Partial<Record<SfxName, number>> = {
  land: 90,
  jump: 70,
  death: 200,
  respawn: 200,
  click: 60,
  spike: 120,
  fakeFloor: 150,
  crumble: 150,
  trap: 120,
  checkpoint: 300,
  victory: 1500,
  blip: 250,
  boing: 250,
  hehe: 300,
  narSoft: 250,
  narSavage: 300,
  reveal: 1000,
  mirror: 150,
  ghost: 600,
  shiftWarn: 300,
  shift: 300,
  fakeDoor: 400,
  trueDoor: 1500,
  gravity: 250,
  dimension: 150,
  dimNope: 200,
  chaseWarn: 1500,
  chase: 1500,
  collapse: 1500,
};
export const DEFAULT_MIN_GAP_MS = 50;

export interface Synth {
  tone(type: OscillatorType, f0: number, f1: number, start: number, dur: number, vol: number): void;
  wobble(start: number, f0: number, f1: number, dur: number, vol: number, rate?: number): void;
  burst(start: number, dur: number, cutoff: number, vol: number, type?: BiquadFilterType): void;
}

/** Schedules the sound at time t and returns its length in seconds. */
export function playRecipe(s: Synth, name: SfxName, t: number): number {
  switch (name) {
    case 'jump':
      // Soft "boing" up-sweep.
      s.tone('triangle', 420, 880, t, 0.11, 0.09);
      s.tone('sine', 840, 1300, t + 0.02, 0.07, 0.03);
      return 0.13;
    case 'land':
      // Squishy little thump.
      s.tone('sine', 190, 80, t, 0.07, 0.12);
      s.burst(t, 0.04, 600, 0.035);
      return 0.08;
    case 'death':
      // Cartoon "pop" then a wobbly slide down: funny, not harsh.
      s.tone('sine', 520, 900, t, 0.07, 0.11);
      s.wobble(t + 0.07, 700, 160, 0.45, 0.09);
      return 0.54;
    case 'respawn':
      // Sparkly pop-in.
      s.tone('sine', 660, 1320, t, 0.09, 0.07);
      [1568, 2093].forEach((f, i) => s.tone('triangle', f, f, t + 0.06 + i * 0.05, 0.1, 0.04));
      return 0.22;
    case 'trap':
      s.tone('square', 1200, 1800, t, 0.05, 0.06);
      s.burst(t, 0.12, 4000, 0.12);
      return 0.14;
    case 'spike':
      // Metallic "shing!" as spikes pop out.
      s.tone('square', 1500, 2600, t, 0.04, 0.045);
      s.burst(t, 0.1, 5000, 0.1, 'highpass');
      s.tone('sine', 3150, 3000, t + 0.02, 0.22, 0.035);
      return 0.26;
    case 'fakeFloor':
      // Crack-crack, then a slide whistle down.
      s.burst(t, 0.05, 1800, 0.16, 'bandpass');
      s.burst(t + 0.07, 0.06, 1400, 0.14, 'bandpass');
      s.tone('sine', 950, 260, t + 0.1, 0.38, 0.08);
      return 0.5;
    case 'crumble':
      s.burst(t, 0.3, 700, 0.18);
      s.tone('triangle', 120, 60, t, 0.25, 0.12);
      return 0.32;
    case 'checkpoint':
      [659.25, 783.99, 1046.5].forEach((f, i) => s.tone('sine', f, f, t + i * 0.065, 0.14, 0.1));
      return 0.3;
    case 'victory':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => s.tone('triangle', f, f, t + i * 0.1, 0.16, 0.15));
      [523.25, 659.25, 783.99].forEach((f) => s.tone('sine', f, f, t + 0.42, 0.5, 0.09));
      return 0.95;
    case 'click':
      s.tone('sine', 700, 900, t, 0.05, 0.1);
      return 0.06;
    case 'coin':
      s.tone('square', 988, 988, t, 0.06, 0.05);
      s.tone('square', 1319, 1319, t + 0.06, 0.16, 0.05);
      return 0.23;
    case 'whoosh':
      s.burst(t, 0.28, 2400, 0.1);
      s.tone('sine', 300, 1100, t, 0.22, 0.06);
      return 0.3;
    case 'bonk':
      s.tone('square', 260, 120, t, 0.09, 0.07);
      s.tone('sine', 160, 70, t, 0.14, 0.12);
      return 0.15;
    case 'dizzy':
      s.wobble(t, 500, 900, 0.4, 0.08);
      return 0.42;
    case 'blip':
      // Narrator "talking": three tiny chirps (Chaos).
      [620, 820, 700].forEach((f, i) => s.tone('square', f, f * 1.08, t + i * 0.055, 0.04, 0.035));
      return 0.17;
    case 'boing':
      s.tone('sine', 180, 520, t, 0.16, 0.12);
      s.tone('triangle', 520, 260, t + 0.14, 0.14, 0.06);
      return 0.3;
    case 'hehe':
      // Three quick cheeky notes.
      [880, 740, 988].forEach((f, i) => s.tone('triangle', f, f * 0.94, t + i * 0.08, 0.07, 0.09));
      return 0.25;
    case 'narSoft':
      // Soft: one gentle, quiet chime.
      s.tone('sine', 1046.5, 1046.5, t, 0.22, 0.045);
      s.tone('sine', 1568, 1568, t + 0.04, 0.2, 0.02);
      return 0.26;
    case 'reveal':
      // The real portal appears: rising sparkly arpeggio.
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => s.tone('triangle', f, f, t + i * 0.07, 0.18, 0.08));
      s.tone('sine', 2093, 2093, t + 0.3, 0.35, 0.04);
      return 0.68;
    case 'mirror':
      // Glass shimmer breaking into sparkles.
      [2637, 3136, 2349, 3520].forEach((f, i) => s.tone('sine', f, f * 0.98, t + i * 0.035, 0.16, 0.035));
      s.burst(t, 0.12, 6000, 0.05, 'highpass');
      return 0.3;
    case 'ghost':
      // The ghost wakes up: airy, soft up-sweep with a little shimmer.
      s.tone('sine', 330, 660, t, 0.4, 0.06);
      s.tone('triangle', 495, 990, t + 0.05, 0.36, 0.03);
      s.wobble(t + 0.2, 990, 1100, 0.3, 0.025, 9);
      return 0.52;
    case 'shiftWarn':
      // Soft double tick: the platforms are about to change.
      s.tone('sine', 1318.5, 1318.5, t, 0.05, 0.05);
      s.tone('sine', 1318.5, 1318.5, t + 0.12, 0.05, 0.04);
      return 0.18;
    case 'shift':
      // Reality flips: a gentle whoom.
      s.tone('sine', 220, 440, t, 0.16, 0.07);
      s.burst(t, 0.14, 1600, 0.04, 'bandpass');
      return 0.18;
    case 'fakeDoor':
      // Creaky door, then a cheeky honk.
      s.wobble(t, 300, 380, 0.22, 0.05, 22);
      s.tone('square', 233, 220, t + 0.24, 0.12, 0.05);
      s.tone('square', 196, 185, t + 0.38, 0.18, 0.05);
      return 0.58;
    case 'trueDoor':
      // The real door opens: bright rising chime.
      [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => s.tone('triangle', f, f, t + i * 0.06, 0.2, 0.07));
      s.tone('sine', 1975.5, 1975.5, t + 0.26, 0.4, 0.035);
      return 0.68;
    case 'gravity':
      // Gravity flips: a floaty "bwoop" that bends up then settles.
      s.tone('sine', 280, 760, t, 0.18, 0.08);
      s.tone('triangle', 760, 520, t + 0.16, 0.14, 0.04);
      s.wobble(t + 0.05, 1200, 1500, 0.2, 0.02, 14);
      return 0.32;
    case 'dimension':
      // Dimension switch: a bright glassy swap with a tiny bitcrush blip.
      s.tone('triangle', 880, 1320, t, 0.08, 0.07);
      s.tone('square', 660, 440, t + 0.06, 0.07, 0.03);
      s.tone('sine', 1760, 1760, t + 0.1, 0.12, 0.035);
      return 0.24;
    case 'dimNope':
      // Switch cancelled: soft double "nuh-uh".
      s.tone('square', 262, 247, t, 0.07, 0.045);
      s.tone('square', 208, 196, t + 0.1, 0.1, 0.045);
      return 0.22;
    case 'chaseWarn':
      // The chaos wave wakes up: two-tone siren over a low rumble.
      s.tone('triangle', 660, 880, t, 0.2, 0.06);
      s.tone('triangle', 660, 880, t + 0.32, 0.2, 0.06);
      s.tone('triangle', 660, 880, t + 0.64, 0.2, 0.06);
      s.burst(t, 0.9, 260, 0.08, 'lowpass');
      return 0.95;
    case 'chase':
      // The wave starts moving: a deep whoosh.
      s.tone('sawtooth', 110, 55, t, 0.45, 0.05);
      s.burst(t, 0.5, 700, 0.07, 'lowpass');
      return 0.52;
    case 'collapse':
      // Reality cracks: glass crunch over a falling rumble.
      [3136, 2349, 2794, 1975].forEach((f, i) => s.tone('sine', f, f * 0.9, t + i * 0.05, 0.14, 0.03));
      s.burst(t, 0.6, 400, 0.09, 'lowpass');
      s.tone('sine', 160, 60, t + 0.05, 0.6, 0.07);
      return 0.7;
    case 'narSavage':
      // Savage: dramatic "wah-wah" with a wobbly ending.
      s.tone('triangle', 392, 370, t, 0.16, 0.1);
      s.tone('triangle', 349, 330, t + 0.18, 0.16, 0.1);
      s.wobble(t + 0.36, 311, 262, 0.3, 0.09, 7);
      return 0.68;
  }
}
