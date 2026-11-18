# Keyfall

A falling-notes piano trainer built for iPhone (a home-screen web app). Pick a song, choose a
level for each hand, and play along on the screen or on a real piano. In "My piano" mode the
phone listens through the microphone.

## Install the iPhone app (free, with Sideloadly on Windows)

1. Download **Keyfall.ipa**: https://github.com/TheJustas228/keyfall/releases/latest/download/Keyfall.ipa
2. On your PC, install **Sideloadly** (sideloadly.io) plus **iTunes** and **iCloud** from apple.com
   (the Apple website versions, not the Microsoft Store ones).
3. Connect the iPhone with a cable, unlock it, and tap **Trust**.
4. Drag `Keyfall.ipa` into Sideloadly, type your Apple ID email, press **Start**, and enter your Apple ID password.
5. On the iPhone, turn on **Settings › Privacy & Security › Developer Mode** (the phone restarts).
   Then open **Settings › General › VPN & Device Management**, tap your Apple ID, and tap **Trust**.
6. Open Keyfall. Free Apple IDs make the install expire after 7 days: repeat step 4 weekly,
   or turn on Sideloadly's auto-refresh.

The same app also runs in Safari at https://thejustas228.github.io/keyfall/.

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

Pushing to `main` deploys the website (`.github/workflows/deploy.yml`) and builds `Keyfall.ipa` on a macOS runner
(`.github/workflows/ios.yml`), published as the latest GitHub Release. The native shell is Capacitor (`ios/`).

## Credits

- Piano samples: Salamander Grand Piano by Alexander Holm, CC BY 3.0.
- Classical scores: the Mutopia Project (public domain and CC BY-SA, credited on each song).
- Easy songs: simplified arrangements of public-domain melodies.
