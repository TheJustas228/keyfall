import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATALOG, loadSong, visibleCatalog } from '../src/lib/songs/catalog';

const fetchBytes = async (url: string) => {
  const path = 'public/' + url.replace(/^.*?songs\//, 'songs/');
  return new Uint8Array(readFileSync(path));
};

describe('catalog', () => {
  test('includes Für Elise and a River Flows in You placeholder', () => {
    expect(CATALOG.some((e) => e.id === 'fur-elise')).toBe(true);
    const river = CATALOG.find((e) => e.id === 'river-flows')!;
    expect(river.kind).toBe('placeholder');
  });

  test('ids are unique', () => {
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
  });

  for (const entry of CATALOG.filter((e) => e.kind !== 'placeholder')) {
    test(`${entry.id} loads as a playable two-hand song`, async () => {
      const song = await loadSong(entry, fetchBytes);
      expect(song.notes.length).toBeGreaterThanOrEqual(16);
      expect(song.notes.some((n) => n.hand === 'R')).toBe(true);
      expect(song.notes.some((n) => n.hand === 'L')).toBe(true);
      for (const n of song.notes) {
        expect(n.midi).toBeGreaterThanOrEqual(21);
        expect(n.midi).toBeLessThanOrEqual(108);
        expect(n.dur).toBeGreaterThan(0);
      }
      expect(song.duration).toBeGreaterThan(10);
      expect(song.source).toBe('builtin');
      expect(song.title).toBe(entry.title);
    });
  }

  test('an imported River Flows in You replaces the placeholder', () => {
    const withImport = visibleCatalog([{ id: 'import-1', title: 'River Flows in You', addedAt: 1 }]);
    expect(withImport.some((e) => e.id === 'river-flows')).toBe(false);
    expect(withImport.some((e) => e.id === 'import-1' && e.kind === 'import')).toBe(true);
    expect(visibleCatalog([]).some((e) => e.id === 'river-flows')).toBe(true);
  });
});
