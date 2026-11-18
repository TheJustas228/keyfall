import type { Level } from './prepare';

export type HandChoice = 'R' | 'L' | 'both';

/** Map the song screen's hand planet to engine levels: your hand(s) in full, the other played for you. */
export function levelsFor(hands: HandChoice): { levels: { R: Level; L: Level }; speed: number } {
  return {
    levels: { R: hands === 'L' ? 'off' : 'full', L: hands === 'R' ? 'off' : 'full' },
    speed: 0.9,
  };
}
