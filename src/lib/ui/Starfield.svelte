<script lang="ts">
  import { onMount } from 'svelte';

  /** Space background: twinkling stars, drifting dust, rising embers and the odd shooting star. */
  let { active = true, embers = 1 }: { active?: boolean; embers?: number } = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1;
    type Star = { x: number; y: number; r: number; tw: number; ph: number; warm: boolean };
    type Ember = { x: number; y: number; vy: number; vx: number; r: number; life: number; max: number };
    let stars: Star[] = [];
    let emberList: Ember[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let raf = 0;
    let last = performance.now();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((W * H) / 2600);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.08 ? 1.3 + Math.random() : 0.4 + Math.random() * 0.7,
        tw: 0.6 + Math.random() * 2.2,
        ph: Math.random() * 6.28,
        warm: Math.random() < 0.35,
      }));
    }

    function spawnEmber(): Ember {
      return {
        x: Math.random() * W,
        y: H + 10,
        vy: -(14 + Math.random() * 38),
        vx: (Math.random() - 0.5) * 10,
        r: 0.6 + Math.random() * 1.8,
        life: 0,
        max: 4 + Math.random() * 7,
      };
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (!active || document.visibilityState !== 'visible') {
        last = t;
        return;
      }
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const time = t / 1000;
      ctx.fillStyle = '#050307';
      ctx.fillRect(0, 0, W, H);
      // warm nebula haze rising from the bottom
      const g = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(255,90,30,0.20)');
      g.addColorStop(0.45, 'rgba(160,30,20,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.tw + s.ph));
        ctx.globalAlpha = a;
        ctx.fillStyle = s.warm ? '#ffb27a' : '#fff4ea';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce) {
        const target = Math.round(46 * embers);
        while (emberList.length < target) {
          const e = spawnEmber();
          e.y = H * (0.4 + Math.random() * 0.6);
          emberList.push(e);
        }
        ctx.globalCompositeOperation = 'lighter';
        emberList = emberList.filter((e) => (e.life += dt) < e.max && e.y > -10);
        for (const e of emberList) {
          e.y += e.vy * dt;
          e.x += (e.vx + Math.sin(time * 1.3 + e.max) * 6) * dt;
          const fade = Math.min(1, e.life / 0.8) * Math.min(1, (e.max - e.life) / 1.2) * Math.min(1, e.y / (H * 0.35));
          ctx.globalAlpha = Math.max(0, fade) * 0.9;
          ctx.fillStyle = '#ff8a3c';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, 6.2832);
          ctx.fill();
          ctx.globalAlpha = Math.max(0, fade) * 0.18;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 4, 0, 6.2832);
          ctx.fill();
        }
        while (emberList.length < target) emberList.push(spawnEmber());

        if (!shoot && Math.random() < dt * 0.06) {
          shoot = { x: Math.random() * W * 0.8, y: Math.random() * H * 0.35, vx: 520 + Math.random() * 300, vy: 160 + Math.random() * 120, life: 0 };
        }
        if (shoot) {
          shoot.life += dt;
          shoot.x += shoot.vx * dt;
          shoot.y += shoot.vy * dt;
          const a = Math.max(0, 1 - shoot.life / 0.9);
          const tail = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18);
          tail.addColorStop(0, `rgba(255,236,220,${a})`);
          tail.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.globalAlpha = 1;
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18);
          ctx.stroke();
          if (a <= 0 || shoot.x > W + 50) shoot = null;
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }
</style>
