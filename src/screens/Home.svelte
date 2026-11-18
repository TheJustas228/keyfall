<script lang="ts">
  import { onMount } from 'svelte';
  import { app, go, openSong } from '../lib/ui/store.svelte';
  import { visibleCatalog, type CatalogEntry } from '../lib/songs/catalog';
  import { getHistory, getLastSong, getStreak } from '../lib/storage/prefs';
  import Avatar from '../lib/ui/Avatar.svelte';

  let { onimport }: { onimport: (title?: string) => void } = $props();

  const entries = $derived(visibleCatalog(app.imports));
  const lastId = getLastSong();
  const last = $derived(entries.find((e) => e.id === lastId && e.kind !== 'placeholder'));
  const streak = getStreak();
  let query = $state('');
  let shown = $state(false);

  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning!' : hour < 18 ? 'Hey!' : 'Good evening!';


  function suggest() {
    const played = new Set(getHistory());
    const pool = entries.filter((e) => e.kind !== 'placeholder' && e.kind !== 'import' && !played.has(e.id));
    const list = pool.length ? pool : entries.filter((e) => e.kind !== 'placeholder');
    const pick: CatalogEntry = list[Math.floor(Math.random() * list.length)];
    openSong(pick, 'home');
  }

  function search(e: SubmitEvent) {
    e.preventDefault();
    app.libraryQuery = query.trim();
    go('library');
  }

  onMount(() => {
    requestAnimationFrame(() => (shown = true));
  });
</script>

