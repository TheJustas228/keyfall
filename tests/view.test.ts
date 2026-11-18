import { describe, test, expect } from 'vitest';
import { whiteIndexOf, fitView, panView, zoomView, viewKeys, MIN_WHITES, WHITE_TOTAL } from '../src/lib/game/view';
import { hitTest } from '../src/lib/game/keyboard';

describe('keyboard view window', () => {
  test('white key indices run from A0 = 0 to C8 = 51', () => {
    expect(whiteIndexOf(21)).toBe(0);
    expect(whiteIndexOf(24)).toBe(2);
    expect(whiteIndexOf(60)).toBe(23);
    expect(whiteIndexOf(108)).toBe(51);
    expect(WHITE_TOTAL).toBe(52);
  });

  test('fitView covers exactly the song range', () => {
    expect(fitView(60, 71)).toEqual({ first: 23, count: 7 });
  });

  test('panning is clamped to the 88-key piano', () => {
    expect(panView({ first: 23, count: 7 }, -100)).toEqual({ first: 0, count: 7 });
    expect(panView({ first: 23, count: 7 }, 100)).toEqual({ first: WHITE_TOTAL - 7, count: 7 });
    expect(panView({ first: 23, count: 7 }, 2.5).first).toBeCloseTo(25.5);
  });

  test('zooming keeps the point under the fingers in place', () => {
    const v = zoomView({ first: 20, count: 16 }, 2, 0.5); // zoom in around the middle
    expect(v.count).toBe(8);
    expect(v.first).toBe(24);
  });

  test('zoom is clamped between a few keys and the whole piano', () => {
    expect(zoomView({ first: 20, count: 14 }, 10, 0.5).count).toBe(MIN_WHITES);
    expect(zoomView({ first: 20, count: 14 }, 0.01, 0.5)).toEqual({ first: 0, count: WHITE_TOTAL });
  });

  test('viewKeys lays out the visible keys with the view offset', () => {
    const keys = viewKeys({ first: 23, count: 7 }, 700);
    const c4 = keys.find((k) => k.midi === 60)!;
    expect(c4.x).toBeCloseTo(0);
    expect(c4.w).toBeCloseTo(100);
    expect(keys.find((k) => k.midi === 71)!.x).toBeCloseTo(600);
    expect(keys.some((k) => k.midi === 50)).toBe(false); // far off screen
    expect(hitTest(keys, 50, 190, 200)).toBe(60);
  });

  test('a half-scrolled view shows partial keys at the edges', () => {
    const keys = viewKeys({ first: 22.5, count: 7 }, 700);
    expect(keys.some((k) => k.midi === 59)).toBe(true); // B3 half visible on the left
    expect(keys.find((k) => k.midi === 60)!.x).toBeCloseTo(50);
  });
});
