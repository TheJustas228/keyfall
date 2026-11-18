import { describe, test, expect } from 'vitest';
import { parseNotation } from '../src/lib/music/notation';
import { EASY_SONGS } from '../src/lib/songs/easy';

const end = (notes: { start: number; dur: number }[]) => notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);

describe('EASY_SONGS', () => {
  test('has songs with unique kebab-case ids', () => {
    expect(EASY_SONGS.length).toBeGreaterThan(0);
    const ids = EASY_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  describe.each(EASY_SONGS.map((s) => [s.id, s] as const))('%s', (_id, song) => {
    test('parses without throwing', () => {
      expect(() => parseNotation(song)).not.toThrow();
    });

    test('both hands have notes and end together', () => {
      const notes = parseNotation(song);
      const right = notes.filter((n) => n.hand === 'R');
      const left = notes.filter((n) => n.hand === 'L');
      expect(right.length).toBeGreaterThan(0);
      expect(left.length).toBeGreaterThan(0);
      expect(end(left)).toBeCloseTo(end(right), 6);
    });

    test('every note is within midi 36..96', () => {
      for (const n of parseNotation(song)) {
        expect(n.midi).toBeGreaterThanOrEqual(36);
        expect(n.midi).toBeLessThanOrEqual(96);
      }
    });

    test('total duration is between 20 and 150 seconds', () => {
      const total = end(parseNotation(song));
      expect(total).toBeGreaterThanOrEqual(20);
      expect(total).toBeLessThanOrEqual(150);
    });

    test('has library metadata', () => {
      expect(song.title).toBeTruthy();
      expect(song.composer).toBeTruthy();
      expect(song.art.emoji).toBeTruthy();
      expect(song.art.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(song.art.to).toMatch(/^#[0-9a-f]{6}$/i);
      expect(song.bpm).toBeGreaterThanOrEqual(60);
      expect(song.bpm).toBeLessThanOrEqual(110);
    });
  });
});
