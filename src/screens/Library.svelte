<script lang="ts">
  import { app, go, openSong } from '../lib/ui/store.svelte';
  import { visibleCatalog, type CatalogEntry } from '../lib/songs/catalog';
  import { getFavorites, getHistory, toggleFavorite, getBest } from '../lib/storage/prefs';
  import { queueThumb } from '../lib/ui/planets';

  let { onimport }: { onimport: (title?: string) => void } = $props();

  type Seg = 'all' | 'fav' | 'imports';
  let seg = $state<Seg>('all');
  let genre = $state<'all' | 'Classical' | 'Traditional'>('all');
  let difficulty = $state<0 | 1 | 2 | 3>(0);
  let menu = $state<'' | 'genre' | 'difficulty'>('');
  // svelte-ignore state_referenced_locally
  let query = $state(app.libraryQuery);
  // svelte-ignore state_referenced_locally
  let searching = $state(!!app.libraryQuery);
  let favorites = $state(getFavorites());
  const history = getHistory();
  const thumbs = $state<Record<string, string>>({});

  const entries = $derived(visibleCatalog(app.imports));
  const filtered = $derived(
    entries.filter((e) => {
      if (seg === 'fav' && !favorites.includes(e.id)) return false;
      if (seg === 'imports' && e.kind !== 'import' && e.kind !== 'placeholder') return false;
      if (genre !== 'all' && e.genre !== genre) return false;
      if (difficulty && (e.difficulty !== difficulty || e.kind === 'placeholder')) return false;
      const q = query.trim().toLowerCase();
      if (q && !`${e.title} ${e.composer}`.toLowerCase().includes(q)) return false;
      return true;
    }),
  );
  const sections = $derived.by(() => {
    const out: { title: string; items: CatalogEntry[] }[] = [];
    const recent = history.map((id) => filtered.find((e) => e.id === id)).filter(Boolean).slice(0, 3) as CatalogEntry[];
    if (recent.length && seg === 'all' && !query) out.push({ title: 'Recently played', items: recent });
    const classical = filtered.filter((e) => e.genre === 'Classical');
    const trad = filtered.filter((e) => e.genre === 'Traditional');
    const imported = filtered.filter((e) => e.genre === 'Imported');
    if (classical.length) out.push({ title: 'Classical', items: classical });
    if (trad.length) out.push({ title: 'Folk & favourites', items: trad });
    if (imported.length) out.push({ title: 'Your imports', items: imported });
    return out;
  });

  $effect(() => {
    for (const s of sections) for (const e of s.items) if (!thumbs[e.id]) queueThumb(e.id, e.palette, 88, (u) => (thumbs[e.id] = u));
  });

  const diffName = ['Any difficulty', 'Easy', 'Medium', 'Hard'];
  const diffClass = ['', 'easy', 'medium', 'hard'];

  function heart(e: CatalogEntry, ev: MouseEvent) {
    ev.stopPropagation();
    toggleFavorite(e.id);
    favorites = getFavorites();
  }
  function open(e: CatalogEntry) {
    if (e.kind === 'placeholder') onimport(e.title);
    else openSong(e, 'library');
  }
  function back() {
    app.libraryQuery = '';
    go('home');
  }
</script>

