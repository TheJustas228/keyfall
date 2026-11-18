import type { Level } from './prepare';

export type HandChoice = 'R' | 'L' | 'both';
export type Difficulty = 'easy' | 'medium' | 'hard';

const SPEED: Record<Difficulty, number> = { easy: 0.7, medium: 0.85, hard: 1 };

/** Map the song screen's hand planet + difficulty to engine levels and speed. */
export function levelsFor(hands: HandChoice, diff: Difficulty): { levels: { R: Level; L: Level }; speed: number } {
  const on: Level = diff === 'easy' ? 'easy' : 'full';
  return {
    levels: { R: hands === 'L' ? 'off' : on, L: hands === 'R' ? 'off' : on },
    speed: SPEED[diff],
  };
}
