# Keyfall Ember Galaxy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Keyfall's presentation layer with the Ember Galaxy design while keeping the tested engine.

**Architecture:** New pure helpers (config mapping, timeline buckets, streak/favorites/history) are TDD'd. Visual pieces (planets, starfield, screens, renderer) are verified with Playwright screenshots in an emulated iPhone 16 Pro Max.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, Canvas 2D, Playwright (bundled Chromium).

**Spec:** `docs/superpowers/specs/2026-11-18-keyfall-cosmic-redesign-design.md`

## Global Constraints

- Palette and fonts exactly as in the spec. Right hand `#ff7a2f`, left hand `#6ea8ff`.
- Haptics only on screen touches (keys, planets) and milestones, never on plain buttons. Settings toggle `haptics`.
- Everything keeps working offline (fonts bundled under `public/fonts`).
- Reduced motion: starfield and planet spin freeze, transitions shorten.

## Review Focus

1. Planet carousel swipe vs tap on iOS (a swipe must not also trigger a tap). Test: pointer-move threshold in `Carousel` logic (manual Playwright swipe).
2. Preview phase → main phase handoff: no leftover scheduled notes from the preview (cancelScheduled on handoff). Playwright check that the session starts at 0.
3. Results chart with zero-note buckets (both hands off / short songs) must not produce NaN paths. Unit test `timeline()`.
4. Streak across day boundaries and a missed day. Unit test `recordPractice`.
5. Favorites/history storage corrupt JSON → defaults. Unit test.

---

### Task 1: Pure helpers (TDD)
**Files:** `src/lib/game/levels.ts` (`levelsFor(hands: 'R'|'L'|'both', diff: 'easy'|'medium'|'hard'): { levels: {R: Level; L: Level}; speed: number }`); `src/lib/game/session.ts` (+ `timeline(buckets: number): (number|null)[]` and `stats.wrongTimes`); `src/lib/storage/prefs.ts` (+ `toggleFavorite(id): boolean`, `getFavorites(): string[]`, `recordPractice(today?: Date): number /*streak*/`, `getStreak(today?: Date): number`, `pushHistory(id)`, `getHistory(): string[]`, setting `haptics: boolean`).
- [ ] Tests first (`tests/levels.test.ts`, additions in `tests/session.test.ts` and `tests/prefs.test.ts`), see them fail, implement, see them pass, commit.

### Task 2: Visual foundations
**Files:** `public/fonts/instrument-serif.woff2`, `src/app.css` (tokens, @font-face), `src/lib/ui/haptics.ts` (`haptic(kind?: 'tick'|'success')`), `src/lib/ui/planets.ts` (`planetTexture(seed, palette)`, `createPlanetRenderer(canvas, opts)`, `planetThumb(id, size): string`), `src/lib/ui/Planet.svelte` (spinning canvas planet, optional ring), `src/lib/ui/Starfield.svelte` (stars + embers canvas).
- [ ] Build passes, screenshot of a test page shows planets render.

### Task 3: Home, Library, Song screen
**Files:** `src/screens/Home.svelte`, `src/screens/Library.svelte` (rewrite), `src/screens/SongScreen.svelte` (replaces SongSheet), `src/lib/ui/HandOrbit.svelte`, `src/App.svelte` routing (`home | library | song | player | results | free | settings`).
- [ ] Playwright screenshots at 440×956 and 956×440, with no console errors.

### Task 4: Player redesign
**Files:** `src/lib/game/renderer.ts` (rewrite visuals: perspective keyboard, outlined auto notes, glow line, embers), `src/lib/game/keyboard.ts` (+ `unproject`), `src/screens/Player.svelte` (preview phase, coach bubbles, edge glow, ticked progress, mini keyboard map, haptics).
- [ ] Playwright: learn flow advances when the glowing keys are tapped, preview can be skipped, no console errors.

### Task 5: Results overview, Settings, Import, Free play restyle
- [ ] Playwright screenshots, `npm test` green, `svelte-check` 0 errors. Commit, push to main (auto-deploys), verify the live URL.
