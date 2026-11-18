import type { Level } from '../game/prepare';
import type { Mode } from '../game/session';

export interface Settings {
  labels: 'letters' | 'solfege' | 'off';
  keyLabels: boolean;
  volume: number;
  reverb: boolean;
  fallSeconds: number;
  sensitivity: number;
  haptics: boolean;
}
export interface SongConfig {
  levels: { R: Level; L: Level };
  mode: Mode;
  input: 'touch' | 'listen';
  speed: number;
}
export interface Best {
  stars: number;
  accuracy: number;
}

export const DEFAULT_SETTINGS: Settings = {
  labels: 'letters',
  keyLabels: true,
  volume: 0.85,
  reverb: true,
  fallSeconds: 2.4,
  sensitivity: 0.5,
  haptics: true,
};
const DEFAULT_CONFIG: SongConfig = { levels: { R: 'easy', L: 'off' }, mode: 'learn', input: 'touch', speed: 0.8 };

const K = 'keyfall.';

function read<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(K + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(K + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: settings just won't persist */
  }
}

export function getSettings(): Settings {
  const s = read<Partial<Settings>>('settings');
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s: Settings): void {
  write('settings', s);
}

export function getSongConfig(id: string): SongConfig {
  const c = read<Partial<SongConfig>>('config.' + id);
  if (!c || typeof c !== 'object') return structuredClone(DEFAULT_CONFIG);
  return { ...structuredClone(DEFAULT_CONFIG), ...c, levels: { ...DEFAULT_CONFIG.levels, ...(c.levels ?? {}) } };
}
export function saveSongConfig(id: string, c: SongConfig): void {
  write('config.' + id, c);
}

export function getBest(id: string): Best | null {
  const b = read<Best>('best.' + id);
  return b && typeof b.stars === 'number' ? b : null;
}
export function recordResult(id: string, stars: number, accuracy: number): { best: boolean } {
  const prev = getBest(id);
  const better = !prev || stars > prev.stars || (stars === prev.stars && accuracy > prev.accuracy);
  if (better) write('best.' + id, { stars, accuracy });
  return { best: better };
}

export function getLastSong(): string | null {
  return read<string>('last');
}
export function setLastSong(id: string): void {
  write('last', id);
}

export function getFavorites(): string[] {
  const f = read<string[]>('favorites');
  return Array.isArray(f) ? f.filter((x) => typeof x === 'string') : [];
}
export function toggleFavorite(id: string): boolean {
  const f = getFavorites();
  const on = !f.includes(id);
  write('favorites', on ? [...f, id] : f.filter((x) => x !== id));
  return on;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const daysBetween = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};
/** Days practised in a row, counting today or yesterday as still alive. */
export function getStreak(today = new Date()): number {
  const s = read<{ last: string; count: number }>('streak');
  if (!s || typeof s.count !== 'number' || typeof s.last !== 'string') return 0;
  return daysBetween(s.last, dayKey(today)) <= 1 ? s.count : 0;
}
export function recordPractice(today = new Date()): number {
  const s = read<{ last: string; count: number }>('streak');
  const key = dayKey(today);
  let count = 1;
  if (s && typeof s.count === 'number' && typeof s.last === 'string') {
    const gap = daysBetween(s.last, key);
    count = gap === 0 ? s.count : gap === 1 ? s.count + 1 : 1;
  }
  write('streak', { last: key, count });
  return count;
}

export function getHistory(): string[] {
  const h = read<string[]>('history');
  return Array.isArray(h) ? h.filter((x) => typeof x === 'string') : [];
}
export function pushHistory(id: string): void {
  write('history', [id, ...getHistory().filter((x) => x !== id)].slice(0, 10));
}
