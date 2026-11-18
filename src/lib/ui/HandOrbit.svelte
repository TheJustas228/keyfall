<script lang="ts">
  import Planet from './Planet.svelte';
  import { haptic } from './haptics';
  import type { HandChoice } from '../game/levels';

  let {
    value,
    onchange,
    disabled = {},
    compact = false,
  }: { value: HandChoice; onchange: (v: HandChoice) => void; disabled?: Partial<Record<HandChoice, boolean>>; compact?: boolean } = $props();
  const size = $derived(compact ? 120 : 170);

  const items: { id: HandChoice; label: string; palette: string; seed: string; ring?: boolean }[] = [
    { id: 'R', label: 'Right hand', palette: 'ember', seed: 'hand-right-7' },
    { id: 'L', label: 'Left hand', palette: 'cobalt', seed: 'hand-left-3' },
    { id: 'both', label: 'Both hands', palette: 'crimson', seed: 'hand-both-11', ring: true },
  ];
  const sel = $derived(Math.max(0, items.findIndex((i) => i.id === value)));
  /** -1 left, 0 centre, +1 right */
  const slotOf = (k: number) => ((k - sel + 4) % 3) - 1;

  let width = $state(360);
  let startX = 0;
  let dragging = false;
  let dx = $state(0);

  function pick(k: number) {
    const id = items[k].id;
    if (disabled[id] || id === value) return;
    haptic();
    onchange(id);
  }
  function down(e: PointerEvent) {
    dragging = true;
    startX = e.clientX;
    dx = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (dragging) dx = e.clientX - startX;
  }
  function up(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    const moved = dx;
    dx = 0;
    if (Math.abs(moved) > 36) {
      pick((sel + (moved < 0 ? 1 : 2)) % 3);
      return;
    }
    // a tap: which planet was under the finger?
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const slot = Math.abs(x) < r.width * 0.17 ? 0 : x < 0 ? -1 : 1;
    const k = items.findIndex((_, i) => slotOf(i) === slot);
    if (k >= 0) pick(k);
  }
</script>

<div class="orbit" class:compact tabindex="-1" bind:clientWidth={width} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => { dragging = false; dx = 0; }} role="radiogroup" aria-label="Which hand">
  <div class="chev up" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 9l7 6 7-6" /></svg></div>
  <div class="line" aria-hidden="true"></div>
  {#each items as it, k (it.id)}
    {@const slot = slotOf(k)}
    <div
      class="body"
      class:center={slot === 0}
      class:off={disabled[it.id]}
      style:transform="translateX({slot * width * 0.34 + dx * 0.35}px) scale({slot === 0 ? 1 : 0.38})"
      role="radio"
      aria-checked={slot === 0}
      aria-label={it.label}
    >
      {#if slot === 0}
        <svg class="ring" viewBox="0 0 300 120" aria-hidden="true"><ellipse cx="150" cy="60" rx="140" ry="34" /><circle class="moon" r="7" cx="150" cy="60" /></svg>
      {/if}
      <Planet seed={it.seed} palette={it.palette} {size} spin={slot === 0 ? 0.035 : 0.015} ring={it.ring} moon={it.ring} glow={slot === 0 ? 1 : 0.6} />
    </div>
  {/each}
  <div class="chev down" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 15l7-6 7 6" /></svg></div>
</div>
<div class="labels">
  {#each items as it, k (it.id)}
    <button class:on={slotOf(k) === 0} style:transform="translateX({slotOf(k) * width * 0.34}px)" onclick={() => pick(k)} disabled={disabled[it.id]}>{it.label}</button>
  {/each}
</div>

<style>
  .orbit {
    position: relative;
    height: 250px;
    display: grid;
    place-items: center;
    touch-action: pan-y;
    cursor: grab;
  }
  .line {
    position: absolute;
    left: 6%;
    right: 6%;
    top: 50%;
    height: 1.5px;
    background: linear-gradient(90deg, transparent, rgba(255, 210, 190, 0.35) 18%, rgba(255, 210, 190, 0.35) 82%, transparent);
  }
  .body {
    position: absolute;
    display: grid;
    place-items: center;
    transition: transform 0.65s var(--spring), filter 0.4s ease;
    will-change: transform;
  }
  .body:not(.center) {
    filter: saturate(0.9) brightness(0.85);
  }
  .body.off {
    filter: grayscale(1) brightness(0.4);
  }
  .ring {
    position: absolute;
    width: 300px;
    height: 120px;
    transform: rotate(-14deg);
    overflow: visible;
    pointer-events: none;
    animation: ringIn 0.6s var(--ease-out);
  }
  .ring ellipse {
    fill: none;
    stroke: rgba(255, 236, 220, 0.75);
    stroke-width: 1.6;
  }
  .ring .moon {
    fill: #ff8a3c;
    filter: drop-shadow(0 0 6px #ff6a1f);
    offset-path: path('M 10 60 A 140 34 0 1 0 290 60 A 140 34 0 1 0 10 60');
    animation: moon 9s linear infinite;
  }
  @keyframes moon {
    to { offset-distance: 100%; }
  }
  @keyframes ringIn {
    from { opacity: 0; transform: rotate(-14deg) scale(0.7); }
  }
  .chev {
    position: absolute;
    left: 50%;
    width: 34px;
    height: 34px;
    margin-left: -17px;
    animation: bob 2.4s ease-in-out infinite;
  }
  .chev svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: var(--ember);
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px rgba(255, 106, 31, 0.6));
  }
  .chev.up {
    top: -4px;
  }
  .chev.down {
    bottom: -4px;
    animation-delay: 1.2s;
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); opacity: 0.8; }
    50% { transform: translateY(5px); opacity: 1; }
  }
  .chev.down {
    animation-name: bobUp;
  }
  @keyframes bobUp {
    0%, 100% { transform: translateY(0); opacity: 0.8; }
    50% { transform: translateY(-5px); opacity: 1; }
  }
  .orbit.compact {
    height: 180px;
  }
  .orbit.compact .ring {
    width: 220px;
    height: 88px;
  }
  .labels {
    position: relative;
    height: 44px;
    margin-top: 6px;
  }
  .labels button {
    position: absolute;
    left: 50%;
    top: 0;
    width: 130px;
    margin-left: -65px;
    min-height: 44px;
    font-size: 17px;
    color: var(--muted);
    transition: transform 0.65s var(--spring), color 0.3s ease;
  }
  .labels button.on {
    color: var(--ivory);
    font-weight: 600;
  }
  .labels button:disabled {
    opacity: 0.35;
  }
</style>
