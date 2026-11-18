# Keyfall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home-screen PWA for iPhone 16 Pro Max that teaches piano songs with falling notes, with touch and microphone input.

**Architecture:** Pure TypeScript core (`src/lib/music`, `src/lib/game`, `src/lib/listen`) holds every rule and is unit-tested. Browser shells (`src/lib/audio`, `src/lib/storage`) wrap Web Audio, the microphone and storage. Svelte 5 screens sit on top, and one canvas draws the falling notes and keyboard.

**Tech Stack:** Svelte 5, TypeScript, Vite 6, Vitest, vite-plugin-pwa (Workbox), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-18-keyfall-piano-design.md`

## Global Constraints

- Vite `base: '/keyfall/'`; every asset URL is built from `import.meta.env.BASE_URL`.
- Works offline after first load: precache app shell, `songs/*.mid`, `samples/*.mp3`.
- iOS meta: `viewport-fit=cover, user-scalable=no`, `apple-mobile-web-app-capable`, black-translucent status bar; respect `env(safe-area-inset-*)`.
- Hand colors: right `#38bdf8`→`#2563eb`, left `#fb923c`→`#f43f5e`; auto notes drawn at 35% alpha.
- Judgment windows (real time): Perfect ≤ 70 ms, Good ≤ 160 ms; Learn early-press window 250 ms; chord grouping 30 ms.
- Stars: accuracy ≥ 0.60 → 1, ≥ 0.80 → 2, ≥ 0.95 → 3.
- Speed range 0.4–1.2 (default 1.0 for Watch, 0.8 for Learn).
- Credits: Salamander Grand Piano (CC BY 3.0, Alexander Holm); each Mutopia piece's license is shown on its sheet.
- River Flows in You is never bundled; the placeholder card opens Import.

## Review Focus

1. Imported MIDI oddities (format 0 with several channels, tempo changes mid-song, zero-length notes, overlapping same-pitch notes, drum channel): import still yields a playable two-hand song. Test in Task 3.
2. Touch edge cases (two fingers on one key, sliding off the keyboard, `pointercancel` from an iOS gesture): no stuck notes. Test in Task 7 (`KeyInput` tracker).
3. App backgrounded or screen locked mid-song: playback pauses, no burst of queued notes on return. Test in Task 5 (`Session.update` clamps huge dt).
4. Seek or loop during Learn: wait state resets, auto notes are not replayed twice. Test in Task 5.
5. Microphone denied or missing: clear message, falls back to Touch. Handled in Task 9 (`startListening` rejects with typed error) and surfaced in the Task 11 UI.

---

### Task 1: Scaffold

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`, `tests/smoke.test.ts`.

- [ ] Step 1: `npm create vite@latest` (svelte-ts) into the repo root, add `vitest`, `vite-plugin-pwa`; add scripts `test`=`vitest run`, `build`, `dev`.
- [ ] Step 2: Write `tests/smoke.test.ts` asserting `1+1===2`; run `npm test` → PASS; `npm run build` → exits 0.
- [ ] Step 3: Commit `chore: scaffold svelte + vite + vitest`.

### Task 2: Song model and text notation

**Files:** Create `src/lib/music/types.ts`, `src/lib/music/notation.ts`. Test `tests/notation.test.ts`.

**Interfaces (Produces):**
```ts
type Hand = 'R' | 'L';
interface Note { midi: number; start: number; dur: number; hand: Hand; vel: number } // seconds
interface Song { id: string; title: string; composer: string; difficulty: 1|2|3; notes: Note[]; duration: number;
  art: { emoji: string; from: string; to: string }; credit?: string; source: 'builtin' | 'import' }
function noteNameToMidi(name: string): number          // 'C4'→60, 'C#5'→73, 'Eb4'→63, 'A0'→21
function parseNotation(src: { bpm: number; beatsPerBar: number; pickupBeats?: number; R: string; L?: string }): Note[]
```
Notation: whitespace-separated tokens; `C#5:q`, chord `[A2 E3 A3]:h`, rest `r:e`; durations `w h q e s` (4,2,1,½,¼ beats), suffix `.` dotted, `t` triplet (×⅔); duration omitted = previous; `|` bar line. Every bar except the first (if `pickupBeats`) must sum to `beatsPerBar` or throw `Error('Bar N in R: got X beats')`.

- [ ] Step 1: Tests: `noteNameToMidi` cases above; `parseNotation({bpm:60,beatsPerBar:4,R:'C4:q D4 E4 F4 | [C4 E4 G4]:w'})` gives 7 notes, the chord's three notes have `start===4`, `dur===4`; dotted/triplet durations; bad bar throws the message; pickup bar allowed.
- [ ] Step 2: Run, see FAIL. Step 3: implement. Step 4: PASS. Step 5: commit `feat: notation parser`.

### Task 3: MIDI parser and import mapping

**Files:** Create `src/lib/music/midi.ts`. Test `tests/midi.test.ts`, fixtures `public/songs/*.mid` (the downloaded Mutopia set).

**Interfaces (Produces):**
```ts
function parseMidi(bytes: Uint8Array): { tracks: { name: string; notes: { midi; start; dur; vel; channel }[] }[]; duration: number }
function midiToSong(bytes: Uint8Array, meta: Partial<Song> & { id: string; title: string }): Song
```
Tempo map honoured (seconds, not ticks); running status; note-on vel 0 = off; overlapping same pitch closes the earlier note; zero-length notes get `dur = 0.05`; channel 9 dropped. Hands: ≥2 note tracks → by mean pitch (highest = R, rest = L); one track → split at 60 with notes ≥ 60 = R.

- [ ] Step 1: Tests: Für Elise fixture → first five R notes are E5 D#5 E5 D#5 E5; both hands non-empty; synthetic format-0 file built in-test with a tempo change halfway (start times reflect it), a zero-length note, an overlapping pair, a ch-9 note (dropped).
- [ ] Step 2–4: FAIL → implement → PASS. Step 5: commit `feat: midi parser`.

### Task 4: Practice preparation

**Files:** Create `src/lib/game/prepare.ts`. Test `tests/prepare.test.ts`.

**Interfaces (Produces):**
```ts
type Level = 'off' | 'easy' | 'full';
interface Step { time: number; notes: Note[] }
interface Prepared { required: Note[]; auto: Note[]; steps: Step[]; lo: number; hi: number }
function prepare(song: Song, levels: { R: Level; L: Level }): Prepared
```
Easy keeps the highest R note or the lowest L note per 30 ms onset group; dropped notes go to `auto`. Range covers `required` (or all notes when both hands are off), is padded to the white key below/above, and is widened symmetrically to at least 15 white keys.

- [ ] Step 1: Tests: chord C4-E4-G4 in R with easy → required G4, auto C4+E4; L easy keeps lowest; both off → required empty, range from all notes; steps group notes 20 ms apart, split notes 40 ms apart; range lo/hi are white keys and span ≥ 15 white keys.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: practice preparation`.

### Task 5: Session engine

**Files:** Create `src/lib/game/session.ts`. Test `tests/session.test.ts`.

**Interfaces (Produces):**
```ts
type Mode = 'learn' | 'play' | 'watch';
type Judgment = 'perfect' | 'good' | 'miss' | 'wrong';
interface Stats { perfect; good; miss; wrong; combo; bestCombo; score; accuracy(): number; stars(): 0|1|2|3 }
class Session {
  constructor(p: Prepared, mode: Mode, speed: number, opts?: { leadIn?: number /*s, default 2.5*/ })
  clock: number; waiting: boolean; finished: boolean; stats: Stats; stepIndex: number;
  update(dtReal: number): void                 // dt clamped to 0.1 s
  press(midi: number): Judgment | null         // null = free key in watch mode
  pendingMidis(): Set<number>                  // keys to highlight in learn
  seek(t: number): void; setLoop(a: number | null, b: number | null): void
  autoHorizon(lookahead: number): number       // furthest song time safe to schedule auto notes
}
```
Learn: clock clamps to `step.time − 0.001` until all step midis have been pressed since the step became pending (presses within 250 ms × speed before the step count). Play: nearest unjudged required note with the same midi within 160 ms real time (`|Δsong| / speed`); notes past the window become `miss` during `update`. Accuracy: play = (perfect + 0.6·good) / total judged; learn = correct / (correct + wrong). `finished` when the clock passes the last note end + 1 s. Loop: when the clock ≥ b, seek(a).

- [ ] Step 1: Tests: learn waits at the first step and resumes after the right press; wrong press → `'wrong'` and no resume; chord needs all keys; early press within window counts; play judgments at +50 ms → perfect, +120 ms → good, unpressed → miss after the window; speed 0.5 doubles the song-time window; `update(5)` advances at most 0.1 s × speed; seek resets step index and judgments after t; `autoHorizon` never exceeds the pending step time in learn; loop wraps.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: session engine`.

