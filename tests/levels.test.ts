import { test, expect } from 'vitest';
import { levelsFor } from '../src/lib/game/levels';

test('right hand: every right-hand note is yours, the left hand is played for you', () => {
  expect(levelsFor('R')).toEqual({ levels: { R: 'full', L: 'off' }, speed: 0.9 });
});
test('left hand: every left-hand note is yours', () => {
  expect(levelsFor('L')).toEqual({ levels: { R: 'off', L: 'full' }, speed: 0.9 });
});
test('both hands: everything is yours', () => {
  expect(levelsFor('both')).toEqual({ levels: { R: 'full', L: 'full' }, speed: 0.9 });
});
