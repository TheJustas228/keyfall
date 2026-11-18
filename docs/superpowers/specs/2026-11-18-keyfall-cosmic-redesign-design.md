# Keyfall "Ember Galaxy" redesign (design)

## Intent

The user sent eleven reference screenshots of a piano app and asked for something "very similar" in spirit:
a galaxy look in red/orange on black, planets for choosing the hand, lots of smooth animation, haptics
when touching things on screen (not on plain buttons), and a fun, beautiful UI. A different colorway or
theme is allowed. A video of the full UI will follow, and this build works from the screenshots.

The app stays a home-screen PWA. That is the only way to get a real app on the iPhone from this machine:
there is no Mac to build or sign a native app.

## Goals

- **Home:** starfield with rising embers, a glowing planet-horizon arc, a floating four-point star,
  "Hey!" and a serif headline "What would you like to do today?". Practice streak flame, a song-library
  pill and a menu. Buttons: "Continue learning" (last song), "Suggest something new", "Open song library".
- **Library:** back button, search, All / Favorites / Imports segments, Genre and Difficulty filters,
  "Recently played" and grouped sections, rows with planet thumbnails, a heart for favorites.
- **Song screen:** a large spinning planet for the song, its title and composer, and a Learn / Play switch.
  - Learn: a three-planet orbit carousel (Right hand, Left hand, Both hands), swipe or tap, with springy
    motion and a haptic tick. Difficulty Easy / Medium / Hard. Continue.
  - Play (scored): best-score ring or "No sessions yet", per-hand chips (Off / Easy / Hard), Continue.
  - A small "Play on" switch (Screen / My piano).
- **Player:** black stage, thin octave lines, rounded orange/blue note tiles with letters. Notes the app
  plays are drawn as outlines ("the empty ones"). A glowing hit line and a perspective 3D keyboard with
  glossy keys and C labels. An orange glow around the screen edge that flares on hits, and ember sparks.
  - Top: a ticked progress pill with an orange thumb, a pause button, and a skip/loop button.
  - Coach bubble with short lines: "Take a listen, then you try." / "Off you go, from the top." /
    "Only the colored notes are yours. I play the empty ones." / streak cheers / gentle help after mistakes.
  - Learn starts with a skippable preview of the opening (a "Preview only" pill). A mini 88-key map shows
    which part of the piano is in view.
- **Results ("Song overview"):** a count-up percentage, and a chart of the song's notes over time (by pitch)
  with an accuracy line drawn in. Buttons "Back to song library" and "Continue".
- **Haptics** (iOS 18 Safari switch-checkbox technique, `navigator.vibrate` elsewhere) on key touches,
  planet selection and streak milestones. Not on buttons. Can be turned off in Settings.
- Smooth 60–120 fps: canvas for the stage and planets, CSS transforms for UI motion, reduced-motion respected.

## Non-goals

An AI chat ("Ask Artie"), accounts, composer portraits (procedural planets replace them), and any use of the
reference app's name or assets.

## Approach

Keep the tested core (parser, session, detector, audio, storage) and replace the presentation layer.
- Planets: deterministic procedural textures (seeded by song id) rendered as true spheres on canvas.
  Lookup tables are precomputed so the hero planet can spin every frame cheaply.
- Fonts: Instrument Serif (OFL) bundled for headings, the system SF Pro for UI text.
- Palette: space black `#050307`, ember `#ff6a1f`, flame `#ff8f3c`, crimson `#d7263d`, gold `#ffc46b`,
  ivory text `#f6efe9`, glass `rgba(28,20,22,.72)` with a `rgba(255,160,110,.14)` hairline. Right hand is
  ember orange and the left hand is cosmic blue `#6ea8ff`, matching the hand planets.

## Mapping hand + difficulty to the engine

The chosen hands get `easy` (Easy) or `full` (Medium/Hard), and the other hand is `off` (played by the app).
Speed is Easy 0.7, Medium 0.85, Hard 1.0. Learn mode waits for you. Play mode uses its per-hand chips.
