/**
 * Sampled grand piano on Web Audio. Salamander Grand Piano samples
 * (CC BY 3.0, Alexander Holm), one every minor third from A0 to C8,
 * pitch-shifted to the notes in between.
 */
const SAMPLE_NAMES = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8'];
const FIRST_SAMPLE = 21; // A0, then every 3 semitones
const MAX_VOICES = 48;

interface Voice {
  midi: number;
  src: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
  releasedAt: number | null;
  scheduled: boolean;
}

type AudioSessionType = 'auto' | 'playback' | 'play-and-record' | 'ambient' | 'transient' | 'transient-solo';

export function setAudioSession(type: AudioSessionType) {
  const s = (navigator as Navigator & { audioSession?: { type: AudioSessionType } }).audioSession;
  if (s) {
    try {
      s.type = type;
    } catch {
      /* not supported */
    }
  }
}

class Piano {
  ctx: AudioContext | null = null;
  private buffers: (AudioBuffer | null)[] = [];
  private bus!: GainNode;
  private master!: GainNode;
  private wet!: GainNode;
  private voices: Voice[] = [];
  private loading: Promise<void> | null = null;
  private volume = 0.85;
  private reverbOn = true;
  loaded = false;

  private context(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.bus = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.9);
    this.wet = ctx.createGain();
    this.wet.gain.value = this.reverbOn ? 0.16 : 0;
    this.bus.connect(comp);
    this.bus.connect(reverb).connect(this.wet).connect(comp);
    comp.connect(this.master).connect(ctx.destination);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx?.state !== 'running') this.ctx?.resume().catch(() => {});
    });
    this.ctx = ctx;
    return ctx;
  }

  /** Call from a user gesture (tap). Unlocks audio on iOS, even with the silent switch on. */
  async ensureStarted(): Promise<void> {
    setAudioSession('playback');
    const ctx = this.context();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* resumed on a later gesture */
      }
    }
    // A silent buffer kicks iOS into actually producing sound.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start();
  }

  load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.loading) return this.loading;
    const ctx = this.context();
    let done = 0;
    const base = import.meta.env.BASE_URL + 'samples/';
    this.loading = Promise.all(
      SAMPLE_NAMES.map(async (name, i) => {
        try {
          const res = await fetch(base + name + '.mp3');
          const data = await res.arrayBuffer();
          this.buffers[i] = await ctx.decodeAudioData(data);
        } catch {
          this.buffers[i] = null;
        }
        onProgress?.(++done / SAMPLE_NAMES.length);
      }),
    ).then(() => {
      this.loaded = this.buffers.some(Boolean);
    });
    return this.loading;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setReverb(on: boolean) {
    this.reverbOn = on;
    if (this.ctx) this.wet.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.05);
  }

  private pickSample(midi: number): { buf: AudioBuffer; rate: number } | null {
    let idx = Math.round((midi - FIRST_SAMPLE) / 3);
    idx = Math.max(0, Math.min(SAMPLE_NAMES.length - 1, idx));
    // fall back to the nearest loaded sample
    for (let d = 0; d < SAMPLE_NAMES.length; d++) {
      for (const j of [idx - d, idx + d]) {
        const buf = this.buffers[j];
        if (buf) return { buf, rate: 2 ** ((midi - (FIRST_SAMPLE + j * 3)) / 12) };
      }
    }
    return null;
  }

  private startVoice(midi: number, vel: number, when: number, scheduled: boolean): Voice | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const pick = this.pickSample(midi);
    if (!pick) return null;
    this.reap();
    if (this.voices.length >= MAX_VOICES) this.kill(this.voices[0], ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = pick.buf;
    src.playbackRate.value = pick.rate;
    const gain = ctx.createGain();
    const level = 0.12 + 0.88 * Math.pow(Math.min(1, Math.max(0.05, vel)), 1.4);
    const t = Math.max(when, ctx.currentTime);
    gain.gain.setValueAtTime(level, t);
    src.connect(gain).connect(this.bus);
    src.start(t);
    const v: Voice = { midi, src, gain, start: t, releasedAt: null, scheduled };
    src.onended = () => {
      const i = this.voices.indexOf(v);
      if (i >= 0) this.voices.splice(i, 1);
      gain.disconnect();
    };
    this.voices.push(v);
    return v;
  }

  private release(v: Voice, when: number) {
    if (v.releasedAt !== null) return;
    const t = Math.max(when, v.start + 0.02);
    v.releasedAt = t;
    // Higher notes are damped faster, like a real piano.
    const tau = v.midi > 84 ? 0.06 : v.midi > 60 ? 0.09 : 0.12;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, tau);
    try {
      v.src.stop(t + tau * 8);
    } catch {
      /* already stopped */
    }
  }

  private kill(v: Voice, now: number) {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setTargetAtTime(0, now, 0.01);
    try {
      v.src.stop(now + 0.05);
    } catch {
      /* already stopped */
    }
    v.releasedAt = now;
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
  }

  private reap() {
    const now = this.now();
    this.voices = this.voices.filter((v) => v.releasedAt === null || v.releasedAt + 1.5 > now);
  }

  /** Start a note now (key press). */
  noteOn(midi: number, vel = 0.75): void {
    if (!this.ctx) return;
    // re-striking a held key: release the old voice first
    for (const v of this.voices) if (v.midi === midi && v.releasedAt === null && !v.scheduled) this.release(v, this.ctx.currentTime);
    this.startVoice(midi, vel, this.ctx.currentTime, false);
  }

  noteOff(midi: number): void {
    if (!this.ctx) return;
    for (const v of this.voices) if (v.midi === midi && !v.scheduled) this.release(v, this.ctx.currentTime);
  }

  /** Schedule a whole note on the audio clock (auto-played notes). */
  schedule(midi: number, vel: number, when: number, dur: number): void {
    const v = this.startVoice(midi, vel, when, true);
    if (v) this.release(v, v.start + Math.max(0.08, dur));
  }

  /** Stop notes scheduled for the future and quickly fade auto notes that are sounding (pause/seek). */
  cancelScheduled(): void {
    const now = this.now();
    for (const v of [...this.voices]) if (v.scheduled) this.kill(v, now);
  }

  allOff(): void {
    const now = this.now();
    for (const v of [...this.voices]) this.kill(v, now);
  }
}

function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

export const piano = new Piano();
