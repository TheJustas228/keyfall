import { test, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { portraitKey, PORTRAITS } from '../src/lib/songs/portraits';
import { CATALOG } from '../src/lib/songs/catalog';

test('composer names map to their portrait', () => {
  expect(portraitKey('Ludwig van Beethoven')).toBe('beethoven');
  expect(portraitKey('L. van Beethoven')).toBe('beethoven');
  expect(portraitKey('J. S. Bach (attr. Petzold)')).toBe('bach');
  expect(portraitKey('Friedrich Burgmüller')).toBe('burgmuller');
  expect(portraitKey('Traditional (J. Newton)')).toBe('newton');
});

test('songs without a public-domain portrait get none', () => {
  expect(portraitKey('Traditional')).toBeNull();
  expect(portraitKey('Yiruma')).toBeNull();
  expect(portraitKey('J. Pachelbel')).toBeNull();
});

test('every portrait has an image file and a credit', () => {
  for (const [key, p] of Object.entries(PORTRAITS)) {
    expect(existsSync(`public/portraits/${key}.jpg`)).toBe(true);
    expect(p.credit.length).toBeGreaterThan(5);
  }
});

test('most built-in songs show a person', () => {
  const withFace = CATALOG.filter((e) => portraitKey(e.composer));
  expect(withFace.length).toBeGreaterThanOrEqual(20);
});
