import type { Note } from '../music/types';

/**
 * Hands out auto-played notes (sorted by start) exactly once as the song's
 * scheduling horizon moves forward. Whenever the session's epoch changes (a
 * seek or a loop wrap), it restarts from the current clock instead of
 * replaying or skipping a whole section.
 */
export class AutoScheduler {
  private idx = 0;
  private epoch = Number.NaN;

  constructor(private readonly notes: Note[]) {}

  reset(clock: number): void {
    let lo = 0;
    let hi = this.notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.notes[mid].start < clock) lo = mid + 1;
      else hi = mid;
    }
    this.idx = lo;
  }

  due(horizon: number, clock: number, epoch: number): Note[] {
    if (epoch !== this.epoch) {
      this.epoch = epoch;
      this.reset(clock);
    }
    const out: Note[] = [];
    while (this.idx < this.notes.length && this.notes[this.idx].start <= horizon) {
      const n = this.notes[this.idx++];
      if (n.start >= clock - 0.05) out.push(n);
    }
    return out;
  }
}
