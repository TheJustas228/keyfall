<script lang="ts">
  import type { ResultData } from '../lib/ui/store.svelte';

  let { result, onagain, onback, onlearn }: { result: ResultData; onagain: (speed?: number) => void; onback: () => void; onlearn: () => void } =
    $props();

  const r = $derived(result);
  const pct = $derived(Math.round(r.accuracy * 100));
  const headline = $derived(
    r.mode === 'watch'
      ? 'That’s the whole song'
      : r.stars === 3
        ? 'Beautifully played'
        : r.stars === 2
          ? 'Great playing'
          : r.stars === 1
            ? 'Nice work'
            : 'Keep going, it gets easier',
  );
  const nextSpeed = $derived(r.stars === 3 && r.config.speed < 1 ? Math.min(1, Math.round((r.config.speed + 0.1) * 10) / 10) : null);
</script>

<div class="results">
  <div class="panel">
    <div class="cover" style:background="linear-gradient(140deg, {r.entry.art.from}, {r.entry.art.to})">{r.entry.art.emoji}</div>
    <div class="body">
      <p class="song">{r.song.title}</p>
      <h1>{headline}</h1>
      {#if r.mode !== 'watch'}
        <div class="stars" aria-label="{r.stars} of 3 stars">
          {#each [1, 2, 3] as s}<span class:on={s <= r.stars}>★</span>{/each}
        </div>
        <p class="accuracy"><b>{pct}%</b> accuracy{r.newBest ? ', a new best!' : ''}</p>
        <dl>
          {#if r.mode === 'play'}
            <div><dt>Perfect</dt><dd>{r.perfect}</dd></div>
            <div><dt>Good</dt><dd>{r.good}</dd></div>
            <div><dt>Missed</dt><dd>{r.miss}</dd></div>
            <div><dt>Best streak</dt><dd>{r.bestCombo}</dd></div>
          {:else}
            <div><dt>Right notes</dt><dd>{r.perfect}</dd></div>
            <div><dt>Wrong notes</dt><dd>{r.wrong}</dd></div>
          {/if}
        </dl>
      {:else}
        <p class="accuracy">Ready to try it yourself?</p>
      {/if}
      <div class="actions">
        {#if r.mode === 'watch'}
          <button class="btn-primary" onclick={onlearn}>Learn this song</button>
        {:else if nextSpeed}
          <button class="btn-primary" onclick={() => onagain(nextSpeed!)}>Try it at {Math.round(nextSpeed * 100)}%</button>
          <button class="btn-quiet" onclick={() => onagain()}>Play again</button>
        {:else}
          <button class="btn-primary" onclick={() => onagain()}>Play again</button>
        {/if}
        <button class="btn-quiet" onclick={onback}>Back to songs</button>
      </div>
    </div>
  </div>
</div>

<style>
  .results {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow-y: auto;
    padding: calc(var(--sat) + 16px) calc(var(--sar) + 16px) calc(var(--sab) + 16px) calc(var(--sal) + 16px);
    background: radial-gradient(80% 70% at 50% 0%, rgba(231, 182, 90, 0.14), transparent 70%), var(--midnight);
  }
  .panel {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 32px;
    align-items: center;
    max-width: 760px;
    width: 100%;
  }
  .cover {
    aspect-ratio: 1;
    border-radius: 28px;
    display: grid;
    place-items: center;
    font-size: 88px;
  }
  .song {
    color: var(--ivory-dim);
    font-weight: 700;
  }
  h1 {
    margin-top: 4px;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .stars {
    margin-top: 10px;
    font-size: 48px;
    letter-spacing: 6px;
    color: rgba(245, 239, 227, 0.16);
  }
  .stars .on {
    color: var(--brass);
    text-shadow: 0 0 24px rgba(231, 182, 90, 0.45);
  }
  .accuracy {
    margin-top: 4px;
    font-size: 18px;
    color: var(--ivory-dim);
  }
  .accuracy b {
    color: var(--ivory);
    font-size: 24px;
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 24px;
    margin: 18px 0 0;
  }
  dl div {
    display: grid;
  }
  dt {
    color: var(--ivory-dim);
    font-size: 14px;
  }
  dd {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 24px;
  }
  @media (max-width: 600px) {
    .panel {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    .cover {
      width: 120px;
      font-size: 56px;
    }
  }
</style>
