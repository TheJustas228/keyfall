<script lang="ts">
  import { onMount } from 'svelte';
  import type { ResultData } from '../lib/ui/store.svelte';

  let { result, onagain, onback }: { result: ResultData; onagain: () => void; onback: () => void } = $props();

  const r = $derived(result);
  const target = $derived(Math.round(r.accuracy * 100));
  let shown = $state(0);
  let drawn = $state(false);

  const W = 600;
  const H = 300;
  const chart = $derived.by(() => {
    const notes = r.song.notes;
    const dur = Math.max(1, r.song.duration);
    let lo = 127, hi = 0;
    for (const n of notes) {
      lo = Math.min(lo, n.midi);
      hi = Math.max(hi, n.midi);
    }
    const span = Math.max(12, hi - lo);
    const dots = notes.map((n) => ({
      x: (n.start / dur) * W,
      y: 288 - ((n.midi - lo) / span) * 120,
      w: Math.max(2, (n.dur / dur) * W),
      hand: n.hand,
    }));
    // accuracy line, broken where nothing was judged
    const segs: string[] = [];
    let cur = '';
    r.timeline.forEach((a, i) => {
      if (a === null) {
        if (cur) segs.push(cur);
        cur = '';
        return;
      }
      const x = ((i + 0.5) / r.timeline.length) * W;
      const y = 150 - a * 125;
      cur += `${cur ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
    });
    if (cur) segs.push(cur);
    return { dots, segs, dur };
  });
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const headline = $derived(
    r.mode === 'watch' ? 'Song overview' : r.stars === 3 ? 'Beautifully played' : r.stars === 2 ? 'Great playing' : r.stars === 1 ? 'Nice work' : 'Keep going, it gets easier',
  );

  onMount(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1300);
      shown = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setTimeout(() => (drawn = true), 150);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="results">
  <header>
    <h2>{r.song.title}</h2>
    <p>{r.song.composer}</p>
  </header>

  <section class="score">
    <span class="label">{headline}</span>
    {#if r.mode !== 'watch'}
      <b class="pct serif">{shown}<i>%</i></b>
      <div class="stars" aria-label="{r.stars} of 3 stars">
        {#each [1, 2, 3] as s}<span class:on={s <= r.stars} style:--d="{0.9 + s * 0.18}s">★</span>{/each}
      </div>
      <div class="chips">
        {#if r.newBest}<span class="chip best">New best</span>{/if}
        {#if r.streak > 0}<span class="chip">🔥 {r.streak}-day streak</span>{/if}
        {#if r.mode === 'play'}<span class="chip">Best run {r.bestCombo}</span>{/if}
      </div>
    {:else}
      <b class="pct serif small">{fmt(r.song.duration)}</b>
    {/if}
  </section>

  <section class="chart glass">
    <svg viewBox="0 0 {W} {H + 24}" preserveAspectRatio="none">
      <line x1="0" x2={W} y1="25" y2="25" class="grid" />
      <line x1="0" x2={W} y1="150" y2="150" class="grid" />
      <text x="6" y="21">100</text>
      <text x="6" y="146">0</text>
      {#each chart.dots as d}
        <rect x={d.x} y={d.y} width={Math.min(d.w, 14)} height="2.6" rx="1.3" class={d.hand === 'R' ? 'r' : 'l'} />
      {/each}
      {#each chart.segs as s}
        <path d={s} class="acc" class:drawn pathLength="1" />
      {/each}
      <text x="4" y={H + 20}>0:00</text>
      <text x={W / 2} y={H + 20} text-anchor="middle">{fmt(chart.dur / 2)}</text>
      <text x={W - 4} y={H + 20} text-anchor="end">{fmt(chart.dur)}</text>
    </svg>
    {#if r.mode === 'play'}
      <dl>
        <div><dt>Perfect</dt><dd>{r.perfect}</dd></div>
        <div><dt>Good</dt><dd>{r.good}</dd></div>
        <div><dt>Missed</dt><dd>{r.miss}</dd></div>
      </dl>
    {:else if r.mode === 'learn'}
      <dl>
        <div><dt>Right notes</dt><dd>{r.perfect}</dd></div>
        <div><dt>Wrong notes</dt><dd>{r.wrong}</dd></div>
      </dl>
    {/if}
  </section>

  <footer>
    <button class="btn-glass" onclick={onback}>Back to song library</button>
    <button class="btn-ember" onclick={onagain}>Play again</button>
  </footer>
</div>

<style>
  .results {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: minmax(220px, 34%) 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 14px 28px;
    padding: calc(var(--sat) + 18px) calc(var(--sar) + 28px) calc(var(--sab) + 18px) calc(var(--sal) + 28px);
  }
  header {
    grid-column: 1 / -1;
  }
  header h2 {
    font-size: 24px;
    font-weight: 600;
  }
  header p {
    color: var(--muted);
    margin-top: 2px;
  }
  .score {
    display: grid;
    align-content: center;
    justify-items: center;
    text-align: center;
    gap: 6px;
  }
  .label {
    color: var(--muted);
    font-size: 19px;
  }
  .pct {
    font-size: clamp(84px, 18vw, 128px);
    line-height: 0.95;
    text-shadow: 0 0 40px rgba(255, 106, 31, 0.35);
    font-variant-numeric: tabular-nums;
  }
  .pct i {
    font-style: normal;
    font-size: 0.6em;
    margin-left: 4px;
  }
  .pct.small {
    font-size: 64px;
  }
  .stars {
    font-size: 40px;
    letter-spacing: 6px;
    color: rgba(255, 255, 255, 0.12);
  }
  .stars .on {
    color: var(--gold);
    text-shadow: 0 0 20px rgba(255, 196, 107, 0.6);
    display: inline-block;
    animation: starIn 0.6s var(--spring) both;
    animation-delay: var(--d);
  }
  @keyframes starIn {
    from {
      transform: scale(0) rotate(-40deg);
      opacity: 0;
    }
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
  .chip {
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px var(--hair);
    font-size: 14px;
  }
  .chip.best {
    color: #1d0a02;
    background: var(--gold);
    font-weight: 600;
  }
  .chart {
    border-radius: 28px;
    padding: 18px 18px 12px;
    display: grid;
    gap: 10px;
    align-content: center;
    min-height: 0;
  }
  svg {
    width: 100%;
    height: auto;
    max-height: 52vh;
    overflow: visible;
  }
  .grid {
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
  }
  text {
    fill: var(--muted);
    font-size: 15px;
    font-family: var(--sans);
  }
  rect.r {
    fill: #ff9a52;
    opacity: 0.85;
  }
  rect.l {
    fill: #7fb2ff;
    opacity: 0.85;
  }
  .acc {
    fill: none;
    stroke: #6ee7a8;
    stroke-width: 3;
    stroke-linejoin: round;
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px rgba(110, 231, 168, 0.6));
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition: stroke-dashoffset 1.8s var(--ease-out);
  }
  .acc.drawn {
    stroke-dashoffset: 0;
  }
  dl {
    display: flex;
    justify-content: center;
    gap: 34px;
    margin: 0;
  }
  dl div {
    display: grid;
    justify-items: center;
  }
  dt {
    color: var(--muted);
    font-size: 14px;
  }
  dd {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  footer {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (orientation: portrait), (max-width: 700px) {
    .results {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto auto;
    }
    footer {
      grid-template-columns: 1fr;
    }
  }
</style>
