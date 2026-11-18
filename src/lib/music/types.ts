export type Hand = 'R' | 'L';

/** A single note. Times are in seconds from the start of the song. */
export interface Note {
  midi: number;
  start: number;
  dur: number;
  hand: Hand;
  vel: number;
}

export interface SongArt {
  emoji: string;
  from: string;
  to: string;
}

export interface Song {
  id: string;
  title: string;
  composer: string;
  difficulty: 1 | 2 | 3;
  notes: Note[];
  duration: number;
  art: SongArt;
  credit?: string;
  source: 'builtin' | 'import';
}

export function sortNotes(notes: Note[]): Note[] {
  return notes.sort((a, b) => a.start - b.start || (a.hand === b.hand ? a.midi - b.midi : a.hand === 'L' ? -1 : 1));
}

export function songDuration(notes: Note[]): number {
  let end = 0;
  for (const n of notes) end = Math.max(end, n.start + n.dur);
  return end;
}