<div class="home" class:shown>
  <header>
    <div class="streak" title="Days practised in a row">
      <svg class="flame" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#ff3d1f" />
            <stop offset="0.6" stop-color="#ff8f3c" />
            <stop offset="1" stop-color="#ffd27a" />
          </linearGradient>
        </defs>
        <path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 12 22a5 5 0 0 1-5-5c0-2.6 1.6-4.3 2.6-5.4.2 1.6 1 2.6 2 3 0-3.2-1.2-6 .4-12.6z" fill="url(#fl)" />
      </svg>
      <span>{streak}</span>
    </div>
    <button class="btn-glass pill" onclick={() => go('library')}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5C3 4.7 3.7 4 4.5 4c2.7 0 4.9.6 6.5 1.8v14c-1.6-1.1-3.8-1.7-6.5-1.7-.8 0-1.5-.7-1.5-1.5V5.5zm18 0c0-.8-.7-1.5-1.5-1.5-2.7 0-4.9.6-6.5 1.8v14c1.6-1.1 3.8-1.7 6.5-1.7.8 0 1.5-.7 1.5-1.5V5.5z" /></svg>
      Song library
    </button>
    <button class="menu" aria-label="Settings" onclick={() => go('settings')}>
      <span></span><span></span><span></span>
    </button>
  </header>

  <div class="sky" aria-hidden="true">
    <div class="sparkle">
      <svg viewBox="0 0 100 100"><path d="M50 0 C53 38 62 47 100 50 C62 53 53 62 50 100 C47 62 38 53 0 50 C38 47 47 38 50 0Z" /></svg>
    </div>
    <div class="glow"></div>
    <div class="horizon"></div>
  </div>

  <section class="greeting">
    <p class="hello serif">{hello}</p>
    <h1 class="serif">What would you like to play today?</h1>
  </section>

  <section class="actions">
    {#if last}
      <button class="continue glass" onclick={() => openSong(last, 'home')}>
        <Avatar entry={last} size={64} />
        <span class="ct">
          <span class="title">{last.title}</span>
          <span class="sub">Continue learning <b>›</b></span>
        </span>
      </button>
    {/if}
    <button class="btn-glass chip" onclick={suggest}>Suggest something new</button>
    <button class="btn-glass chip" onclick={() => go('library')}>Open song library</button>
    {#if !app.imports.some((i) => /river\s*flows/i.test(i.title))}
      <button class="btn-glass chip" onclick={() => onimport('River Flows in You')}>Add River Flows in You</button>
    {/if}
  </section>

  <form class="ask" onsubmit={search}>
    <input class="field" type="search" placeholder="Find a song…" bind:value={query} enterkeyhint="search" aria-label="Find a song" />
    <button type="button" class="orb-btn" aria-label="Free play piano" onclick={() => go('free')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6M8 6v12M12 9v6M16 4v16M20 9v6" /></svg>
    </button>
  </form>
</div>

<style>
  .home {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto auto auto;
    padding: calc(var(--sat) + 10px) calc(var(--sar) + 20px) calc(var(--sab) + 16px) calc(var(--sal) + 20px);
    overflow: hidden;
  }
  header {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .streak {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 64px;
    font-size: 26px;
    color: var(--flame);
    font-weight: 500;
  }
  .flame {
    width: 26px;
    height: 26px;
    filter: drop-shadow(0 0 8px rgba(255, 110, 40, 0.7));
    animation: flicker 2.2s ease-in-out infinite;
    transform-origin: 50% 90%;
  }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); }
    40% { transform: scale(1.08, 0.94) rotate(2deg); }
    70% { transform: scale(0.96, 1.05) rotate(-1deg); }
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0 26px;
    min-height: 54px;
  }
  .pill svg {
    width: 22px;
    height: 22px;
  }
  .menu {
    width: 64px;
    height: 48px;
    display: grid;
    align-content: center;
    justify-items: end;
    gap: 5px;
  }
  .menu span {
    display: block;
    width: 28px;
    height: 3px;
    border-radius: 2px;
    background: var(--ivory);
  }

  /* --- the sky: sparkle star + glowing planet horizon --- */
  .sky {
    position: relative;
    min-height: 0;
  }
  .sparkle {
    position: absolute;
    left: 50%;
    top: 30%;
    width: 64px;
    height: 64px;
    margin-left: -32px;
    filter: drop-shadow(0 0 10px rgba(255, 140, 60, 0.9)) drop-shadow(0 0 30px rgba(255, 90, 20, 0.6));
    opacity: 0;
    transform: scale(0.2) rotate(-90deg);
    transition: opacity 0.9s ease 0.5s, transform 1.4s var(--ease-out) 0.5s;
  }
  .sparkle svg {
    width: 100%;
    height: 100%;
    fill: #ff8a3c;
    animation: twinkle 5s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
    50% { transform: translateY(-8px) scale(1.08) rotate(8deg); }
  }
  .horizon {
    position: absolute;
    left: 50%;
    top: 62%;
    width: 230vw;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 0%, #4a1709 0%, #1d0805 9%, #090304 22%, #050307 40%);
    box-shadow:
      0 -1px 0 0 rgba(255, 214, 160, 0.95),
      0 -5px 18px 1px rgba(255, 150, 70, 0.8),
      inset 0 14px 40px -6px rgba(255, 120, 50, 0.65);
    transform: translate(-50%, 40px);
    opacity: 0;
    transition: transform 1.6s var(--ease-out), opacity 1.2s ease;
  }
  /* the sunrise glow above the planet's rim: its own layer, breathing via opacity */
  .glow {
    position: absolute;
    left: 50%;
    top: calc(62% - 170px);
    width: 160vw;
    height: 300px;
    transform: translateX(-50%);
    background:
      radial-gradient(50% 42% at 50% 62%, rgba(255, 160, 80, 0.55), rgba(255, 90, 25, 0.22) 55%, transparent 75%),
      radial-gradient(60% 60% at 50% 70%, rgba(200, 40, 10, 0.25), transparent 70%);
    opacity: 0;
    transition: opacity 1.8s ease 0.3s;
    pointer-events: none;
  }
  @keyframes breathe {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 1; }
  }
  .shown .glow {
    opacity: 1;
    animation: breathe 7s ease-in-out infinite 2.2s;
  }
  .shown .horizon {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  .shown .sparkle {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }

  /* --- greeting --- */
  .greeting {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 0 8px 22px;
  }
  .hello {
    font-size: 30px;
    margin-bottom: 14px;
  }
  h1 {
    font-size: clamp(34px, 9.5vw, 50px);
    line-height: 1.06;
    max-width: 12em;
    margin: 0 auto;
  }
  .greeting > * {
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.8s ease, transform 0.9s var(--ease-out);
  }
  .shown .greeting > * {
    opacity: 1;
    transform: none;
  }
  .shown .greeting h1 {
    transition-delay: 0.9s;
  }
  .shown .greeting .hello {
    transition-delay: 0.75s;
  }

  /* --- actions --- */
  .actions {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: end;
    gap: 12px;
    padding-bottom: 16px;
  }
  .actions > * {
    opacity: 0;
    transform: translateX(30px);
    transition: opacity 0.6s ease, transform 0.8s var(--spring);
  }
  .shown .actions > * {
    opacity: 1;
    transform: none;
  }
  .shown .actions > :nth-child(1) { transition-delay: 1.15s; }
  .shown .actions > :nth-child(2) { transition-delay: 1.25s; }
  .shown .actions > :nth-child(3) { transition-delay: 1.35s; }
  .shown .actions > :nth-child(4) { transition-delay: 1.45s; }
  .continue {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 26px 8px 8px;
    border-radius: 999px;
    min-width: min(100%, 330px);
    text-align: left;
    transition: transform 0.18s var(--spring);
  }
  .continue:active {
    transform: scale(0.97);
  }
  .ct {
    display: grid;
    gap: 2px;
  }
  .title {
    font-size: 19px;
    font-weight: 600;
  }
  .sub {
    color: var(--flame);
    font-size: 16px;
  }
  .sub b {
    font-weight: 700;
    margin-left: 4px;
  }
  .chip {
    font-size: 17px;
  }

  .ask {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .field {
    flex: 1;
    min-width: 0;
    height: 58px;
    padding: 0 26px;
    border-radius: 999px;
    border: 0;
    outline: 0;
    color: var(--ivory);
    font: inherit;
    font-size: 18px;
    background: rgba(20, 12, 12, 0.75);
    box-shadow: inset 0 0 0 1px rgba(255, 130, 70, 0.35), 0 0 30px rgba(255, 80, 20, 0.12);
    -webkit-user-select: text;
    user-select: text;
  }
  .field::placeholder {
    color: var(--muted);
  }
  .ask .orb-btn {
    width: 58px;
    height: 58px;
  }

  @media (orientation: landscape) and (max-height: 560px) {
    .home {
      grid-template-columns: 1fr minmax(300px, 380px);
      grid-template-rows: auto 1fr auto;
      column-gap: 24px;
    }
    header {
      grid-column: 1 / -1;
    }
    .sky {
      position: absolute;
      inset: 0;
    }
    .sparkle {
      top: 18%;
      left: 34%;
      width: 48px;
      height: 48px;
    }
    .horizon {
      top: 50%;
      left: 34%;
      width: 130vw;
    }
    .glow {
      top: calc(50% - 170px);
      left: 34%;
      width: 110vw;
    }
    .greeting {
      grid-column: 1;
      grid-row: 2;
      align-self: end;
      padding-bottom: 8px;
    }
    h1 {
      font-size: 40px;
    }
    .hello {
      font-size: 24px;
      margin-bottom: 6px;
    }
    .actions {
      grid-column: 2;
      grid-row: 2 / 4;
      align-self: center;
      padding: 0;
    }
    .ask {
      grid-column: 1;
      grid-row: 3;
      padding-top: 10px;
    }
  }
</style>
