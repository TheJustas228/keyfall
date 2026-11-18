# Keyfall feedback round 1 — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD for every pure module.

**Goal:** Fix the six issues the user reported after installing the iOS app.

**Spec (the user's words):**
- "There is no sound on the preview."
- "the library has planets instead of the peoples' head."
- "make the planets an SVG or smth? ... it looks ugly with those pixels."
- "I don't want to scroll down when I pick my song and which hand I want to play. Also the easy, medium, hard thing is not needed."
- "improve the sound recognition, it doesn't pick up the right notes that I have to play."
- "let me go left and right on the keyboard ... Also let me zoom in and out in the keyboard."

## Diagnosis notes

- **No sound in the preview.** The most likely cause: in "My piano" mode the mic opens before the preview starts. iOS then switches the audio to play-and-record and routes the app's sound to the earpiece, while the code also drops the preview to 55% volume. Fixes:
  - Run the preview first with the mic off, and turn the mic on afterwards.
  - Native: force speaker output whenever the audio route changes while recording.
  - Defensive: a synthesized piano fallback if samples fail to decode, plus console logging in the release build so the CI simulator run can confirm the samples load.
- **Mic recognition.** In Learn mode, detections that aren't one of the expected notes count as wrong presses, and the fixed −70 dB floor ignores room noise and mic level. Fixes:
  - Count only expected notes heard by the mic, and ignore everything else.
  - Make the noise floor adaptive.
  - Accept an expected note when its fundamental or 2nd harmonic is present and it clearly rises.
  - Show what the mic hears on screen, so the user can report back.

## Tasks

1. `levelsFor(hands)`: drop difficulty. The chosen hands get `full` at speed 0.9; the other hand is `off`. Update `tests/levels.test.ts`.
2. `src/lib/game/view.ts`, a keyboard view window:
   - Functions: `fitView(lo, hi)`, `panView`, `zoomView(anchor)` (clamped to 8–52 white keys), `viewKeys(view, width)`.
   - Tests in `tests/view.test.ts`.
3. Detector:
   - Adaptive per-note noise floor, and lenient expected-note acceptance.
   - New tests: notes are heard over background noise at −50 dB, a low note is heard with its fundamental removed, and a wrong neighbouring note is not accepted as the expected one.
4. Visuals:
   - An SVG `Planet` (vector, crisp) replaces the canvas planet.
   - Public-domain composer portraits in `public/portraits` (credits in `src/lib/songs/portraits.ts`) appear in the library rows, the song hero and the Continue card.
   - Songs without a portrait get an SVG emblem.
5. Song screen:
   - No difficulty control.
   - Learn/Play tabs and the hand orbit for both modes.
   - Fits the screen in portrait and landscape with no scrolling.
6. Player:
   - Pan with a one-finger drag on the stage, pinch to zoom, − and + buttons, and a draggable mini-map.
   - Double-tap the stage to re-fit.
   - Arrows at the edges point to off-screen notes.
   - Listen flow: preview first, then turn on the mic. Count only expected notes. Show what the mic hears.
7. Native: route audio to the speaker during recording, and log in Release builds.
   CI: capture the app's console output in the simulator.
8. Verify:
   - Unit tests and svelte-check.
   - Playwright screenshots.
   - A CI iOS build plus the simulator log.
   - Then deploy.
