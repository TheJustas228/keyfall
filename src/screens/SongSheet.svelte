<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import Segmented from '../lib/ui/Segmented.svelte';
  import { app, getSong, startPlaying, showToast, forgetSong, refreshImports } from '../lib/ui/store.svelte';
  import type { CatalogEntry } from '../lib/songs/catalog';
  import { getBest, getSongConfig, saveSongConfig, setLastSong, type SongConfig } from '../lib/storage/prefs';
  import { deleteImport } from '../lib/storage/imports';
  import { piano } from '../lib/audio/piano';
  import type { Level } from '../lib/game/prepare';
  import type { Mode } from '../lib/game/session';
  import type { Song } from '../lib/music/types';

  let { entry, onclose }: { entry: CatalogEntry; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let cfg = $state<SongConfig>(getSongConfig(entry.id));
  let song = $state<Song | null>(null);
  let loadError = $state('');
  // svelte-ignore state_referenced_locally
  const best = getBest(entry.id);

  $effect(() => {
    getSong(entry)
      .then((s) => (song = s))
      .catch((e) => (loadError = e instanceof Error ? e.message : String(e)));
  });

  const levels: { value: Level; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'easy', label: 'Easy' },
    { value: 'full', label: 'Full' },
  ];
  const modes: { value: Mode; label: string }[] = [
    { value: 'learn', label: 'Learn' },
    { value: 'play', label: 'Play' },
    { value: 'watch', label: 'Watch' },
  ];
  const modeHelp: Record<Mode, string> = {
    learn: 'The notes wait for you. Take your time and find each key.',
    play: 'The notes keep moving. Hit them on time to score stars.',
    watch: 'Keyfall plays the whole song so you can see and hear it first.',
  };
  const inputs = [
    { value: 'touch' as const, label: 'Screen keys' },
    { value: 'listen' as const, label: 'My piano' },
  ];
  const inputHelp = {
    touch: 'Tap the keys on the screen.',
    listen: 'Play on a real piano. The microphone listens for the right notes (beta).',
  };

  const canStart = $derived(cfg.mode === 'watch' || cfg.levels.R !== 'off' || cfg.levels.L !== 'off');
  const handCount = $derived.by(() => {
    if (!song) return null;
    return { R: song.notes.filter((n) => n.hand === 'R').length, L: song.notes.filter((n) => n.hand === 'L').length };
  });
  const minutes = $derived(song ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : '');

  async function start() {
    if (!song || !canStart) return;
    saveSongConfig(entry.id, $state.snapshot(cfg));
    setLastSong(entry.id);
    await piano.ensureStarted();
    startPlaying(entry, song, $state.snapshot(cfg));
  }

  async function remove() {
    if (!entry.importId) return;
    if (!confirm(`Remove “${entry.title}” from your songs?`)) return;
    await deleteImport(entry.importId);
    forgetSong(entry.id);
    await refreshImports();
    showToast(`Removed ${entry.title}.`);
    onclose();
  }
</script>