### Task 6: Note detector (Listen mode)

**Files:** Create `src/lib/listen/detector.ts`. Test `tests/detector.test.ts` (with an in-test radix-2 FFT and harmonic tone generator).

**Interfaces (Produces):**
```ts
class NoteDetector {
  constructor(sampleRate: number, fftSize: number, opts?: { sensitivity?: number /*0..1, default 0.5*/ })
  process(magDb: Float32Array, timeMs: number): number[]   // midis with a new onset this frame
  level(): number                                          // 0..1 input meter
}
```
Per-note energy = Σ_{h=1..4} w_h·peak(h·f0 ± max(1 bin, 3%)), w = [1, .7, .5, .35]. Onset when energy > 4× slow baseline (τ ≈ 400 ms) and above an absolute floor scaled by sensitivity, is ≥ both semitone neighbours, and ≥ 120 ms since that note's last onset.

- [ ] Step 1: Tests: A4 tone → onset 69 only; C4+E4+G4 chord → contains 60, 64, 67, no neighbours; silence or white noise at −60 dB → none; the same note re-struck after decay → second onset; sustained tone → exactly one onset.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: listen-mode note detector`.

### Task 7: Keyboard geometry and touch tracking

**Files:** Create `src/lib/game/keyboard.ts`, `src/lib/game/keyinput.ts`. Test `tests/keyboard.test.ts`.

**Interfaces (Produces):**
```ts
interface Key { midi: number; black: boolean; x: number; w: number }
function layoutKeys(lo: number, hi: number, width: number): Key[]        // white keys equal width, black 0.6× width
function hitTest(keys: Key[], x: number, y: number, keyH: number): number | null  // black keys win in the top 62%
class KeyInput { down(pointerId: number, midi: number | null): {on?: number; off?: number}; move(pointerId, midi); up(pointerId): {off?: number}; cancelAll(): number[] }
```
`KeyInput` counts fingers per midi: a note turns off only when no pointer holds it. Sliding emits off(old) + on(new).

- [ ] Step 1: Tests: C4–B4 has 7 white + 5 black keys; C#4 sits between C4 and D4; a hit at the top of a C#4 region → 61 and at the bottom → 60 or 62; two pointers on C4, one up → no off; slide C4→D4 → off 60 / on 62; `cancelAll` returns every held midi once.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: keyboard geometry and touch tracking`.

