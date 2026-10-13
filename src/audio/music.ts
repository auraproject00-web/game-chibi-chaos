/**
 * Original background music, composed for CHIBI CHAOS and synthesized in the browser (no audio
 * files, no licenses to track). Each track is rendered once with an OfflineAudioContext into a
 * single AudioBuffer that loops sample-accurately, so there is no JS note scheduling while playing
 * (no timer jitter, no input delay, nothing to fall behind when the tab is throttled).
 */

export type MusicTrack = 'menu' | 'game';

type Inst = 'marimba' | 'xylo' | 'bass' | 'kick' | 'shaker' | 'block';

interface TrackDef {
  bpm: number;
  /** Melody (xylophone), one string per bar, 16 sixteenth-note tokens: note, '.' rest, '-' hold. */
  melody: string[];
  /** Chord per bar as note names (root first). */
  chords: string[][];
  /** Marimba pattern per bar: chord-tone index per sixteenth, '.' for rest. */
  arp: string;
  /** Bass pattern per bar: 'R' root, 'O' octave, 'F' fifth, '.' rest. */
  bass: string;
  /** Drum patterns per bar (sixteenths): k kick, s shaker, b woodblock. */
  drums: string;
  /** Overall level of each part. */
  mix: Partial<Record<Inst, number>>;
}

const C = ['C4', 'E4', 'G4', 'C5'];
const Am = ['A3', 'C4', 'E4', 'A4'];
const F = ['F3', 'A3', 'C4', 'F4'];
const G = ['G3', 'B3', 'D4', 'G4'];

