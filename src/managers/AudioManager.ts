import { lastRenderTiming, renderTrack, type MusicTrack } from '../audio/music';
import { DEFAULT_MIN_GAP_MS, MIN_GAP_MS, playRecipe, type SfxName, type Synth } from '../audio/sfx';
import { SaveManager } from './SaveManager';

export type { SfxName } from '../audio/sfx';
export type { MusicTrack } from '../audio/music';

/** At most this many sound effects ring at the same time; extra ones are dropped. */
const MAX_VOICES = 10;
/** Music bus level at 100% music volume (music sits under the SFX). */
const MUSIC_LEVEL = 0.5;
/** Music level while the game is paused. */
const DUCK_LEVEL = 0.35;

/**
 * One AudioContext for the whole game, created on the first user gesture (browser autoplay rules).
 *
 *   sfx voices -> sfxBus (SFX volume / mute) ─┐
 *   music loop -> trackGain -> duck -> musicBus (music volume / mute) ─┴-> master -> speakers
 *
 * Sound effects are synthesized (see audio/sfx.ts) with a per-sound minimum gap and a voice cap,
 * so repeated sounds never pile up. Music is pre-rendered once per track (audio/music.ts) and
 * played as a single looping buffer, with at most one track audible at a time.
 * The context is suspended while the page is hidden and closed when the game is destroyed.
 */
