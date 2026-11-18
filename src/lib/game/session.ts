import type { Note } from '../music/types';
import type { Prepared } from './prepare';

export type Mode = 'learn' | 'play' | 'watch';
export type Judgment = 'perfect' | 'good' | 'miss' | 'wrong';

export const PERFECT_WINDOW = 0.07; // real seconds
export const GOOD_WINDOW = 0.16;
export const EARLY_WINDOW = 0.25;
const MAX_DT = 0.1;
const END_PAD = 1;
const FREEZE_EPS = 0.001;

export class Stats {
  perfect = 0;
  good = 0;
  miss = 0;
  wrong = 0;
  combo = 0;
  bestCombo = 0;
  score = 0;
  /** song times of wrong presses (for the results timeline) */
  wrongTimes: number[] = [];
  constructor(readonly mode: Mode) {}

  accuracy(): number {
    if (this.mode === 'learn') {
      const total = this.perfect + this.wrong;
      return total ? this.perfect / total : 0;
    }
    const judged = this.perfect + this.good + this.miss;
    return judged ? (this.perfect + 0.6 * this.good) / judged : 0;
  }

  stars(): 0 | 1 | 2 | 3 {
    const a = this.accuracy();
    return a >= 0.95 ? 3 : a >= 0.8 ? 2 : a >= 0.6 ? 1 : 0;
  }

  hit(j: 'perfect' | 'good') {
    this[j]++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += j === 'perfect' ? 100 + Math.min(this.combo, 20) * 5 : 50;
  }
}

export class Session {
  clock: number;
  waiting = false;
  finished = false;
  stepIndex = 0;
  stats: Stats;
  loop: { a: number; b: number } | null = null;
  loopCount = 0;
  /** increments on every seek (including loop wraps) so the player can reschedule audio */
  epoch = 0;
  /** play mode: notes before this time are never counted as missed (after a forward seek) */
  private scoreFrom = -Infinity;
  readonly lastEnd: number;
  readonly firstStart: number;

  private judgments = new Map<Note, Judgment>();
  private stepHits = new Set<number>();

  constructor(
    readonly prepared: Prepared,
    readonly mode: Mode,
    public speed: number,
    opts: { leadIn?: number } = {},
  ) {
    const all = [...prepared.required, ...prepared.auto];
    this.firstStart = all.length ? Math.min(...all.map((n) => n.start)) : 0;
    this.lastEnd = all.length ? Math.max(...all.map((n) => n.start + n.dur)) : 0;
    this.clock = Math.min(0, this.firstStart - (opts.leadIn ?? 2.5) * speed);
    this.stats = new Stats(mode);
  }

  get duration() {
    return this.lastEnd;
  }

  judgmentOf(note: Note): Judgment | undefined {
    return this.judgments.get(note);
  }

  private currentStep() {
    return this.mode === 'learn' ? this.prepared.steps[this.stepIndex] : undefined;
  }

  update(dtReal: number): void {
    if (this.finished) return;
    const dt = Math.min(Math.max(dtReal, 0), MAX_DT);
    let next = this.clock + dt * this.speed;
    const step = this.currentStep();
    this.waiting = false;
    if (step && next >= step.time - FREEZE_EPS) {
      next = Math.max(this.clock, step.time - FREEZE_EPS);
      this.waiting = true;
    }
    this.clock = next;

    if (this.mode === 'play') {
      for (const note of this.prepared.required) {
        if (note.start > this.clock) break;
        if (note.start < this.scoreFrom) continue;
        if (!this.judgments.has(note) && (this.clock - note.start) / this.speed > GOOD_WINDOW) {
          this.judgments.set(note, 'miss');
          this.stats.miss++;
          this.stats.combo = 0;
        }
      }
    }

    if (this.loop && this.clock >= this.loop.b) {
      this.loopCount++;
      this.seek(this.loop.a);
      return;
    }
    if (this.clock > this.lastEnd + END_PAD) this.finished = true;
  }

