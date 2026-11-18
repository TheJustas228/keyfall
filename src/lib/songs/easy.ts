import type { NotationSong } from '../music/notation';

/**
 * Beginner arrangements of well-known public-domain melodies.
 * Right hand = melody (mostly octaves 4–5), left hand = simple roots / fifths (octaves 2–3).
 * Compound meters (3/8, 6/8) are written with eighth = 0.5 beat, so beatsPerBar is 1.5 / 3.
 */
export const EASY_SONGS: NotationSong[] = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    composer: 'Traditional',
    difficulty: 1,
    art: { emoji: '⭐', from: '#1e3a8a', to: '#7c3aed' },
    bpm: 90,
    beatsPerBar: 4,
    R: `
      C4:q C4 G4 G4 | A4 A4 G4:h | F4:q F4 E4 E4 | D4 D4 C4:h |
      G4:q G4 F4 F4 | E4 E4 D4:h | G4:q G4 F4 F4 | E4 E4 D4:h |
      C4:q C4 G4 G4 | A4 A4 G4:h | F4:q F4 E4 E4 | D4 D4 C4:h |
    `,
    L: `
      [C3 G3]:w | [F3 A3]:h [C3 G3]:h | [F3 A3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:h |
      [C3 G3]:h [G2 D3]:h | [C3 G3]:h [G2 D3]:h | [C3 G3]:h [G2 D3]:h | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:w | [F3 A3]:h [C3 G3]:h | [F3 A3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:h |
    `,
  },
  {
    id: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    difficulty: 1,
    art: { emoji: '🐑', from: '#86efac', to: '#0ea5e9' },
    bpm: 100,
    beatsPerBar: 4,
    R: `
      E4:q D4 C4 D4 | E4 E4 E4:h | D4:q D4 D4:h | E4:q G4 G4:h |
      E4:q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:w |
      E4:q D4 C4 D4 | E4 E4 E4:h | D4:q D4 D4:h | E4:q G4 G4:h |
      E4:q D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:w |
    `,
    L: `
      [C3 G3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
      [C3 G3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
      [C3 G3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
      [C3 G3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
    `,
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'L. van Beethoven',
    difficulty: 1,
    art: { emoji: '🎉', from: '#f59e0b', to: '#ef4444' },
    bpm: 100,
    beatsPerBar: 4,
    // 16-bar theme in C major, played twice.
    R: `
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:q. D4:e D4:h |
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h |
      D4:q D4 E4 C4 | D4:q E4:e F4 E4:q C4 | D4:q E4:e F4 E4:q D4 | C4:q D4 G3:h |
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h |
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:q. D4:e D4:h |
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h |
      D4:q D4 E4 C4 | D4:q E4:e F4 E4:q C4 | D4:q E4:e F4 E4:q D4 | C4:q D4 G3:h |
      E4:q E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:q. C4:e C4:h |
    `,
    L: `
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [G2 D3]:h [C3 G3]:h |
      [G2 D3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:q [G2 D3]:q | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [G2 D3]:h [C3 G3]:h |
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [G2 D3]:h [C3 G3]:h |
      [G2 D3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:h | [G2 D3]:h [C3 G3]:q [G2 D3]:q | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:w | [G2 D3]:w | [C3 G3]:w | [G2 D3]:h [C3 G3]:h |
    `,
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    composer: 'Patty & Mildred Hill',
    difficulty: 1,
    art: { emoji: '🎂', from: '#ec4899', to: '#f97316' },
    bpm: 96,
    beatsPerBar: 3,
    pickupBeats: 1,
    // C major, played twice.
    R: `
      G4:e G4 |
      A4:q G4 C5 | B4:h G4:e G4 | A4:q G4 D5 | C5:h G4:e G4 |
      G5:q E5 C5 | B4 A4 F5:e F5 | E5:q C5 D5 | C5:h G4:e G4 |
      A4:q G4 C5 | B4:h G4:e G4 | A4:q G4 D5 | C5:h G4:e G4 |
      G5:q E5 C5 | B4 A4 F5:e F5 | E5:q C5 D5 | C5:h. |
    `,
    L: `
      r:q |
      [C3 G3]:h. | [G2 D3]:h. | [G2 D3]:h. | [C3 G3]:h. |
      [C3 G3]:h. | [F2 C3]:h. | [C3 G3]:h [G2 D3]:q | [C3 G3]:h. |
      [C3 G3]:h. | [G2 D3]:h. | [G2 D3]:h. | [C3 G3]:h. |
      [C3 G3]:h. | [F2 C3]:h. | [C3 G3]:h [G2 D3]:q | [C3 G3]:h. |
    `,
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells',
    composer: 'J. L. Pierpont',
    difficulty: 1,
    art: { emoji: '🔔', from: '#dc2626', to: '#16a34a' },
    bpm: 100,
    beatsPerBar: 4,
    // Chorus, played twice.
    R: `
      E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w |
      F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4 | E4:q D4 D4 E4 | D4:h G4:h |
      E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w |
      F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4 | G4:q G4 F4 D4 | C4:w |
      E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w |
      F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4 | E4:q D4 D4 E4 | D4:h G4:h |
      E4:q E4 E4:h | E4:q E4 E4:h | E4:q G4 C4:q. D4:e | E4:w |
      F4:q F4 F4:q. F4:e | F4:q E4 E4 E4:e E4 | G4:q G4 F4 D4 | C4:w |
    `,
    L: `
      [C3 G3]:w | [C3 G3]:w | [C3 G3]:w | [C3 G3]:w |
      [F2 C3]:w | [C3 G3]:w | [D3 A3]:w | [G2 D3]:w |
      [C3 G3]:w | [C3 G3]:w | [C3 G3]:w | [C3 G3]:w |
      [F2 C3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
      [C3 G3]:w | [C3 G3]:w | [C3 G3]:w | [C3 G3]:w |
      [F2 C3]:w | [C3 G3]:w | [D3 A3]:w | [G2 D3]:w |
      [C3 G3]:w | [C3 G3]:w | [C3 G3]:w | [C3 G3]:w |
      [F2 C3]:w | [C3 G3]:w | [G2 D3]:w | [C3 G3]:w |
    `,
  },
  {
    id: 'canon-easy',
    title: 'Canon in D (Easy)',
    composer: 'J. Pachelbel',
    difficulty: 1,
    art: { emoji: '🎻', from: '#a78bfa', to: '#f0abfc' },
    bpm: 100,
    beatsPerBar: 4,
    // Ground bass D A B F# G D G A, one note per 2 beats; 8 cycles of 4 bars + final chord.
    // Cycles: violin lines 1, 2, 3, 4, lines 1+2 together, 3, 4, 1.
    R: `
      F#5:h E5 | D5 C#5 | B4 A4 | B4 C#5 |
      D5:h C#5 | B4 A4 | G4 F#4 | G4 E4 |
      D4:q F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 |
      F#4:q D4 E4 C#5 | D5 F#5 A5 A4 | B4 G4 A4 F#4 | D4 D5 D5:q. C#5:e |
      [D5 F#5]:h [C#5 E5] | [B4 D5] [A4 C#5] | [G4 B4] [F#4 A4] | [G4 B4] [E4 C#5] |
      D4:q F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 |
      F#4:q D4 E4 C#5 | D5 F#5 A5 A4 | B4 G4 A4 F#4 | D4 D5 D5:q. C#5:e |
      F#5:h E5 | D5 C#5 | B4 A4 | B4 C#5 |
      D5:w |
    `,
    L: `
      D3:h A2 | B2 F#2 | G2 D2 | G2 A2 |
      D3:h A2 | B2 F#2 | G2 D2 | G2 A2 |
      D3:h A2 | B2 F#2 | G2 D2 | G2 A2 |
      D3:h A2 | B2 F#2 | G2 D2 | G2 A2 |
      [D3 A3]:h [A2 E3] | [B2 F#3] [F#2 C#3] | [G2 D3] [D2 A2] | [G2 D3] [A2 E3] |
      [D3 A3]:h [A2 E3] | [B2 F#3] [F#2 C#3] | [G2 D3] [D2 A2] | [G2 D3] [A2 E3] |
      [D3 A3]:h [A2 E3] | [B2 F#3] [F#2 C#3] | [G2 D3] [D2 A2] | [G2 D3] [A2 E3] |
      [D3 A3]:h [A2 E3] | [B2 F#3] [F#2 C#3] | [G2 D3] [D2 A2] | [G2 D3] [A2 E3] |
      [D3 A3]:w |
    `,
  },
  {
    id: 'brahms-lullaby',
    title: 'Lullaby (Wiegenlied)',
    composer: 'J. Brahms',
    difficulty: 1,
    art: { emoji: '🌙', from: '#312e81', to: '#6366f1' },
    bpm: 66,
    beatsPerBar: 3,
    pickupBeats: 1,
    // C major (original E-flat). Short rests after phrase ends are held through for legato.
    R: `
      E4:e E4 |
      G4:q. E4:e E4:q | G4:h E4:e G4 | C5:q B4:q. A4:e | A4:q G4 D4:e E4 |
      F4:q D4 D4:e E4 | F4:h D4:e F4 | B4:e A4 G4:q B4 | C5:h C4:e C4 |
      C5:h A4:e F4 | G4:h E4:e C4 | F4:q G4 A4 | G4:h C4:e C4 |
      C5:h A4:e F4 | G4:h E4:e C4 | F4:q E4 D4 | C4:h. |
    `,
    L: `
      r:q |
      [C3 G3]:h. | [C3 G3]:h. | [C3 G3]:h. | [G2 D3]:h. |
      [G2 D3]:h. | [G2 D3]:h. | [G2 D3]:h. | [C3 G3]:h. |
      [F2 C3]:h. | [C3 G3]:h. | [F2 C3]:h. | [C3 G3]:h. |
      [F2 C3]:h. | [C3 G3]:h. | [G2 D3]:h. | [C3 G3]:h. |
    `,
  },
  {
    id: 'fur-elise-easy',
    title: 'Für Elise (Easy Theme)',
    composer: 'L. van Beethoven',
    difficulty: 1,
    art: { emoji: '🌹', from: '#9f1239', to: '#f43f5e' },
    bpm: 60,
    beatsPerBar: 1.5,
    pickupBeats: 0.5,
    // 3/8, A section twice (first ending leads back with E5 D#5; second time ends on A).
    R: `
      E5:s D#5 |
      E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s G#4 B4 | C5:e r:s E4:s E5 D#5 |
      E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s C5 B4 | A4:e r:e E5:s D#5 |
      E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s G#4 B4 | C5:e r:s E4:s E5 D#5 |
      E5:s D#5 E5 B4 D5 C5 | A4:e r:s C4:s E4 A4 | B4:e r:s E4:s C5 B4 | A4:q. |
    `,
    L: `
      r:e |
      r:q. | A2:s E3 A3 r:e. | E2:s E3 G#3 r:e. | A2:s E3 A3 r:e. |
      r:q. | A2:s E3 A3 r:e. | E2:s E3 G#3 r:e. | A2:s E3 A3 r:e. |
      r:q. | A2:s E3 A3 r:e. | E2:s E3 G#3 r:e. | A2:s E3 A3 r:e. |
      r:q. | A2:s E3 A3 r:e. | E2:s E3 G#3 r:e. | A2:s E3 A3:q |
    `,
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (J. Newton)',
    difficulty: 1,
    art: { emoji: '🕊️', from: '#38bdf8', to: '#a5b4fc' },
    bpm: 76,
    beatsPerBar: 3,
    pickupBeats: 1,
    // G major, one verse (tune "New Britain").
    R: `
      D4:q |
      G4:h B4:e G4 | B4:h A4:q | G4:h E4:q | D4:h D4:q |
      G4:h B4:e G4 | B4:h A4:q | D5:h. | r:h B4:q |
      D5:h B4:e G4 | B4:h A4:q | G4:h E4:q | D4:h D4:q |
      G4:h B4:e G4 | B4:h A4:q | G4:h. |
    `,
    L: `
      r:q |
      [G2 D3]:h. | [G2 D3]:h. | [C3 G3]:h. | [G2 D3]:h. |
      [G2 D3]:h. | [E2 B2]:h. | [D3 A3]:h. | [D3 A3]:h. |
      [G2 D3]:h. | [G2 D3]:h. | [C3 G3]:h. | [G2 D3]:h. |
      [E2 B2]:h. | [D3 A3]:h. | [G2 D3]:h. |
    `,
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional',
    difficulty: 2,
    art: { emoji: '🍀', from: '#166534', to: '#4ade80' },
    bpm: 72,
    beatsPerBar: 3,
    pickupBeats: 0.5,
    // A minor, 6/8 (eighth = 0.5 beat): verse + refrain.
    R: `
      A4:e |
      C5:q D5:e E5:e. F5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:q A4:e A4:e. G#4:s A4:e | B4:q G#4:e E4:q A4:e |
      C5:q D5:e E5:e. F5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:e. B4:s A4:e G#4:e. F#4:s G#4:e | A4:h. |
      G5:q. G5:e. F#5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:q A4:e A4:e. G#4:s A4:e | B4:q G#4:e E4:q. |
      G5:q. G5:e. F#5:s E5:e | D5:q B4:e G4:e. A4:s B4:e | C5:e. B4:s A4:e G#4:e. F#4:s G#4:e | A4:h. |
    `,
    L: `
      r:e |
      [A2 E3]:h. | [G2 D3]:h. | [A2 E3]:h. | [E2 B2]:h. |
      [A2 E3]:h. | [G2 D3]:h. | [A2 E3]:q. [E2 B2]:q. | [A2 E3]:h. |
      [C3 G3]:h. | [G2 D3]:h. | [A2 E3]:h. | [E2 B2]:h. |
      [C3 G3]:h. | [G2 D3]:h. | [A2 E3]:q. [E2 B2]:q. | [A2 E3]:h. |
    `,
  },
  {
    id: 'swan-lake',
    title: 'Swan Lake Theme',
    composer: 'P. I. Tchaikovsky',
    difficulty: 2,
    art: { emoji: '🦢', from: '#0f172a', to: '#38bdf8' },
    bpm: 76,
    beatsPerBar: 4,
    // B minor: theme, middle phrase, theme again.
    R: `
      F#5:h B4:e C#5 D5 E5 | F#5:q. D5:e F#5:q. D5:e | F#5:q. B4:e D5 B4 G4 D5 | B4:h r:e E5 D5 C#5 |
      F#5:h B4:e C#5 D5 E5 | F#5:q. D5:e F#5:q. D5:e | F#5:q. B4:e D5 B4 G4 D5 | B4:h. B4:q |
      C#5:q D5 E5 F#5:e G5 | A5:q. G5:e F#5:q G5:e A5 | B5:q. A5:e G5:q A5:e B5 | C#6:q. B5:e F#5:h |
      C#5:q D5 E5 F#5:e G5 | A5:q. G5:e F#5:q G5:e A5 | B5:q. A5:e G5:q A5:e B5 | C6:q. G5:e E5:q G5:e C6 |
      C#6:q. G#5:e C#6:q. F#5:e |
      F#5:h B4:e C#5 D5 E5 | F#5:q. D5:e F#5:q. D5:e | F#5:q. B4:e D5 B4 G4 D5 | B4:h r:e E5 D5 C#5 |
      F#5:h B4:e C#5 D5 E5 | F#5:q. D5:e F#5:q. D5:e | F#5:q. B4:e D5 B4 G4 D5 | B4:w |
    `,
    L: `
      [B2 F#3]:w | [B2 F#3]:w | [B2 F#3]:h [G2 D3]:h | [B2 F#3]:h [F#2 C#3]:h |
      [B2 F#3]:w | [B2 F#3]:w | [B2 F#3]:h [G2 D3]:h | [B2 F#3]:w |
      [A2 E3]:w | [D3 A3]:w | [G2 D3]:w | [F#2 C#3]:w |
      [A2 E3]:w | [D3 A3]:w | [G2 D3]:w | [C3 G3]:w |
      [C#3 G#3]:h [F#2 C#3]:h |
      [B2 F#3]:w | [B2 F#3]:w | [B2 F#3]:h [G2 D3]:h | [B2 F#3]:h [F#2 C#3]:h |
      [B2 F#3]:w | [B2 F#3]:w | [B2 F#3]:h [G2 D3]:h | [B2 F#3]:w |
    `,
  },
  {
    id: 'morning-mood',
    title: 'Morning Mood',
    composer: 'E. Grieg',
    difficulty: 2,
    art: { emoji: '🌅', from: '#fb923c', to: '#fde047' },
    bpm: 84,
    beatsPerBar: 3,
    // E major, 6/8 (eighth = 0.5 beat): flute call, oboe answer (to G#), both again in G#,
    // then the flute call in E with a closing cadence. Grace notes omitted.
    R: `
      B5:e G#5 F#5 E5 F#5 G#5 | B5:e G#5 F#5 E5 F#5:s G#5 F#5 G#5 | B5:e G#5 B5 C#6 G#5 C#6 | B5:e G#5 F#5 E5:q r:e |
      B4:e G#4 F#4 E4 F#4 G#4 | B4:e G#4 F#4 E4 F#4:s G#4 F#4 G#4 | B4:e G#4 B4 C#5 G#4 C#5 | D#5:e B#4 A#4 G#4:q. |
      D#5:e B#4 A#4 G#4 A#4 B#4 | D#5:e B#4 A#4 G#4 A#4:s B#4 A#4 B#4 | D#5:e B#4 D#5 E5 B#4 E5 | D#5:e B#4 A#4 G#4:q r:e |
      D#5:e B#4 A#4 G#4 A#4 B#4 | D#5:e B#4 A#4 G#4 A#4:s B#4 A#4 B#4 | D#5:e B#4 D#5 E5 C#5 E5 | F#5:e D#5 C#5 B4:q. |
      B5:e G#5 F#5 E5 F#5 G#5 | B5:e G#5 F#5 E5 F#5:s G#5 F#5 G#5 | B5:e G#5 B5 C#6 G#5 C#6 | B5:e G#5 F#5 E5:q. |
    `,
    L: `
      [E3 B3]:h. | [E3 B3]:h. | [E3 B3]:q. [C#3 G#3]:q. | [E3 B3]:h. |
      [E2 B2]:h. | [E2 B2]:h. | [E2 B2]:q. [C#3 G#3]:q. | [G#2 D#3]:h. |
      [G#2 D#3]:h. | [G#2 D#3]:h. | [G#2 D#3]:q. [E3 C4]:q. | [G#2 D#3]:h. |
      [G#2 D#3]:h. | [G#2 D#3]:h. | [G#2 D#3]:q. [C#3 G#3]:q. | [B2 F#3]:h. |
      [E3 B3]:h. | [E3 B3]:h. | [E3 B3]:q. [C#3 G#3]:q. | [B2 F#3]:q. [E3 B3]:q. |
    `,
  },
  {
    id: 'spring-vivaldi',
    title: 'Spring (Four Seasons)',
    composer: 'A. Vivaldi',
    difficulty: 2,
    art: { emoji: '🌸', from: '#f472b6', to: '#a3e635' },
    bpm: 72,
    beatsPerBar: 4,
    pickupBeats: 0.5,
    // Opening ritornello of the 1st movement, E major, an octave below the violin; trills omitted.
    R: `
      E4:e |
      G#4:e G#4 G#4 F#4:s E4 B4:q. B4:s A4 | G#4:e G#4 G#4 F#4:s E4 B4:q. B4:s A4 |
      G#4:e A4:s B4 A4:e G#4 F#4 D#4 B3 E4 |
      G#4:e G#4 G#4 F#4:s E4 B4:q. B4:s A4 | G#4:e G#4 G#4 F#4:s E4 B4:q. B4:s A4 |
      G#4:e A4:s B4 A4:e G#4 F#4:q r:e E4 |
      B4:e A4:s G#4 A4:e B4 C#5 B4:q E4:e | B4:e A4:s G#4 A4:e B4 C#5 B4:q E4:e |
      C#5:e B4:q A4:e G#4 F#4:s E4 F#4:q |
      E4:q r:e E4 B4 A4:s G#4 A4:e B4 | C#5:e B4:q E4:e B4 A4:s G#4 A4:e B4 |
      C#5:e B4:q E4:e C#5 B4:q A4:e | G#4:e F#4:s E4 F#4:q E4:h |
    `,
    L: `
      r:e |
      [E3 B3]:w | [E3 B3]:w |
      [E3 B3]:h [B2 F#3]:h |
      [E3 B3]:w | [E3 B3]:w |
      [E3 B3]:h [B2 F#3]:h |
      [E3 B3]:w | [E3 B3]:w |
      [A2 E3]:h [B2 F#3]:h |
      [E3 B3]:w | [E3 B3]:w |
      [E3 B3]:h [A2 E3]:h | [B2 F#3]:h [E3 B3]:h |
    `,
  },
  {
    id: 'can-can',
    title: 'Can-Can',
    composer: 'J. Offenbach',
    difficulty: 2,
    art: { emoji: '💃', from: '#e11d48', to: '#facc15' },
    bpm: 100,
    beatsPerBar: 4,
    // Galop infernal main theme in C major, played twice.
    R: `
      C4:h D4:e F4 E4 D4 | G4:q G4 G4:e A4 E4 F4 | D4:q D4 D4:e F4 E4 D4 | C4:e C5 B4 A4 G4 F4 E4 D4 |
      C4:h D4:e F4 E4 D4 | G4:q G4 G4:e A4 E4 F4 | D4:q D4 D4:e F4 E4 D4 | C4:e G4 D4 E4 C4:q G3 |
      C4:h D4:e F4 E4 D4 | G4:q G4 G4:e A4 E4 F4 | D4:q D4 D4:e F4 E4 D4 | C4:e C5 B4 A4 G4 F4 E4 D4 |
      C4:h D4:e F4 E4 D4 | G4:q G4 G4:e A4 E4 F4 | D4:q D4 D4:e F4 E4 D4 | C4:e G4 D4 E4 C4:h |
    `,
    L: `
      [C3 G3]:h [G2 D3]:h | [C3 G3]:w | [G2 D3]:w | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:h [G2 D3]:h | [C3 G3]:w | [G2 D3]:w | [C3 G3]:q [G2 D3] [C3 G3] [G2 D3] |
      [C3 G3]:h [G2 D3]:h | [C3 G3]:w | [G2 D3]:w | [C3 G3]:h [G2 D3]:h |
      [C3 G3]:h [G2 D3]:h | [C3 G3]:w | [G2 D3]:w | [C3 G3]:q [G2 D3] [C3 G3]:h |
    `,
  },
];
