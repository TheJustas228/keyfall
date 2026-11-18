import { describe, test, expect } from 'vitest';
import { noteNameToMidi, parseNotation } from '../src/lib/music/notation';

describe('noteNameToMidi', () => {
  test.each([
    ['C4', 60], ['C#5', 73], ['Eb4', 63], ['A0', 21], ['C8', 108], ['B3', 59], ['Bb2', 46], ['F#3', 54],
  ])('%s → %i', (name, midi) => {
    expect(noteNameToMidi(name)).toBe(midi);
  });

  test('rejects garbage', () => {
    expect(() => noteNameToMidi('H4')).toThrow();
    expect(() => noteNameToMidi('C')).toThrow();
  });
});

describe('parseNotation', () => {
  test('quarter notes then a whole-note chord, durations carried forward', () => {
    const notes = parseNotation({ bpm: 60, beatsPerBar: 4, R: 'C4:q D4 E4 F4 | [C4 E4 G4]:w' });
    expect(notes).toHaveLength(7);
    expect(notes.slice(0, 4).map((n) => n.start)).toEqual([0, 1, 2, 3]);
    const chord = notes.filter((n) => n.start === 4);
    expect(chord.map((n) => n.midi).sort()).toEqual([60, 64, 67]);
    expect(chord.every((n) => n.dur === 4 && n.hand === 'R')).toBe(true);
  });

  test('bpm converts beats to seconds', () => {
    const notes = parseNotation({ bpm: 120, beatsPerBar: 4, R: 'C4:h C4:h' });
    expect(notes.map((n) => n.start)).toEqual([0, 1]);
    expect(notes[0].dur).toBe(1);
  });

  test('dotted and triplet durations, rests advance time', () => {
    const notes = parseNotation({ bpm: 60, beatsPerBar: 3, R: 'C4:q. D4:e r:q | E4:et F4 G4 r:h' });
    [0, 1.5, 3, 3 + 1 / 3, 3 + 2 / 3].forEach((t, i) => expect(notes[i].start).toBeCloseTo(t, 9));
    expect(notes[0].dur).toBe(1.5);
    expect(notes[2].dur).toBeCloseTo(1 / 3);
  });

  test('left hand is parsed with hand L and merged in time order', () => {
    const notes = parseNotation({ bpm: 60, beatsPerBar: 2, R: 'E5:q E5 |', L: 'A2:h |' });
    expect(notes.map((n) => [n.hand, n.start])).toEqual([['L', 0], ['R', 0], ['R', 1]]);
  });

  test('a bar with the wrong number of beats throws with bar number and hand', () => {
    expect(() => parseNotation({ bpm: 60, beatsPerBar: 4, R: 'C4:q D4 E4 F4 | G4:h' })).toThrow('Bar 2 in R: got 2 beats');
  });

  test('pickup bar may be short', () => {
    const notes = parseNotation({ bpm: 60, beatsPerBar: 3, pickupBeats: 1, R: 'E4:q | A4:h. |' });
    expect(notes.map((n) => n.start)).toEqual([0, 1]);
  });

  test('tied durations with + add up', () => {
    const notes = parseNotation({ bpm: 60, beatsPerBar: 4, R: 'C4:h+e r:e D4:q |' });
    expect(notes[0].dur).toBe(2.5);
    expect(notes[1].start).toBe(3);
  });
});