  /** `atClock` lets microphone input be judged at the moment the note was really played. */
  press(midi: number, atClock?: number): Judgment | null {
    if (this.mode === 'watch' || this.finished) return null;
    if (this.mode === 'learn') return this.pressLearn(midi);
    return this.pressPlay(midi, atClock ?? this.clock);
  }

  private pressLearn(midi: number): Judgment | null {
    const step = this.currentStep();
    const inWindow = step && this.clock >= step.time - EARLY_WINDOW * this.speed;
    if (!step || !inWindow || !step.notes.some((n) => n.midi === midi)) {
      this.stats.wrong++;
      this.stats.wrongTimes.push(this.clock);
      return 'wrong';
    }
    if (this.stepHits.has(midi)) return null;
    this.stepHits.add(midi);
    this.stats.hit('perfect');
    if (step.notes.every((n) => this.stepHits.has(n.midi))) {
      for (const n of step.notes) this.judgments.set(n, 'perfect');
      this.stepIndex++;
      this.stepHits.clear();
      this.waiting = false;
    }
    return 'perfect';
  }

  private pressPlay(midi: number, at: number): Judgment {
    let best: Note | null = null;
    let bestErr = Infinity;
    for (const note of this.prepared.required) {
      if (note.midi !== midi || this.judgments.has(note)) continue;
      const err = Math.abs(note.start - at) / this.speed;
      if (err <= GOOD_WINDOW && err < bestErr) {
        best = note;
        bestErr = err;
      }
    }
    if (!best) {
      this.stats.wrong++;
      return 'wrong';
    }
    const j = bestErr <= PERFECT_WINDOW ? 'perfect' : 'good';
    this.judgments.set(best, j);
    this.stats.hit(j);
    return j;
  }

  /** Keys the learner should press now (learn mode). */
  pendingMidis(): Set<number> {
    const step = this.currentStep();
    const out = new Set<number>();
    if (!step || this.clock < step.time - EARLY_WINDOW * this.speed) return out;
    for (const n of step.notes) if (!this.stepHits.has(n.midi)) out.add(n.midi);
    return out;
  }

  /** The furthest song time up to which auto notes can safely be scheduled. */
  autoHorizon(lookahead: number): number {
    const h = this.clock + lookahead * this.speed;
    const step = this.currentStep();
    return step ? Math.min(h, step.time - FREEZE_EPS) : h;
  }

  seek(t: number): void {
    this.clock = t;
    this.epoch++;
    this.scoreFrom = t;
    this.finished = false;
    this.waiting = false;
    this.stepHits.clear();
    const steps = this.prepared.steps;
    this.stepIndex = steps.findIndex((s) => s.time >= t);
    if (this.stepIndex < 0) this.stepIndex = steps.length;
    for (const note of [...this.judgments.keys()]) if (note.start >= t) this.judgments.delete(note);
    if (this.mode === 'play') {
      const s = this.stats;
      s.perfect = s.good = s.miss = 0;
      for (const j of this.judgments.values()) if (j !== 'wrong') s[j]++;
      s.combo = 0;
    }
  }

  setLoop(a: number | null, b: number | null): void {
    this.loop = a !== null && b !== null && b > a ? { a, b } : null;
  }

  /** Accuracy per time bucket across the song (null where nothing was judged). */
  timeline(buckets: number): (number | null)[] {
    const out: (number | null)[] = [];
    const len = this.lastEnd > 0 ? this.lastEnd / buckets : 1;
    const score = new Array(buckets).fill(0);
    const count = new Array(buckets).fill(0);
    const bucketOf = (t: number) => Math.min(buckets - 1, Math.max(0, Math.floor(t / len)));
    for (const [note, j] of this.judgments) {
      const b = bucketOf(note.start);
      count[b]++;
      score[b] += j === 'perfect' ? 1 : j === 'good' ? 0.6 : 0;
    }
    if (this.mode === 'learn') {
      for (const t of this.stats.wrongTimes) count[bucketOf(t)]++;
    }
    for (let b = 0; b < buckets; b++) out.push(count[b] ? score[b] / count[b] : null);
    return out;
  }

  progress(): number {
    return this.lastEnd > 0 ? Math.min(1, Math.max(0, this.clock / this.lastEnd)) : 0;
  }
}