const TRACKS: Record<MusicTrack, TrackDef> = {
  // Relaxed and sweet: marimba arpeggios, sparse xylophone, shaker only.
  menu: {
    bpm: 100,
    chords: [C, G, Am, F, C, G, Am, F],
    melody: [
      'G5 - - - E5 - - - C5 - D5 - E5 - - -',
      'D5 - - - B4 - - - G4 - A4 - B4 - - -',
      'C5 - - - E5 - - - A5 - G5 - E5 - - -',
      'F5 - E5 - D5 - C5 - A4 - - - - - - -',
      'E5 - G5 - C6 - - - B5 - A5 - G5 - - -',
      'D5 - G5 - B5 - - - A5 - G5 - D5 - - -',
      'E5 - A5 - C6 - B5 - A5 - E5 - C5 - - -',
      'F5 - A5 - G5 - F5 - E5 - D5 - C5 - - -',
    ],
    arp: '0 . 1 . 2 . 1 . 3 . 2 . 1 . 2 .',
    bass: 'R . . . . . . . F . . . . . . .',
    drums: '. . s . . . s . . . s . . . s s',
    mix: { marimba: 0.55, xylo: 0.42, bass: 0.5, shaker: 0.5 },
  },
  // Bouncy and cheeky: busier marimba, light kick + woodblock backbeat.
  game: {
    bpm: 128,
    chords: [C, Am, F, G, C, Am, F, G],
    melody: [
      'E5 . G5 . C6 . G5 . A5 . G5 . E5 - - -',
      'C5 . E5 . A5 . E5 . G5 . E5 . C5 - - -',
      'A5 . C6 . A5 . F5 . G5 . A5 . C6 - - -',
      'B5 . D6 . B5 . G5 . A5 . B5 . D6 . C6 .',
      'E6 . D6 C6 . . G5 . E5 . G5 . C6 - - -',
      'A5 . G5 E5 . . C5 . E5 . A5 . G5 - - -',
      'F5 . A5 . C6 . A5 . G5 . F5 . E5 . D5 .',
      'D5 . G5 . B5 . D6 . - - G5 . - - - -',
    ],
    arp: '0 2 1 2 3 2 1 2 0 2 1 2 3 2 1 2',
    bass: 'R . . . F . . O R . . . F . O .',
    drums: 'k . s . b . s . k . s k b . s s',
    mix: { marimba: 0.38, xylo: 0.4, bass: 0.55, kick: 0.5, shaker: 0.45, block: 0.4 },
  },
};

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function freq(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const semis = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

/** Bars, beats and samples of a track loop. */
export function loopInfo(track: MusicTrack, sampleRate: number): { seconds: number; samples: number } {
  const def = TRACKS[track];
  const seconds = (def.chords.length * 4 * 60) / def.bpm;
  return { seconds, samples: Math.round(seconds * sampleRate) };
}

/** How long the last render took: main-thread graph building vs. total (rendering runs off the main thread). */
export const lastRenderTiming: Partial<Record<MusicTrack, { buildMs: number; totalMs: number }>> = {};

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

/**
 * Renders one loop of the track. Needs no user gesture (offline rendering is silent), so it can run
 * at boot and the music starts the instant audio is unlocked.
 */
export async function renderTrack(track: MusicTrack): Promise<AudioBuffer> {
  const def = TRACKS[track];
  const sr = 32000;
  const { samples } = loopInfo(track, sr);
  const tailSamples = Math.round(1.5 * sr);
  const Offline =
    (window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor }).OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;
  if (!Offline) throw new Error('OfflineAudioContext not supported');
  const started = performance.now();
  const ctx = new Offline(1, samples + tailSamples, sr);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, Math.floor(sr * 0.25), sr);
  const nd = noise.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < nd.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    nd[i] = (seed / 0x7fffffff) * 2 - 1;
  }

  const step = 60 / def.bpm / 4;
  const mix = (i: Inst): number => def.mix[i] ?? 0;
  const play = (inst: Inst, t: number, f = 0, len = 1, vel = 1): void => {
    const g = vel * mix(inst);
    if (g <= 0) return;
    switch (inst) {
      case 'marimba':
        // Warm wooden tone: fundamental plus the bright 4th partial that dies fast.
        partial(ctx, out, 'sine', f, t, 0.004, 0.55, 0.32 * g);
        partial(ctx, out, 'sine', f * 3.93, t, 0.002, 0.07, 0.07 * g);
        break;
      case 'xylo':
        // Brighter and shorter, with the classic 3x overtone; held notes ring a bit longer.
        partial(ctx, out, 'sine', f, t, 0.003, 0.28 + 0.06 * len, 0.28 * g);
        partial(ctx, out, 'sine', f * 3, t, 0.002, 0.09, 0.08 * g);
        partial(ctx, out, 'sine', f * 6.27, t, 0.001, 0.03, 0.03 * g);
        break;
      case 'bass': {
        const o = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const v = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        v.gain.setValueAtTime(0.0001, t);
        v.gain.exponentialRampToValueAtTime(0.42 * g, t + 0.012);
        v.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(lp).connect(v).connect(out);
        o.start(t);
        o.stop(t + 0.4);
        break;
      }
      case 'kick': {
        const o = ctx.createOscillator();
        const v = ctx.createGain();
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
        v.gain.setValueAtTime(0.55 * g, t);
        v.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(v).connect(out);
        o.start(t);
        o.stop(t + 0.18);
        break;
      }
      case 'shaker':
        noiseHit(ctx, out, noise, t, 'highpass', 6500, 0.045, 0.16 * g);
        break;
      case 'block':
        partial(ctx, out, 'sine', 1250, t, 0.001, 0.045, 0.16 * g);
        noiseHit(ctx, out, noise, t, 'bandpass', 2400, 0.02, 0.08 * g);
        break;
    }
  };

  const tokens = (s: string): string[] => s.trim().split(/\s+/);
  const arp = tokens(def.arp);
  const bass = tokens(def.bass);
  const drums = tokens(def.drums);
  def.chords.forEach((chord, bar) => {
    const barT = bar * 16 * step;
    const mel = tokens(def.melody[bar]);
    mel.forEach((n, i) => {
      if (n === '.' || n === '-') return;
      let len = 1;
      while (mel[i + len] === '-') len++;
      play('xylo', barT + i * step, freq(n), len, i % 4 === 0 ? 1 : 0.85);
    });
    arp.forEach((a, i) => {
      if (a === '.') return;
      play('marimba', barT + i * step, freq(chord[Number(a)]), 1, i % 4 === 0 ? 0.95 : 0.7);
    });
    bass.forEach((b, i) => {
      if (b === '.') return;
      const root = freq(chord[0]) / 2;
      const f = b === 'O' ? root * 2 : b === 'F' ? root * 1.5 : root;
      play('bass', barT + i * step, f);
    });
    drums.forEach((d, i) => {
      if (d === 'k') play('kick', barT + i * step);
      else if (d === 's') play('shaker', barT + i * step, 0, 1, i % 2 === 0 ? 1 : 0.7);
      else if (d === 'b') play('block', barT + i * step);
    });
  });

  const buildMs = performance.now() - started;
  const rendered = await ctx.startRendering();
  const src = rendered.getChannelData(0);
  // Fold the ring-out past the loop end back onto the start so the loop has no click or gap.
  const data = new Float32Array(samples);
  data.set(src.subarray(0, samples));
  for (let i = 0; i < tailSamples; i++) data[i] += src[samples + i];
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(data[i]));
  const norm = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < samples; i++) data[i] *= norm;
  // AudioBuffers are not tied to a context: this one plays in the live AudioContext later.
  const buffer = ctx.createBuffer(1, samples, sr);
  buffer.getChannelData(0).set(data);
  lastRenderTiming[track] = { buildMs: Math.round(buildMs), totalMs: Math.round(performance.now() - started) };
  return buffer;
}

function partial(
  ctx: BaseAudioContext,
  out: AudioNode,
  type: OscillatorType,
  f: number,
  t: number,
  attack: number,
  decay: number,
  vol: number,
): void {
  const o = ctx.createOscillator();
  const v = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(vol, t + attack);
  v.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(v).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.02);
}

function noiseHit(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  t: number,
  type: BiquadFilterType,
  cutoff: number,
  dur: number,
  vol: number,
): void {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = cutoff;
  const v = ctx.createGain();
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(v).connect(out);
  s.start(t);
  s.stop(t + dur + 0.01);
}
