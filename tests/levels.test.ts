import { test, expect } from 'vitest';
import { levelsFor } from '../src/lib/game/levels';

test('right hand easy: melody notes for the right hand, left hand played for you, 70% speed', () => {
  expect(levelsFor('R', 'easy')).toEqual({ levels: { R: 'easy', L: 'off' }, speed: 0.7 });
});
test('left hand medium: all left-hand notes at 85%', () => {
  expect(levelsFor('L', 'medium')).toEqual({ levels: { R: 'off', L: 'full' }, speed: 0.85 });
});
test('both hands hard: everything at full speed', () => {
  expect(levelsFor('both', 'hard')).toEqual({ levels: { R: 'full', L: 'full' }, speed: 1 });
});
test('both hands easy: melody notes in both hands', () => {
  expect(levelsFor('both', 'easy')).toEqual({ levels: { R: 'easy', L: 'easy' }, speed: 0.7 });
});
