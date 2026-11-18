import { midiToSong } from '../music/midi';
import { parseNotation, type NotationSong } from '../music/notation';
import { songDuration, type Song, type SongArt } from '../music/types';
import type { ImportMeta } from '../storage/imports';
import { EASY_SONGS } from './easy';

export interface CatalogEntry {
  id: string;
  title: string;
  composer: string;
  difficulty: 1 | 2 | 3;
  art: SongArt;
  credit?: string;
  kind: 'midi' | 'notation' | 'placeholder' | 'import';
  /** planet colours (see ui/planets.ts PALETTES) */
  palette: string;
  genre: 'Classical' | 'Traditional' | 'Imported';
  file?: string;
  notation?: NotationSong;
  importId?: string;
}

const MUTOPIA_PD = 'Score from the Mutopia Project, public domain.';
const mutopiaCC = (v: string) => `Score from the Mutopia Project, licensed CC BY-SA ${v}.`;

const PALETTE: Record<string, string> = {
  'fur-elise': 'rose', moonlight: 'cobalt', 'prelude-c': 'gold', 'minuet-g': 'teal', gymnopedie: 'ash', 'old-french-song': 'ember',
  arabesque: 'teal', 'sonata-facile': 'violet', gnossienne: 'ash', entertainer: 'gold', 'alla-turca': 'crimson', 'clair-de-lune': 'cobalt',
  nocturne: 'violet', 'mountain-king': 'crimson', 'river-flows': 'cobalt',
};
const CYCLE = ['ember', 'gold', 'rose', 'teal', 'violet', 'crimson', 'cobalt'];
const paletteFor = (id: string) => PALETTE[id] ?? CYCLE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % CYCLE.length];

const midi = (id: string, title: string, composer: string, difficulty: 1 | 2 | 3, art: SongArt, credit = MUTOPIA_PD): CatalogEntry => ({
  id, title, composer, difficulty, art, credit, kind: 'midi', file: `songs/${id}.mid`, palette: paletteFor(id), genre: 'Classical',
});

const BUILTIN_MIDI: CatalogEntry[] = [
  midi('fur-elise', 'Für Elise', 'Ludwig van Beethoven', 2, { emoji: '🌹', from: '#f472b6', to: '#7c3aed' }),
  midi('moonlight', 'Moonlight Sonata', 'Ludwig van Beethoven', 2, { emoji: '🌙', from: '#1e3a8a', to: '#0f172a' }, mutopiaCC('2.5')),
  midi('prelude-c', 'Prelude in C', 'Johann Sebastian Bach', 2, { emoji: '🕯️', from: '#fde68a', to: '#b45309' }),
  midi('minuet-g', 'Minuet in G', 'J. S. Bach (attr. Petzold)', 1, { emoji: '🎻', from: '#86efac', to: '#15803d' }),
  midi('gymnopedie', 'Gymnopédie No. 1', 'Erik Satie', 2, { emoji: '🌫️', from: '#cbd5e1', to: '#475569' }),
  midi('old-french-song', 'Old French Song', 'Pyotr Tchaikovsky', 1, { emoji: '🍂', from: '#fdba74', to: '#9a3412' }),
  midi('arabesque', 'Arabesque', 'Friedrich Burgmüller', 2, { emoji: '🌀', from: '#67e8f9', to: '#0e7490' }),
  midi('sonata-facile', 'Sonata Facile', 'Wolfgang Amadeus Mozart', 2, { emoji: '🎼', from: '#c4b5fd', to: '#4c1d95' }, mutopiaCC('3.0')),
  midi('gnossienne', 'Gnossienne No. 1', 'Erik Satie', 2, { emoji: '🗝️', from: '#a8a29e', to: '#292524' }, mutopiaCC('4.0')),
  midi('entertainer', 'The Entertainer', 'Scott Joplin', 3, { emoji: '🎩', from: '#fcd34d', to: '#78350f' }),
  midi('alla-turca', 'Rondo alla Turca', 'Wolfgang Amadeus Mozart', 3, { emoji: '🥁', from: '#fca5a5', to: '#991b1b' }),
  midi('clair-de-lune', 'Clair de Lune', 'Claude Debussy', 3, { emoji: '✨', from: '#93c5fd', to: '#312e81' }),
  midi('nocturne', 'Nocturne in E-flat', 'Frédéric Chopin', 3, { emoji: '🌌', from: '#818cf8', to: '#1e1b4b' }, mutopiaCC('3.0')),
  midi('mountain-king', 'In the Hall of the Mountain King', 'Edvard Grieg', 3, { emoji: '👑', from: '#a3e635', to: '#365314' }),
];

