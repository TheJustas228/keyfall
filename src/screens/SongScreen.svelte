<script lang="ts">
  import { onMount } from 'svelte';
  import Planet from '../lib/ui/Planet.svelte';
  import HandOrbit from '../lib/ui/HandOrbit.svelte';
  import { app, getSong, startPlaying, showToast, forgetSong, refreshImports } from '../lib/ui/store.svelte';
  import type { CatalogEntry } from '../lib/songs/catalog';
  import { getBest, getSongUi, saveSongUi, setLastSong, pushHistory, getFavorites, toggleFavorite, type SongUi, type SongConfig } from '../lib/storage/prefs';
  import { deleteImport } from '../lib/storage/imports';
  import { piano } from '../lib/audio/piano';
  import { levelsFor } from '../lib/game/levels';
  import type { Level } from '../lib/game/prepare';
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
  let compact = $state(false);

  $effect(() => {
    getSong(entry)
      .then((s) => (song = s))
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });
  onMount(() => {
    requestAnimationFrame(() => (shown = true));
    const mq = matchMedia('(orientation: landscape) and (max-height: 560px)');
    const set = () => (compact = mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  });

  const hasL = $derived(!song || song.notes.some((n) => n.hand === 'L'));
  const hasR = $derived(!song || song.notes.some((n) => n.hand === 'R'));
  const duration = $derived(song ? `${Math.floor(song.duration / 60)}:${String(Math.round(song.duration % 60)).padStart(2, '0')}` : '');
  const playLevels: Level[] = ['off', 'easy', 'full'];
  const levelName: Record<Level, string> = { off: 'Off', easy: 'Easy', full: 'Hard' };
  const canPlay = $derived(ui.play.R !== 'off' || ui.play.L !== 'off');

  function cycle(hand: 'R' | 'L') {
    const i = playLevels.indexOf(ui.play[hand]);
    ui.play[hand] = playLevels[(i + 1) % 3];
  }

  async function start(mode: 'learn' | 'play' | 'watch') {
    if (!song) return;
    saveSongUi(entry.id, $state.snapshot(ui));
    setLastSong(entry.id);
    pushHistory(entry.id);
    await piano.ensureStarted();
    let config: SongConfig;
    if (mode === 'learn') {
      const l = levelsFor(ui.hands, ui.diff);
      config = { levels: l.levels, speed: l.speed, mode: 'learn', input: ui.input };
    } else if (mode === 'play') {
      config = { levels: { ...ui.play }, speed: 1, mode: 'play', input: ui.input };
    } else {
      config = { levels: { R: 'full', L: 'full' }, speed: 1, mode: 'watch', input: 'touch' };
    }
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

  const ringPct = best ? Math.round(best.accuracy * 100) : 0;
  const C = 2 * Math.PI * 92;
</script>

<div class="song" class:shown>
  <header>
    <button class="orb-btn" aria-label="Back" onclick={onback}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <button class="orb-btn heart" class:on={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} onclick={() => (fav = toggleFavorite(entry.id))}>
      <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.6A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8c0 6-7.5 10.6-7.5 10.6z" /></svg>
    </button>
  </header>

  <section class="hero">
    <div class="halo">
      <svg class="rings" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="140" />
        <circle cx="150" cy="150" r="128" class="dash" />
      </svg>
      <Planet seed={entry.id} palette={entry.palette} size={176} spin={0.025} />
    </div>
    <h1 class="serif">{entry.title}</h1>
    <p class="composer">{entry.composer}{duration ? `  ·  ${duration}` : ''}</p>
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

    {#key ui.tab}
      <div class="pane">
        {#if ui.tab === 'learn'}
          <HandOrbit {compact} value={ui.hands} onchange={(v) => (ui.hands = v)} disabled={{ L: !hasL, R: !hasR, both: !hasL || !hasR }} />
          <div class="diff glass" role="radiogroup" aria-label="Difficulty">
            {#each [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] as [v, l]}
              <button role="radio" aria-checked={ui.diff === v} class={v} class:on={ui.diff === v} onclick={() => (ui.diff = v as SongUi['diff'])}>{l}</button>
            {/each}
          </div>
          <p class="hint">
            {ui.diff === 'easy' ? 'Melody notes only, at a gentle pace. The notes wait for you.' : ui.diff === 'medium' ? 'Every note, a little slower than written. The notes wait for you.' : 'Every note at full speed. The notes wait for you.'}
          </p>
        {:else}
          <div class="score">
            {#if best}
              <svg viewBox="0 0 200 200" class="ringchart">
                <circle cx="100" cy="100" r="92" class="track" />
                <circle cx="100" cy="100" r="92" class="val" style:stroke-dasharray="{(C * ringPct) / 100} {C}" />
              </svg>
              <div class="scoretext">
                <b class="serif">{ringPct}%</b>
                <span>Best score{best.stars ? `  ${'★'.repeat(best.stars)}` : ''}</span>
              </div>
            {:else}
              <svg viewBox="0 0 200 200" class="ringchart"><circle cx="100" cy="100" r="92" class="dots" /></svg>
              <div class="scoretext">
                <b>No sessions yet</b>
                <span>Play once and your score appears here.</span>
              </div>
            {/if}
          </div>
          <div class="hands">
            {#each [['L', 'Left hand'], ['R', 'Right hand']] as [h, label]}
              {@const lv = ui.play[h as 'R' | 'L']}
              <button class="handcard" aria-label="{label}: {levelName[lv]}" disabled={h === 'L' ? !hasL : !hasR} onclick={() => cycle(h as 'R' | 'L')}>
                <span class="lvl {lv}">{levelName[lv]}</span>
                <span class="card glass">
                  <svg viewBox="0 0 24 24" class:mirror={h === 'R'}><path d="M8.5 21c-2.2-1.2-4-3.7-4.5-6.8l-.6-3.3c-.2-.9.4-1.6 1.2-1.7.7-.1 1.3.4 1.5 1.1l.8 2.5V5.2c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4V11h.6V3.6c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4V11h.6V4.6c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4V11h.6V6.8c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v7.4c0 3.6-2 6.8-6.3 6.8z" /></svg>
                </span>
              </button>
            {/each}
          </div>
          <p class="hint">Tap a hand to switch between Off, Easy and Hard. The notes keep moving and you score points.</p>
        {/if}
      </div>
    {/key}

    <div class="input glass" role="radiogroup" aria-label="Play on">
      <button role="radio" aria-checked={ui.input === 'touch'} class:on={ui.input === 'touch'} onclick={() => (ui.input = 'touch')}>On screen</button>
      <button role="radio" aria-checked={ui.input === 'listen'} class:on={ui.input === 'listen'} onclick={() => (ui.input = 'listen')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        My piano
      </button>
    </div>

    {#if error}<p class="error">This song couldn’t be opened: {error}</p>{/if}
    <button class="btn-ember go" disabled={!song || !app.pianoReady || (ui.tab === 'play' && !canPlay)} onclick={() => start(ui.tab)}>
      {!song ? 'Loading song…' : !app.pianoReady ? `Tuning the piano ${Math.round(app.pianoProgress * 100)}%` : 'Continue'}
    </button>
    <div class="links">
      <button onclick={() => start('watch')} disabled={!song || !app.pianoReady}>Just listen to it</button>
      {#if entry.kind === 'import'}<button class="danger" onclick={remove}>Remove song</button>{/if}
    </div>
    {#if entry.credit}<p class="credit">{entry.credit}</p>{/if}
  </section>
</div>

<style>
  .song {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: calc(var(--sat) + 12px) calc(var(--sar) + 20px) calc(var(--sab) + 24px) calc(var(--sal) + 20px);
    background: radial-gradient(90% 50% at 50% 18%, rgba(120, 30, 10, 0.35), transparent 70%);
  }
  header {
    display: flex;
    justify-content: space-between;
    position: relative;
    z-index: 2;
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
    margin-top: -20px;
  }
  .halo {
    position: relative;
    width: 270px;
    height: 270px;
    display: grid;
    place-items: center;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.7s ease, transform 1s var(--spring);
  }
  .shown .halo {
    opacity: 1;
    transform: none;
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
    to { transform: rotate(360deg); }
  }
  h1 {
    margin-top: 4px;
    font-size: clamp(36px, 10vw, 46px);
    line-height: 1.05;
  }
  .composer {
    margin-top: 8px;
    color: var(--muted);
    font-size: 18px;
    white-space: pre;
  }
  .hero h1,
  .hero .composer {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.6s ease 0.2s, transform 0.7s var(--ease-out) 0.2s;
  }
  .shown .hero h1,
  .shown .hero .composer {
    opacity: 1;
    transform: none;
  }
  .controls {
    display: grid;
    gap: 16px;
    margin: 22px auto 0;
    max-width: 520px;
  }
  .tabs {
    display: flex;
    padding: 5px;
    border-radius: 999px;
  }
  .tabs button {
    flex: 1;
    min-height: 50px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 18px;
    color: var(--muted);
    transition: color 0.2s, background 0.35s var(--ease-out);
  }
  .tabs button svg {
    width: 22px;
    height: 22px;
  }
  .tabs button.on {
    color: var(--ivory);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
  }
  .pane {
    display: grid;
    gap: 14px;
    animation: paneIn 0.45s var(--ease-out);
  }
  @keyframes paneIn {
    from { opacity: 0; transform: translateY(12px); }
  }
  .diff {
    display: flex;
    padding: 5px;
    border-radius: 999px;
  }
  .diff button {
    flex: 1;
    min-height: 50px;
    border-radius: 999px;
    font-size: 18px;
    color: var(--faint);
    transition: color 0.25s, background 0.35s var(--ease-out), box-shadow 0.35s;
  }
  .diff button.on {
    background: rgba(0, 0, 0, 0.35);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
  }
  .diff .easy.on { color: var(--gold); text-shadow: 0 0 14px rgba(255, 196, 107, 0.6); }
  .diff .medium.on { color: var(--flame); text-shadow: 0 0 14px rgba(255, 143, 60, 0.6); }
  .diff .hard.on { color: #ff4d5e; text-shadow: 0 0 14px rgba(255, 77, 94, 0.6); }
  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.4;
  }
  .score {
    position: relative;
    width: 230px;
    height: 230px;
    margin: 0 auto;
    display: grid;
    place-items: center;
  }
  .ringchart {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }
  .ringchart circle {
    fill: none;
    stroke-width: 6;
  }
  .ringchart .track {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .ringchart .val {
    stroke: var(--ember);
    stroke-linecap: round;
    filter: drop-shadow(0 0 8px rgba(255, 106, 31, 0.7));
    animation: draw 1.4s var(--ease-out);
  }
  @keyframes draw {
    from { stroke-dasharray: 0 999; }
  }
  .ringchart .dots {
    stroke: rgba(255, 255, 255, 0.28);
    stroke-width: 2;
    stroke-dasharray: 1 7;
    stroke-linecap: round;
    animation: spin 40s linear infinite;
    transform-origin: center;
  }
  .scoretext {
    display: grid;
    gap: 6px;
    text-align: center;
    max-width: 170px;
  }
  .scoretext b {
    font-size: 19px;
    font-weight: 600;
  }
  .scoretext b.serif {
    font-size: 56px;
    font-weight: 400;
  }
  .scoretext span {
    color: var(--muted);
    font-size: 15px;
    line-height: 1.35;
  }
  .hands {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
  .handcard {
    display: grid;
    justify-items: center;
    gap: 10px;
  }
  .lvl {
    font-size: 17px;
    padding-bottom: 6px;
    min-width: 108px;
    text-align: center;
    border-bottom: 3px solid currentColor;
  }
  .lvl.off { color: var(--faint); }
  .lvl.easy { color: var(--gold); }
  .lvl.full { color: #ff4d5e; }
  .card {
    width: 116px;
    height: 116px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    transition: transform 0.2s var(--spring);
  }
  .handcard:active .card {
    transform: scale(0.94);
  }
  .card svg {
    width: 62px;
    height: 62px;
    fill: var(--ivory);
  }
  .card svg.mirror {
    transform: scaleX(-1);
  }
  .handcard:disabled {
    opacity: 0.35;
  }
  .input {
    display: flex;
    padding: 4px;
    border-radius: 999px;
    max-width: 340px;
    margin: 0 auto;
    width: 100%;
  }
  .input button {
    flex: 1;
    min-height: 44px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--muted);
    font-size: 16px;
  }
  .input button svg {
    width: 18px;
    height: 18px;
  }
  .input button.on {
    color: var(--ivory);
    background: rgba(255, 255, 255, 0.07);
  }
  .go {
    width: 100%;
  }
  .links {
    display: flex;
    justify-content: center;
    gap: 24px;
  }
  .links button {
    min-height: 44px;
    color: var(--flame);
    font-size: 16px;
  }
  .links .danger {
    color: var(--danger);
  }
  .links button:disabled {
    opacity: 0.4;
  }
  .error {
    color: var(--danger);
    text-align: center;
  }
  .credit {
    text-align: center;
    color: var(--faint);
    font-size: 13px;
    line-height: 1.4;
  }
  @media (orientation: landscape) and (max-height: 560px) {
    .song {
      display: grid;
      grid-template-columns: minmax(260px, 40%) 1fr;
      grid-template-rows: auto 1fr;
      column-gap: 20px;
    }
    header {
      grid-column: 1 / -1;
      position: absolute;
      left: calc(var(--sal) + 20px);
      right: calc(var(--sar) + 20px);
      top: calc(var(--sat) + 12px);
    }
    .hero {
      grid-column: 1;
      grid-row: 1 / 3;
      align-self: center;
      margin: 0;
      position: sticky;
      top: 0;
    }
    .halo {
      width: 220px;
      height: 220px;
    }
    h1 {
      font-size: 38px;
    }
    .controls {
      grid-column: 2;
      grid-row: 1 / 3;
      margin-top: 50px;
      width: 100%;
    }
  }
</style>
