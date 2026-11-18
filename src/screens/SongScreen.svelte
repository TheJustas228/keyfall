<script lang="ts">
  import { onMount } from 'svelte';
  import Avatar from '../lib/ui/Avatar.svelte';
  import HandOrbit from '../lib/ui/HandOrbit.svelte';
  import { app, getSong, startPlaying, showToast, forgetSong, refreshImports } from '../lib/ui/store.svelte';
  import type { CatalogEntry } from '../lib/songs/catalog';
  import { getBest, getSongUi, saveSongUi, setLastSong, pushHistory, getFavorites, toggleFavorite, type SongUi, type SongConfig } from '../lib/storage/prefs';
  import { deleteImport } from '../lib/storage/imports';
  import { piano } from '../lib/audio/piano';
  import { levelsFor } from '../lib/game/levels';
  import type { Song } from '../lib/music/types';

  let { entry, onback }: { entry: CatalogEntry; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let ui = $state<SongUi>(getSongUi(entry.id));
  let song = $state<Song | null>(null);
  let error = $state('');
  // svelte-ignore state_referenced_locally
  let fav = $state(getFavorites().includes(entry.id));
  // svelte-ignore state_referenced_locally
  const best = getBest(entry.id);
  let shown = $state(false);
  let H = $state(800);
  let W = $state(400);

  // size everything from the screen so the page never needs scrolling
  const land = $derived(W > H);
  const heroSize = $derived(land ? Math.max(100, Math.min(180, H * 0.36)) : Math.max(110, Math.min(190, H * 0.17)));
  const orbitSize = $derived(land ? Math.max(64, Math.min(112, H * 0.2)) : Math.max(80, Math.min(132, H * 0.115)));

  $effect(() => {
    getSong(entry)
      .then((s) => (song = s))
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });
  onMount(() => {
    requestAnimationFrame(() => (shown = true));
  });

  const hasL = $derived(!song || song.notes.some((n) => n.hand === 'L'));
  const hasR = $derived(!song || song.notes.some((n) => n.hand === 'R'));
  const duration = $derived(song ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : '');

  async function start(mode: 'learn' | 'play' | 'watch') {
    if (!song) return;
    saveSongUi(entry.id, $state.snapshot(ui));
    setLastSong(entry.id);
    pushHistory(entry.id);
    await piano.ensureStarted();
    const l = levelsFor(ui.hands);
    let config: SongConfig;
    if (mode === 'watch') config = { levels: { R: 'full', L: 'full' }, speed: 1, mode: 'watch', input: 'touch' };
    else config = { levels: l.levels, speed: mode === 'learn' ? l.speed : 1, mode, input: ui.input };
    startPlaying(entry, song, config);
  }

  async function remove() {
    if (!entry.importId || !confirm(`Remove “${entry.title}” from your songs?`)) return;
    await deleteImport(entry.importId);
    forgetSong(entry.id);
    await refreshImports();
    showToast(`Removed ${entry.title}.`);
    onback();
  }
</script>

<svelte:window bind:innerHeight={H} bind:innerWidth={W} />

<div class="song" class:land class:shown>
  <header>
    <button class="orb-btn" aria-label="Back" onclick={onback}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    {#if entry.kind === 'import'}
      <button class="remove" onclick={remove}>Remove</button>
    {/if}
    <button class="orb-btn heart" class:on={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} onclick={() => (fav = toggleFavorite(entry.id))}>
      <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.6A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8c0 6-7.5 10.6-7.5 10.6z" /></svg>
    </button>
  </header>

  <section class="hero">
    <div class="halo" style:width="{heroSize * 1.32}px" style:height="{heroSize * 1.32}px">
      <svg class="rings" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="146" />
        <circle cx="150" cy="150" r="136" class="dash" />
      </svg>
      <Avatar {entry} size={heroSize} spin={30} />
    </div>
    <h1 class="serif">{entry.title}</h1>
    <p class="composer">
      {entry.composer}{duration ? `  ·  ${duration}` : ''}
      {#if best}<span class="best">Best {Math.round(best.accuracy * 100)}%{best.stars ? ` ${'★'.repeat(best.stars)}` : ''}</span>{/if}
    </p>
  </section>

  <section class="controls">
    <div class="tabs glass" role="tablist">
      <button role="tab" aria-selected={ui.tab === 'learn'} class:on={ui.tab === 'learn'} onclick={() => (ui.tab = 'learn')}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z" /></svg>
        Learn
      </button>
      <button role="tab" aria-selected={ui.tab === 'play'} class:on={ui.tab === 'play'} onclick={() => (ui.tab = 'play')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h10M3 11h10M3 16h6" /><path d="M17 4v11.5a2.5 2.5 0 1 1-2-2.45" /><path d="M17 4l4 1.5" /></svg>
        Play
      </button>
    </div>
    <p class="hint">{ui.tab === 'learn' ? 'The notes wait for you. Take your time.' : 'The notes keep moving. Hit them on time to score.'}</p>

    <HandOrbit size={orbitSize} value={ui.hands} onchange={(v) => (ui.hands = v)} disabled={{ L: !hasL, R: !hasR, both: !hasL || !hasR }} />

    <div class="input glass" role="radiogroup" aria-label="Play on">
      <button role="radio" aria-checked={ui.input === 'touch'} class:on={ui.input === 'touch'} onclick={() => (ui.input = 'touch')}>On screen</button>
      <button role="radio" aria-checked={ui.input === 'listen'} class:on={ui.input === 'listen'} onclick={() => (ui.input = 'listen')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        My piano
      </button>
    </div>

    {#if error}<p class="error">This song couldn’t be opened: {error}</p>{/if}
    <div class="go">
      <button class="btn-ember" disabled={!song || !app.pianoReady} onclick={() => start(ui.tab)}>
        {!song ? 'Loading song…' : !app.pianoReady ? `Tuning the piano ${Math.round(app.pianoProgress * 100)}%` : 'Continue'}
      </button>
      <button class="orb-btn listen" aria-label="Just listen to the song" disabled={!song || !app.pianoReady} onclick={() => start('watch')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>
      </button>
    </div>
  </section>
</div>

<style>
  .song {
    position: fixed;
    inset: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: calc(var(--sat) + 8px) calc(var(--sar) + 20px) calc(var(--sab) + 12px) calc(var(--sal) + 20px);
    background: radial-gradient(90% 45% at 50% 16%, rgba(120, 30, 10, 0.35), transparent 70%);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 2;
  }
  .remove {
    color: var(--danger);
    font-size: 15px;
    min-height: 44px;
    padding: 0 12px;
  }
  .heart svg {
    width: 26px;
    height: 26px;
    fill: transparent;
    stroke: var(--ivory);
    stroke-width: 2;
    transition: fill 0.25s, stroke 0.25s, transform 0.4s var(--spring);
  }
  .heart.on svg {
    fill: var(--ember);
    stroke: var(--ember);
    transform: scale(1.1);
  }
  .hero {
    display: grid;
    justify-items: center;
    text-align: center;
    margin-top: -26px;
  }
  .halo {
    position: relative;
    display: grid;
    place-items: center;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.7s ease, transform 1s var(--spring);
  }
  .shown .halo {
    opacity: 1;
    transform: none;
  }
  .halo :global(.avatar) {
    box-shadow: 0 0 0 1px rgba(255, 220, 200, 0.25), 0 0 40px rgba(255, 106, 31, 0.35);
  }
  .rings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: spin 60s linear infinite;
  }
  .rings circle {
    fill: none;
    stroke: rgba(255, 220, 200, 0.22);
    stroke-width: 1.2;
  }
  .rings .dash {
    stroke-dasharray: 2 7;
    stroke: rgba(255, 170, 120, 0.35);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  h1 {
    margin-top: 6px;
    font-size: clamp(30px, 8.5vw, 42px);
    line-height: 1.05;
  }
  .composer {
    margin-top: 6px;
    color: var(--muted);
    font-size: 16px;
    white-space: pre-wrap;
  }
  .best {
    display: inline-block;
    margin-left: 10px;
    padding: 2px 10px;
    border-radius: 999px;
    color: var(--gold);
    background: rgba(255, 196, 107, 0.1);
    box-shadow: inset 0 0 0 1px rgba(255, 196, 107, 0.3);
    font-size: 14px;
  }
  .controls {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 6px;
    margin: 12px auto 0;
    width: 100%;
    max-width: 520px;
  }
  .tabs {
    display: flex;
    padding: 4px;
    border-radius: 999px;
  }
  .tabs button {
    flex: 1;
    min-height: 46px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 17px;
    color: var(--muted);
    transition: color 0.2s, background 0.35s var(--ease-out);
  }
  .tabs button svg {
    width: 21px;
    height: 21px;
  }
  .tabs button.on {
    color: var(--ivory);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
  }
  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
  .input {
    display: flex;
    padding: 4px;
    border-radius: 999px;
    max-width: 320px;
    margin: 0 auto;
    width: 100%;
  }
  .input button {
    flex: 1;
    min-height: 40px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--muted);
    font-size: 15px;
  }
  .input button svg {
    width: 17px;
    height: 17px;
  }
  .input button.on {
    color: var(--ivory);
    background: rgba(255, 255, 255, 0.07);
  }
  .go {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .go .btn-ember {
    flex: 1;
  }
  .listen {
    width: 58px;
    height: 58px;
  }
  .listen:disabled,
  .btn-ember:disabled {
    opacity: 0.45;
  }
  .error {
    color: var(--danger);
    text-align: center;
    font-size: 14px;
  }

  /* sideways: picture and title on the left, choices on the right */
  .song.land {
    display: grid;
    grid-template-columns: minmax(240px, 40%) 1fr;
    grid-template-rows: auto 1fr;
    column-gap: 24px;
  }
  .land header {
    grid-column: 1 / -1;
    position: absolute;
    left: calc(var(--sal) + 20px);
    right: calc(var(--sar) + 20px);
    top: calc(var(--sat) + 8px);
  }
  .land .hero {
    grid-column: 1;
    grid-row: 1 / 3;
    align-self: center;
    margin: 0;
  }
  .land h1 {
    font-size: 34px;
  }
  .land .controls {
    grid-column: 2;
    grid-row: 1 / 3;
    margin: 0;
    padding-top: 48px;
    justify-content: space-between;
  }
</style>