const RIVER: CatalogEntry = {
  id: 'river-flows',
  title: 'River Flows in You',
  composer: 'Yiruma',
  difficulty: 2,
  art: { emoji: '🌊', from: '#38bdf8', to: '#1e40af' },
  kind: 'placeholder',
  palette: 'cobalt',
  genre: 'Classical',
  credit: 'This song is still under copyright, so it can’t be built in. Add it from a MIDI file and it will appear here.',
};

const EASY: CatalogEntry[] = EASY_SONGS.map((s) => ({
  id: s.id, title: s.title, composer: s.composer, difficulty: s.difficulty, art: s.art,
  credit: 'Simplified arrangement of a public-domain melody.', kind: 'notation', notation: s, palette: paletteFor(s.id),
  genre: /traditional|hill/i.test(s.composer) ? 'Traditional' : 'Classical',
}));

// Order: the user's requested songs first, then easy to hard.
const firstIds = ['fur-elise', 'river-flows', 'fur-elise-easy'];
export const CATALOG: CatalogEntry[] = [...BUILTIN_MIDI, RIVER, ...EASY].sort((a, b) => {
  const fa = firstIds.indexOf(a.id), fb = firstIds.indexOf(b.id);
  if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
  return a.difficulty - b.difficulty;
});

const RIVER_RE = /river\s*flows/i;

/** Built-in songs plus the user's imports; an imported River Flows in You takes the placeholder's place. */
export function visibleCatalog(imports: ImportMeta[]): CatalogEntry[] {
  const importEntries: CatalogEntry[] = imports.map((m) => ({
    id: m.id,
    title: m.title,
    composer: RIVER_RE.test(m.title) ? 'Yiruma' : 'Imported',
    difficulty: 2,
    art: RIVER_RE.test(m.title) ? RIVER.art : { emoji: '🎹', from: '#94a3b8', to: '#334155' },
    kind: 'import',
    palette: RIVER_RE.test(m.title) ? 'cobalt' : paletteFor(m.id),
    genre: 'Imported',
    importId: m.id,
    credit: 'Imported from a MIDI file.',
  }));
  const river = importEntries.find((e) => RIVER_RE.test(e.title));
  const out: CatalogEntry[] = [];
  for (const e of CATALOG) {
    if (e.id === 'river-flows') {
      if (river) out.push(river);
      else out.push(e);
    } else out.push(e);
  }
  return [...out, ...importEntries.filter((e) => e !== river)];
}

export async function loadSong(e: CatalogEntry, fetchBytes: (url: string) => Promise<Uint8Array>): Promise<Song> {
  if (e.kind === 'notation' && e.notation) {
    const notes = parseNotation(e.notation);
    return { id: e.id, title: e.title, composer: e.composer, difficulty: e.difficulty, art: e.art, credit: e.credit, source: 'builtin', notes, duration: songDuration(notes) };
  }
  if (e.kind === 'midi' && e.file) {
    const bytes = await fetchBytes(import.meta.env.BASE_URL + e.file);
    return midiToSong(bytes, { id: e.id, title: e.title, composer: e.composer, difficulty: e.difficulty, art: e.art, credit: e.credit, source: 'builtin' });
  }
  throw new Error(`“${e.title}” has no notes to load`);
}
