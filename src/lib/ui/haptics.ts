import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Light haptic taps. In the iOS app this is the real Taptic Engine. In Safari
 * (no Vibration API) iOS 18 plays the system haptic when a native switch
 * checkbox toggles, so that is the web fallback. Call from a touch handler.
 */
let enabled = true;
let last = 0;
const native = Capacitor.isNativePlatform();

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function haptic(minGapMs = 35) {
  if (!enabled) return;
  const now = performance.now();
  if (now - last < minGapMs) return; // never buzz continuously
  last = now;
  try {
    if (native) {
      void Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
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
