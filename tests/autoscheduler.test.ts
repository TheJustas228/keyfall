import { test, expect } from 'vitest';
import { AutoScheduler } from '../src/lib/game/autoscheduler';
import type { Note } from '../src/lib/music/types';

const n = (midi: number, start: number): Note => ({ midi, start, dur: 0.3, hand: 'L', vel: 0.7 });
const notes = [n(48, 0.5), n(50, 1.0), n(52, 1.5), n(53, 2.0)];

test('hands out each note once as the horizon advances', () => {
  const a = new AutoScheduler(notes);
  a.reset(0);
  expect(a.due(0.6, 0, 0).map((x) => x.midi)).toEqual([48]);
  expect(a.due(0.6, 0.1, 0)).toEqual([]);
  expect(a.due(1.6, 1.0, 0).map((x) => x.midi)).toEqual([50, 52]);
});

test('a new epoch (seek or loop wrap) reschedules from the new clock', () => {
  const a = new AutoScheduler(notes);
  a.reset(0);
  a.due(2.1, 1.9, 0); // everything handed out
  expect(a.due(1.1, 0.4, 1).map((x) => x.midi)).toEqual([48, 50]); // looped back to 0.4
});

test('notes already behind the clock after a seek are skipped, not burst-played', () => {
  const a = new AutoScheduler(notes);
  a.reset(0);
  expect(a.due(1.7, 1.45, 1).map((x) => x.midi)).toEqual([52]);
});
