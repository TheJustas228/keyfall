import { describe, test, expect } from 'vitest';
import { Session } from '../src/lib/game/session';
import { prepare } from '../src/lib/game/prepare';
import type { Note, Song } from '../src/lib/music/types';

const n = (midi: number, start: number, hand: 'R' | 'L' = 'R', dur = 0.4): Note => ({ midi, start, dur, hand, vel: 0.7 });
const song = (notes: Note[]): Song => ({
  id: 's', title: 'S', composer: 'C', difficulty: 1, notes, duration: 10, art: { emoji: '', from: '', to: '' }, source: 'builtin',
});
const prep = (notes: Note[]) => prepare(song(notes), { R: 'full', L: 'off' });
/** advance the session by `sec` real seconds in 1/60 s frames */
const run = (s: Session, sec: number) => {
  for (let t = 0; t < sec - 1e-9; t += 1 / 60) s.update(1 / 60);
};

describe('Session learn mode', () => {
  test('waits at the first step and resumes after the right key', () => {
    const s = new Session(prep([n(60, 1), n(62, 2)]), 'learn', 1, { leadIn: 0 });
    run(s, 3);
    expect(s.waiting).toBe(true);
    expect(s.clock).toBeLessThan(1);
    expect(s.clock).toBeGreaterThan(0.99);
    expect([...s.pendingMidis()]).toEqual([60]);
    expect(s.press(60)).toBe('perfect');
    run(s, 0.5);
    expect(s.waiting).toBe(false);
    expect(s.clock).toBeGreaterThan(1.4);
  });

  test('a wrong key is judged wrong and does not resume', () => {
    const s = new Session(prep([n(60, 1)]), 'learn', 1, { leadIn: 0 });
    run(s, 2);
    expect(s.press(61)).toBe('wrong');
    run(s, 1);
    expect(s.waiting).toBe(true);
    expect(s.stats.wrong).toBe(1);
  });

  test('a chord needs every key, pressed in any order', () => {
    const s = new Session(prep([n(60, 1), n(64, 1), n(67, 1)]), 'learn', 1, { leadIn: 0 });
    run(s, 2);
    s.press(67);
    s.press(60);
    run(s, 0.5);
    expect(s.waiting).toBe(true);
    expect([...s.pendingMidis()]).toEqual([64]);
    s.press(64);
    run(s, 0.5);
    expect(s.waiting).toBe(false);
  });

  test('an early press within 250 ms counts and the session never stops', () => {
    const s = new Session(prep([n(60, 1), n(62, 3)]), 'learn', 1, { leadIn: 0 });
    run(s, 0.8); // clock 0.8, 200 ms early
    expect(s.press(60)).toBe('perfect');
    run(s, 0.5);
    expect(s.waiting).toBe(false);
    expect(s.clock).toBeGreaterThan(1.25);
  });

  test('a press far too early is wrong', () => {
    const s = new Session(prep([n(60, 2)]), 'learn', 1, { leadIn: 0 });
    run(s, 0.5);
    expect(s.press(60)).toBe('wrong');
  });

  test('accuracy is correct / (correct + wrong) and stars follow thresholds', () => {
    const s = new Session(prep([n(60, 1), n(62, 2), n(64, 3), n(65, 4)]), 'learn', 1, { leadIn: 0 });
    for (const m of [60, 62, 64, 65]) {
      run(s, 1.2);
      s.press(m);
    }
    expect(s.stats.accuracy()).toBe(1);
    expect(s.stats.stars()).toBe(3);
  });

  test('autoHorizon never passes the pending step', () => {
    const p = prepare(song([n(60, 1), n(48, 1, 'L'), n(50, 1.5, 'L')]), { R: 'full', L: 'off' });
    const s = new Session(p, 'learn', 1, { leadIn: 0 });
    run(s, 0.9);
    expect(s.autoHorizon(0.15)).toBeLessThan(1);
    run(s, 2);
    expect(s.autoHorizon(0.15)).toBeLessThan(1);
    s.press(60);
    expect(s.autoHorizon(0.15)).toBeGreaterThan(1);
  });

  test('finishes after the last note ends', () => {
    const s = new Session(prep([n(60, 0.5)]), 'learn', 1, { leadIn: 0 });
    run(s, 1);
    s.press(60);
    run(s, 3);
    expect(s.finished).toBe(true);
  });
});

