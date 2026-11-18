/**
 * Detects piano note onsets from magnitude spectra (dB, as produced by
 * AnalyserNode.getFloatFrequencyData). For each piano key it sums the energy at
 * the fundamental and three harmonics, then reports an onset when that energy
 * jumps well above its recent level, is loud enough, beats its semitone
 * neighbours, and is not just a harmonic of a stronger lower note.
 */
const LO = 21;
const HI = 108;
const WEIGHTS = [1, 0.7, 0.5, 0.35];
const RISE = 2.2; // energy must exceed this × its recent minimum
const BASELINE_RATIO = 4;
const TAU_MS = 400;
const REFRACTORY_MS = 120;
const CONFIRM_MIN_MS = 45; // wait for a sharper spectrum before trusting a rise
const CONFIRM_MIN_EXPECTED_MS = 28; // expected notes have the pitch-centre test, so they can confirm sooner
const CONFIRM_MAX_MS = 160;
const EXPECTED_RISE = 1.5;
const EXPECTED_NEIGHBOUR = 0.35; // loose sanity check; the pitch-centre test does the real work
const CENTRE_CENTS = 35; // an expected note's spectral peak must sit this close to its pitch
const NOISE_RATIO = 3.5; // a note must stand this far above its own noise floor
const NOISE_RISE_MS = 2500; // how slowly the noise floor follows rising levels
const HISTORY_MS = 90;
const REL_FLOOR = 0.08; // fraction of the loudest note this frame
const HARMONIC_OF = [12, 19, 24, 28, 31, 34, 36]; // n is the 2nd..8th harmonic of n - k
const FUNDAMENTAL_SHARE = 0.12; // own fundamental (or 2nd harmonic for very low notes) vs strongest partial

export class NoteDetector {
  private binHz: number;
  private bins: { lo: number; hi: number }[][] = []; // per note, per harmonic
  private energy = new Float64Array(HI + 1);
  private grounded = new Uint8Array(HI + 1); // 1 when the note's own fundamental is present
  private baseline = new Float64Array(HI + 1);
  private lastOnset = new Float64Array(HI + 1).fill(-1e9);
  private candidateSince = new Float64Array(HI + 1).fill(-1e9);
  private history: { t: number; e: Float64Array }[] = [];
  private lastT = -1;
  private lvl = 0;
  private floorLin: number;
  private noise = new Float64Array(HI + 1).fill(-1); // per-note adaptive noise floor

  constructor(sampleRate: number, fftSize: number, opts: { sensitivity?: number } = {}) {
    this.binHz = sampleRate / fftSize;
    const nyquistBin = fftSize / 2 - 1;
    for (let m = 0; m <= HI; m++) {
      const f0 = 440 * 2 ** ((m - 69) / 12);
      this.bins[m] = WEIGHTS.map((_, h) => {
        const f = f0 * (h + 1);
        const tol = Math.max(this.binHz, f * 0.03);
        return {
          lo: Math.max(1, Math.floor((f - tol) / this.binHz)),
          hi: Math.min(nyquistBin, Math.ceil((f + tol) / this.binHz)),
        };
      });
    }
    const s = Math.min(1, Math.max(0, opts.sensitivity ?? 0.5));
    this.floorLin = 10 ** ((-92 + (0.5 - s) * 30) / 20);
  }

  level(): number {
    return this.lvl;
  }