<div class="scrim" transition:fade={{ duration: 160 }} onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={entry.title} transition:fly={{ y: 600, duration: 260, opacity: 1 }}>
  <button class="icon-btn close" aria-label="Close" onclick={onclose}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>

  <section class="about">
    <div class="cover" style:background="linear-gradient(140deg, {entry.art.from}, {entry.art.to})">{entry.art.emoji}</div>
    <div class="titles">
      <h2>{entry.title}</h2>
      <p class="composer">{entry.composer}</p>
      {#if song}
        <p class="facts">{minutes} long{best ? `, best ${best.stars}★ at ${Math.round(best.accuracy * 100)}%` : ''}</p>
      {/if}
      {#if entry.credit}<p class="credit">{entry.credit}</p>{/if}
      {#if entry.kind === 'import'}
        <button class="remove" onclick={remove}>Remove this song</button>
      {/if}
    </div>
  </section>

  <section class="controls">
    {#if loadError}
      <p class="error">This song couldn’t be opened: {loadError}</p>
    {/if}

    <div class="field">
      <span class="field-label">Mode</span>
      <Segmented label="Mode" options={modes} value={cfg.mode} onchange={(v) => (cfg.mode = v)} />
      <p class="help">{modeHelp[cfg.mode]}</p>
    </div>

    <div class="hands" class:muted={cfg.mode === 'watch'}>
      <div class="field">
        <span class="field-label"><i class="dot right"></i>Right hand</span>
        <Segmented label="Right hand" options={levels} value={cfg.levels.R} disabled={cfg.mode === 'watch' || handCount?.R === 0} onchange={(v) => (cfg.levels.R = v)} />
      </div>
      <div class="field">
        <span class="field-label"><i class="dot left"></i>Left hand</span>
        <Segmented label="Left hand" options={levels} value={cfg.levels.L} disabled={cfg.mode === 'watch' || handCount?.L === 0} onchange={(v) => (cfg.levels.L = v)} />
      </div>
      <p class="help span">
        {cfg.mode === 'watch' ? 'Watch plays both hands.' : 'Off: Keyfall plays that hand for you. Easy: just the melody notes.'}
      </p>
    </div>

    <div class="pair">

    {#if cfg.mode !== 'watch'}
      <div class="field">
        <span class="field-label">Play on</span>
        <Segmented label="Play on" options={inputs} value={cfg.input} onchange={(v) => (cfg.input = v)} />
        <p class="help">{inputHelp[cfg.input]}</p>
      </div>
    {/if}

    <div class="field">
      <span class="field-label">Speed <b>{Math.round(cfg.speed * 100)}%</b></span>
      <input
        type="range"
        min="0.4"
        max="1.2"
        step="0.1"
        value={cfg.speed}
        aria-label="Speed"
        oninput={(e) => (cfg.speed = Number((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
    </div>

    <div class="start">
      {#if !canStart}<p class="help warn">Turn on at least one hand, or choose Watch.</p>{/if}
      <button class="btn-primary" disabled={!song || !canStart} onclick={start}>
        {song ? (cfg.mode === 'watch' ? 'Watch the song' : 'Start playing') : 'Loading song…'}
      </button>
    </div>
  </section>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 7, 20, 0.6);
  }
  .sheet {
    position: fixed;
    inset: calc(var(--sat) + 10px) calc(var(--sar) + 10px) 0 calc(var(--sal) + 10px);
    display: grid;
    grid-template-columns: minmax(220px, 300px) 1fr;
    gap: 28px;
    padding: 22px 22px calc(var(--sab) + 16px);
    border-radius: 28px 28px 0 0;
    background: var(--midnight-2);
    box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.4);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 1;
  }
  .about {
    display: grid;
    align-content: start;
    gap: 16px;
  }
  .cover {
    aspect-ratio: 1;
    width: 100%;
    max-width: 300px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    font-size: 96px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
  h2 {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .composer {
    margin-top: 4px;
    font-size: 17px;
    color: var(--ivory-dim);
  }
  .facts {
    margin-top: 10px;
    font-size: 15px;
    font-weight: 600;
  }
  .credit {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ivory-dim);
  }
  .remove {
    margin-top: 12px;
    min-height: 40px;
    color: var(--danger);
    font-weight: 700;
  }
  .controls {
    display: grid;
    align-content: start;
    gap: 16px;
    padding-top: 8px;
    padding-right: 56px;
    max-width: 640px;
  }
  .field {
    display: grid;
    gap: 8px;
  }
  .field-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 750;
    font-size: 16px;
  }
  .field-label b {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .dot.right {
    background: var(--right);
  }
  .dot.left {
    background: var(--left);
  }
  .hands,
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
    align-items: start;
  }
  .span {
    grid-column: 1 / -1;
  }
  .help {
    color: var(--ivory-dim);
    font-size: 14px;
    line-height: 1.4;
  }
  .help.warn {
    color: var(--brass);
  }
  .error {
    color: var(--danger);
    font-weight: 650;
  }
  input[type='range'] {
    width: 100%;
    height: 44px;
    accent-color: var(--brass);
  }
  .start {
    position: sticky;
    bottom: 0;
    display: grid;
    gap: 8px;
    padding-top: 8px;
    background: linear-gradient(to top, var(--midnight-2) 70%, transparent);
  }
  .start .btn-primary:disabled {
    opacity: 0.5;
  }
  @media (max-width: 700px) {
    .sheet {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    .about {
      grid-template-columns: 120px 1fr;
      align-items: center;
    }
    .cover {
      font-size: 56px;
      border-radius: 20px;
    }
    .controls {
      padding-top: 0;
    }
    .pair {
      grid-template-columns: 1fr;
    }
    h2 {
      font-size: 24px;
    }
  }
</style>