### Task 8: Song library

**Files:** Create `src/lib/songs/catalog.ts` (built-in metadata + loader), `src/lib/songs/easy/*.ts` (notation songs). Copy MIDI to `public/songs/`. Test `tests/catalog.test.ts`.

**Interfaces (Produces):**
```ts
interface CatalogEntry { id; title; composer; difficulty: 1|2|3; art; credit?; kind: 'midi' | 'notation' | 'placeholder'; file?: string; maxSeconds?: number; transposeHands?: boolean }
const CATALOG: CatalogEntry[]
function loadSong(e: CatalogEntry, fetchBytes: (url: string) => Promise<Uint8Array>): Promise<Song>
```
Contents: Für Elise (easy theme + full), Twinkle, Ode to Joy, Happy Birthday, Jingle Bells, Canon in D (easy), Brahms Lullaby, Minuet in G, Prelude in C, Gymnopédie No. 1, Moonlight Sonata I, The Entertainer, Rondo alla Turca, Clair de Lune, Nocturne Op. 9 No. 2, Hall of the Mountain King, Arabesque (Burgmüller), Sonata Facile I, Gnossienne No. 1, Old French Song, and a River Flows in You placeholder.

- [ ] Step 1: Test: every non-placeholder entry loads (fetch reads from `public/`), has ≥ 16 notes, both hands where expected, notes in MIDI range 21–108, duration > 10 s; every notation song passes bar validation.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: song catalog`.

### Task 9: Audio and microphone shells

**Files:** Create `src/lib/audio/piano.ts`, `src/lib/audio/listen.ts`; copy samples to `public/samples/`.

**Interfaces (Produces):**
```ts
const piano: { ensureStarted(): Promise<void>; load(onProgress?: (f: number) => void): Promise<void>;
  noteOn(midi: number, vel?: number, when?: number): number /*voice id*/; noteOff(midi: number, when?: number): void;
  schedule(midi, vel, when, dur): void; cancelScheduled(): void; now(): number; setVolume(v: number): void; setReverb(on: boolean): void }
