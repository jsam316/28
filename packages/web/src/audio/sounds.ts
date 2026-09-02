// Small synthesised sound effects built on the Web Audio API - no audio files
// to download, so they work offline and keep the app tiny. The AudioContext
// is created lazily on the first user gesture (browsers block audio before
// one), and a persisted mute flag silences everything.
import { loadJSON, saveJSON } from '../utils/storage';

export type SoundName = 'card' | 'sweep' | 'trump' | 'bid' | 'turn' | 'deal' | 'win' | 'lose';

type Listener = () => void;

class SoundPlayer {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private _muted: boolean = loadJSON<boolean>('muted', false);

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    saveJSON('muted', muted);
    if (!muted) this.unlock();
    for (const l of this.listeners) l();
  }

  toggle() {
    this.setMuted(!this._muted);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Call from a user gesture so the context is allowed to start.
  unlock() {
    const ctx = this.context();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  play(name: SoundName) {
    if (this._muted) return;
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return;
    try {
      this.synth(ctx, name);
    } catch {
      // A failed effect must never break the game.
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    start: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
    glideTo?: number
  ) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private burst(ctx: AudioContext, start: number, duration: number, gain: number, freq: number, q = 1, sweepTo?: number) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, start);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  private synth(ctx: AudioContext, name: SoundName) {
    const t = ctx.currentTime;
    switch (name) {
      case 'card':
        // A card snapping onto felt: a short filtered noise tap.
        this.burst(ctx, t, 0.07, 0.35, 1800, 0.8);
        this.tone(ctx, 220, t, 0.05, 0.08, 'triangle');
        break;
      case 'deal':
        for (let i = 0; i < 4; i++) this.burst(ctx, t + i * 0.07, 0.06, 0.25, 1500 + i * 150, 0.9);
        break;
      case 'sweep':
        // Cards gathered off the table: a rising whoosh.
        this.burst(ctx, t, 0.28, 0.3, 500, 0.6, 2600);
        break;
      case 'bid':
        this.tone(ctx, 520, t, 0.09, 0.18, 'square');
        break;
      case 'turn':
        this.tone(ctx, 880, t, 0.16, 0.12, 'triangle');
        break;
      case 'trump':
        // Trump called: a bright two-note chime.
        this.tone(ctx, 660, t, 0.35, 0.22);
        this.tone(ctx, 990, t + 0.12, 0.45, 0.22);
        break;
      case 'win': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.tone(ctx, f, t + i * 0.13, 0.32, 0.2, 'triangle'));
        break;
      }
      case 'lose':
        this.tone(ctx, 392, t, 0.3, 0.18, 'sawtooth', 330);
        this.tone(ctx, 261.6, t + 0.25, 0.5, 0.18, 'sawtooth', 220);
        break;
    }
  }
}

export const sounds = new SoundPlayer();

// Unlock the audio context on the first gesture anywhere in the page.
if (typeof window !== 'undefined') {
  const unlock = () => sounds.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}
