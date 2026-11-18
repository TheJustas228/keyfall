import type { Song } from '../music/types';
import { midiToSong } from '../music/midi';
import type { CatalogEntry } from '../songs/catalog';
import { loadSong } from '../songs/catalog';
import { getSettings, saveSettings, type Settings, type SongConfig } from '../storage/prefs';
import { getImport, listImports, type ImportMeta } from '../storage/imports';
import type { Mode } from '../game/session';

export type Screen = 'home' | 'library' | 'song' | 'player' | 'results' | 'free' | 'settings';

export interface FinishStats {
  stars: 0 | 1 | 2 | 3;
  accuracy: number;
  perfect: number;
  good: number;
  miss: number;
  wrong: number;
  bestCombo: number;
  timeline: (number | null)[];
}

export interface ResultData {
  entry: CatalogEntry;
  song: Song;
  config: SongConfig;
  mode: Mode;
  stars: 0 | 1 | 2 | 3;
  accuracy: number;
  perfect: number;
  good: number;
  miss: number;
  wrong: number;
  bestCombo: number;
  timeline: (number | null)[];
  newBest: boolean;
  streak: number;
}

export const app = $state({
  screen: 'home' as Screen,
  back: 'home' as Screen,
  song: null as CatalogEntry | null,
  libraryQuery: '',
  importOpen: false,
  importTitle: '',
  playing: null as { entry: CatalogEntry; song: Song; config: SongConfig; runId: number } | null,
  result: null as ResultData | null,
  settings: getSettings() as Settings,
  imports: [] as ImportMeta[],
  pianoReady: false,
  pianoProgress: 0,
  toast: '' as string,
});

let toastTimer = 0;
export function showToast(msg: string) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (app.toast = ''), 4200);
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(app.settings, patch);
  saveSettings($state.snapshot(app.settings));
}

export async function refreshImports() {
  app.imports = await listImports();
}

const songCache = new Map<string, Song>();

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn’t load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function getSong(entry: CatalogEntry): Promise<Song> {
  const hit = songCache.get(entry.id);
  if (hit) return hit;
  let song: Song;
  if (entry.kind === 'import' && entry.importId) {
    const bytes = await getImport(entry.importId);
    song = midiToSong(bytes, { id: entry.id, title: entry.title, composer: entry.composer, art: entry.art, credit: entry.credit, source: 'import' });
  } else {
    song = await loadSong(entry, fetchBytes);
  }
  songCache.set(entry.id, song);
  return song;
}

export function forgetSong(id: string) {
  songCache.delete(id);
}

let runCounter = 0;
export function startPlaying(entry: CatalogEntry, song: Song, config: SongConfig) {
  app.playing = { entry, song, config, runId: ++runCounter };
  app.screen = 'player';
}

export function go(screen: Screen) {
  app.screen = screen;
}

export function openSong(entry: CatalogEntry, from: Screen = app.screen) {
  app.song = entry;
  app.back = from === 'song' ? app.back : from;
  app.screen = 'song';
}
