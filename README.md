# Keyfall

A falling-notes piano trainer built for iPhone (a home-screen web app). Pick a song, choose a
level for each hand, and play along on the screen or on a real piano. In "My piano" mode the
phone listens through the microphone.

## Install on iPhone

1. Open the app's address in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open Keyfall from the home screen. It runs full screen and works offline.

## Practice modes

- **Learn**: the notes wait until you press the right key.
- **Play**: the notes keep moving, and you get Perfect/Good/Miss and stars.
- **Watch**: Keyfall plays the whole song for you.

Each hand can be **Off** (Keyfall plays it), **Easy** (melody notes only) or **Full**.

## Adding songs (including River Flows in You)

Tap **Import MIDI** and choose any `.mid` file. River Flows in You is still under copyright,
so it isn't bundled. Download a MIDI of it, import it, and it replaces the placeholder card.

## Development

```bash
npm install
npm test        # unit tests (parser, engine, detector, ...)
npm run dev     # local dev server
npm run build   # production build in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Credits

- Piano samples: Salamander Grand Piano by Alexander Holm, CC BY 3.0.
- Classical scores: the Mutopia Project (public domain and CC BY-SA, credited on each song).
- Easy songs: simplified arrangements of public-domain melodies.