class MicError extends Error { kind: 'denied' | 'unavailable' }
function startListening(onNotes: (midis: number[]) => void, sensitivity: number): Promise<{ stop(): void; level(): number }>
```
iOS: `navigator.audioSession.type` = `'playback'` (or `'play-and-record'` while listening); resume the context on `visibilitychange` back to visible; 48-voice cap; release 0.35 s.

- [ ] Step 1: Build passes; manual check in Playwright (Task 12) that a key press creates a voice and no console errors appear.
- [ ] Step 2: Commit `feat: sampled piano and microphone input`.

### Task 10: Persistence

**Files:** Create `src/lib/storage/prefs.ts`, `src/lib/storage/imports.ts`. Test `tests/prefs.test.ts`.

**Interfaces (Produces):**
```ts
interface Settings { labels: 'letters' | 'solfege' | 'off'; volume: number; reverb: boolean; fallSeconds: number; sensitivity: number }
function getSettings(): Settings; function saveSettings(s: Settings): void
interface SongConfig { levels: { R: Level; L: Level }; mode: Mode; input: 'touch' | 'listen'; speed: number }
function getSongConfig(id: string): SongConfig; function saveSongConfig(id: string, c: SongConfig): void
function recordResult(id: string, stars: number, accuracy: number): { best: boolean }
function getBest(id: string): { stars: number; accuracy: number } | null
// imports.ts (IndexedDB)
function listImports(): Promise<{ id: string; title: string; addedAt: number }[]>
function addImport(title: string, bytes: Uint8Array): Promise<string>; function getImport(id: string): Promise<Uint8Array>; function deleteImport(id: string): Promise<void>
```
Corrupt or missing JSON → defaults (never throws).

- [ ] Step 1: Tests (in-memory localStorage stub): defaults; round trip; corrupt JSON → defaults; `recordResult` keeps the best.
- [ ] Step 2–5: FAIL → implement → PASS → commit `feat: persistence`.

### Task 11: Screens

**Files:** Create `src/screens/Library.svelte`, `SongSheet.svelte`, `Player.svelte`, `Results.svelte`, `FreePlay.svelte`, `Settings.svelte`, `ImportSheet.svelte`; `src/lib/game/renderer.ts` (canvas drawing); `src/lib/ui/state.svelte.ts` (screen router + shared runes).

**Interfaces:** consumes everything above. Renderer: `createRenderer(canvas): { resize(w, h, dpr); draw(frame: { clock; fallSeconds; keys; keyH; required; auto; pressed: Map<number, Hand | 'wrong' | 'free'>; pending: Set<number>; labels; effects }) }`.

- [ ] Step 1: Build each screen per the spec's Screens section. The player loop runs `requestAnimationFrame` → `session.update(dt)` → schedule auto notes up to `session.autoHorizon(0.15)` → draw. It pauses on `visibilitychange` hidden, holds a Screen Wake Lock while playing, and uses `touch-action: none` with pointer events routed through `KeyInput`.
- [ ] Step 2: `npm run build` exits 0; `npm test` PASS.
- [ ] Step 3: Commit `feat: screens`.

### Task 12: Verify in an emulated iPhone

- [ ] Step 1: `npm run preview`, then Playwright at 956×440 (landscape) and 440×956 with touch emulation: Library renders, open Für Elise → sheet → Start → tiles fall, a tap on a key lights it, Learn mode waits, Results appear after Watch at 1.2×. Screenshots reviewed; no console errors.
- [ ] Step 2: Fix findings; commit `fix: ...`.

### Task 13: PWA and deploy

**Files:** Create `public/icons/*` (generated PNG 180/192/512), `.github/workflows/deploy.yml`; modify `vite.config.ts` (manifest: name "Keyfall", display standalone, theme `#0b0b14`, orientation any; Workbox globPatterns include `mid,mp3`).

- [ ] Step 1: `gh repo create keyfall --public --source . --push`; enable Pages (build type workflow); the workflow runs `npm ci && npm test && npm run build` and uploads `dist`.
- [ ] Step 2: Verify `curl -sI https://<user>.github.io/keyfall/` → 200, the manifest and `sw.js` are served, and Playwright loads the live URL with no errors.
- [ ] Step 3: Final whole-branch code review (superpowers:requesting-code-review), fix, redeploy.
