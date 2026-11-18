<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Starfield from './lib/ui/Starfield.svelte';
  import Home from './screens/Home.svelte';
  import Library from './screens/Library.svelte';
  import SongScreen from './screens/SongScreen.svelte';
  import ImportSheet from './screens/ImportSheet.svelte';
  import Player from './screens/Player.svelte';
  import Results from './screens/Results.svelte';
  import FreePlay from './screens/FreePlay.svelte';
  import Settings from './screens/Settings.svelte';
  import { app, go, refreshImports, startPlaying, type FinishStats } from './lib/ui/store.svelte';
  import { piano } from './lib/audio/piano';
  import { recordResult, recordPractice } from './lib/storage/prefs';
  import { setHapticsEnabled } from './lib/ui/haptics';

  function openImport(title = '') {
    app.importTitle = title;
    app.importOpen = true;
  }

  function finish(stats: FinishStats) {
    const p = app.playing!;
    const newBest = p.config.mode !== 'watch' && stats.stars > 0 ? recordResult(p.entry.id, stats.stars, stats.accuracy).best : false;
    const streak = p.config.mode === 'watch' ? 0 : recordPractice();
    app.result = { entry: p.entry, song: p.song, config: p.config, mode: p.config.mode, newBest, streak, ...stats };
    app.screen = 'results';
  }

  function again() {
    const r = app.result!;
    startPlaying(r.entry, r.song, r.config);
  }

  function exitPlayer() {
    app.playing = null;
    app.screen = app.song ? 'song' : 'home';
  }

  /** Screens rise in softly; this is the one orchestrated motion per navigation. */
  function screenIn(_: Element, { delay = 0 } = {}) {
    return {
      delay,
      duration: 420,
      easing: cubicOut,
      css: (t: number) => `opacity:${t};transform:translateY(${(1 - t) * 14}px) scale(${0.985 + 0.015 * t})`,
    };
  }

  const space = $derived(app.screen !== 'player' && app.screen !== 'free');

  $effect(() => setHapticsEnabled(app.settings.haptics));

  // Apply app updates only between songs, never mid-practice.
  let applyUpdate: (() => void) | null = null;
  $effect(() => {
    if (applyUpdate && (app.screen === 'home' || app.screen === 'library')) applyUpdate();
  });

  onMount(() => {
    refreshImports();
    piano.setVolume(app.settings.volume);
    piano.setReverb(app.settings.reverb);
    piano.load((f) => (app.pianoProgress = f)).then(() => (app.pianoReady = true));
    const unlock = () => piano.ensureStarted();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    const onUpdate = () => (applyUpdate = (window as unknown as { __kfUpdate?: () => void }).__kfUpdate ?? null);
    window.addEventListener('kf-update', onUpdate);
    return () => window.removeEventListener('kf-update', onUpdate);
  });
</script>

<Starfield active={space} embers={app.screen === 'home' ? 1 : 0.45} />

{#key app.screen}
  <div class="screen" in:screenIn out:fade={{ duration: 140 }}>
    {#if app.screen === 'home'}
      <Home onimport={openImport} />
    {:else if app.screen === 'library'}
      <Library onimport={openImport} />
    {:else if app.screen === 'song' && app.song}
      <SongScreen entry={app.song} onback={() => go(app.back === 'song' ? 'home' : app.back)} />
    {:else if app.screen === 'player' && app.playing}
      {#key app.playing.runId}
        <Player entry={app.playing.entry} song={app.playing.song} config={app.playing.config} onexit={exitPlayer} onfinish={finish} />
      {/key}
    {:else if app.screen === 'results' && app.result}
      <Results result={app.result} onagain={again} onback={() => { app.playing = null; go('library'); }} />
    {:else if app.screen === 'free'}
      <FreePlay onexit={() => go('home')} />
    {:else if app.screen === 'settings'}
      <Settings onexit={() => go('home')} />
    {/if}
  </div>
{/key}

{#if app.importOpen}
  <ImportSheet presetTitle={app.importTitle} onclose={() => (app.importOpen = false)} />
{/if}

{#if app.toast}
  <div class="toast glass" role="status" transition:fade={{ duration: 160 }}>{app.toast}</div>
{/if}

<style>
  .screen {
    position: fixed;
    inset: 0;
  }
  .toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--sab) + 18px);
    padding: 12px 20px;
    border-radius: 999px;
    background: var(--glass-strong);
    font-size: 15px;
    max-width: calc(100% - 32px);
    text-align: center;
    pointer-events: none;
    z-index: 50;
  }
</style>
