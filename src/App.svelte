<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Library from './screens/Library.svelte';
  import SongSheet from './screens/SongSheet.svelte';
  import ImportSheet from './screens/ImportSheet.svelte';
  import Player from './screens/Player.svelte';
  import Results from './screens/Results.svelte';
  import FreePlay from './screens/FreePlay.svelte';
  import Settings from './screens/Settings.svelte';
  import { app, refreshImports, startPlaying, type FinishStats } from './lib/ui/store.svelte';
  import { piano } from './lib/audio/piano';
  import { recordResult } from './lib/storage/prefs';
  import type { CatalogEntry } from './lib/songs/catalog';

  function openImport(title = '') {
    app.importTitle = title;
    app.importOpen = true;
  }

  function finish(stats: FinishStats) {
    const p = app.playing!;
    const newBest = p.config.mode !== 'watch' && stats.stars > 0 ? recordResult(p.entry.id, stats.stars, stats.accuracy).best : false;
    app.result = { entry: p.entry, song: p.song, config: p.config, mode: p.config.mode, newBest, ...stats };
    app.screen = 'results';
  }

  function again(speed?: number) {
    const r = app.result!;
    startPlaying(r.entry, r.song, speed ? { ...r.config, speed } : r.config);
  }

  function back() {
    app.screen = 'library';
    app.playing = null;
  }

  onMount(() => {
    refreshImports();
    piano.setVolume(app.settings.volume);
    piano.setReverb(app.settings.reverb);
    piano.load((f) => (app.pianoProgress = f)).then(() => (app.pianoReady = true));
    // iOS only lets audio start inside a touch; unlock on the first one anywhere.
    const unlock = () => piano.ensureStarted();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  });
</script>

{#if app.screen === 'library'}
  <Library onopen={(e: CatalogEntry) => (app.sheet = e)} onimport={openImport} />
{:else if app.screen === 'player' && app.playing}
  {#key app.playing.runId}
    <Player song={app.playing.song} config={app.playing.config} onexit={back} onfinish={finish} />
  {/key}
{:else if app.screen === 'results' && app.result}
  <Results
    result={app.result}
    onagain={again}
    onback={back}
    onlearn={() => {
      const r = app.result!;
      startPlaying(r.entry, r.song, { ...r.config, mode: 'learn', speed: Math.min(r.config.speed, 0.8) });
    }}
  />
{:else if app.screen === 'free'}
  <FreePlay onexit={back} />
{:else if app.screen === 'settings'}
  <Settings onexit={back} />
{/if}

{#if app.sheet}
  <SongSheet entry={app.sheet} onclose={() => (app.sheet = null)} />
{/if}
{#if app.importOpen}
  <ImportSheet presetTitle={app.importTitle} onclose={() => (app.importOpen = false)} />
{/if}

{#if !app.pianoReady && app.screen !== 'player'}
  <div class="loading" transition:fade>Loading piano sounds {Math.round(app.pianoProgress * 100)}%</div>
{/if}
{#if app.toast}
  <div class="toast" role="status" transition:fade={{ duration: 150 }}>{app.toast}</div>
{/if}

<style>
  .loading,
  .toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--sab) + 16px);
    padding: 10px 18px;
    border-radius: 14px;
    background: rgba(24, 32, 74, 0.96);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    font-weight: 650;
    font-size: 15px;
    max-width: calc(100% - 32px);
    text-align: center;
    pointer-events: none;
  }
  .loading {
    color: var(--ivory-dim);
  }
</style>
