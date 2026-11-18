/**
 * Light haptic taps on iPhone. Safari has no Vibration API, but since iOS 18
 * toggling a native `<input type="checkbox" switch>` plays the system haptic.
 * Must be called from inside a touch/pointer handler.
 */
let enabled = true;
let last = 0;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function haptic(minGapMs = 35) {
  if (!enabled) return;
  const now = performance.now();
  if (now - last < minGapMs) return; // never buzz continuously
  last = now;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
      return;
    }
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    document.head.removeChild(label);
  } catch {
    /* no haptics on this device */
  }
}
