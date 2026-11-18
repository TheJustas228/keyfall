<script lang="ts">
  import { planetDesign, RADIUS, PERIOD } from './planets';

  let {
    seed,
    palette = 'ember',
    size = 160,
    spin = 40,
    ring = false,
    moon = false,
    glow = 1,
  }: { seed: string; palette?: string; size?: number; spin?: number; ring?: boolean; moon?: boolean; glow?: number } = $props();

  const d = $derived(planetDesign(seed, palette));
  // unique ids so several planets on one screen don't share gradients
  const uid = 'p' + Math.random().toString(36).slice(2, 8);
  // the drawing is 200 units wide (sphere radius 80); a ring needs more room
  const view = $derived(ring ? 156 : 116);
  // `size` is the sphere's diameter; the box adds room for the glow (and ring)
  const box = $derived((size * view) / RADIUS);
</script>

<svg
  class="planet"
  width={box}
  height={box}
  viewBox="{-view} {-view} {view * 2} {view * 2}"
  aria-hidden="true"
  style:--spin="{spin}s"
  style:--period="{-PERIOD}px"
>
  <defs>
    <radialGradient id="{uid}-base" cx="38%" cy="32%" r="78%">
      <stop offset="0" stop-color={d.pal.light} />
      <stop offset="0.45" stop-color={d.pal.mid} />
      <stop offset="1" stop-color={d.pal.deep} />
    </radialGradient>
    <radialGradient id="{uid}-shade" cx="34%" cy="28%" r="88%">
      <stop offset="0.35" stop-color="#000" stop-opacity="0" />
      <stop offset="0.82" stop-color="#000" stop-opacity="0.45" />
      <stop offset="1" stop-color="#000" stop-opacity="0.85" />
    </radialGradient>
    <radialGradient id="{uid}-shine" cx="32%" cy="26%" r="40%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-rim" r="50%">
      <stop offset="0.86" stop-color={d.pal.glow} stop-opacity="0" />
      <stop offset="0.97" stop-color={d.pal.glow} stop-opacity={0.55 * glow} />
      <stop offset="1" stop-color={d.pal.glow} stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-halo" r="50%">
      <stop offset="0.5" stop-color={d.pal.glow} stop-opacity={0.32 * glow} />
      <stop offset="1" stop-color={d.pal.glow} stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-ring" x1="0" x2="1">
      <stop offset="0" stop-color={d.pal.light} stop-opacity="0.15" />
      <stop offset="0.5" stop-color={d.pal.light} stop-opacity="0.75" />
      <stop offset="1" stop-color={d.pal.light} stop-opacity="0.15" />
    </linearGradient>
    <clipPath id="{uid}-clip"><circle r={RADIUS} /></clipPath>
    <clipPath id="{uid}-back"><rect x="-200" y="-200" width="400" height="200" /></clipPath>
    <clipPath id="{uid}-front"><rect x="-200" y="0" width="400" height="200" /></clipPath>
  </defs>

  <circle r={RADIUS * 1.42} fill="url(#{uid}-halo)" />

  {#if ring}
    <g transform="rotate(-16)" clip-path="url(#{uid}-back)">
      <ellipse rx={RADIUS * 1.75} ry={RADIUS * 0.42} fill="none" stroke="url(#{uid}-ring)" stroke-width="7" opacity="0.7" />
      <ellipse rx={RADIUS * 1.55} ry={RADIUS * 0.36} fill="none" stroke="url(#{uid}-ring)" stroke-width="3" opacity="0.55" />
    </g>
  {/if}

  <circle r={RADIUS} fill="url(#{uid}-base)" />
  <g clip-path="url(#{uid}-clip)">
    <g class="bands" class:still={spin <= 0}>
      {#each d.bands as b}
        <path d={b.path} fill={b.color} opacity={b.opacity} />
      {/each}
      {#each d.storms as s}
        <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.color} opacity={s.opacity} />
      {/each}
    </g>
  </g>
  <circle r={RADIUS} fill="url(#{uid}-shade)" />
  <circle r={RADIUS} fill="url(#{uid}-shine)" />
  <circle r={RADIUS * 1.03} fill="url(#{uid}-rim)" />

  {#if ring}
    <g transform="rotate(-16)" clip-path="url(#{uid}-front)">
      <ellipse rx={RADIUS * 1.75} ry={RADIUS * 0.42} fill="none" stroke="url(#{uid}-ring)" stroke-width="7" opacity="0.85" />
      <ellipse rx={RADIUS * 1.55} ry={RADIUS * 0.36} fill="none" stroke="url(#{uid}-ring)" stroke-width="3" opacity="0.7" />
    </g>
    {#if moon}
      <g transform="rotate(-16)">
        <circle r="7" fill={d.pal.light} class="moon">
          <animateMotion dur="9s" repeatCount="indefinite" path="M {RADIUS * 1.75},0 A {RADIUS * 1.75},{RADIUS * 0.42} 0 1 1 {-RADIUS * 1.75},0 A {RADIUS * 1.75},{RADIUS * 0.42} 0 1 1 {RADIUS * 1.75},0" />
        </circle>
      </g>
    {/if}
  {/if}
</svg>

<style>
  .planet {
    display: block;
    flex: none;
    overflow: visible;
  }
  .bands {
    animation: spin var(--spin) linear infinite;
  }
  .bands.still {
    animation: none;
  }
  @keyframes spin {
    to {
      transform: translateX(var(--period));
    }
  }
  .moon {
    filter: drop-shadow(0 0 4px currentColor);
  }
  @media (prefers-reduced-motion: reduce) {
    .bands {
      animation: none;
    }
  }
</style>
