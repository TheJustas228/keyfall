import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMidi, midiToSong } from '../src/lib/music/midi';

// ---- tiny SMF writer for synthetic fixtures ----
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
type Ev = [tick: number, bytes: number[]];
function track(events: Ev[]): number[] {
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  const body: number[] = [];
  let last = 0;
  for (const [tick, bytes] of sorted) {
    body.push(...vlq(tick - last), ...bytes);
    last = tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  const len = body.length;
  return [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body];
}
function smf(format: number, division: number, tracks: number[][]): Uint8Array {
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks.length, (division >> 8) & 255, division & 255];
  return new Uint8Array([...head, ...tracks.flat()]);
}
const tempo = (us: number) => [0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255];
const on = (ch: number, n: number, v = 90) => [0x90 | ch, n, v];
const off = (ch: number, n: number) => [0x80 | ch, n, 0];

describe('parseMidi', () => {
  test('Für Elise fixture: right hand opens E5 D#5 E5 D#5 E5', () => {
    const song = midiToSong(new Uint8Array(readFileSync('public/songs/fur-elise.mid')), { id: 'fe', title: 'Für Elise' });
    const rh = song.notes.filter((n) => n.hand === 'R').slice(0, 5).map((n) => n.midi);
    expect(rh).toEqual([76, 75, 76, 75, 76]);
    expect(song.notes.some((n) => n.hand === 'L')).toBe(true);
    expect(song.duration).toBeGreaterThan(60);
  });

  test('tempo change mid-song is honoured in seconds', () => {
    const bytes = smf(0, 480, [track([
      [0, tempo(500000)], // 120 bpm: 480 ticks = 0.5 s
      [0, on(0, 60)], [480, off(0, 60)],
      [960, tempo(1000000)], // 60 bpm: 480 ticks = 1 s
      [1440, on(0, 62)], [1920, off(0, 62)],
    ])]);
    const { tracks } = parseMidi(bytes);
    const notes = tracks.flatMap((t) => t.notes);
    expect(notes.map((n) => n.midi)).toEqual([60, 62]);
    expect(notes[0].dur).toBeCloseTo(0.5);
    expect(notes[1].start).toBeCloseTo(2.0); // 1.0 s at 120 bpm + 1.0 s at 60 bpm (would be 1.5 if tempo change ignored)
    expect(notes[1].dur).toBeCloseTo(1);
  });

  test('zero-length notes get 0.05 s, overlapping same pitch closes the earlier one, drums dropped', () => {
    const bytes = smf(0, 480, [track([
      [0, tempo(500000)],
      [0, on(0, 64)], [0, off(0, 64)], // zero length
      [0, on(0, 67)], [240, on(0, 67)], [480, off(0, 67)], [720, off(0, 67)], // overlap
      [0, on(9, 36)], [240, off(9, 36)], // drum
      [960, [0x90, 72, 80]], [1200, [72, 0]], // running status: note-on vel 0 = off
    ])]);
    const notes = parseMidi(bytes).tracks.flatMap((t) => t.notes).sort((a, b) => a.start - b.start || a.midi - b.midi);
    expect(notes.find((n) => n.midi === 64)!.dur).toBeCloseTo(0.05);
    const gs = notes.filter((n) => n.midi === 67);
    expect(gs).toHaveLength(2);
    expect(gs[0].dur).toBeCloseTo(0.25);
    expect(gs[1].start).toBeCloseTo(0.25);
    expect(gs[1].dur).toBeCloseTo(0.25);
    expect(notes.some((n) => n.midi === 36)).toBe(false);
    const c5 = notes.find((n) => n.midi === 72)!;
    expect(c5.start).toBeCloseTo(1);
    expect(c5.dur).toBeCloseTo(0.25);
  });
});

describe('midiToSong hand assignment', () => {
  test('one track: notes at or above middle C go to the right hand', () => {
    const bytes = smf(0, 480, [track([[0, on(0, 72)], [480, off(0, 72)], [0, on(0, 48)], [480, off(0, 48)]])]);
    const song = midiToSong(bytes, { id: 'x', title: 'X' });
    expect(song.notes.find((n) => n.midi === 72)!.hand).toBe('R');
    expect(song.notes.find((n) => n.midi === 48)!.hand).toBe('L');
  });

  test('two tracks: the higher-pitched track is the right hand, regardless of order', () => {
    const low = track([[0, on(0, 40)], [480, off(0, 40)], [480, on(0, 43)], [960, off(0, 43)]]);
    const high = track([[0, on(1, 65)], [480, off(1, 65)], [480, on(1, 55)], [960, off(1, 55)]]);
    const song = midiToSong(smf(1, 480, [track([[0, tempo(500000)]]), low, high]), { id: 'y', title: 'Y' });
    expect(song.notes.filter((n) => n.hand === 'R').map((n) => n.midi).sort()).toEqual([55, 65]);
    expect(song.notes.filter((n) => n.hand === 'L').map((n) => n.midi).sort()).toEqual([40, 43]);
    expect(song.source).toBe('import');
    expect(song.duration).toBeCloseTo(1);
  });

  test('garbage bytes throw a readable error', () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3, 4]))).toThrow(/MIDI/);
  });
});
