import { describe, test, expect } from 'vitest';
import { prepare, isWhite } from '../src/lib/game/prepare';
import type { Note, Song } from '../src/lib/music/types';

const n = (midi: number, start: number, hand: 'R' | 'L' = 'R', dur = 0.5): Note => ({ midi, start, dur, hand, vel: 0.7 });
const song = (notes: Note[]): Song => ({
  id: 's', title: 'S', composer: 'C', difficulty: 1, notes, duration: 10, art: { emoji: '', from: '', to: '' }, source: 'builtin',
});

const whiteCount = (lo: number, hi: number) => {
  let c = 0;
  for (let m = lo; m <= hi; m++) if (isWhite(m)) c++;
  return c;
};

describe('prepare', () => {
  test('easy right hand keeps the top note of a chord, the rest is auto-played', () => {
    const p = prepare(song([n(60, 0), n(64, 0.01), n(67, 0.02)]), { R: 'easy', L: 'full' });
    expect(p.required.map((x) => x.midi)).toEqual([67]);
    expect(p.auto.map((x) => x.midi).sort()).toEqual([60, 64]);
  });

  test('easy left hand keeps the lowest note of a chord', () => {
    const p = prepare(song([n(45, 0, 'L'), n(52, 0, 'L'), n(57, 0, 'L')]), { R: 'full', L: 'easy' });
    expect(p.required.map((x) => x.midi)).toEqual([45]);
    expect(p.auto).toHaveLength(2);
  });

  test('off hand goes entirely to auto, full hand entirely to required', () => {
    const p = prepare(song([n(72, 0), n(48, 0, 'L'), n(74, 1)]), { R: 'full', L: 'off' });
    expect(p.required.map((x) => x.midi)).toEqual([72, 74]);
    expect(p.auto.map((x) => x.midi)).toEqual([48]);
  });

  test('both hands off: nothing required, range comes from all notes', () => {
    const p = prepare(song([n(40, 0, 'L'), n(84, 1)]), { R: 'off', L: 'off' });
    expect(p.required).toHaveLength(0);
    expect(p.lo).toBeLessThanOrEqual(40);
    expect(p.hi).toBeGreaterThanOrEqual(84);
  });

  test('steps group onsets within 30 ms and split onsets 40 ms apart', () => {
    const p = prepare(song([n(60, 1), n(64, 1.02), n(67, 1.06)]), { R: 'full', L: 'full' });
    expect(p.steps).toHaveLength(2);
    expect(p.steps[0].notes.map((x) => x.midi)).toEqual([60, 64]);
    expect(p.steps[0].time).toBe(1);
    expect(p.steps[1].notes.map((x) => x.midi)).toEqual([67]);
  });

  test('range ends on white keys and spans at least 15 white keys', () => {
    const p = prepare(song([n(61, 0), n(63, 1)]), { R: 'full', L: 'full' }); // C#4..D#4
    expect(isWhite(p.lo)).toBe(true);
    expect(isWhite(p.hi)).toBe(true);
    expect(p.lo).toBeLessThanOrEqual(61);
    expect(p.hi).toBeGreaterThanOrEqual(63);
    expect(whiteCount(p.lo, p.hi)).toBeGreaterThanOrEqual(15);
  });

  test('range never leaves the 88-key piano', () => {
    const p = prepare(song([n(21, 0), n(23, 1)]), { R: 'full', L: 'full' });
    expect(p.lo).toBeGreaterThanOrEqual(21);
    expect(whiteCount(p.lo, p.hi)).toBeGreaterThanOrEqual(15);
  });

  test('wide songs keep their full range', () => {
    const p = prepare(song([n(36, 0, 'L'), n(96, 1)]), { R: 'full', L: 'full' });
    expect(p.lo).toBe(36);
    expect(p.hi).toBe(96);
  });
});