describe('Session play mode', () => {
  test('timing judgments: +50 ms perfect, +120 ms good, unpressed becomes miss', () => {
    const s = new Session(prep([n(60, 1), n(62, 2), n(64, 3)]), 'play', 1, { leadIn: 0 });
    s.update(0.1); // can't jump more than 0.1 s per update
    run(s, 0.95 - 0.1);
    s.update(0.1); // clock ≈ 1.05
    expect(s.press(60)).toBe('perfect');
    run(s, 1.07);   // clock ≈ 2.12
    expect(s.press(62)).toBe('good');
    run(s, 1.3);    // past note 3 + window
    expect(s.stats.miss).toBe(1);
    expect(s.stats.perfect).toBe(1);
    expect(s.stats.good).toBe(1);
    expect(s.stats.accuracy()).toBeCloseTo((1 + 0.6) / 3);
  });

  test('a key with no note nearby is wrong and breaks nothing else', () => {
    const s = new Session(prep([n(60, 1)]), 'play', 1, { leadIn: 0 });
    run(s, 1);
    expect(s.press(70)).toBe('wrong');
    expect(s.press(60)).toBe('perfect');
  });

  test('at half speed the song-time window halves (real-time windows stay the same)', () => {
    const s = new Session(prep([n(60, 1)]), 'play', 0.5, { leadIn: 0 });
    run(s, 2.2); // clock = 1.1 → real error = 0.1/0.5 = 200 ms → outside 160 ms
    expect(s.press(60)).toBe('wrong');
    const s2 = new Session(prep([n(60, 1)]), 'play', 0.5, { leadIn: 0 });
    run(s2, 2.06); // clock 1.03 → 60 ms real
    expect(s2.press(60)).toBe('perfect');
  });

  test('combo counts consecutive hits and resets on a miss', () => {
    const s = new Session(prep([n(60, 1), n(62, 2), n(64, 3), n(65, 4)]), 'play', 1, { leadIn: 0 });
    run(s, 1); s.press(60);
    run(s, 1); s.press(62);
    expect(s.stats.combo).toBe(2);
    run(s, 1.5); // miss 64
    expect(s.stats.combo).toBe(0);
    expect(s.stats.bestCombo).toBe(2);
  });
});

describe('Session robustness', () => {
  test('a huge dt (app was backgrounded) advances at most 0.1 s × speed', () => {
    const s = new Session(prep([n(60, 10)]), 'play', 1, { leadIn: 0 });
    s.update(5);
    expect(s.clock).toBeCloseTo(0.1);
  });

  test('lead-in starts the clock before the first note', () => {
    const s = new Session(prep([n(60, 1)]), 'watch', 1, { leadIn: 2 });
    expect(s.clock).toBeCloseTo(-1);
  });

  test('seek in learn mode resets the step index and judgments after t', () => {
    const s = new Session(prep([n(60, 1), n(62, 2), n(64, 3)]), 'learn', 1, { leadIn: 0 });
    run(s, 1.2); s.press(60);
    run(s, 1); s.press(62);
    s.seek(0.5);
    expect(s.clock).toBe(0.5);
    expect(s.stepIndex).toBe(0);
    expect(s.judgmentOf(s.prepared.required[0])).toBeUndefined();
    run(s, 1);
    expect(s.waiting).toBe(true);
    expect([...s.pendingMidis()]).toEqual([60]);
  });

  test('seek in play mode clears later judgments and recounts stats', () => {
    const s = new Session(prep([n(60, 1), n(62, 2)]), 'play', 1, { leadIn: 0 });
    run(s, 1); s.press(60);
    run(s, 1.5); // 62 missed
    expect(s.stats.miss).toBe(1);
    s.seek(1.5);
    expect(s.stats.miss).toBe(0);
    expect(s.stats.perfect).toBe(1);
  });

  test('loop jumps back to A when the clock reaches B', () => {
    const s = new Session(prep([n(60, 1), n(62, 5)]), 'watch', 1, { leadIn: 0 });
    s.setLoop(2, 3);
    run(s, 3.5);
    expect(s.clock).toBeGreaterThanOrEqual(2);
    expect(s.clock).toBeLessThan(3);
    expect(s.loopCount).toBe(1);
  });

  test('watch mode: presses are free (null) and the song still finishes', () => {
    const s = new Session(prep([n(60, 0.2)]), 'watch', 1, { leadIn: 0 });
    expect(s.press(60)).toBeNull();
    run(s, 2);
    expect(s.finished).toBe(true);
  });
});
