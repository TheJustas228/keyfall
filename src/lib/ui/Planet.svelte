<script lang="ts">
  import { onMount } from 'svelte';
  import { cachedTexture, renderSphere, PALETTES } from './planets';

  let {
    seed,
    palette = 'ember',
    size = 200,
    spin = 0.02,
    ring = false,
    moon = false,
    glow = 1,
  }: { seed: string; palette?: string; size?: number; spin?: number; ring?: boolean; moon?: boolean; glow?: number } = $props();

  let canvas: HTMLCanvasElement;
  const pal = $derived(PALETTES[palette] ?? PALETTES.ember);
  const box = $derived(ring ? size * 1.9 : size * 1.15);

  onMount(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d')!;
    let res = 0;
    let img: ImageData;
    let sphere: HTMLCanvasElement;
    let sctx: CanvasRenderingContext2D;
    let raf = 0;
    let spinPos = Math.random();
    let last = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setup() {
      res = Math.min(360, Math.round(size * dpr));
      img = new ImageData(res, res);
      sphere = document.createElement('canvas');
      sphere.width = sphere.height = res;
      sctx = sphere.getContext('2d')!;
      canvas.width = Math.round(box * dpr);
      canvas.height = Math.round(box * dpr);
    }

    function drawRing(front: boolean, cx: number, cy: number, R: number) {
      const c = pal.glow;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.38);
      ctx.beginPath();
      ctx.rect(-box * dpr, front ? 0 : -box * dpr, box * 2 * dpr, box * dpr);
      ctx.clip();
      for (let i = 0; i < 7; i++) {
        const k = 1.32 + i * 0.07;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * k * 1.18, R * k * 0.3, 0, 0, Math.PI * 2);
        ctx.lineWidth = R * (i % 3 === 0 ? 0.05 : 0.025);
        ctx.strokeStyle = `rgba(${Math.min(255, c[0] + 40)},${Math.min(255, c[1] + 50)},${Math.min(255, c[2] + 60)},${0.16 + (i % 2) * 0.22})`;
        ctx.stroke();
      }
      if (moon) {
        const a = performance.now() / 4000;
        const mx = Math.cos(a) * R * 1.62;
        const my = Math.sin(a) * R * 0.42;
        if ((my > 0) === front) {
          const g = ctx.createRadialGradient(mx - R * 0.03, my - R * 0.03, 0, mx, my, R * 0.09);
          g.addColorStop(0, '#ffd9a8');
          g.addColorStop(1, `rgb(${c.join(',')})`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(mx, my, R * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (document.visibilityState !== 'visible') return;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!reduce) spinPos = (spinPos + dt * spin) % 1;
      renderSphere(img, cachedTexture(seed, palette), pal, spinPos);
      sctx.putImageData(img, 0, 0);
      const W = canvas.width;
      const cx = W / 2;
      const cy = W / 2;
      const R = (size * dpr) / 2;
      ctx.clearRect(0, 0, W, W);
      if (ring) drawRing(false, cx, cy, R);
      ctx.drawImage(sphere, cx - R, cy - R, R * 2, R * 2);
      if (ring) drawRing(true, cx, cy, R);
      if (reduce && !moon) cancelAnimationFrame(raf);
    }

    setup();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="planet" style:width="{box}px" style:height="{box}px" style:--g={glow} style:--glow="rgb({pal.glow.join(',')})" style:--core="{size}px">
  <canvas bind:this={canvas} style:width="{box}px" style:height="{box}px"></canvas>
</div>

<style>
  .planet {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
  }
  .planet::before {
    content: '';
    position: absolute;
    width: var(--core);
    height: var(--core);
    border-radius: 50%;
    box-shadow:
      0 0 calc(var(--core) * 0.18 * var(--g)) calc(var(--core) * 0.02) color-mix(in srgb, var(--glow) 55%, transparent),
      0 0 calc(var(--core) * 0.5 * var(--g)) calc(var(--core) * 0.06) color-mix(in srgb, var(--glow) 22%, transparent);
    opacity: var(--g);
  }
  canvas {
    position: relative;
    display: block;
  }
</style>
