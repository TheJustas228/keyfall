<script lang="ts">
  import { onDestroy } from 'svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import { app, updateSettings } from '../lib/ui/store.svelte';
  import { piano } from '../lib/audio/piano';
  import { startListening, MicError, type Listener } from '../lib/audio/listen';
  import { Capacitor } from '@capacitor/core';

  const native = Capacitor.isNativePlatform();

  let { onexit }: { onexit: () => void } = $props();

  let micTest = $state<Listener | null>(null);
  let micLevel = $state(0);
  let heard = $state<string[]>([]);
  let micError = $state('');
  let timer = 0;
  const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  async function toggleMic() {
    if (micTest) return stopMic();
    micError = '';
    try {
      micTest = await startListening((m) => {
        heard = [...heard, ...m.map((x) => NAMES[x % 12] + (Math.floor(x / 12) - 1))].slice(-8);
      }, app.settings.sensitivity);
      timer = window.setInterval(() => (micLevel = micTest?.level() ?? 0), 50);
    } catch (e) {
      micError = e instanceof MicError ? e.message : 'The microphone couldn’t start.';
    }
  }
  function stopMic() {
    micTest?.stop();
    micTest = null;
    clearInterval(timer);
    micLevel = 0;
  }
  onDestroy(stopMic);

  function onSensitivity(v: number) {
    updateSettings({ sensitivity: v });
    if (micTest) {
      stopMic();
      toggleMic();
    }
  }
</script>

<div class="settings">
  <header>
    <button class="orb-btn" aria-label="Back to song list" onclick={onexit}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <h1 class="serif">Settings</h1>
  </header>

  <div class="cols">
    <section>
      <h2>Notes</h2>
      <div class="field">
        <span>Names on notes and keys</span>
        <Segmented
          label="Note names"
          options={[
            { value: 'letters', label: 'C D E' },
            { value: 'solfege', label: 'Do Re Mi' },
            { value: 'off', label: 'Off' },
          ]}
          value={app.settings.labels}
          onchange={(v) => updateSettings({ labels: v })}
        />
      </div>
      <label class="toggle">
        <span>Show names on the keyboard</span>
        <input type="checkbox" checked={app.settings.keyLabels} onchange={(e) => updateSettings({ keyLabels: (e.currentTarget as HTMLInputElement).checked })} />
      </label>
      <div class="field">
        <span>Falling speed <b>{app.settings.fallSeconds <= 1.8 ? 'Fast' : app.settings.fallSeconds >= 3.2 ? 'Relaxed' : 'Normal'}</b></span>
        <input
          type="range"
          min="1.4"
          max="4"
          step="0.2"
          value={5.4 - app.settings.fallSeconds}
          aria-label="Falling speed"
          oninput={(e) => updateSettings({ fallSeconds: Math.round((5.4 - Number((e.currentTarget as HTMLInputElement).value)) * 10) / 10 })}
        />
        <p class="help">How fast the notes travel down the screen. Slower gives you more time to read ahead.</p>
      </div>

      <h2>Feel</h2>
      <label class="toggle">
        <span>Haptic taps on the piano keys</span>
        <input type="checkbox" checked={app.settings.haptics} onchange={(e) => updateSettings({ haptics: (e.currentTarget as HTMLInputElement).checked })} />
      </label>

      <h2>Sound</h2>
      <div class="field">
        <span>Volume <b>{Math.round(app.settings.volume * 100)}%</b></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={app.settings.volume}
          aria-label="Volume"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updateSettings({ volume: v });
            piano.setVolume(v);
          }}
        />
      </div>
      <label class="toggle">
        <span>Concert hall reverb</span>
        <input
          type="checkbox"
          checked={app.settings.reverb}
          onchange={(e) => {
            const on = (e.currentTarget as HTMLInputElement).checked;
            updateSettings({ reverb: on });
            piano.setReverb(on);
          }}
        />
      </label>
    </section>

    <section>
      <h2>Playing on a real piano</h2>
      <p class="help">
        Choose “My piano” before starting a song and Keyfall listens through the microphone. This works best in a quiet room with the phone on the music
        rest. Test it here first.
      </p>
      <div class="field">
        <span>Microphone sensitivity <b>{Math.round(app.settings.sensitivity * 100)}%</b></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={app.settings.sensitivity}
          aria-label="Microphone sensitivity"
          onchange={(e) => onSensitivity(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <p class="help">Raise it if quiet notes are missed. Lower it if notes you didn’t play show up.</p>
      </div>
      <button class="btn-glass" onclick={toggleMic}>{micTest ? 'Stop the test' : 'Test the microphone'}</button>
      {#if micError}<p class="error">{micError}</p>{/if}
      {#if micTest}
        <div class="meter"><div style:width="{micLevel * 100}%"></div></div>
        <p class="heard">{heard.length ? `Heard: ${heard.join('  ')}` : 'Play a few notes on your piano.'}</p>
      {/if}

      <h2>About</h2>
      <p class="help">
        Piano sound: Salamander Grand Piano by Alexander Holm, CC BY 3.0. Classical scores: the Mutopia Project (public domain and CC BY-SA, credited on each
        song). Easy songs are simplified arrangements of public-domain melodies.
      </p>
      {#if !native}
        <p class="help">To install Keyfall, open it in Safari, tap Share, then Add to Home Screen. It then works offline.</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .settings {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: calc(var(--sat) + 12px) calc(var(--sar) + 18px) calc(var(--sab) + 28px) calc(var(--sal) + 18px);
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  h1 {
    font-size: 40px;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 8px 40px;
    max-width: 980px;
  }
  section {
    display: grid;
    align-content: start;
    gap: 14px;
  }
  h2 {
    margin-top: 22px;
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
  }
  .field {
    display: grid;
    gap: 8px;
    font-weight: 650;
  }
  .field span {
    display: flex;
  }
  .field b {
    margin-left: auto;
  }
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    font-weight: 650;
  }
  .toggle input {
    width: 26px;
    height: 26px;
    accent-color: var(--ember);
  }
  input[type='range'] {
    width: 100%;
    height: 40px;
    accent-color: var(--ember);
  }
  .help {
    color: var(--ivory-dim);
    font-size: 14px;
    line-height: 1.5;
    font-weight: 400;
  }
  .error {
    color: var(--danger);
    font-weight: 650;
  }
  .meter {
    height: 10px;
    border-radius: 5px;
    background: rgba(245, 239, 227, 0.12);
    overflow: hidden;
  }
  .meter div {
    height: 100%;
    background: linear-gradient(90deg, var(--ember), var(--gold));
    transition: width 0.05s linear;
  }
  .heard {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
