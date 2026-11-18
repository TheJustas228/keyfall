import { test, expect } from 'vitest';
import { preferFlats } from '../src/lib/music/spelling';
import { noteNameToMidi } from '../src/lib/music/notation';
import type { Note } from '../src/lib/music/types';

const scale = (names: string[]): Note[] =>
  names.map((n, i) => ({ midi: noteNameToMidi(n), start: i, dur: 1, hand: 'R', vel: 0.7 }));

test('C major and D major use sharps', () => {
  expect(preferFlats(scale(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'G4', 'E4', 'C4']))).toBe(false);
  expect(preferFlats(scale(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5', 'A4', 'F#4', 'D4']))).toBe(false);
});

test('F major and E-flat major use flats', () => {
  expect(preferFlats(scale(['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5', 'C5', 'A4', 'F4']))).toBe(true);
  expect(preferFlats(scale(['Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5', 'D5', 'Eb5', 'Bb4', 'G4', 'Eb4']))).toBe(true);
});

test('A minor with a raised G-sharp (Für Elise style) uses sharps', () => {
  expect(preferFlats(scale(['A3', 'C4', 'E4', 'A4', 'E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4', 'E4', 'G#4', 'B4', 'C5']))).toBe(false);
});

test('no notes defaults to sharps', () => {
  expect(preferFlats([])).toBe(false);
});
