import type { Level } from '../game/prepare';
import type { Mode } from '../game/session';

export interface Settings {
  labels: 'letters' | 'solfege' | 'off';
  keyLabels: boolean;
  volume: number;
  reverb: boolean;
  fallSeconds: number;
  sensitivity: number;
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
