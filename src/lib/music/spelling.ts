import type { Note } from './types';

// Krumhansl–Kessler key profiles
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]); // d g c f bb eb

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Guess the song's key and say whether its accidentals are written as flats. */
export function preferFlats(notes: Note[]): boolean {
  if (!notes.length) return false;
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[n.midi % 12] += n.dur;
  let best = { score: -Infinity, flats: false };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = hist.map((_, i) => hist[(i + tonic) % 12]);
    const maj = correlation(rot, MAJOR);
    const min = correlation(rot, MINOR);
    if (maj > best.score) best = { score: maj, flats: FLAT_MAJOR.has(tonic) };
    if (min > best.score) best = { score: min, flats: FLAT_MINOR.has(tonic) };
  }
  return best.flats;
}
