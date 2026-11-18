import { isWhite } from './prepare';
import { layoutKeys, type Key } from './keyboard';

/** Which part of the 88-key piano is on screen, measured in white keys from A0. */
export interface View {
  first: number; // fractional white-key index of the left edge
  count: number; // white keys across the screen
}

export const PIANO_LO = 21;
export const PIANO_HI = 108;
export const WHITE_TOTAL = 52;
export const MIN_WHITES = 8;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Index of a white key counted from A0 (a black key gets the white key below it). */
export function whiteIndexOf(midi: number): number {
  let n = -1;
  for (let m = PIANO_LO; m <= midi; m++) if (isWhite(m)) n++;
  return Math.max(0, n);
}

export function fitView(lo: number, hi: number): View {
  const first = whiteIndexOf(lo);
  return { first, count: whiteIndexOf(hi) - first + 1 };
}

export function panView(v: View, dWhites: number): View {
  return { first: clamp(v.first + dWhites, 0, WHITE_TOTAL - v.count), count: v.count };
}

/** Zoom by `factor` (>1 = closer) keeping the point at `anchor` (0..1 across the screen) fixed. */
export function zoomView(v: View, factor: number, anchor: number): View {
  const count = clamp(v.count / factor, MIN_WHITES, WHITE_TOTAL);
  const at = v.first + anchor * v.count;
  return { first: clamp(at - anchor * count, 0, WHITE_TOTAL - count), count };
}

const fullCache = new Map<number, Key[]>();
/** Keys visible in `view` for a keyboard `width` px wide, positioned relative to its left edge. */
export function viewKeys(view: View, width: number): Key[] {
  const ww = width / view.count;
  const full = WHITE_TOTAL * ww;
  let all = fullCache.get(full);
  if (!all) {
    all = layoutKeys(PIANO_LO, PIANO_HI, full);
    fullCache.clear();
    fullCache.set(full, all);
  }
  const off = view.first * ww;
  const out: Key[] = [];
  for (const k of all) {
    const x = k.x - off;
    if (x + k.w > 0 && x < width) out.push({ midi: k.midi, black: k.black, x, w: k.w });
  }
  return out;
}