<div class="library">
  <header>
    <button class="orb-btn" aria-label="Back" onclick={back}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    {#if searching}
      <input class="search" type="search" placeholder="Search songs or composers" bind:value={query} aria-label="Search songs" />
    {/if}
    <div class="tools glass">
      <button aria-label="Settings" onclick={() => go('settings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <button aria-label={searching ? 'Close search' : 'Search'} onclick={() => { searching = !searching; if (!searching) query = ''; }}>
        {#if searching}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M16 16l5 5" /></svg>
        {/if}
      </button>
    </div>
  </header>

  <div class="segs glass" role="tablist">
    <button role="tab" aria-selected={seg === 'all'} class:on={seg === 'all'} onclick={() => (seg = 'all')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h10M3 11h10M3 16h6" /><path d="M17 4v11.5a2.5 2.5 0 1 1-2-2.45" /><path d="M17 4l4 1.5" /></svg>
      All
    </button>
    <button role="tab" aria-selected={seg === 'fav'} class:on={seg === 'fav'} onclick={() => (seg = 'fav')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
      Favorites
    </button>
    <button role="tab" aria-selected={seg === 'imports'} class:on={seg === 'imports'} onclick={() => (seg = 'imports')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
      Imports
    </button>
  </div>

  <div class="filters">
    <div class="dd">
      <button class="chipbtn" class:set={genre !== 'all'} onclick={() => (menu = menu === 'genre' ? '' : 'genre')}>
        {genre === 'all' ? 'Genre' : genre}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {#if menu === 'genre'}
        <div class="pop glass">
          {#each [['all', 'All genres'], ['Classical', 'Classical'], ['Traditional', 'Folk & favourites']] as [v, l]}
            <button class:on={genre === v} onclick={() => { genre = v as typeof genre; menu = ''; }}>{l}</button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="dd">
      <button class="chipbtn" class:set={difficulty > 0} onclick={() => (menu = menu === 'difficulty' ? '' : 'difficulty')}>
        {difficulty ? diffName[difficulty] : 'Difficulty'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {#if menu === 'difficulty'}
        <div class="pop glass">
          {#each [0, 1, 2, 3] as d}
            <button class:on={difficulty === d} class={diffClass[d]} onclick={() => { difficulty = d as typeof difficulty; menu = ''; }}>{diffName[d]}</button>
          {/each}
        </div>
      {/if}
    </div>
    {#if seg === 'imports'}
      <button class="chipbtn add" onclick={() => onimport()}>+ Import MIDI</button>
    {/if}
  </div>

  <div class="list">
    {#each sections as s (s.title)}
      <h2 class="serif">{s.title}</h2>
      {#each s.items as e, i (s.title + e.id)}
        {@const best = getBest(e.id)}
        <div class="row" role="button" tabindex="0" style:--i={i} onclick={() => open(e)} onkeydown={(k) => k.key === 'Enter' && open(e)}>
          <span class="thumb">{#if thumbs[e.id]}<img src={thumbs[e.id]} alt="" />{/if}</span>
          <span class="text">
            <span class="name">{e.title}</span>
            <span class="by">
              {e.composer}
              {#if e.kind === 'placeholder'}<em class="tag">Add a MIDI file</em>{/if}
              {#if best}<em class="stars">{'★'.repeat(best.stars)}</em>{/if}
            </span>
          </span>
          {#if e.kind !== 'placeholder'}
            <button class="heart" class:on={favorites.includes(e.id)} aria-label={favorites.includes(e.id) ? 'Remove from favorites' : 'Add to favorites'} onclick={(ev) => heart(e, ev)}>
              <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.6A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8c0 6-7.5 10.6-7.5 10.6z" /></svg>
            </button>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="empty">
        {#if seg === 'fav'}
          <p class="serif">No favorites yet</p>
          <span>Tap the heart next to a song to keep it here.</span>
        {:else if seg === 'imports'}
          <p class="serif">Bring your own songs</p>
          <span>Import any piano MIDI file, like River Flows in You.</span>
          <button class="btn-ember" onclick={() => onimport()}>Import a MIDI file</button>
        {:else}
          <p class="serif">Nothing matches</p>
          <span>Try another search or filter.</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

{#if menu}<button class="scrim" aria-label="Close menu" onclick={() => (menu = '')}></button>{/if}

<style>
  .library {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: calc(var(--sat) + 12px) calc(var(--sar) + 20px) calc(var(--sab) + 30px) calc(var(--sal) + 20px);
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tools {
    margin-left: auto;
    display: flex;
    border-radius: 999px;
    padding: 4px;
  }
  .tools button {
    width: 56px;
    height: 48px;
    display: grid;
    place-items: center;
  }
  .tools svg {
    width: 26px;
    height: 26px;
  }
  .search {
    flex: 1;
    min-width: 0;
    height: 52px;
    border-radius: 999px;
    border: 0;
    padding: 0 20px;
    font: inherit;
    font-size: 17px;
    color: var(--ivory);
    background: rgba(24, 16, 16, 0.85);
    box-shadow: inset 0 0 0 1px rgba(255, 130, 70, 0.35);
    outline: 0;
    -webkit-user-select: text;
    user-select: text;
    animation: grow 0.35s var(--ease-out);
  }
  @keyframes grow {
    from { opacity: 0; transform: scaleX(0.6); transform-origin: right; }
  }
  .segs {
    margin-top: 18px;
    display: flex;
    padding: 5px;
    border-radius: 999px;
    max-width: 640px;
  }
  .segs button {
    flex: 1;
    min-height: 50px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--muted);
    font-size: 17px;
    transition: color 0.2s ease, background 0.3s var(--ease-out);
  }
  .segs button svg {
    width: 22px;
    height: 22px;
  }
  .segs button.on {
    color: var(--ivory);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
  }
  .filters {
    display: flex;
    gap: 10px;
    margin-top: 14px;
    flex-wrap: wrap;
  }
  .dd {
    position: relative;
  }
  .chipbtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--glass);
    box-shadow: inset 0 0 0 1px var(--hair);
    font-size: 16px;
  }
  .chipbtn svg {
    width: 18px;
    height: 18px;
  }
  .chipbtn.set {
    box-shadow: inset 0 0 0 1px rgba(255, 140, 70, 0.6);
    color: var(--gold);
  }
  .chipbtn.add {
    color: var(--flame);
  }
  .pop {
    position: absolute;
    z-index: 5;
    top: calc(100% + 8px);
    left: 0;
    min-width: 200px;
    display: grid;
    padding: 6px;
    border-radius: 18px;
    background: var(--glass-strong);
    animation: pop 0.25s var(--spring);
    transform-origin: top left;
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.9) translateY(-6px); }
  }
  .pop button {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    text-align: left;
    font-size: 16px;
  }
  .pop button.on {
    background: rgba(255, 255, 255, 0.07);
  }
  .pop .easy { color: var(--gold); }
  .pop .medium { color: var(--flame); }
  .pop .hard { color: var(--danger); }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 4;
  }
  .list {
    max-width: 760px;
  }
  h2 {
    margin: 26px 0 10px;
    font-size: 34px;
    letter-spacing: -0.01em;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 4px;
    border-radius: 18px;
    cursor: pointer;
    animation: rise 0.5s var(--ease-out) both;
    animation-delay: calc(var(--i) * 35ms);
    transition: background 0.2s ease, transform 0.15s var(--spring);
  }
  .row:active {
    background: rgba(255, 255, 255, 0.04);
    transform: scale(0.985);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(10px); }
  }
  .thumb {
    width: 64px;
    height: 64px;
    flex: none;
    border-radius: 16px;
    overflow: hidden;
    background: radial-gradient(circle at 50% 40%, #2a1210, #0d0707);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.12);
    animation: fadein 0.4s ease;
  }
  @keyframes fadein {
    from { opacity: 0; transform: scale(0.9); }
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .name {
    font-size: 18px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .by {
    color: var(--muted);
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tag,
  .stars {
    font-style: normal;
    margin-left: 8px;
  }
  .tag {
    color: var(--flame);
  }
  .stars {
    color: var(--gold);
    letter-spacing: 1px;
  }
  .heart {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    flex: none;
  }
  .heart svg {
    width: 28px;
    height: 28px;
    fill: transparent;
    stroke: var(--ivory);
    stroke-width: 1.8;
    transition: fill 0.2s ease, stroke 0.2s ease, transform 0.35s var(--spring);
  }
  .heart.on svg {
    fill: var(--ember);
    stroke: var(--ember);
    transform: scale(1.12);
    filter: drop-shadow(0 0 8px rgba(255, 106, 31, 0.6));
  }
  .heart:active svg {
    transform: scale(0.8);
  }
  .empty {
    display: grid;
    justify-items: start;
    gap: 10px;
    padding: 40px 4px;
    color: var(--muted);
  }
  .empty p {
    font-size: 30px;
    color: var(--ivory);
  }
  .empty .btn-ember {
    margin-top: 10px;
  }
</style>
