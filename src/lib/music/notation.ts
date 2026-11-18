import { sortNotes, type Hand, type Note } from './types';

/**
 * Compact text notation for authoring songs.
 *
 *   C#5:q          note with duration (w h q e s; "." dotted; "t" triplet; "+" ties: h+e)
 *   [A2 E3 A3]:h   chord
 *   r:e            rest
 *   |              bar line (every bar is checked against beatsPerBar)
 * A token without ":dur" reuses the previous duration.
 */
export interface NotationSource {
  bpm: number;
  beatsPerBar: number;
  pickupBeats?: number;
  R: string;
  L?: string;
}

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const BEATS: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

export function noteNameToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note name "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + STEPS[m[1]] + acc;
}

function parseDuration(spec: string): number {
  let total = 0;
  for (const part of spec.split('+')) {
    const m = /^([whqes])(\.?)(t?)$/.exec(part);
    if (!m) throw new Error(`Bad duration "${spec}"`);
    let beats = BEATS[m[1]];
    if (m[2]) beats *= 1.5;
    if (m[3]) beats *= 2 / 3;
    total += beats;
  }
  return total;
}

function parseHand(text: string, hand: Hand, src: NotationSource, out: Note[]) {
  const secPerBeat = 60 / src.bpm;
  // Keep chords as single tokens: "[A2 E3]:h" → "[A2,E3]:h"
  const tokens = text.replace(/\[([^\]]*)\]/g, (_, inner: string) => `[${inner.trim().split(/\s+/).join(',')}]`).split(/\s+/).filter(Boolean);
  let beat = 0;
  let barStart = 0;
  let bar = 1;
  let dur = 1;
  const closeBar = () => {
    const got = +(beat - barStart).toFixed(6);
    const isPickup = bar === 1 && src.pickupBeats !== undefined;
    const want = isPickup ? src.pickupBeats! : src.beatsPerBar;
    if (got !== 0 && Math.abs(got - want) > 1e-6) throw new Error(`Bar ${bar} in ${hand}: got ${got} beats`);
    if (got !== 0 || isPickup) bar++;
    barStart = beat;
  };
  for (const tok of tokens) {
    if (tok === '|') {
      closeBar();
      continue;
    }
    const [pitchPart, durPart] = tok.split(':');
    if (durPart) dur = parseDuration(durPart);
    if (pitchPart !== 'r') {
      const names = pitchPart.startsWith('[') ? pitchPart.slice(1, -1).split(',') : [pitchPart];
      for (const name of names) {
        out.push({ midi: noteNameToMidi(name), start: beat * secPerBeat, dur: dur * secPerBeat, hand, vel: 0.7 });
      }
    }
    beat += dur;
  }
  if (beat - barStart > 1e-6) closeBar();
}

export function parseNotation(src: NotationSource): Note[] {
  const out: Note[] = [];
  parseHand(src.R, 'R', src, out);
  if (src.L) parseHand(src.L, 'L', src, out);
  return sortNotes(out);
}

/** A song authored in notation, with library metadata. */
export interface NotationSong extends NotationSource {
  id: string;
  title: string;
  composer: string;
  difficulty: 1 | 2 | 3;
  art: import('./types').SongArt;
}
