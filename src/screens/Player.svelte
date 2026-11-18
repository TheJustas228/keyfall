<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/ui/store.svelte';
  import { prepare, type Prepared } from '../lib/game/prepare';
  import { Session, type Judgment } from '../lib/game/session';
  import { layoutKeys, hitTest, type Key } from '../lib/game/keyboard';
  import { KeyInput, type KeyChange } from '../lib/game/keyinput';
  import { createRenderer, type PressKind, type Renderer } from '../lib/game/renderer';
  import { piano } from '../lib/audio/piano';
  import { startListening, MicError, type Listener } from '../lib/audio/listen';
  import type { Note, Song } from '../lib/music/types';
  import type { SongConfig } from '../lib/storage/prefs';
  import type { FinishStats } from '../lib/ui/store.svelte';
  import { preferFlats } from '../lib/music/spelling';

  let {
    song,
    config,
    onexit,
    onfinish,
  }: { song: Song; config: SongConfig; onexit: () => void; onfinish: (s: FinishStats) => void } = $props();

  // ---------- setup (fixed for the life of this player) ----------
  // svelte-ignore state_referenced_locally
  const mode = config.mode;
  const watch = mode === 'watch';
  const byStart = (a: Note, b: Note) => a.start - b.start || a.midi - b.midi;
  // svelte-ignore state_referenced_locally
  const base = prepare(song, watch ? { R: 'full', L: 'full' } : config.levels);
  // svelte-ignore state_referenced_locally
  const prepared: Prepared = watch ? { ...base, required: [], auto: [...song.notes].sort(byStart), steps: [] } : base;
  const LEAD_IN = 2.5;
  // svelte-ignore state_referenced_locally
  const flats = preferFlats(song.notes);

  // svelte-ignore state_referenced_locally
  let session = $state.raw(new Session(prepared, mode, config.speed, { leadIn: LEAD_IN }));
  // svelte-ignore state_referenced_locally
  let input = $state(config.input);
  // svelte-ignore state_referenced_locally
  let speed = $state(config.speed);
  let paused = $state(false);
  let started = $state(false);
  // svelte-ignore state_referenced_locally
  let needsTapToListen = $state(config.input === 'listen');
  let progress = $state(0);
  let loopA = $state<number | null>(null);
  let loopB = $state<number | null>(null);
  let portrait = $state(false);
  let rotateDismissed = $state(false);
  let waitingLong = $state(false);
  let micLevel = $state(0);
  let banner = $state('');
  let scrubbing = $state(false);

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let probe: HTMLDivElement;
  let renderer: Renderer;
  let keys: Key[] = [];
  let kb = { x: 0, y: 0, w: 0, h: 0 };
  let stageTop = 0;
  const keyInput = new KeyInput();
  const userPressed = new Map<number, PressKind>();
  const recentAuto = new Map<number, number>(); // midi → time (ms) it sounded, for the mic echo guard
  let listener: Listener | null = null;
  let autoIdx = 0;
  let raf = 0;
  let lastT = 0;
  let lastMiss = 0;
  let waitingSince = 0;
  let done = false;
  let destroyed = false;
  let wakeLock: { release(): Promise<void> } | null = null;
  let bannerTimer = 0;

  function flash(msg: string) {
    banner = msg;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => (banner = ''), 2600);
  }

  // ---------- layout ----------
  function layout() {
    const W = container.clientWidth;
    const H = container.clientHeight;
    const cs = getComputedStyle(probe);
    const sal = parseFloat(cs.paddingLeft) || 0;
    const sar = parseFloat(cs.paddingRight) || 0;
    const sat = parseFloat(cs.paddingTop) || 0;
    const sab = parseFloat(cs.paddingBottom) || 0;
    portrait = H > W;
    const kbH = portrait ? Math.min(210, Math.max(140, H * 0.2)) : Math.min(175, Math.max(108, H * 0.32));
    kb = { x: sal + 6, y: H - Math.max(sab, 6) - kbH, w: W - sal - sar - 12, h: kbH };
    stageTop = sat + 60;
    keys = layoutKeys(prepared.lo, prepared.hi, kb.w);
    renderer.resize(W, H, Math.min(window.devicePixelRatio || 1, 3));
  }

  // ---------- audio scheduling ----------
  function lowerBound(arr: Note[], t: number) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].start < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function resetAuto() {
    piano.cancelScheduled();
    autoIdx = lowerBound(prepared.auto, session.clock);
  }

  function scheduleAuto() {
    const auto = prepared.auto;
    const horizon = session.autoHorizon(0.12);
    const now = piano.now();
    const volume = input === 'listen' ? 0.55 : 1;
    while (autoIdx < auto.length && auto[autoIdx].start <= horizon) {
      const n = auto[autoIdx++];
      if (n.start < session.clock - 0.05) continue;
      const delay = Math.max(0, (n.start - session.clock) / session.speed);
      piano.schedule(n.midi, (watch ? n.vel : n.vel * 0.8) * volume, now + delay, n.dur / session.speed);
      recentAuto.set(n.midi, performance.now() + delay * 1000);
    }
  }

  // ---------- input ----------
  function handOf(midi: number): 'R' | 'L' {
    const req = prepared.required;
    let best: Note | null = null;
    for (let i = Math.max(0, lowerBound(req, session.clock - 1)); i < req.length && req[i].start < session.clock + 1; i++) {
      if (req[i].midi === midi && (!best || Math.abs(req[i].start - session.clock) < Math.abs(best.start - session.clock))) best = req[i];
    }
    return best ? best.hand : midi >= 60 ? 'R' : 'L';
  }

  function react(midi: number, j: Judgment | null): PressKind {
    if (j === null) return 'free';
    if (j === 'wrong') {
      if (mode === 'play') renderer.pop('✕', frameRef(), '#fda4af', midi);
      return 'wrong';
    }
    const hand = handOf(midi);
    renderer.burst(midi, frameRef(), hand);
    if (mode === 'play') renderer.pop(j === 'perfect' ? 'Perfect' : 'Good', frameRef(), j === 'perfect' ? '#e7b65a' : '#f5efe3', midi);
    return hand;
  }

  function apply(change: KeyChange) {
    if (change.off !== undefined) {
      piano.noteOff(change.off);
      userPressed.delete(change.off);
    }
    if (change.on !== undefined) {
      const midi = change.on;
      piano.noteOn(midi, 0.8);
      const j = started && !paused ? session.press(midi) : null;
      userPressed.set(midi, react(midi, j));
      if (j && j !== 'wrong') waitingSince = performance.now();
    }
  }

  function midiAt(e: PointerEvent): number | null {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left - kb.x;
    const y = e.clientY - r.top - kb.y;
    if (y < -24 || y > kb.h + 10) return null;
    return hitTest(keys, x, Math.max(0, y), kb.h);
  }

  function onDown(e: PointerEvent) {
    const midi = midiAt(e);
    if (midi === null) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    apply(keyInput.down(e.pointerId, midi));
  }
  function onMove(e: PointerEvent) {
    apply(keyInput.move(e.pointerId, midiAt(e)));
  }
  function onUp(e: PointerEvent) {
    apply(keyInput.up(e.pointerId));
  }
  function releaseAll() {
    for (const m of keyInput.cancelAll()) {
      piano.noteOff(m);
      userPressed.delete(m);
    }
  }

  function onMicNotes(midis: number[]) {
    if (!started || paused) return;
    const now = performance.now();
    for (const midi of midis) {
      const t = recentAuto.get(midi);
      if (t !== undefined && Math.abs(now - t) < 320) continue; // that was the app's own accompaniment
      const j = session.press(midi);
      const kind = react(midi, j);
      userPressed.set(midi, kind);
      if (j && j !== 'wrong') waitingSince = now;
      setTimeout(() => {
        if (userPressed.get(midi) === kind && !keyInput.held().includes(midi)) userPressed.delete(midi);
      }, 220);
    }
  }

  // ---------- transport ----------
  function pause() {
    if (paused || done) return;
    paused = true;
    piano.cancelScheduled();
    releaseAll();
  }
  function resume() {
    paused = false;
    lastT = performance.now();
    resetAuto();
  }
  function restart() {
    session = new Session(prepared, mode, speed, { leadIn: LEAD_IN });
    session.setLoop(loopA, loopB);
    lastMiss = 0;
    renderer.clearEffects();
    resume();
  }
  function setSpeed(s: number) {
    speed = Math.round(Math.min(1.2, Math.max(0.4, s)) * 10) / 10;
    session.speed = speed;
    resetAuto();
  }
  function seekTo(t: number) {
    // seeking to the very start gives a short lead-in so the first notes fall into view
    session.seek(t < 0.5 ? -1.5 * speed : t);
    renderer.clearEffects();
    resetAuto();
    lastMiss = session.stats.miss;
    progress = session.progress();
  }
  function toggleLoop() {
    const t = Math.max(0, session.clock);
    if (loopA === null) {
      loopA = t;
      flash('Loop start set. Tap the loop button again at the end of the section.');
    } else if (loopB === null) {
      if (t <= loopA + 0.5) {
        flash('Play a little further, then set the loop end.');
        return;
      }
      loopB = t;
      session.setLoop(loopA, loopB);
      seekTo(loopA);
      flash('Looping this section.');
    } else {
      loopA = loopB = null;
      session.setLoop(null, null);
      flash('Loop off.');
    }
  }

  function scrub(e: PointerEvent) {
    const bar = e.currentTarget as HTMLElement;
    const r = bar.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    seekTo(f * session.duration);
  }

  async function beginListening() {
    needsTapToListen = false;
    await piano.ensureStarted();
    try {
      listener = await startListening(onMicNotes, app.settings.sensitivity);
      flash('Listening. Play on your piano.');
    } catch (e) {
      input = 'touch';
      flash(e instanceof MicError ? e.message : 'The microphone couldn’t start. Using the screen keys instead.');
    }
    start();
  }

  function start() {
    started = true;
    lastT = performance.now();
    waitingSince = performance.now();
    resetAuto();
  }

  function finish() {
    if (done) return;
    done = true;
    piano.cancelScheduled();
    const s = session.stats;
    setTimeout(() => {
      if (destroyed) return;
      onfinish({ stars: s.stars(), accuracy: s.accuracy(), perfect: s.perfect, good: s.good, miss: s.miss, wrong: s.wrong, bestCombo: s.bestCombo });
    }, 600);
  }

  // ---------- render loop ----------
  const pressed = new Map<number, PressKind>();
  function frameRef() {
    return {
      clock: session.clock,
      window: app.settings.fallSeconds * session.speed,
      keys,
      kb,
      stageTop,
      required: prepared.required,
      auto: prepared.auto,
      dimAuto: !watch,
      judgment: (n: Note) => session.judgmentOf(n),
      pressed,
      pending: session.pendingMidis(),
      labels: app.settings.labels,
      flats,
      keyLabels: app.settings.keyLabels,
      now: performance.now() / 1000,
    };
  }

  function loop(t: number) {
    raf = requestAnimationFrame(loop);
    const dt = (t - lastT) / 1000;
    lastT = t;
    if (started && !paused && !done) {
      session.update(dt);
      scheduleAuto();
      if (session.stats.miss > lastMiss) {
        lastMiss = session.stats.miss;
        renderer.pop('Miss', frameRef(), '#94a3b8');
      }
      if (session.waiting) {
        if (performance.now() - waitingSince > 2200) waitingLong = true;
      } else {
        waitingSince = performance.now();
        waitingLong = false;
      }
      if (session.finished) finish();
    }
    // keys lit by the music itself
    pressed.clear();
    const auto = prepared.auto;
    for (let i = lowerBound(auto, session.clock - 6); i < auto.length && auto[i].start <= session.clock; i++) {
      const n = auto[i];
      if (n.start + n.dur > session.clock) pressed.set(n.midi, watch ? n.hand : n.hand === 'R' ? 'autoR' : 'autoL');
    }
    for (const [m, k] of userPressed) pressed.set(m, k);
    renderer.draw(frameRef());
    if (!scrubbing) {
      const p = session.progress();
      if (Math.abs(p - progress) > 0.001) progress = p;
    }
    if (listener) micLevel = listener.level();
  }

  // ---------- lifecycle ----------
  async function lockScreen() {
    try {
      wakeLock = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLock = null;
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') pause();
    else lockScreen();
  }

  onMount(() => {
    renderer = createRenderer(canvas);
    layout();
    const ro = new ResizeObserver(() => layout());
    ro.observe(container);
    document.addEventListener('visibilitychange', onVisibility);
    lockScreen();
    if (!needsTapToListen) start();
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      piano.cancelScheduled();
      releaseAll();
      listener?.stop();
      wakeLock?.release().catch(() => {});
      clearTimeout(bannerTimer);
    };
  });

  const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const modeLabel = { learn: 'Learn', play: 'Play', watch: 'Watch' }[mode];
