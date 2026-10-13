import { SaveManager } from './SaveManager';

export type SfxName =
  | 'jump'
  | 'land'
  | 'death'
  | 'trap'
  | 'crumble'
  | 'checkpoint'
  | 'victory'
  | 'click';

/**
 * Small synthesized sound effects built on the Web Audio API, so the MVP needs no audio files.
 * The AudioContext is only created/resumed after a user gesture to respect browser autoplay rules.
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Listens for the first user gestures and unlocks audio. */
  installUnlock(): void {
    const unlock = (): void => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchend', unlock);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchend', unlock);
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
        this.noise = this.makeNoise(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get sfxEnabled(): boolean {
    return SaveManager.sfxEnabled;
  }

  setSfxEnabled(enabled: boolean): void {
    SaveManager.setSfxEnabled(enabled);
  }

  play(name: SfxName): void {
    if (!this.sfxEnabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'jump':
        // Soft "boing" up-sweep.
        this.tone('triangle', 420, 880, t, 0.11, 0.09);
        this.tone('sine', 840, 1300, t + 0.02, 0.07, 0.03);
        break;
      case 'land':
        // Squishy little thump.
        this.tone('sine', 190, 80, t, 0.07, 0.12);
        this.burst(t, 0.04, 600, 0.035);
        break;
      case 'trap':
        this.tone('square', 1200, 1800, t, 0.05, 0.06);
        this.burst(t, 0.12, 4000, 0.12);
        break;
      case 'crumble':
        this.burst(t, 0.3, 700, 0.18);
        this.tone('triangle', 120, 60, t, 0.25, 0.12);
        break;
      case 'death':
        // Cartoon "pop" then a wobbly slide down: funny, not harsh.
        this.tone('sine', 520, 900, t, 0.07, 0.11);
        this.wobble(t + 0.07, 700, 160, 0.45, 0.09);
        break;
      case 'checkpoint':
        [659.25, 783.99, 1046.5].forEach((f, i) => this.tone('sine', f, f, t + i * 0.065, 0.14, 0.1));
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone('triangle', f, f, t + i * 0.1, 0.16, 0.15),
        );
        [523.25, 659.25, 783.99].forEach((f) => this.tone('sine', f, f, t + 0.42, 0.5, 0.09));
        break;
      case 'click':
        this.tone('sine', 700, 900, t, 0.05, 0.1);
        break;
    }
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private wobble(start: number, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    lfo.frequency.value = 14;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    lfo.start(start);
    osc.stop(start + dur + 0.02);
    lfo.stop(start + dur + 0.02);
  }

  private burst(start: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

export const AudioManager = new AudioManagerImpl();
