<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/ui/store.svelte';
  import { layoutKeys, hitTest, type Key } from '../lib/game/keyboard';
  import { KeyInput, type KeyChange } from '../lib/game/keyinput';
  import { createRenderer, type PressKind, type Renderer, type Rising } from '../lib/game/renderer';
  import { isWhite } from '../lib/game/prepare';
  import { piano } from '../lib/audio/piano';

  let { onexit }: { onexit: () => void } = $props();

  let octaves = $state(3);
  let low = $state(48); // C3
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let probe: HTMLDivElement;
  let renderer: Renderer;
  let keys: Key[] = [];
  let kb = { x: 0, y: 0, w: 0, h: 0 };
  let stageTop = 0;
  const input = new KeyInput();
  const pressed = new Map<number, PressKind>();
  let rising: Rising[] = [];
  let raf = 0;

  const hi = $derived(Math.min(108, low + octaves * 12));
  const rangeLabel = $derived(`C${Math.floor(low / 12) - 1} to C${Math.floor(hi / 12) - 1}`);

  function layout() {
    const W = container.clientWidth;
    const H = container.clientHeight;
    const cs = getComputedStyle(probe);
    const sal = parseFloat(cs.paddingLeft) || 0;
    const sar = parseFloat(cs.paddingRight) || 0;
    const sab = parseFloat(cs.paddingBottom) || 0;
    const sat = parseFloat(cs.paddingTop) || 0;
    const portrait = H > W;
    const kbH = portrait ? Math.min(240, H * 0.26) : Math.min(200, Math.max(120, H * 0.42));
    kb = { x: sal + 6, y: H - Math.max(sab, 6) - kbH, w: W - sal - sar - 12, h: kbH };
    stageTop = sat + 64;
    keys = layoutKeys(low, isWhite(hi) ? hi : hi + 1, kb.w);
    renderer.resize(W, H, Math.min(window.devicePixelRatio || 1, 3));
  }

  $effect(() => {
    void low;
    void octaves;
    if (renderer) {
      for (const m of input.cancelAll()) piano.noteOff(m);
      pressed.clear();
      layout();
    }
  });

  function apply(c: KeyChange) {
    const now = performance.now() / 1000;
    if (c.off !== undefined) {
      piano.noteOff(c.off);
      pressed.delete(c.off);
      const r = rising.findLast((x) => x.midi === c.off && x.t1 === null);
      if (r) r.t1 = now;
    }
    if (c.on !== undefined) {
      piano.noteOn(c.on, 0.8);
      pressed.set(c.on, c.on >= 60 ? 'R' : 'L');
      rising.push({ midi: c.on, t0: now, t1: null });
    }
  }

  function midiAt(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    const y = e.clientY - r.top - kb.y;
    if (y < -24 || y > kb.h + 10) return null;
    return hitTest(keys, e.clientX - r.left - kb.x, Math.max(0, y), kb.h);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const now = performance.now() / 1000;
    rising = rising.filter((r) => r.t1 === null || now - r.t1 < 4);
    renderer.draw({
      clock: 0,
      window: 1,
      keys,
      kb,
      stageTop,
      required: [],
      auto: [],
      dimAuto: false,
      judgment: () => undefined,
      pressed,
      pending: new Set(),
      labels: app.settings.labels,
      flats: false,
      keyLabels: app.settings.keyLabels,
      now,
      rising,
    });
  }

  onMount(() => {
    renderer = createRenderer(canvas);
    layout();
    piano.ensureStarted();
    const ro = new ResizeObserver(layout);
    ro.observe(container);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const m of input.cancelAll()) piano.noteOff(m);
    };
  });
</script>

<div class="free" bind:this={container}>
  <div class="probe" bind:this={probe}></div>
  <canvas
    bind:this={canvas}
    onpointerdown={(e) => {
      const m = midiAt(e);
      if (m === null) return;
      canvas.setPointerCapture(e.pointerId);
      apply(input.down(e.pointerId, m));
    }}
    onpointermove={(e) => apply(input.move(e.pointerId, midiAt(e)))}
    onpointerup={(e) => apply(input.up(e.pointerId))}
    onpointercancel={(e) => apply(input.up(e.pointerId))}
    onlostpointercapture={(e) => apply(input.up(e.pointerId))}
  ></canvas>
  <header>
    <button class="icon-btn" aria-label="Back to song list" onclick={onexit}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <h1>Free play</h1>
    <div class="group" aria-label="Move the keyboard">
      <button class="icon-btn" aria-label="Lower notes" disabled={low <= 24} onclick={() => (low = Math.max(24, low - 12))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <span class="range">{rangeLabel}</span>
      <button class="icon-btn" aria-label="Higher notes" disabled={hi >= 96} onclick={() => (low = Math.min(96 - octaves * 12, low + 12))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
    <div class="group" aria-label="Number of keys">
      <button class="icon-btn" aria-label="Fewer, bigger keys" disabled={octaves <= 1} onclick={() => (octaves -= 1)}>−</button>
      <span class="range">{octaves} {octaves === 1 ? 'octave' : 'octaves'}</span>
      <button class="icon-btn" aria-label="More keys" disabled={octaves >= 5} onclick={() => { octaves += 1; low = Math.min(low, 96 - octaves * 12); }}>+</button>
    </div>
  </header>
</div>

<style>
  .free {
    position: fixed;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }
  .probe {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  canvas {
    position: absolute;
    inset: 0;
    touch-action: none;
  }
  header {
    position: absolute;
    top: calc(var(--sat) + 8px);
    left: calc(var(--sal) + 10px);
    right: calc(var(--sar) + 10px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
  }
  h1 {
    font-size: 22px;
    font-weight: 800;
    margin-right: auto;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .icon-btn {
    font-size: 24px;
    font-weight: 700;
  }
  .icon-btn:disabled {
    opacity: 0.35;
  }
  .range {
    min-width: 92px;
    text-align: center;
    font-weight: 700;
    color: var(--ivory-dim);
    font-variant-numeric: tabular-nums;
  }
</style>
