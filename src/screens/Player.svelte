<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { app, type FinishStats } from '../lib/ui/store.svelte';
  import { prepare, isWhite, type Prepared } from '../lib/game/prepare';
  import { Session, type Judgment } from '../lib/game/session';
  import { AutoScheduler } from '../lib/game/autoscheduler';
  import { layoutKeys, hitTest, unproject, type Key } from '../lib/game/keyboard';
  import { KeyInput, type KeyChange } from '../lib/game/keyinput';
  import { createRenderer, PERSPECTIVE, type PressKind, type Renderer } from '../lib/game/renderer';
  import { piano } from '../lib/audio/piano';
  import { startListening, MicError, MIC_LAG, type Listener } from '../lib/audio/listen';
  import { preferFlats } from '../lib/music/spelling';
  import { haptic } from '../lib/ui/haptics';
  import { fitView, panView, zoomView, viewKeys, whiteIndexOf, WHITE_TOTAL, type View } from '../lib/game/view';
  import { noteLabel } from '../lib/game/renderer';
  import type { Note, Song } from '../lib/music/types';
  import type { SongConfig } from '../lib/storage/prefs';
  import type { CatalogEntry } from '../lib/songs/catalog';

  let {
    entry,
    song,
    config,
    onexit,
    onfinish,
  }: { entry: CatalogEntry; song: Song; config: SongConfig; onexit: () => void; onfinish: (s: FinishStats) => void } = $props();

  // ---------- fixed setup for this run ----------
  // svelte-ignore state_referenced_locally
  const mode = config.mode;
  const watch = mode === 'watch';
  const byStart = (a: Note, b: Note) => a.start - b.start || a.midi - b.midi;
  // svelte-ignore state_referenced_locally
  const allNotes = [...song.notes].sort(byStart);
  // svelte-ignore state_referenced_locally
  const base = prepare(song, watch ? { R: 'full', L: 'full' } : config.levels);
  const prepared: Prepared = watch ? { ...base, required: [], auto: allNotes, steps: [] } : base;
  const previewPrepared: Prepared = { ...base, required: [], auto: allNotes, steps: [] };
  // svelte-ignore state_referenced_locally
  const flats = preferFlats(song.notes);
  const LEAD_IN = 2.5;

  // svelte-ignore state_referenced_locally
  let session = $state.raw(new Session(prepared, mode, config.speed, { leadIn: LEAD_IN }));
  // svelte-ignore state_referenced_locally
  const previewEnd = session.firstStart + Math.min(9, Math.max(4, session.duration * 0.3));
  // svelte-ignore state_referenced_locally
  let preview = $state.raw<Session | null>(mode === 'learn' ? new Session(previewPrepared, 'watch', config.speed, { leadIn: LEAD_IN }) : null);
  // svelte-ignore state_referenced_locally
  let input = $state<'touch' | 'listen'>(watch ? 'touch' : config.input);
  // svelte-ignore state_referenced_locally
  let speed = $state(config.speed);
  let paused = $state(false);
  let started = $state(false);
  // svelte-ignore state_referenced_locally
  // Learn plays its preview first (mic off, full sound); the mic turns on when it's your turn
  let needsTapToListen = $state(input === 'listen' && mode !== 'learn');
  let waitingMic = $state(false);
  let progress = $state(0);
  let loopA = $state<number | null>(null);
  let loopB = $state<number | null>(null);
  let portrait = $state(false);
  let rotateDismissed = $state(false);
  let micLevel = $state(0);
  let coach = $state<{ text: string; id: number; sticky: boolean } | null>(null);
  let showMap = $state(true);
  // which part of the piano is on screen (pan / zoom)
  // svelte-ignore state_referenced_locally
  let view: View = fitView(prepared.lo, prepared.hi);
  let viewUi = $state<View>({ ...view });
  let heard = $state('');
  let heardTimer = 0;
  let offLeft = $state(false);
  let offRight = $state(false);
  const stagePointers = new Map<number, { x: number; y: number }>();
  let lastStageTap = 0;
  let runTimer = 0;
  let scrubbing = $state(false);

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let probe: HTMLDivElement;
  let flare: HTMLDivElement;
  let renderer: Renderer;
  let keys: Key[] = [];
  let kb = { x: 0, y: 0, w: 0, h: 0 };
  let stageTop = 0;
  const keyInput = new KeyInput();
  const userPressed = new Map<number, PressKind>();
  const recentAuto = new Map<number, number>();
  let scheduler = new AutoScheduler(previewPrepared.auto);
  let listener: Listener | null = null;
  let raf = 0;
  let lastT = 0;
  let lastMiss = 0;
  let waitingSince = 0;
  let wrongRun = 0;
  let heat = 0;
  let done = false;
  let destroyed = false;
  let wakeLock: { release(): Promise<void> } | null = null;
  let coachTimer = 0;
  let coachId = 0;
  let mapTimer = 0;
  let saidWaitHint = false;

  function say(text: string, ms = 3400, sticky = false) {
    clearTimeout(coachTimer);
    coach = { text, id: ++coachId, sticky };
    if (!sticky) coachTimer = window.setTimeout(() => (coach = null), ms);
  }
  function flashMap(ms = 3800) {
    showMap = true;
    clearTimeout(mapTimer);
    mapTimer = window.setTimeout(() => (showMap = false), ms);
  }
  const active = () => preview ?? session;

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
    const kbH = portrait ? Math.min(220, Math.max(150, H * 0.21)) : Math.min(190, Math.max(116, H * 0.36));
    kb = { x: sal + 4, y: H - Math.max(sab, 4) - kbH, w: W - sal - sar - 8, h: kbH };
    stageTop = sat + 62;
    keys = viewKeys(view, kb.w);
    renderer.resize(W, H, Math.min(window.devicePixelRatio || 1, 3));
  }

  // ---------- audio ----------
  function scheduleAuto() {
    const s = active();
    const now = piano.now();
    // quieter accompaniment only while the mic is listening, so it doesn't drown your piano
    const volume = listener ? 0.55 : 1;
    for (const n of scheduler.due(s.autoHorizon(0.14), s.clock, s.epoch)) {
      const delay = Math.max(0, (n.start - s.clock) / s.speed);
      piano.schedule(n.midi, (watch || preview ? n.vel : n.vel * 0.8) * volume, now + delay, n.dur / s.speed);
      recentAuto.set(n.midi, performance.now() + delay * 1000);
    }
  }
  function rescheduleNow() {
    piano.cancelScheduled();
    scheduler = new AutoScheduler(preview ? previewPrepared.auto : prepared.auto);
  }

  // ---------- view: pan & zoom ----------
  function setView(v: View, flash = true) {
    view = v;
    viewUi = { ...v };
    keys = viewKeys(view, kb.w);
    if (flash) flashMap(2400);
  }
  const zoomBy = (f: number) => setView(zoomView(view, f, 0.5));
  const panBy = (whites: number) => setView(panView(view, whites));
  const fitSong = () => setView(fitView(prepared.lo, prepared.hi));

  function stageDown(e: PointerEvent): boolean {
    const r = canvas.getBoundingClientRect();
    const y = e.clientY - r.top;
    if (y < stageTop || y > kb.y) return false;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    stagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (stagePointers.size === 1) {
      const now = performance.now();
      if (now - lastStageTap < 320) {
        fitSong(); // double-tap: back to the whole song
        lastStageTap = 0;
      } else lastStageTap = now;
    }
    return true;
  }
  function stageMove(e: PointerEvent): boolean {
    const p = stagePointers.get(e.pointerId);
    if (!p) return false;
    const ww = kb.w / view.count;
    if (stagePointers.size === 1) {
      const dx = e.clientX - p.x;
      if (dx) setView(panView(view, -dx / ww)); // drag the piano with your finger
      if (Math.abs(dx) > 3) lastStageTap = 0;
    } else {
      const other = [...stagePointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(p.x - other.x, p.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (before > 12 && after > 12) {
          const r = canvas.getBoundingClientRect();
          const anchor = Math.min(1, Math.max(0, ((e.clientX + other.x) / 2 - r.left - kb.x) / kb.w));
          setView(zoomView(view, after / before, anchor));
        }
      }
      lastStageTap = 0;
    }
    stagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    return true;
  }
  const stageUp = (e: PointerEvent) => stagePointers.delete(e.pointerId);

  function mapDrag(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    if (e.type === 'pointerdown') el.setPointerCapture(e.pointerId);
    else if (!el.hasPointerCapture(e.pointerId)) return;
    const r = el.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    setView(panView({ first: frac * WHITE_TOTAL - view.count / 2, count: view.count }, 0));
  }

  // ---------- input ----------
  function lowerBound(arr: Note[], t: number) {
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].start < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function handOf(midi: number): 'R' | 'L' {
    const req = prepared.required;
    let best: Note | null = null;
    for (let i = lowerBound(req, session.clock - 1); i < req.length && req[i].start < session.clock + 1; i++) {
      if (req[i].midi === midi && (!best || Math.abs(req[i].start - session.clock) < Math.abs(best.start - session.clock))) best = req[i];
    }
    return best ? best.hand : midi >= 60 ? 'R' : 'L';
  }

  function react(midi: number, j: Judgment | null, touch: boolean): PressKind {
    if (j === null) {
      if (touch) haptic();
      return 'free';
    }
    if (j === 'wrong') {
      wrongRun++;
      if (touch) haptic();
      if (mode === 'learn' && wrongRun === 3) say('Look for the glowing key. No rush.');
      if (mode === 'play') renderer.pop('✕', frameRef(), '#ff8d9a', midi);
      return 'wrong';
    }
    wrongRun = 0;
    if (touch) haptic();
    const hand = handOf(midi);
    renderer.burst(midi, frameRef(), hand);
    heat = Math.min(1, heat + 0.35);
    if (mode === 'play') renderer.pop(j === 'perfect' ? 'Perfect' : 'Good', frameRef(), j === 'perfect' ? '#ffc46b' : '#f6efe9', midi);
    const c = session.stats.combo;
    if (c === 10 || c === 25 || c === 50 || c === 100 || (c > 100 && c % 100 === 0)) {
      say(c >= 50 ? `${c} in a row. You’re on fire!` : `${c} in a row!`, 2200);
      heat = 1;
    }
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
      const j = started && !paused && !preview ? session.press(midi) : null;
      userPressed.set(midi, react(midi, j, true));
      if (j && j !== 'wrong') waitingSince = performance.now();
    }
  }

  function midiAt(e: PointerEvent): number | null {
    const r = canvas.getBoundingClientRect();
    const y = e.clientY - r.top - kb.y;
    if (y < -26 || y > kb.h + 10) return null;
    const frac = Math.max(0, y) / kb.h;
    const x = unproject(e.clientX - r.left - kb.x, frac, kb.w, PERSPECTIVE);
    return hitTest(keys, x, Math.max(0, y), kb.h);
  }
  function onDown(e: PointerEvent) {
    const midi = midiAt(e);
    if (midi === null) {
      stageDown(e);
      return;
    }
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    apply(keyInput.down(e.pointerId, midi));
  }
  function onMove(e: PointerEvent) {
    if (stageMove(e)) return;
    apply(keyInput.move(e.pointerId, midiAt(e)));
  }
  function onUp(e: PointerEvent) {
    if (stageUp(e)) return;
    apply(keyInput.up(e.pointerId));
  }
  function releaseAll() {
    for (const m of keyInput.cancelAll()) {
      piano.noteOff(m);
      userPressed.delete(m);
    }
  }

  function upcomingRequired(): Set<number> {
    if (mode === 'learn') return session.pendingMidis();
    const out = new Set<number>();
    const req = prepared.required;
    for (let i = lowerBound(req, session.clock - 0.25 * speed); i < req.length && req[i].start < session.clock + 0.35 * speed; i++) out.add(req[i].midi);
    return out;
  }

  function showHeard(midis: number[]) {
    heard = midis.map((m) => noteLabel(m, 'letters', flats) + (Math.floor(m / 12) - 1)).join('  ');
    clearTimeout(heardTimer);
    heardTimer = window.setTimeout(() => (heard = ''), 1400);
  }

  function onMicNotes(midis: number[]) {
    if (!started || paused || preview || waitingMic) return;
    showHeard(midis);
    const now = performance.now();
    const lag = (MIC_LAG + (piano.ctx?.baseLatency ?? 0)) * session.speed;
    const wanted = upcomingRequired();
    for (const midi of midis) {
      const t = recentAuto.get(midi);
      if (t !== undefined && Math.abs(now - t) < 320) continue; // the app's own accompaniment
      if (!wanted.has(midi)) continue; // the mic can mishear: only the notes you need ever count
      const j = session.press(midi, session.clock - lag);
      const kind = react(midi, j, false);
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
  async function resume() {
    await piano.ensureStarted();
    paused = false;
    lastT = performance.now();
    rescheduleNow();
  }
  function restart() {
    session = new Session(prepared, mode, speed, { leadIn: LEAD_IN });
    session.setLoop(loopA, loopB);
    preview = null;
    lastMiss = 0;
    wrongRun = 0;
    renderer.clearEffects();
    resume();
    flashMap();
  }
  function setSpeed(s: number) {
    speed = Math.round(Math.min(1.2, Math.max(0.4, s)) * 20) / 20;
    session.speed = speed;
    if (preview) preview.speed = speed;
    rescheduleNow();
  }
  function seekTo(t: number) {
    session.seek(t < 0.5 ? -1.5 * speed : t);
    renderer.clearEffects();
    lastMiss = session.stats.miss;
    progress = session.progress();
  }
  function skipPreview() {
    if (!preview) return;
    preview = null;
    rescheduleNow();
    renderer.clearEffects();
    session.seek(Math.min(0, session.firstStart - 1.6 * speed));
    lastMiss = 0;
    waitingSince = performance.now();
    if (input === 'listen' && !listener) {
      // your turn: now switch the microphone on
      waitingMic = true;
      needsTapToListen = true;
      return;
    }
    say('Off you go, from the top.', 2600);
    flashMap(3000);
    if (prepared.auto.length && prepared.required.length) {
      setTimeout(() => {
        if (!destroyed) say('Only the colored notes are yours. I play the empty ones.', 4200);
      }, 2800);
    }
  }
  function toggleLoop() {
    const t = Math.max(0, session.clock);
    if (loopA === null) {
      loopA = t;
      say('Loop start set. Tap again at the end of the section.');
    } else if (loopB === null) {
      if (t <= loopA + 0.5) return say('Play a little further, then tap to set the loop end.');
      loopB = t;
      session.setLoop(loopA, loopB);
      seekTo(loopA);
      say('Looping this section.', 2200);
    } else {
      loopA = loopB = null;
      session.setLoop(null, null);
      say('Loop off.', 1600);
    }
  }
  function scrub(e: PointerEvent) {
    const bar = e.currentTarget as HTMLElement;
    const r = bar.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (preview) skipPreview();
    seekTo(f * session.duration);
  }

  async function beginListening() {
    needsTapToListen = false;
    await piano.ensureStarted();
    try {
      const l = await startListening(onMicNotes, app.settings.sensitivity, upcomingRequired, () => {
        if (!destroyed) say('The microphone stopped. Pause, then resume, to keep listening.', 0, true);
      });
      if (destroyed) return l.stop();
      listener = l;
    } catch (e) {
      input = 'touch';
      say(e instanceof MicError ? e.message + ' Using the screen keys for now.' : 'The microphone couldn’t start. Using the screen keys for now.', 0, true);
    }
    if (!started) start();
    else {
      waitingMic = false;
      lastT = performance.now();
      waitingSince = performance.now();
      rescheduleNow();
      if (!coach?.sticky) say(listener ? 'I’m listening. Play the glowing keys on your piano.' : 'Off you go, from the top.', 3000);
    }
  }

  function start() {
    started = true;
    lastT = performance.now();
    waitingSince = performance.now();
    rescheduleNow();
    flashMap();
    if (coach?.sticky) return;
    if (preview) say('Take a listen, then you try.');
    else if (mode === 'play') say('Let’s play through it once. Mistakes are totally fine.');
    else if (watch) say('Sit back and listen.');
    else say(input === 'listen' ? 'I’m listening. Play the glowing keys on your piano.' : 'Play the glowing keys. I’ll wait for you.');
  }

  function finish() {
    if (done) return;
    done = true;
    piano.cancelScheduled();
    const s = session.stats;
    say(watch ? 'That’s the whole song.' : 'Beautiful. Let’s see how it went.', 2000);
    setTimeout(() => {
      if (destroyed) return;
      onfinish({ stars: s.stars(), accuracy: s.accuracy(), perfect: s.perfect, good: s.good, miss: s.miss, wrong: s.wrong, bestCombo: s.bestCombo, timeline: session.timeline(48) });
    }, 1100);
  }

  // ---------- render loop ----------
  const pressed = new Map<number, PressKind>();
  const noPending = new Set<number>();
  function frameRef() {
    const s = active();
    return {
      clock: s.clock,
      window: app.settings.fallSeconds * s.speed,
      keys,
      kb,
      stageTop,
      required: preview ? [] : prepared.required,
      auto: preview ? previewPrepared.auto : prepared.auto,
      dimAuto: !watch,
      preview: !!preview,
      judgment: (n: Note) => session.judgmentOf(n),
      pressed,
      pending: preview ? noPending : session.pendingMidis(),
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
    if (started && !paused && !done && !waitingMic) {
      if (preview) {
        preview.update(dt);
        scheduleAuto();
        if (preview.clock >= previewEnd) skipPreview();
      } else {
        session.update(dt);
        scheduleAuto();
        if (session.stats.miss > lastMiss) {
          lastMiss = session.stats.miss;
          renderer.pop('Miss', frameRef(), '#8f8496');
        }
        if (session.waiting) {
          if (!saidWaitHint && performance.now() - waitingSince > 6000) {
            saidWaitHint = true;
            say('Take your time. Play the glowing key.');
          }
        } else waitingSince = performance.now();
        if (session.finished) finish();
      }
    }
    pressed.clear();
    const s = active();
    const auto = preview ? previewPrepared.auto : prepared.auto;
    for (let i = lowerBound(auto, s.clock - 6); i < auto.length && auto[i].start <= s.clock; i++) {
      const n = auto[i];
      if (n.start + n.dur > s.clock) pressed.set(n.midi, watch ? n.hand : n.hand === 'R' ? 'autoR' : 'autoL');
    }
    for (const [m, k] of userPressed) pressed.set(m, k);
    if (!preview && keys.length) {
      let visLo = 200, visHi = 0;
      for (const k of keys) {
        if (k.x >= -1 && k.x + k.w <= kb.w + 1) {
          visLo = Math.min(visLo, k.midi);
          visHi = Math.max(visHi, k.midi);
        }
      }
      let l = false, r = false;
      const req = prepared.required;
      const ahead = app.settings.fallSeconds * session.speed;
      for (let i = lowerBound(req, session.clock - 0.2); i < req.length && req[i].start < session.clock + ahead; i++) {
        if (req[i].midi < visLo) l = true;
        else if (req[i].midi > visHi) r = true;
      }
      if (l !== offLeft) offLeft = l;
      if (r !== offRight) offRight = r;
    }
    renderer.draw(frameRef());
    heat = Math.max(0, heat - dt * 1.6);
    if (flare) flare.style.opacity = String(0.15 + heat * 0.85);
    if (!scrubbing) {
      const p = preview ? 0 : session.progress();
      if (Math.abs(p - progress) > 0.001) progress = p;
    }
    if (listener) micLevel = listener.level();
  }

  // ---------- lifecycle ----------
  async function lockScreen() {
    try {
      const l = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
      if (destroyed) l?.release().catch(() => {});
      else wakeLock = l;
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
    // calls, Siri or alarms stop the audio clock: pause instead of drifting out of sync
    const offRunning = piano.onRunningChange((running) => {
      clearTimeout(runTimer);
      // brief audio hiccups (route changes) are ignored; a real interruption pauses the song
      if (!running && started)
        runTimer = window.setTimeout(() => {
          if (!piano.running) pause();
        }, 600);
    });
    lockScreen();
    if (!needsTapToListen) start();
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      offRunning();
      document.removeEventListener('visibilitychange', onVisibility);
      piano.cancelScheduled();
      releaseAll();
      listener?.stop();
      wakeLock?.release().catch(() => {});
      clearTimeout(coachTimer);
      clearTimeout(mapTimer);
      clearTimeout(heardTimer);
      clearTimeout(runTimer);
    };
  });

  // mini 88-key map
  const MAP_WHITES: number[] = [];
  for (let m = 21; m <= 108; m++) if (isWhite(m)) MAP_WHITES.push(m);
  const whiteIndex = (m: number) => MAP_WHITES.indexOf(isWhite(m) ? m : m - 1);
  const ticks = 60;
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

  <div class="edge" aria-hidden="true"></div>
  <div class="edge flare" bind:this={flare} aria-hidden="true"></div>

  <header class="hud">
    <button class="orb" aria-label="Pause" onclick={pause}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></svg>
    </button>
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
      <div class="ticks">
        {#each Array(ticks) as _, i}<i class:big={i % 10 === 0}></i>{/each}
      </div>
      {#if loopA !== null}
        <div class="loopspan" style:left="{(loopA / session.duration) * 100}%" style:width="{(((loopB ?? Math.max(loopA, progress * session.duration)) - loopA) / session.duration) * 100}%"></div>
      {/if}
      <div class="thumb" style:left="calc({progress * 100}% - {progress * 34}px)"></div>
    </div>
    <div class="zoom">
      <button class="orb small" aria-label="Show more keys" onclick={() => zoomBy(1 / 1.3)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12" /></svg>
      </button>
      <button class="orb small" aria-label="Show bigger keys" onclick={() => zoomBy(1.3)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12M12 6v12" /></svg>
      </button>
    </div>
    {#if input === 'listen'}
      {#if heard}<span class="heard" title="What the microphone hears">{heard}</span>{/if}
      <div class="mic" title="Microphone level" style:--lvl={micLevel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </div>
    {/if}
    {#if preview}
      <button class="orb" aria-label="Skip the preview" onclick={skipPreview}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 6l8 6-8 6zM12 6l8 6-8 6z" /></svg>
      </button>
    {:else if !watch}
      <button class="orb" class:on={loopA !== null} aria-label="Loop a section" onclick={toggleLoop}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>
      </button>
    {/if}
  </header>

  {#if coach}
    {#key coach.id}
      <div class="coach" class:sticky={coach.sticky} role="status" in:fly={{ x: 30, duration: 380 }} out:fade={{ duration: 200 }}>
        {coach.text}
        {#if coach.sticky}<button onclick={() => (coach = null)}>OK</button>{/if}
      </div>
    {/key}
  {/if}

  {#if started && !preview}
    <button class="side left" class:hot={offLeft} aria-label="Move the keyboard left" onclick={() => panBy(-7)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <button class="side right" class:hot={offRight} aria-label="Move the keyboard right" onclick={() => panBy(7)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
    </button>
  {/if}

  {#if showMap && started}
    <div
      class="map"
      transition:fade={{ duration: 300 }}
      role="slider"
      tabindex="-1"
      aria-label="Which part of the piano is on screen"
      aria-valuemin={0}
      aria-valuemax={WHITE_TOTAL}
      aria-valuenow={Math.round(viewUi.first)}
      onpointerdown={(e) => {
        flashMap(4000);
        mapDrag(e);
      }}
      onpointermove={mapDrag}
    >
      <svg viewBox="0 0 {MAP_WHITES.length * 10} 60">
        {#each MAP_WHITES as m, i}
          <rect x={i * 10 + 0.5} y="0" width="9" height="60" rx="1.5" class="w" class:in={i >= viewUi.first - 0.5 && i < viewUi.first + viewUi.count} class:song={m >= prepared.lo && m <= prepared.hi} />
        {/each}
        {#each MAP_WHITES as m, i}
          {#if [0, 2, 5, 7, 9].includes(m % 12) && m + 1 <= 108}
            <rect x={i * 10 + 6.5} y="0" width="6" height="36" rx="1" class="b" />
          {/if}
        {/each}
        <rect class="frame" x={viewUi.first * 10} y="0.75" width={viewUi.count * 10} height="58.5" rx="3" />
        {#each MAP_WHITES as m, i}
          {#if m % 12 === 0}<text x={i * 10 + 5} y="54">C{Math.floor(m / 12) - 1}</text>{/if}
        {/each}
      </svg>
    </div>
  {/if}

  {#if preview && started}
    <div class="previewpill" transition:fade>Preview only</div>
  {/if}

  {#if needsTapToListen}
    <div class="overlay" transition:fade>
      <div class="card glass">
        <h2 class="serif">{waitingMic ? 'Your turn' : 'Listen to your piano'}</h2>
        <p>Stand your phone on the music rest, then tap Start listening. Keyfall uses the microphone to hear which keys you play.</p>
        <button class="btn-ember" onclick={beginListening}>Start listening</button>
        <button
          class="btn-glass"
          onclick={() => {
            needsTapToListen = false;
            input = 'touch';
            if (!started) start();
            else {
              waitingMic = false;
              lastT = performance.now();
              rescheduleNow();
              say('Off you go, from the top.', 2600);
            }
          }}>Use the screen keys instead</button
        >
      </div>
    </div>
  {/if}

  {#if paused}
    <div class="overlay" transition:fade={{ duration: 180 }}>
      <div class="card glass" in:fly={{ y: 20, duration: 320 }}>
        <h2 class="serif">Paused</h2>
        <p class="songname">{entry.title}</p>
        <button class="btn-ember" onclick={resume}>Resume</button>
        <div class="row">
          <span class="label">Speed</span>
          <button class="step" aria-label="Slower" onclick={() => setSpeed(speed - 0.05)}>−</button>
          <span class="value">{Math.round(speed * 100)}%</span>
          <button class="step" aria-label="Faster" onclick={() => setSpeed(speed + 0.05)}>+</button>
        </div>
        <div class="row two">
          <button class="btn-glass" onclick={restart}>Restart</button>
          <button class="btn-glass" onclick={onexit}>Leave</button>
        </div>
      </div>
    </div>
  {/if}

  {#if portrait && !rotateDismissed && !paused && !needsTapToListen}
    <button class="rotate glass" onclick={() => (rotateDismissed = true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2" width="10" height="20" rx="2.5" /></svg>
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
    background: #000;
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
  /* glowing ember frame; the flare layer brightens on hits (opacity only, so it stays cheap) */
  .edge {
    position: absolute;
    inset: 0;
    border-radius: 54px;
    pointer-events: none;
    box-shadow:
      inset 0 0 0 1.5px rgba(255, 130, 60, 0.55),
      inset 0 0 22px 2px rgba(255, 100, 30, 0.35);
  }
  .edge.flare {
    opacity: 0.15;
    box-shadow:
      inset 0 0 0 2px rgba(255, 170, 90, 0.95),
      inset 0 0 40px 8px rgba(255, 110, 30, 0.75),
      inset 0 0 120px 20px rgba(255, 70, 20, 0.25);
    will-change: opacity;
  }
  .hud {
    position: absolute;
    top: calc(var(--sat) + 8px);
    left: calc(var(--sal) + 14px);
    right: calc(var(--sar) + 14px);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .orb {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(18, 14, 16, 0.85);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
    color: var(--ivory);
    transition: transform 0.18s var(--spring);
  }
  .orb:active {
    transform: scale(0.9);
  }
  .orb svg {
    width: 24px;
    height: 24px;
  }
  .orb.on {
    color: var(--flame);
    box-shadow: inset 0 0 0 1.5px var(--flame), 0 0 16px rgba(255, 106, 31, 0.4);
  }
  .bar {
    position: relative;
    flex: 1;
    height: 40px;
    border-radius: 999px;
    background: rgba(18, 14, 16, 0.8);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    touch-action: none;
    cursor: pointer;
  }
  .ticks {
    position: absolute;
    inset: 0 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ticks i {
    width: 1.5px;
    height: 12px;
    border-radius: 1px;
    background: rgba(255, 255, 255, 0.45);
  }
  .ticks i.big {
    height: 18px;
    background: rgba(255, 255, 255, 0.75);
  }
  .thumb {
    position: absolute;
    top: 9px;
    width: 34px;
    height: 22px;
    border-radius: 999px;
    background: linear-gradient(180deg, #ff9a52, #ec4f16);
    box-shadow: 0 0 14px rgba(255, 106, 31, 0.8), inset 0 1px 0 rgba(255, 230, 200, 0.6);
  }
  .loopspan {
    position: absolute;
    top: 5px;
    bottom: 5px;
    border-radius: 999px;
    background: rgba(110, 168, 255, 0.28);
    box-shadow: inset 0 0 0 1px rgba(110, 168, 255, 0.8);
  }
  .zoom {
    display: flex;
    gap: 6px;
  }
  .orb.small {
    width: 40px;
    height: 40px;
  }
  .orb.small svg {
    width: 20px;
    height: 20px;
  }
  .heard {
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(255, 122, 47, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 140, 70, 0.5);
    color: #ffd2b0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .side {
    position: absolute;
    top: 52%;
    width: 44px;
    height: 64px;
    margin-top: -32px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    background: rgba(18, 14, 16, 0.55);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    color: rgba(246, 239, 233, 0.75);
    transition: background 0.3s, color 0.3s, box-shadow 0.3s;
  }
  .side svg {
    width: 24px;
    height: 24px;
  }
  .side.left {
    left: calc(var(--sal) + 10px);
  }
  .side.right {
    right: calc(var(--sar) + 10px);
  }
  .side.hot {
    color: #fff;
    background: rgba(255, 106, 31, 0.55);
    box-shadow: inset 0 0 0 1.5px #ff9a52, 0 0 22px rgba(255, 106, 31, 0.7);
    animation: nudge 1s ease-in-out infinite;
  }
  @keyframes nudge {
    50% {
      transform: scale(1.08);
    }
  }
  .mic {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--ivory);
    box-shadow: 0 0 0 calc(2px + var(--lvl) * 10px) rgba(255, 122, 47, calc(0.15 + var(--lvl) * 0.5));
    transition: box-shadow 0.08s linear;
  }
  .mic svg {
    width: 22px;
    height: 22px;
  }
  .coach {
    position: absolute;
    top: calc(var(--sat) + 66px);
    right: calc(var(--sar) + 16px);
    max-width: min(330px, 70vw);
    padding: 16px 20px;
    border-radius: 24px;
    background: rgba(28, 26, 30, 0.92);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 14px 40px rgba(0, 0, 0, 0.5);
    font-size: 18px;
    line-height: 1.35;
    pointer-events: none;
  }
  .coach.sticky {
    pointer-events: auto;
    display: grid;
    gap: 10px;
  }
  .coach button {
    justify-self: end;
    min-height: 40px;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--ember);
    font-weight: 600;
  }
  .map {
    position: absolute;
    left: calc(var(--sal) + 50px);
    top: 46%;
    transform: translateY(-50%);
    width: min(400px, 42vw);
    padding: 7px;
    border-radius: 12px;
    background: rgba(40, 38, 44, 0.92);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    touch-action: none;
    cursor: grab;
  }
  .map svg {
    display: block;
    width: 100%;
  }
  .map .w {
    fill: #6d6a72;
  }
  .map .w.in {
    fill: #fbf8fc;
  }
  .map .w.song:not(.in) {
    fill: #a39fa8;
  }
  .map .b {
    fill: #1d1b20;
  }
  .map .frame {
    fill: none;
    stroke: var(--ember);
    stroke-width: 1.6;
  }
  .map text {
    font-size: 6px;
    text-anchor: middle;
    fill: #444;
    font-family: var(--sans);
  }
  .previewpill {
    position: absolute;
    left: 50%;
    bottom: calc(var(--sab) + 22px);
    transform: translateX(-50%);
    padding: 12px 34px;
    border-radius: 999px;
    background: rgba(30, 26, 28, 0.9);
    box-shadow: inset 0 0 0 2px var(--ember), 0 0 24px rgba(255, 106, 31, 0.55);
    font-size: 22px;
    pointer-events: none;
    animation: glowPulse 2s ease-in-out infinite;
  }
  @keyframes glowPulse {
    50% {
      box-shadow: inset 0 0 0 2px #ff9a52, 0 0 36px rgba(255, 106, 31, 0.8);
    }
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(4, 2, 4, 0.66);
    padding: 16px;
  }
  .card {
    width: min(390px, 100%);
    display: grid;
    gap: 14px;
    padding: 26px;
    border-radius: 30px;
    background: rgba(26, 20, 22, 0.94);
  }
  .card h2 {
    font-size: 40px;
  }
  .card p {
    color: var(--muted);
    line-height: 1.45;
  }
  .songname {
    margin-top: -8px;
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
    font-size: 17px;
  }
  .value {
    min-width: 60px;
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .step {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px var(--hair-strong);
    font-size: 24px;
  }
  .rotate {
    position: absolute;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 20px 24px;
    border-radius: 26px;
    font-size: 17px;
    text-align: center;
    background: rgba(26, 20, 22, 0.94);
  }
  .rotate svg {
    width: 36px;
    height: 36px;
    animation: tilt 2.4s ease-in-out infinite;
  }
  @keyframes tilt {
    0%,
    30% {
      transform: rotate(0deg);
    }
    60%,
    100% {
      transform: rotate(90deg);
    }
  }
  .rotate span {
    color: var(--flame);
    font-size: 15px;
  }
</style>
