# Keyfall: falling-notes piano trainer for iPhone (design)

## Intent and the why

A personal piano-learning app for one user on an **iPhone 16 Pro Max**, modelled on the
"Artie" app in the two reference Shorts. In those, the phone lies sideways on the stand of a
real keyboard, colored tiles fall onto an on-screen keyboard labelled C3/C4/C5, and before
starting you pick a level per hand ("Off" / "Easy"). The user wants a library of songs,
specifically **Für Elise** and **River Flows in You**, plus more. It must be smooth and very
easy to use.

The user handed over every "how" decision ("build in any way you want"), so the calls below are mine.

## Goals

- Open from the home-screen icon, full screen and offline, and feel like a native app.
- Library of songs, with Für Elise prominent and River Flows in You one tap away (see Constraints).
- Falling-notes player over a piano keyboard that auto-fits each song's range, landscape-first.
- Three ways to practise: **Learn** (waits for the right key), **Play** (keeps time, scored), **Watch** (auto-play demo).
- Per-hand level: **Off** (the app plays that hand), **Easy** (melody line only), **Full**.
- Two input methods: **touch** on the screen keyboard, and **Listen** (microphone hears a real piano).
- Realistic piano sound (sampled grand piano), low latency, multi-touch, glissando.
- Speed control, seek/scrub, loop a section, results with stars, progress saved.
- Import any MIDI file (this is how River Flows in You and any other pop song gets in).

## Non-goals

- Accounts, cloud sync, social features, payments, ads.
- Sheet-music notation view.
- A native App Store build (no Mac or Xcode toolchain here, and it would need a $99/yr developer account).

## Anti-goals (it fails even if it "works")

- Laggy touch response or audio crackle.
- Fiddly small controls when the phone sits on a music stand an arm's length away.
- Wrong notes in the built-in songs.
- Needing the network after the first load.

## Constraints

- iOS Safari / home-screen web app: no Web MIDI, Web Audio must be unlocked by a gesture,
  the silent switch mutes Web Audio unless `navigator.audioSession.type` is set (Safari 16.4+),
  and orientation can't be locked (show a rotate hint instead).
- Landscape on the 16 Pro Max is ~956×440 pt with ~60 pt safe-area insets left and right (Dynamic Island).
- **Copyright:** River Flows in You (Yiruma, 2001) is under copyright, so its notes can't
  be bundled. The library shows a "River Flows in You" card that opens the MIDI import with
  instructions. A file the user imports is matched to that card and replaces it.
- Built-in classical pieces come from the **Mutopia Project** (engraved from scores, quantized,
  one track per hand), licensed Public Domain or CC BY-SA, with credits shown in-app.
  Very easy songs (Twinkle, Ode to Joy, Happy Birthday, Jingle Bells, an easy Canon in D,
  an easy Für Elise theme…) are my own arrangements of public-domain melodies, written in a
  compact text notation whose bar lengths are validated by tests.
- Piano sound: Salamander Grand Piano samples (CC BY 3.0, Alexander Holm), 30 samples
  (every minor third, A0–C8), pitch-shifted between samples. About 2 MB, cached offline.

## Approaches considered

1. **PWA: Svelte 5 + TypeScript + Vite, canvas renderer, GitHub Pages** (picked).
   Installs from Safari onto the home screen, runs full screen and offline, and is a single codebase.
   Canvas 2D handles 120 Hz falling notes easily on an A18 Pro. Svelte compiles to a tiny runtime.
2. Native SwiftUI app: best audio latency, but can't be built or signed from this Linux/WSL
   machine without a Mac, and sideloading expires every 7 days.
3. React Native / Expo: needs the Expo Go app or an EAS build plus an Apple account. Heavier, with no real
   gain for a single user.

## Design

### Screens

1. **Library (home)**: big "Continue" card for the last song; a grid of song cards
   (gradient artwork + emoji, title, composer, difficulty dots, best stars); filter chips
   (All · Easy · Medium · Hard · Imported); buttons for Free Play, Import, Settings.
2. **Song sheet** (modal, like Artie): artwork, title, composer, credit line; per-hand
   segmented controls (Off / Easy / Full); mode (Learn / Play / Watch); input (Touch / Listen);
   speed (40–120%); big **Start** button. The last choice is remembered per song.
3. **Player** (landscape-first): top bar with ✕, progress scrubber (drag to seek, long-press
   to set loop A/B), pause, speed. Falling tiles in hand colors (right = cyan/blue,
   left = coral/orange; auto-played notes dim), note names on tiles, glowing hit line, keys
   light up with hand color, octave labels (C3, C4…) on the keyboard, particles and "Perfect"/"Good"
   pop-ups in Play mode. Learn mode freezes tiles on the line and pulses the target keys.
   Portrait shows a dismissible "rotate for a bigger keyboard" hint.
4. **Results**: stars, accuracy, perfect/good/miss, best streak, Retry / Next / Library.
5. **Free Play**: a plain piano with an octave shifter and a keys-visible slider.
6. **Settings**: note labels (Letters / Do-Re-Mi / Off), volume, reverb, falling speed,
   Listen sensitivity + mic test meter, credits/licenses.

### Engine (pure, unit-tested)

- `Song` = `notes[] {midi, start(s), dur(s), hand, vel}` + metadata.
- `prepare(song, levels)` → `required` (user plays), `auto` (app plays), `steps`
  (required notes grouped by onset within 30 ms), display range (padded, min 2 octaves).
  Easy = highest note of each right-hand onset group / lowest of each left-hand group; the dropped notes go to auto.
- `Session` advances a song clock by real dt × speed. **Learn**: clock clamps just before the
  next unfinished step until every note in it has been pressed since it became pending (early
  presses within 250 ms count). **Play**: judgments by real-time error (≤70 ms Perfect,
  ≤160 ms Good, later = Miss), combo, score. **Watch**: everything auto.
  Stars: ≥60% → 1, ≥80% → 2, ≥95% → 3.
- Auto notes are scheduled on the audio clock with a 150 ms lookahead, never past the next
  pending Learn step. Pause and seek cancel future voices.

### Audio

Web Audio sampler: nearest sample + playbackRate, velocity gain, release envelope on key-up,
voice stealing at 48 voices, light algorithmic reverb, compressor. Unlocks on first touch,
`audioSession.type = 'playback'` (`'play-and-record'` while listening).

### Listen mode (microphone)

`getUserMedia` with echo cancellation/noise suppression/AGC off → AnalyserNode (8192 FFT).
A pure detector computes per-note harmonic energy (fundamental + 3 harmonics), keeps a slow
per-note baseline, and reports an **onset** when energy jumps above the baseline, beats an absolute
floor, and is a local maximum against neighbouring semitones. Because the app knows which notes
it expects, it only has to confirm those (template matching), which is far more reliable than
open-ended polyphonic transcription. Labelled "beta". Latency compensation is applied in Play mode.

### Persistence

localStorage: settings, per-song best (stars/accuracy) and last config. IndexedDB: imported
MIDI bytes. Service worker (Workbox via vite-plugin-pwa) precaches app, songs and samples.

### MIDI import

Own SMF parser (format 0/1, running status, tempo map, ignores drums on channel 10).
Hands: with two or more note tracks, the higher-pitched track is the right hand. With one track,
notes split around a running pitch midpoint (default middle C).

### Delivery

Public GitHub repo `keyfall` → GitHub Actions → GitHub Pages (HTTPS, which the service worker
and microphone require). The user opens the URL in Safari → Share → Add to Home Screen.

## Left to the builder

Exact colors and typography (within: dark stage, high contrast, SF Rounded), song card art,
particle details, and the list of extra easy songs.
