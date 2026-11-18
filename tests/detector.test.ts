import { describe, test, expect } from 'vitest';
import { NoteDetector } from '../src/lib/listen/detector';

const SR = 48000;
const N = 8192;
const HOP = 800; // 60 frames per second

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** Spectrum in dB, like AnalyserNode.getFloatFrequencyData (Blackman window, 1/N scaling). */
function spectrumAt(signal: (t: number) => number, tEnd: number): Float32Array {
  const re = new Float64Array(N), im = new Float64Array(N);
  const end = Math.round(tEnd * SR);
  for (let i = 0; i < N; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N);
    re[i] = signal((end - N + i) / SR) * w;
  }
  fft(re, im);
  const out = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) out[k] = 20 * Math.log10(Math.max(Math.hypot(re[k], im[k]) / N, 1e-12));
  return out;
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const HARM = [1, 0.5, 0.33, 0.25, 0.2, 0.17, 0.14, 0.125];
/** Piano-ish tone: harmonics with exponential decay (tau seconds; Infinity = sustained). */
const tone = (midi: number, t0: number, tau = 1.5, amp = 0.1) => (t: number) => {
  if (t < t0) return 0;
  const env = Math.exp(-(t - t0) / tau);
  const f = freq(midi);
  let s = 0;
  HARM.forEach((a, h) => (s += a * Math.sin(2 * Math.PI * f * (h + 1) * (t - t0))));
  return amp * env * s;
};
const mix = (...fs: ((t: number) => number)[]) => (t: number) => fs.reduce((s, f) => s + f(t), 0);

function listen(signal: (t: number) => number, seconds: number) {
  const det = new NoteDetector(SR, N);
  const onsets: { midi: number; t: number }[] = [];
  for (let k = 1; k * HOP <= seconds * SR; k++) {
    const t = (k * HOP) / SR;
    if (t * SR < N) continue; // wait until the analysis window is full of (silent) history
    for (const midi of det.process(spectrumAt(signal, t), t * 1000)) onsets.push({ midi, t });
  }
  return onsets;
}

describe('NoteDetector', () => {
  test('a single A4 produces one onset of 69 and nothing else', () => {
    const on = listen(tone(69, 0.4), 1.1);
    expect(on.map((o) => o.midi)).toEqual([69]);
    expect(on[0].t).toBeGreaterThan(0.4);
    expect(on[0].t).toBeLessThan(0.55);
  });

  test('a C major chord yields C4, E4 and G4 without semitone neighbours', () => {
    const on = listen(mix(tone(60, 0.4), tone(64, 0.4), tone(67, 0.4)), 1.0).map((o) => o.midi);
    expect(on).toEqual(expect.arrayContaining([60, 64, 67]));
    for (const bad of [59, 61, 62, 63, 65, 66, 68]) expect(on).not.toContain(bad);
  });

  test('silence and quiet white noise give no onsets', () => {
    expect(listen(() => 0, 1)).toEqual([]);
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    expect(listen(() => 0.0017 * rand(), 1)).toEqual([]);
  });

  test('the same note struck again after it decays gives a second onset', () => {
    const on = listen(mix(tone(69, 0.4, 0.3), tone(69, 1.3, 0.3)), 1.8);
    expect(on.filter((o) => o.midi === 69)).toHaveLength(2);
  });

  test('a long sustained tone gives exactly one onset', () => {
    const on = listen(tone(64, 0.4, Infinity), 2.4);
    expect(on.map((o) => o.midi)).toEqual([64]);
  });

  test('low notes are found through their harmonics', () => {
    const on = listen(tone(45, 0.4), 1.1).map((o) => o.midi); // A2
    expect(on).toContain(45);
  });

  test('an octave struck together (A2 + A3) reports both notes', () => {
    const on = listen(mix(tone(45, 0.4), tone(57, 0.4)), 1.0).map((o) => o.midi);
    expect(on).toEqual(expect.arrayContaining([45, 57]));
  });

  test('level() reports input loudness between 0 and 1', () => {
    const det = new NoteDetector(SR, N);
    det.process(spectrumAt(() => 0, 0.5), 500);
    const quiet = det.level();
    det.process(spectrumAt(tone(69, 0, Infinity), 0.5), 516);
    expect(det.level()).toBeGreaterThan(quiet);
    expect(det.level()).toBeLessThanOrEqual(1);
    expect(quiet).toBeGreaterThanOrEqual(0);
  });
});

/** A held piano key: decays while held, then the damper stops it quickly at release. */
const keyPress = (midi: number, t0: number, held: number) => (t: number) => {
  if (t < t0) return 0;
  const f = freq(midi);
  const dt = t - t0;
  const env = Math.exp(-dt / 1.5) * (dt > held ? Math.exp(-(dt - held) / 0.04) : 1);
  if (env < 1e-4) return 0;
  let s = 0;
  HARM.forEach((a, h) => (s += a * Math.sin(2 * Math.PI * f * (h + 1) * dt)));
  return 0.1 * env * s;
};

/** Learn-mode simulation: the detector is told which note comes next, like the player does. */
function learnSequence(seq: number[], beat: number) {
  const signal = mix(...seq.map((m, i) => keyPress(m, 0.4 + i * beat, beat * 0.85)));
  const det = new NoteDetector(SR, N);
  const heard: number[] = [];
  let next = 0;
  const seconds = 0.4 + seq.length * beat + 0.3;
  for (let k = 1; k * HOP <= seconds * SR; k++) {
    const t = (k * HOP) / SR;
    if (t * SR < N) continue;
    const expected = next < seq.length ? new Set([seq[next]]) : new Set<number>();
    for (const m of det.process(spectrumAt(signal, t), t * 1000, expected)) {
      if (m === seq[next]) { heard.push(m); next++; }
    }
  }
  return heard;
}

describe('NoteDetector with expected notes (template matching)', () => {
  test('Ode to Joy at 100 bpm is heard note for note, including repeated notes', () => {
    const seq = [64, 64, 65, 67, 67, 65, 64, 62];
    expect(learnSequence(seq, 0.6)).toEqual(seq);
  });

  test('a low semitone step E4 → F4 is heard', () => {
    expect(learnSequence([64, 65, 64, 65], 0.6)).toEqual([64, 65, 64, 65]);
  });

  test('Für Elise opening (fast semitone trill) is heard', () => {
    const seq = [76, 75, 76, 75, 76, 71, 74, 72, 69];
    expect(learnSequence(seq, 0.3)).toEqual(seq);
  });

  test('an expected note is not reported while silent', () => {
    const det = new NoteDetector(SR, N);
    let got: number[] = [];
    for (let k = 12; k < 60; k++) got = got.concat(det.process(spectrumAt(() => 0, (k * HOP) / SR), (k * HOP) / SR * 1000, new Set([60])));
    expect(got).toEqual([]);
  });
});