</script>

<div class="player" bind:this={container}>
  <div class="probe" bind:this={probe}></div>
  <canvas
    bind:this={canvas}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onlostpointercapture={onUp}
    oncontextmenu={(e) => e.preventDefault()}
  ></canvas>

  <header class="hud">
    <button class="icon-btn" aria-label="Back to song list" onclick={onexit}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
    <div class="track">
      <div class="title-row">
        <span class="title">{song.title}</span>
        <span class="meta">{modeLabel}{input === 'listen' ? ' with your piano' : ''}</span>
        <span class="time">{fmt(progress * session.duration)} / {fmt(session.duration)}</span>
      </div>
      <div
        class="bar"
        role="slider"
        tabindex="0"
        aria-label="Song position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onpointerdown={(e) => {
          scrubbing = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          scrub(e);
        }}
        onpointermove={(e) => scrubbing && scrub(e)}
        onpointerup={() => (scrubbing = false)}
        onpointercancel={() => (scrubbing = false)}
      >
        <div class="bar-track">
          {#if loopA !== null}
            <div
              class="loop-span"
              style:left="{(loopA / session.duration) * 100}%"
              style:width="{(((loopB ?? Math.max(loopA, progress * session.duration)) - loopA) / session.duration) * 100}%"
            ></div>
          {/if}
          <div class="bar-fill" style:width="{progress * 100}%"></div>
        </div>
      </div>
    </div>
    {#if input === 'listen'}
      <div class="mic" title="Microphone level" style:--lvl={micLevel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </div>
    {/if}
    <button class="icon-btn" class:on={loopA !== null} aria-label="Loop a section" onclick={toggleLoop}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>
    </button>
    <button class="speed" aria-label="Speed" onclick={pause}>{Math.round(speed * 100)}%</button>
    <button class="icon-btn" aria-label="Pause" onclick={pause}>
      <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
    </button>
  </header>

  {#if banner}
    <div class="banner" role="status">{banner}</div>
  {:else if waitingLong && mode === 'learn' && !paused}
    <div class="banner hint" role="status">Play the glowing {session.pendingMidis().size > 1 ? 'keys' : 'key'} to continue</div>
  {/if}

  {#if needsTapToListen}
    <div class="overlay">
      <div class="card">
        <h2>Listen to your piano</h2>
        <p>Stand your phone on the music rest, then tap Start. Keyfall will ask to use the microphone.</p>
        <button class="btn-primary" onclick={beginListening}>Start listening</button>
        <button class="btn-quiet" onclick={() => { needsTapToListen = false; input = 'touch'; start(); }}>Use screen keys instead</button>
      </div>
    </div>
  {/if}

  {#if paused}
    <div class="overlay">
      <div class="card">
        <h2>Paused</h2>
        <button class="btn-primary" onclick={resume}>Resume</button>
        <div class="row">
          <span class="label">Speed</span>
          <button class="step" aria-label="Slower" onclick={() => setSpeed(speed - 0.1)}>−</button>
          <span class="value">{Math.round(speed * 100)}%</span>
          <button class="step" aria-label="Faster" onclick={() => setSpeed(speed + 0.1)}>+</button>
        </div>
        <div class="row two">
          <button class="btn-quiet" onclick={restart}>Restart</button>
          <button class="btn-quiet" onclick={onexit}>Back to songs</button>
        </div>
      </div>
    </div>
  {/if}

  {#if portrait && !rotateDismissed && !paused && !needsTapToListen}
    <button class="rotate" onclick={() => (rotateDismissed = true)}>
      Turn your phone sideways for bigger keys
      <span>Dismiss</span>
    </button>
  {/if}
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--midnight);
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
    display: block;
    touch-action: none;
  }
  .hud {
    position: absolute;
    top: calc(var(--sat) + 6px);
    left: calc(var(--sal) + 8px);
    right: calc(var(--sar) + 8px);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 14px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .title {
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    color: var(--ivory-dim);
    font-weight: 600;
  }
  .time {
    margin-left: auto;
    color: var(--ivory-dim);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .bar {
    height: 28px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
  }
  .bar-track {
    position: relative;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(245, 239, 227, 0.14);
  }
  .bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 3px;
    background: var(--brass);
  }
  .loop-span {
    position: absolute;
    top: -4px;
    bottom: -4px;
    border-radius: 4px;
    background: rgba(56, 189, 248, 0.35);
    outline: 1px solid rgba(56, 189, 248, 0.8);
  }
  .icon-btn.on {
    background: rgba(56, 189, 248, 0.3);
    color: #bae6fd;
  }
  .speed {
    min-width: 58px;
    height: 48px;
    border-radius: 14px;
    background: rgba(35, 44, 94, 0.85);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }
  .mic {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--ivory);
    box-shadow: 0 0 0 calc(2px + var(--lvl) * 10px) rgba(231, 182, 90, calc(0.15 + var(--lvl) * 0.5));
    transition: box-shadow 0.08s linear;
  }
  .mic svg {
    width: 22px;
    height: 22px;
  }
  .banner {
    position: absolute;
    left: 50%;
    top: calc(var(--sat) + 72px);
    transform: translateX(-50%);
    max-width: min(560px, 86vw);
    padding: 10px 18px;
    border-radius: 14px;
    background: rgba(24, 32, 74, 0.94);
    font-weight: 650;
    font-size: 15px;
    text-align: center;
    pointer-events: none;
  }
  .banner.hint {
    background: rgba(231, 182, 90, 0.95);
    color: #1d1606;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(8, 11, 28, 0.72);
    padding: 16px;
  }
  .card {
    width: min(380px, 100%);
    display: grid;
    gap: 14px;
    padding: 24px;
    border-radius: 24px;
    background: var(--midnight-2);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  }
  .card h2 {
    font-size: 24px;
    font-weight: 800;
  }
  .card p {
    color: var(--ivory-dim);
    line-height: 1.45;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .row.two > * {
    flex: 1;
  }
  .label {
    flex: 1;
    font-weight: 650;
  }
  .value {
    min-width: 56px;
    text-align: center;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .step {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--midnight-3);
    font-size: 24px;
    font-weight: 700;
  }
  .rotate {
    position: absolute;
    left: 50%;
    top: 42%;
    transform: translateX(-50%);
    display: grid;
    gap: 6px;
    padding: 16px 22px;
    border-radius: 18px;
    background: rgba(24, 32, 74, 0.95);
    font-weight: 700;
    text-align: center;
  }
  .rotate span {
    color: var(--brass);
    font-size: 14px;
  }
</style>
