import { isWhite } from './prepare';

export interface Key {
  midi: number;
  black: boolean;
  x: number;
  w: number;
}

/** Fraction of the keyboard height covered by black keys. */
export const BLACK_HEIGHT = 0.62;
const BLACK_WIDTH = 0.6;
// Nudge black keys off-centre like a real piano (fraction of a white key).
const BLACK_OFFSET: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };

/** Lay out keys lo..hi (both should be white) across `width`; black keys come last so they draw on top. */
export function layoutKeys(lo: number, hi: number, width: number): Key[] {
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (isWhite(m)) whites++;
  const ww = width / Math.max(1, whites);
  const white: Key[] = [];
  const black: Key[] = [];
  let i = 0;
  for (let m = lo; m <= hi; m++) {
    if (isWhite(m)) {
      white.push({ midi: m, black: false, x: i * ww, w: ww });
      i++;
    } else {
      const bw = ww * BLACK_WIDTH;
      const boundary = i * ww;
      black.push({ midi: m, black: true, x: boundary - bw / 2 + BLACK_OFFSET[m % 12] * ww, w: bw });
    }
  }
  return [...white, ...black];
}

export function hitTest(keys: Key[], x: number, y: number, keyH: number): number | null {
  if (y < keyH * BLACK_HEIGHT) {
    for (const k of keys) if (k.black && x >= k.x && x < k.x + k.w) return k.midi;
  }
  for (const k of keys) if (!k.black && x >= k.x && x < k.x + k.w) return k.midi;
  return null;
}