  /**
   * `expected` are the notes the player is waiting for. They are confirmed with
   * relaxed rules (template matching), which catches repeated notes and close
   * semitone steps that open-ended detection misses.
   */
  process(magDb: Float32Array, timeMs: number, expected?: Set<number>): number[] {
    const dt = this.lastT < 0 ? 16 : Math.max(1, timeMs - this.lastT);
    this.lastT = timeMs;
    const lin = (k: number) => 10 ** (magDb[k] / 20);

    let maxDb = -200;
    for (let k = 1; k < magDb.length; k++) if (magDb[k] > maxDb) maxDb = magDb[k];
    this.lvl = Math.min(1, Math.max(0, (maxDb + 90) / 60));

    const e = this.energy;
    let frameMax = 0;
    for (let m = LO; m <= HI; m++) {
      let sum = 0;
      let strongest = 0;
      const peaks = [0, 0, 0, 0];
      const bins = this.bins[m];
      for (let h = 0; h < WEIGHTS.length; h++) {
        const { lo, hi } = bins[h];
        if (lo > hi) continue;
        let peak = 0;
        for (let k = lo; k <= hi; k++) {
          const v = lin(k);
          if (v > peak) peak = v;
        }
        peaks[h] = peak;
        strongest = Math.max(strongest, peak);
        sum += WEIGHTS[h] * peak;
      }
      // Phone mics barely pick up the lowest fundamentals, so very low notes may lean on the 2nd harmonic.
      const own = m < 40 ? Math.max(peaks[0], peaks[1]) : peaks[0];
      this.grounded[m] = own >= FUNDAMENTAL_SHARE * strongest ? 1 : 0;
      e[m] = sum;
      if (sum > frameMax) frameMax = sum;
    }

    // recent minimum per note (for the rise test)
    this.history = this.history.filter((h) => timeMs - h.t <= HISTORY_MS);
    const onsets: number[] = [];
    for (let m = LO; m <= HI; m++) {
      const v = e[m];
      let recentMin = v;
      for (const h of this.history) recentMin = Math.min(recentMin, h.e[m]);
      const exp = expected?.has(m) ?? false;
      const floor = Math.max(this.floorLin, this.noise[m] * NOISE_RATIO);
      const loudEnough = v >= floor && (exp || v >= REL_FLOOR * frameMax);
      const rising = exp ? v > EXPECTED_RISE * recentMin : v > RISE * recentMin && v > BASELINE_RATIO * this.baseline[m];
      const free = timeMs - this.lastOnset[m] >= REFRACTORY_MS;
      if (rising && loudEnough && free && timeMs - this.candidateSince[m] > CONFIRM_MAX_MS) this.candidateSince[m] = timeMs;
      const age = timeMs - this.candidateSince[m];
      if (age < (exp ? CONFIRM_MIN_EXPECTED_MS : CONFIRM_MIN_MS) || age > CONFIRM_MAX_MS || !free) continue;
      const neighbour = Math.max(e[m - 1], m === HI ? 0 : e[m + 1]);
      const localMax = exp ? v >= EXPECTED_NEIGHBOUR * neighbour && this.centred(magDb, m) : v >= neighbour;
      if (loudEnough && localMax && this.grounded[m] && (exp || !this.isHarmonic(m))) {
        onsets.push(m);
        this.lastOnset[m] = timeMs;
        this.candidateSince[m] = -1e9;
      }
    }

    // update baselines (slow rise, fast fall) and the much slower noise floors
    const a = Math.min(1, dt / TAU_MS);
    const an = Math.min(1, dt / NOISE_RISE_MS);
    for (let m = LO; m <= HI; m++) {
      const b = this.baseline[m];
      this.baseline[m] = e[m] > b ? b + a * (e[m] - b) : 0.5 * (b + e[m]);
      const nf = this.noise[m];
      this.noise[m] = nf < 0 ? e[m] : e[m] < nf ? 0.7 * nf + 0.3 * e[m] : nf + an * (e[m] - nf);
    }
    this.history.push({ t: timeMs, e: Float64Array.from(e) });
    return onsets;
  }

  /**
   * True when the spectral peak around note m's fundamental (or 2nd/3rd harmonic for low
   * notes) sits on m's pitch. Energy leaking in from a neighbouring note peaks at the
   * edge of the window instead, so a played E4 is never mistaken for an expected F4.
   */
  private centred(magDb: Float32Array, m: number): boolean {
    const f0 = 440 * 2 ** ((m - 69) / 12);
    const partials = m < 48 ? 3 : 2;
    let strongest = -Infinity;
    for (let h = 1; h <= partials; h++) {
      const kc = Math.round((f0 * h) / this.binHz);
      if (kc + 2 < magDb.length) strongest = Math.max(strongest, magDb[kc]);
    }
    for (let h = 1; h <= partials; h++) {
      const f = f0 * h;
      const kc = Math.round(f / this.binHz);
      const kLo = Math.max(1, Math.min(Math.floor((f * 2 ** (-0.6 / 12)) / this.binHz), kc - 2));
      const kHi = Math.min(magDb.length - 2, Math.max(Math.ceil((f * 2 ** (0.6 / 12)) / this.binHz), kc + 2));
      let k = kLo;
      for (let i = kLo + 1; i <= kHi; i++) if (magDb[i] > magDb[k]) k = i;
      if (k === kLo || k === kHi) continue; // peak belongs to a neighbour
      if (magDb[k] < strongest - 14) continue; // too weak to count
      const [a, b, c] = [magDb[k - 1], magDb[k], magDb[k + 1]];
      const den = a - 2 * b + c;
      const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
      const fPeak = (k + delta) * this.binHz;
      const cents = Math.abs(1200 * Math.log2(fPeak / f));
      const tol = Math.max(CENTRE_CENTS, 1200 * Math.log2((f + 0.45 * this.binHz) / f));
      if (cents <= tol) return true;
    }
    return false;
  }

  /** True when note m is better explained as a harmonic of a stronger lower note. */
  private isHarmonic(m: number): boolean {
    const e = this.energy;
    for (const k of HARMONIC_OF) {
      const root = m - k;
      if (root >= LO && e[root] >= 1.4 * e[m]) return true;
    }
    return false;
  }
}
