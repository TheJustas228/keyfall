# Keyfall as a native iOS app (design)

## Intent

The user doesn't want a web app: "I want a proper app that I can use on my phone." They picked the free
install route: an app file (.ipa) installed from their Windows PC with Sideloadly and their own Apple ID,
re-installed every 7 days as Apple requires for free accounts.

## Approach (decided)

- **Wrap the existing Svelte app with Capacitor** (a native iOS shell around a WKWebView). It keeps the tested
  engine and the Ember Galaxy design, and native plugins and Swift code cover what the web couldn't.
- Alternatives set aside:
  - A full SwiftUI/Metal rewrite would mean months of re-implementing a working, tested app, and it can't be
    previewed from this Linux machine.
  - Expo/React Native would also be a rewrite, and its free installs face the same signing rules.
- **Build in the cloud:** a GitHub Actions macOS runner (free for public repos) builds an unsigned
  `Keyfall.ipa` and publishes it as a GitHub Release asset at a stable URL. Sideloadly re-signs it with the
  user's Apple ID during install.
- **Verification:** the same workflow builds for the iOS Simulator, launches the app, and captures screenshots
  as artifacts. That is the only way to see the native app from here.

## Native behaviour

- **Haptics:** `@capacitor/haptics` (UIImpactFeedbackGenerator) on native, with the existing web fallback.
- **Audio session:** `.playback` at launch, so the silent switch doesn't mute the piano. `.playAndRecord` with
  speaker output while the microphone is in use. Microphone permission text goes in Info.plist.
- **Screen:**
  - The idle timer is disabled while the app is open, so the screen stays awake during practice.
  - The status bar is hidden, and the home indicator auto-hides.
  - The bottom-edge system gesture is deferred, so playing low keys doesn't trigger the home swipe.
- **WebView:** body scrolling and bounce are off (inner lists still scroll). All orientations are allowed.
- **Web-only features turned off on native:** no service worker, and assets are served from the app bundle
  (base path `/` instead of `/keyfall/`).
- **Branding:** the existing Keyfall icon, plus a dark splash screen.

## Non-goals

App Store or TestFlight distribution (that would need the paid account).
