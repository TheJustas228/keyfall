<script lang="ts">
  import { app } from '../lib/ui/store.svelte';
  import { visibleCatalog, type CatalogEntry } from '../lib/songs/catalog';
  import { getBest, getLastSong } from '../lib/storage/prefs';

  let { onopen, onimport }: { onopen: (e: CatalogEntry) => void; onimport: (title?: string) => void } = $props();

  type Filter = 'all' | 1 | 2 | 3 | 'imported';
  let filter = $state<Filter>('all');

  const entries = $derived(visibleCatalog(app.imports));
  const shown = $derived(
    entries.filter((e) => (filter === 'all' ? true : filter === 'imported' ? e.kind === 'import' : e.difficulty === filter && e.kind !== 'placeholder')),
  );
  const lastId = getLastSong();
  const last = $derived(entries.find((e) => e.id === lastId && e.kind !== 'placeholder'));
  // read best scores whenever we come back to the library
  const bests = $derived.by(() => {
    void app.screen;
    return new Map(entries.map((e) => [e.id, getBest(e.id)]));
  });

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All songs' },
    { value: 1, label: 'Easy' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Hard' },
    { value: 'imported', label: 'My imports' },
  ];
  const diffName = { 1: 'Easy', 2: 'Medium', 3: 'Hard' } as const;

  function open(e: CatalogEntry) {
    if (e.kind === 'placeholder') onimport(e.title);
    else onopen(e);
  }
</script>

<div class="library">
  <header>
    <div class="brand">
      <h1>Keyfall</h1>
      <p>Pick a song, then turn your phone sideways to play.</p>
    </div>
    <nav>
      <button class="btn-quiet" onclick={() => (app.screen = 'free')}>Free play</button>
      <button class="btn-quiet" onclick={() => onimport()}>Import MIDI</button>
      <button class="icon-btn" aria-label="Settings" onclick={() => (app.screen = 'settings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
    </nav>
  </header>

  {#if last}
    <button class="continue" onclick={() => onopen(last)}>
      <span class="mini-cover" style:background="linear-gradient(140deg, {last.art.from}, {last.art.to})">{last.art.emoji}</span>
      <span class="continue-text">
        <span class="continue-label">Continue practising</span>
        <span class="continue-title">{last.title}</span>
      </span>
      <span class="play-dot" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z" /></svg>
      </span>
    </button>
  {/if}

  <div class="filters" role="tablist" aria-label="Filter songs">
    {#each filters as f (f.value)}
      <button role="tab" aria-selected={filter === f.value} class:active={filter === f.value} onclick={() => (filter = f.value)}>
        {f.label}
      </button>
    {/each}
  </div>

  {#if shown.length === 0}
    <div class="empty">
      <p>No imported songs yet. Add any piano MIDI file, such as River Flows in You, and it shows up here.</p>
      <button class="btn-primary" onclick={() => onimport()}>Import a MIDI file</button>
    </div>
  {:else}
    <div class="grid">
      {#each shown as e (e.id)}
        {@const best = bests.get(e.id)}
        <button class="song" class:placeholder={e.kind === 'placeholder'} onclick={() => open(e)}>
          <span class="cover" style:background="linear-gradient(140deg, {e.art.from}, {e.art.to})">
            <span class="emoji">{e.art.emoji}</span>
            {#if e.kind === 'placeholder'}
              <span class="badge">Add MIDI</span>
            {:else}
              <span class="dots" aria-label={diffName[e.difficulty]}>
                {#each [1, 2, 3] as d}<i class:on={d <= e.difficulty}></i>{/each}
              </span>
            {/if}
            {#if best && best.stars > 0}
              <span class="stars" aria-label="{best.stars} stars">{'★'.repeat(best.stars)}</span>
            {/if}
          </span>
          <span class="name">{e.title}</span>
          <span class="composer">{e.composer}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .library {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: calc(var(--sat) + 14px) calc(var(--sar) + 18px) calc(var(--sab) + 28px) calc(var(--sal) + 18px);
    background:
      radial-gradient(120% 60% at 0% 0%, rgba(231, 182, 90, 0.1), transparent 60%),
      var(--midnight);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
  }
  h1 {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--ivory);
  }
  .brand p {
    margin-top: 2px;
    color: var(--ivory-dim);
    font-size: 15px;
  }
  nav {
    display: flex;
    gap: 8px;
  }
  .continue {
    margin-top: 18px;
    width: 100%;
    max-width: 560px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px 10px 10px;
    border-radius: 20px;
    background: var(--midnight-2);
    text-align: left;
  }
  .continue:active {
    background: var(--midnight-3);
  }
  .mini-cover {
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 28px;
  }
  .continue-text {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .continue-label {
    color: var(--ivory-dim);
    font-size: 14px;
    font-weight: 600;
  }
  .continue-title {
    font-size: 19px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .play-dot {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--brass);
    color: #1d1606;
  }
  .play-dot svg {
    width: 22px;
    height: 22px;
  }
  .filters {
    display: flex;
    gap: 8px;
    margin: 22px 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filters button {
    flex: none;
    min-height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: rgba(245, 239, 227, 0.07);
    color: var(--ivory-dim);
    font-weight: 700;
    font-size: 15px;
  }
  .filters button.active {
    background: var(--ivory);
    color: #141a3a;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 20px 16px;
  }
  .song {
    display: grid;
    gap: 4px;
    text-align: left;
    min-width: 0;
  }
  .song:active .cover {
    transform: scale(0.97);
  }
  .cover {
    position: relative;
    aspect-ratio: 1;
    border-radius: 20px;
    display: grid;
    place-items: center;
    transition: transform 0.12s ease;
    overflow: hidden;
  }
  .cover::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    pointer-events: none;
  }
  .placeholder .cover {
    outline: 2px dashed rgba(245, 239, 227, 0.55);
    outline-offset: -8px;
  }
  .emoji {
    font-size: 54px;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  }
  .dots {
    position: absolute;
    left: 12px;
    bottom: 12px;
    display: flex;
    gap: 4px;
  }
  .dots i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
  }
  .dots i.on {
    background: #fff;
  }
  .badge {
    position: absolute;
    bottom: 12px;
    left: 12px;
    padding: 4px 10px;
    border-radius: 10px;
    background: rgba(8, 11, 28, 0.6);
    font-size: 13px;
    font-weight: 700;
  }
  .stars {
    position: absolute;
    top: 10px;
    right: 12px;
    color: var(--brass);
    font-size: 16px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }
  .name {
    margin-top: 6px;
    font-weight: 800;
    font-size: 16px;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .composer {
    color: var(--ivory-dim);
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    display: grid;
    gap: 16px;
    justify-items: start;
    max-width: 440px;
    padding: 24px 0;
    color: var(--ivory-dim);
    line-height: 1.5;
  }
  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
    nav .btn-quiet {
      padding: 0 12px;
      font-size: 15px;
    }
  }
</style>
