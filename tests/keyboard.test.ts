import { describe, test, expect } from 'vitest';
import { layoutKeys, hitTest, BLACK_HEIGHT } from '../src/lib/game/keyboard';
import { KeyInput } from '../src/lib/game/keyinput';

describe('layoutKeys', () => {
  const keys = layoutKeys(60, 71, 700); // C4..B4

  test('one octave has 7 white and 5 black keys of equal white width', () => {
    expect(keys.filter((k) => !k.black)).toHaveLength(7);
    expect(keys.filter((k) => k.black)).toHaveLength(5);
    for (const k of keys.filter((k) => !k.black)) expect(k.w).toBeCloseTo(100);
    for (const k of keys.filter((k) => k.black)) expect(k.w).toBeCloseTo(60);
  });

  test('C#4 sits over the boundary between C4 and D4', () => {
    const cs = keys.find((k) => k.midi === 61)!;
    expect(cs.x).toBeLessThan(100);
    expect(cs.x + cs.w).toBeGreaterThan(100);
  });

  test('white keys tile the full width', () => {
    const whites = keys.filter((k) => !k.black);
    expect(whites[0].x).toBe(0);
    expect(whites[6].x + whites[6].w).toBeCloseTo(700);
  });
});

describe('hitTest', () => {
  const keys = layoutKeys(60, 71, 700);
  const H = 200;

  test('the top part of a black key wins', () => {
    expect(hitTest(keys, 100, 10, H)).toBe(61);
  });

  test('below the black keys, the white key underneath is hit', () => {
    expect(hitTest(keys, 95, H * BLACK_HEIGHT + 5, H)).toBe(60);
    expect(hitTest(keys, 105, H * BLACK_HEIGHT + 5, H)).toBe(62);
  });

  test('outside the keyboard is null', () => {
    expect(hitTest(keys, -5, 10, H)).toBeNull();
    expect(hitTest(keys, 705, 10, H)).toBeNull();
  });
});

describe('KeyInput', () => {
  test('two fingers on one key: the note stays on until both lift', () => {
    const k = new KeyInput();
    expect(k.down(1, 60)).toEqual({ on: 60 });
    expect(k.down(2, 60)).toEqual({});
    expect(k.up(1)).toEqual({});
    expect(k.up(2)).toEqual({ off: 60 });
  });

  test('sliding from C4 to D4 releases C4 and presses D4', () => {
    const k = new KeyInput();
    k.down(1, 60);
    expect(k.move(1, 62)).toEqual({ off: 60, on: 62 });
    expect(k.move(1, 62)).toEqual({});
  });

  test('sliding off the keyboard releases the note', () => {
    const k = new KeyInput();
    k.down(1, 60);
    expect(k.move(1, null)).toEqual({ off: 60 });
    expect(k.up(1)).toEqual({});
  });

  test('cancelAll releases every held note exactly once', () => {
    const k = new KeyInput();
    k.down(1, 60);
    k.down(2, 60);
    k.down(3, 64);
    expect(k.cancelAll().sort()).toEqual([60, 64]);
    expect(k.cancelAll()).toEqual([]);
    expect(k.up(1)).toEqual({});
  });

  test('a move for an unknown pointer is ignored', () => {
    expect(new KeyInput().move(9, 60)).toEqual({});
  });
});