class AudioManagerImpl implements Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listening = false;
  private closed = false;
  private hiddenSuspend = false;

  private readonly lastPlayed = new Map<SfxName, number>();
  private voiceEnds: number[] = [];

  private desiredTrack: MusicTrack | null = null;
  private current: { track: MusicTrack; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private readonly buffers = new Map<MusicTrack, AudioBuffer>();
  private readonly rendering = new Map<MusicTrack, Promise<void>>();
  private ducked = false;

  // Counters for tests and the dev tools.
  private musicSources = 0;
  private dropped = { throttled: 0, voiceCap: 0, muted: 0 };
  private history: SfxName[] = [];
  private failures: string[] = [];

  // ----- Lifecycle -----

  /** Unlocks audio on user gestures and pauses it while the page is hidden. */
  installUnlock(): void {
    if (this.listening) return;
    this.listening = true;
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click'] as const) {
      window.addEventListener(ev, this.onGesture, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onVisibility);
  }

  private readonly onGesture = (): void => this.unlock();

  private readonly onVisibility = (): void => {
    if (!this.ctx || this.closed) return;
    if (document.visibilityState === 'hidden') {
      this.hiddenSuspend = true;
      void this.ctx.suspend().catch(() => undefined);
    } else if (this.hiddenSuspend) {
      this.hiddenSuspend = false;
      // May be refused without a gesture (Safari); the next tap resumes it then.
      void this.ctx.resume().catch(() => undefined);
    }
  };

  private readonly onPageHide = (): void => {
    if (!this.ctx || this.closed) return;
    this.hiddenSuspend = true;
    void this.ctx.suspend().catch(() => undefined);
  };

  /** Creates or resumes the context. Must run inside a user gesture the first time. */
  unlock(): void {
    if (this.closed || document.visibilityState === 'hidden') return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.fail('Web Audio not supported');
          return;
        }
        const ctx = new Ctor({ latencyHint: 'interactive' });
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.connect(this.master);
        this.duckGain = ctx.createGain();
        this.duckGain.connect(this.musicBus);
        this.noise = this.makeNoise(ctx);
        this.applyVolumes();
        ctx.addEventListener('statechange', () => this.syncMusic());
        // iOS Safari only fully unlocks after something is played inside the gesture.
        const silent = ctx.createBufferSource();
        silent.buffer = ctx.createBuffer(1, 1, 22050);
        silent.connect(ctx.destination);
        silent.start(0);
      }
      this.hiddenSuspend = false;
      if (this.ctx.state !== 'running') {
        this.ctx.resume().then(
          () => this.syncMusic(),
          (e: unknown) => this.fail(`resume refused: ${String(e)}`),
        );
      }
    } catch (e) {
      this.fail(`unlock failed: ${String(e)}`);
    }
  }

  /** Stops every sound and releases the context (game closed). */
  shutdown(): void {
    this.closed = true;
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click'] as const) {
      window.removeEventListener(ev, this.onGesture, { capture: true });
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onVisibility);
    this.listening = false;
    this.stopCurrent(0);
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  private get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.closed;
  }

  private fail(msg: string): void {
    this.failures.push(msg);
    if (this.failures.length > 5) this.failures.shift();
  }

  // ----- Settings -----

  get sfxEnabled(): boolean {
    return SaveManager.sfxEnabled;
  }

  setSfxEnabled(enabled: boolean): void {
    SaveManager.setSfxEnabled(enabled);
    this.applyVolumes();
  }

  get musicEnabled(): boolean {
    return SaveManager.musicEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    SaveManager.setMusicEnabled(enabled);
    this.applyVolumes();
    this.syncMusic();
  }

  get musicVolume(): number {
    return SaveManager.musicVolume;
  }

  setMusicVolume(v: number): void {
    SaveManager.setMusicVolume(v);
    this.applyVolumes();
  }

  get sfxVolume(): number {
    return SaveManager.sfxVolume;
  }

  setSfxVolume(v: number): void {
    SaveManager.setSfxVolume(v);
    this.applyVolumes();
  }

  /** True when anything is audible (for the HUD speaker icon). */
  get anyEnabled(): boolean {
    return this.sfxEnabled || this.musicEnabled;
  }

  /** HUD speaker button: mute everything, or turn music and SFX back on. */
  toggleAll(): void {
    const on = !this.anyEnabled;
    SaveManager.setSfxEnabled(on);
    SaveManager.setMusicEnabled(on);
    this.applyVolumes();
    this.syncMusic();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus || !this.duckGain) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxEnabled ? this.sfxVolume : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? this.musicVolume * MUSIC_LEVEL : 0, t, 0.05);
    this.duckGain.gain.setTargetAtTime(this.ducked ? DUCK_LEVEL : 1, t, 0.08);
  }

  // ----- Sound effects -----

  /**
   * Troll sounds (narrator voice, cheeky laughs). They respect both the main SFX switch and the
   * separate "Suara Narator" switch in Settings.
   */
  playTroll(name: SfxName): void {
    if (!SaveManager.trollSfxEnabled) {
      this.dropped.muted++;
      return;
    }
    this.play(name);
  }

  play(name: SfxName): void {
    if (!this.sfxEnabled) {
      this.dropped.muted++;
      return;
    }
    if (!this.running || !this.sfxBus) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (now - last < (MIN_GAP_MS[name] ?? DEFAULT_MIN_GAP_MS)) {
      this.dropped.throttled++;
      return;
    }
    const ctxNow = this.ctx!.currentTime;
    this.voiceEnds = this.voiceEnds.filter((end) => end > ctxNow);
    if (this.voiceEnds.length >= MAX_VOICES) {
      this.dropped.voiceCap++;
      return;
    }
    this.lastPlayed.set(name, now);
    const len = playRecipe(this, name, ctxNow + 0.005);
    this.voiceEnds.push(ctxNow + 0.005 + len);
    this.history.push(name);
    if (this.history.length > 40) this.history.shift();
  }

  tone(type: OscillatorType, f0: number, f1: number, start: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  wobble(start: number, f0: number, f1: number, dur: number, vol: number, rate = 14): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    lfo.frequency.value = rate;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(start);
    lfo.start(start);
    osc.stop(start + dur + 0.02);
    lfo.stop(start + dur + 0.02);
  }

  burst(start: number, dur: number, cutoff: number, vol: number, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(this.sfxBus!);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ----- Music -----

  /** Asks for a track. Calling it again with the same track keeps it playing (no restart). */
  playMusic(track: MusicTrack): void {
    this.desiredTrack = track;
    if (this.ducked) {
      this.ducked = false;
      this.applyVolumes();
    }
    this.syncMusic();
  }

  stopMusic(): void {
    this.desiredTrack = null;
    this.syncMusic();
  }

  /** Lowers the music while the game is paused. */
  duckMusic(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  private syncMusic(): void {
    const want = this.musicEnabled && this.running ? this.desiredTrack : null;
    if (this.current?.track === want) return;
    this.stopCurrent(0.35);
    if (!want) return;
    const buffer = this.buffers.get(want);
    if (buffer) {
      this.startTrack(want, buffer);
      return;
    }
    this.renderLater(want);
  }

  /** Renders a track off the input handler (never inside a tap), then starts it if still wanted. */
  private renderLater(track: MusicTrack): void {
    if (this.rendering.has(track) || !this.ctx) return;
    const ctx = this.ctx;
    const job = new Promise<void>((resolve) => window.setTimeout(resolve, 30))
      .then(() => renderTrack(track, ctx))
      .then((buffer) => {
        this.buffers.set(track, buffer);
        this.syncMusic();
        // Prepare the other track too, so the next scene change starts instantly.
        const other: MusicTrack = track === 'menu' ? 'game' : 'menu';
        if (!this.buffers.has(other)) window.setTimeout(() => this.renderLater(other), 1500);
      })
      .catch((e: unknown) => this.fail(`music render failed: ${String(e)}`))
      .finally(() => this.rendering.delete(track));
    this.rendering.set(track, job);
  }

  private startTrack(track: MusicTrack, buffer: AudioBuffer): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = buffer.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
    src.connect(gain).connect(this.duckGain!);
    src.start();
    this.musicSources++;
    src.onended = () => {
      this.musicSources--;
      src.disconnect();
      gain.disconnect();
    };
    this.current = { track, src, gain };
  }

  private stopCurrent(fadeSec: number): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    const t = ctx.currentTime;
    try {
      cur.gain.gain.cancelScheduledValues(t);
      cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value), t);
      cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.01, fadeSec));
      cur.src.stop(t + Math.max(0.01, fadeSec) + 0.02);
    } catch {
      // Already stopped.
    }
  }

  /** Snapshot for tests and dev tools. */
  get stats(): {
    state: string;
    track: MusicTrack | null;
    desired: MusicTrack | null;
    musicSources: number;
    ducked: boolean;
    voices: number;
    dropped: { throttled: number; voiceCap: number; muted: number };
    history: SfxName[];
    buffers: Record<string, { seconds: number; sampleRate: number; loop: boolean }>;
    sfxBus: number;
    musicBus: number;
    failures: string[];
    renderTiming: typeof lastRenderTiming;
  } {
    const now = this.ctx?.currentTime ?? 0;
    return {
      state: this.closed ? 'closed' : (this.ctx?.state ?? 'none'),
      track: this.current?.track ?? null,
      desired: this.desiredTrack,
      musicSources: this.musicSources,
      ducked: this.ducked,
      voices: this.voiceEnds.filter((e) => e > now).length,
      dropped: { ...this.dropped },
      history: [...this.history],
      buffers: Object.fromEntries(
        [...this.buffers].map(([k, b]) => [k, { seconds: b.duration, sampleRate: b.sampleRate, loop: this.current?.track === k ? this.current.src.loop : false }]),
      ),
      sfxBus: this.sfxBus?.gain.value ?? -1,
      musicBus: this.musicBus?.gain.value ?? -1,
      failures: [...this.failures],
      renderTiming: { ...lastRenderTiming },
    };
  }

  /** Test helper: the rendered loop of a track (to check the loop seam). */
  musicBuffer(track: MusicTrack): AudioBuffer | undefined {
    return this.buffers.get(track);
  }
}

export const AudioManager = new AudioManagerImpl();
