import { describe, test, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings, getSongConfig, saveSongConfig, recordResult, getBest, DEFAULT_SETTINGS } from '../src/lib/storage/prefs';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('settings', () => {
  test('defaults when nothing is stored', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('round trip', () => {
    saveSettings({ ...DEFAULT_SETTINGS, labels: 'solfege', volume: 0.3 });
    expect(getSettings().labels).toBe('solfege');
    expect(getSettings().volume).toBe(0.3);
  });

  test('corrupt JSON falls back to defaults without throwing', () => {
    localStorage.setItem('keyfall.settings', '{not json');
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('missing fields from an older version are filled with defaults', () => {
    localStorage.setItem('keyfall.settings', JSON.stringify({ volume: 0.5 }));
    expect(getSettings()).toEqual({ ...DEFAULT_SETTINGS, volume: 0.5 });
  });

  test('works when localStorage is unavailable', () => {
    delete (globalThis as any).localStorage;
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe('song config and results', () => {
  test('song config defaults to learn mode with the right hand on easy', () => {
    expect(getSongConfig('x')).toEqual({ levels: { R: 'easy', L: 'off' }, mode: 'learn', input: 'touch', speed: 0.8 });
  });

  test('song config round trip per song', () => {
    saveSongConfig('a', { levels: { R: 'full', L: 'full' }, mode: 'play', input: 'listen', speed: 1 });
    expect(getSongConfig('a').mode).toBe('play');
    expect(getSongConfig('b').mode).toBe('learn');
  });

  test('recordResult keeps the best stars and accuracy', () => {
    expect(recordResult('s', 2, 0.85)).toEqual({ best: true });
    expect(recordResult('s', 1, 0.7)).toEqual({ best: false });
    expect(getBest('s')).toEqual({ stars: 2, accuracy: 0.85 });
    expect(recordResult('s', 3, 0.97)).toEqual({ best: true });
    expect(getBest('s')).toEqual({ stars: 3, accuracy: 0.97 });
    expect(getBest('none')).toBeNull();
  });
});
