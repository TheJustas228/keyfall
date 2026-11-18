import type { Hand, Note, Song } from '../music/types';

export type Level = 'off' | 'easy' | 'full';
export interface Step {
  time: number;
  notes: Note[];
}
export interface Prepared {
  required: Note[];
  auto: Note[];
  steps: Step[];
  lo: number;
  hi: number;
}

export const CHORD_WINDOW = 0.03;
const MIN_WHITE_KEYS = 15;
const PIANO_LO = 21;
const PIANO_HI = 108;

export function isWhite(midi: number): boolean {
  return [0, 2, 4, 5, 7, 9, 11].includes(((midi % 12) + 12) % 12);
}

/** Group notes whose onsets fall within CHORD_WINDOW of the group's first note. */
function groupOnsets(notes: Note[]): Note[][] {
  const groups: Note[][] = [];
  for (const note of [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi)) {
    const g = groups[groups.length - 1];
    if (g && note.start - g[0].start <= CHORD_WINDOW + 1e-9) g.push(note);
    else groups.push([note]);
  }
  return groups;
}

function splitHand(notes: Note[], hand: Hand, level: Level, required: Note[], auto: Note[]) {
  const mine = notes.filter((n) => n.hand === hand);
  if (level === 'off') return void auto.push(...mine);
  if (level === 'full') return void required.push(...mine);
  for (const g of groupOnsets(mine)) {
    const keep = g.reduce((best, n) => (hand === 'R' ? (n.midi > best.midi ? n : best) : n.midi < best.midi ? n : best));
    for (const n of g) (n === keep ? required : auto).push(n);
  }
}

function computeRange(notes: Note[]): { lo: number; hi: number } {
  if (!notes.length) return { lo: 48, hi: 72 };
  let lo = Math.min(...notes.map((n) => n.midi));
  let hi = Math.max(...notes.map((n) => n.midi));
  if (!isWhite(lo)) lo--;
  if (!isWhite(hi)) hi++;
  const whites = () => {
    let c = 0;
    for (let m = lo; m <= hi; m++) if (isWhite(m)) c++;
    return c;
  };
  let grow = 0;
  while (whites() < MIN_WHITE_KEYS) {
    const down = (grow++ % 2 === 0 && lo > PIANO_LO) || hi >= PIANO_HI;
    if (down) do lo--; while (!isWhite(lo));
    else do hi++; while (!isWhite(hi));
  }
  return { lo, hi };
}

export function prepare(song: Song, levels: { R: Level; L: Level }): Prepared {
  const required: Note[] = [];
  const auto: Note[] = [];
  splitHand(song.notes, 'R', levels.R, required, auto);
  splitHand(song.notes, 'L', levels.L, required, auto);
  const byTime = (a: Note, b: Note) => a.start - b.start || a.midi - b.midi;
  required.sort(byTime);
  auto.sort(byTime);
  const steps = groupOnsets(required).map((g) => ({ time: g[0].start, notes: g }));
  return { required, auto, steps, ...computeRange(required.length ? required : song.notes) };
}
