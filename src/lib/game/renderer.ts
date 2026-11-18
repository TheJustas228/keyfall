import type { Note } from '../music/types';
import { BLACK_HEIGHT, type Key } from './keyboard';
import type { Judgment } from './session';

export type PressKind = 'R' | 'L' | 'wrong' | 'free' | 'autoR' | 'autoL';
export type LabelStyle = 'letters' | 'solfege' | 'off';

export interface Rising {
  midi: number;
  t0: number;
  t1: number | null;
}

export interface Frame {
  clock: number;
  window: number; // song seconds visible above the hit line
  keys: Key[];
  kb: { x: number; y: number; w: number; h: number };
  stageTop: number;
  required: Note[];
  auto: Note[];
  /** draw auto notes as hollow outlines ("I play the empty ones") */
  dimAuto: boolean;
  /** preview: every note is shown faded */
  preview?: boolean;
  judgment: (n: Note) => Judgment | undefined;
  pressed: Map<number, PressKind>;
  pending: Set<number>;
  labels: LabelStyle;
  flats: boolean;
  keyLabels: boolean;
  now: number; // seconds, for animation
  rising?: Rising[];
}

/** Perspective: the top edge of the keyboard is this much narrower than the bottom. */
export const PERSPECTIVE = 0.955;

const HAND = {
  R: { top: '#ffb27a', mid: '#ff7a2f', bot: '#e8501a', glow: '255,122,47', text: '#3b1200', key: ['#ffc59a', '#ff8a45'], keyBlack: ['#ff8a45', '#c2410c'] },
  L: { top: '#a9cbff', mid: '#6ea8ff', bot: '#3f74e0', glow: '110,168,255', text: '#08173d', key: ['#c4dbff', '#7fb2ff'], keyBlack: ['#7fb2ff', '#2f5fc4'] },
};
const LETTERS_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const LETTERS_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SOLFEGE_SHARP = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const SOLFEGE_FLAT = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const FONT = '-apple-system, "SF Pro Text", system-ui, sans-serif';

export function noteLabel(midi: number, style: LabelStyle, flats = false): string {
  if (style === 'off') return '';
  const table = style === 'solfege' ? (flats ? SOLFEGE_FLAT : SOLFEGE_SHARP) : flats ? LETTERS_FLAT : LETTERS_SHARP;
  return table[midi % 12];
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}
interface Pop {
  text: string;
  x: number;
  y: number;
  t0: number;
  color: string;
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  let W = 0;
  let H = 0;
  let sparks: Spark[] = [];
  let pops: Pop[] = [];
  let lastNow = 0;
  const keyIndex = new Map<number, Key>();
  let keysRef: Key[] | null = null;

  function resize(w: number, h: number, dpr: number) {
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function indexKeys(keys: Key[]) {
    if (keysRef === keys) return;
    keysRef = keys;
    keyIndex.clear();
    for (const k of keys) keyIndex.set(k.midi, k);
  }

  /** x of a key edge at vertical fraction `frac` of the keyboard (0 = top/hit line, 1 = bottom) */
  const px = (f: Frame, x: number, frac: number) => {
    const cx = f.kb.w / 2;
    const s = PERSPECTIVE + (1 - PERSPECTIVE) * frac;
    return f.kb.x + cx + (x - cx) * s;
  };
  /** lane (top of key) position for falling notes */
  const laneX = (f: Frame, x: number) => px(f, x, 0);

  function burst(midi: number, f: Frame, hand: 'R' | 'L' | 'brass') {
    const k = keyIndex.get(midi);
    if (!k) return;
    const x = laneX(f, k.x + k.w / 2);
    const color = hand === 'L' ? '#a9cbff' : '#ffb06a';
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
      const sp = 70 + Math.random() * 190;
      sparks.push({ x: x + (Math.random() - 0.5) * k.w * 0.6, y: f.kb.y - 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.45 + Math.random() * 0.5, r: 1 + Math.random() * 1.8, color });
    }
    if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
  }

  function pop(text: string, f: Frame, color: string, midi?: number) {
    const k = midi !== undefined ? keyIndex.get(midi) : undefined;
    const x = k ? laneX(f, k.x + k.w / 2) : f.kb.x + f.kb.w / 2;
    pops.push({ text, x, y: f.kb.y - 46, t0: f.now, color });
    if (pops.length > 6) pops.shift();
  }

  function clearEffects() {
    sparks = [];
    pops = [];
  }

  function rr(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  }

  function drawStage(f: Frame) {
    const { kb } = f;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, kb.y - 160, 0, kb.y);
    g.addColorStop(0, 'rgba(255,90,30,0)');
    g.addColorStop(1, 'rgba(255,90,30,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(0, kb.y - 160, W, 160);
    for (const k of f.keys) {
      if (k.black) continue;
      const pc = k.midi % 12;
      if (pc !== 0 && pc !== 5) continue;
      ctx.fillStyle = pc === 0 ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(Math.round(laneX(f, k.x)), f.stageTop, pc === 0 ? 1.5 : 1, kb.y - f.stageTop);
    }
  }

  function drawTiles(f: Frame, notes: Note[], kind: 'req' | 'auto') {
    const { kb } = f;
    const span = kb.y - f.stageTop;
    const pps = span / f.window;
    const end = f.clock + f.window;
    const hollow = (kind === 'auto' && f.dimAuto) || f.preview;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const n of notes) {
      if (n.start > end) break;
      if (n.start + n.dur < f.clock - 0.05) continue;
      const k = keyIndex.get(n.midi);
      if (!k) continue;
      const bottom = kb.y - (n.start - f.clock) * pps;
      const top = bottom - Math.max(n.dur * pps, 12);
      const inset = k.black ? 0.5 : Math.max(1.5, k.w * 0.09);
      const x0 = laneX(f, k.x + inset);
      const x1 = laneX(f, k.x + k.w - inset);
      const w = x1 - x0;
      const h = bottom - top;
      const c = HAND[n.hand];
      const j = kind === 'req' ? f.judgment(n) : undefined;
      const active = n.start <= f.clock && n.start + n.dur > f.clock;
      const radius = Math.min(8, w * 0.32);

      if (hollow) {
        ctx.globalAlpha = f.preview ? 0.55 : 0.85;
        rr(x0 + 0.75, top + 0.75, w - 1.5, h - 1.5, radius);
        ctx.fillStyle = `rgba(${c.glow},${active ? 0.28 : 0.08})`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${c.glow},${f.preview ? 0.5 : 0.75})`;
        ctx.stroke();
      } else {
        const missed = j === 'miss';
        if (active && (j === 'perfect' || j === 'good')) {
          ctx.globalAlpha = 0.5;
          rr(x0 - 4, top - 4, w + 8, h + 8, radius + 4);
          ctx.fillStyle = `rgba(${c.glow},0.35)`;
          ctx.fill();
        }
        ctx.globalAlpha = missed ? 0.3 : 1;
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0, c.top);
        g.addColorStop(0.35, c.mid);
        g.addColorStop(1, c.bot);
        rr(x0, top, w, h, radius);
        ctx.fillStyle = missed ? '#5a5560' : g;
        ctx.fill();
        ctx.globalAlpha = missed ? 0.1 : 0.32;
        rr(x0 + 2, top + 2, w - 4, Math.min(h * 0.4, 18), Math.max(0, radius - 2));
        ctx.fillStyle = '#fff';
        ctx.fill();
        if (kind === 'req' && f.pending.has(n.midi) && Math.abs(n.start - f.clock) < 0.3) {
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(f.now * 7);
          rr(x0 - 3, top - 3, w + 6, h + 6, radius + 3);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#fff3e6';
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const label = noteLabel(n.midi, f.labels, f.flats);
      if (label && h >= 18 && w >= 13 && bottom <= kb.y + 3) {
        const size = Math.min(17, Math.max(10, w * 0.55));
        ctx.font = `700 ${size}px ${FONT}`;
        ctx.fillStyle = hollow ? `rgba(${c.glow},${f.preview ? 0.7 : 0.95})` : c.text;
        ctx.fillText(label, (x0 + x1) / 2, bottom - Math.max(5, (Math.min(h, 34) - size) / 2));
      }
    }
  }

  function drawRising(f: Frame) {
    if (!f.rising) return;
    const { kb } = f;
    const speed = 150;
    for (const r of f.rising) {
      const k = keyIndex.get(r.midi);
      if (!k) continue;
      const bottom = r.t1 === null ? kb.y : kb.y - (f.now - r.t1) * speed;
      const top = Math.min(kb.y - (f.now - r.t0) * speed, bottom - 14);
      if (bottom < f.stageTop) continue;
      const c = r.midi >= 60 ? HAND.R : HAND.L;
      const inset = k.black ? 0.5 : Math.max(1.5, k.w * 0.09);
      const x0 = laneX(f, k.x + inset);
      const x1 = laneX(f, k.x + k.w - inset);
      const t = Math.max(top, f.stageTop);
      ctx.globalAlpha = Math.max(0.1, Math.min(1, (bottom - f.stageTop) / 140));
      const g = ctx.createLinearGradient(0, t, 0, bottom);
      g.addColorStop(0, c.top);
      g.addColorStop(1, c.bot);
      rr(x0, t, x1 - x0, bottom - t, 7);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function keyPath(f: Frame, x0: number, x1: number, fTop: number, fBot: number) {
    const { kb } = f;
    const yT = kb.y + kb.h * fTop;
    const yB = kb.y + kb.h * fBot;
    ctx.beginPath();
    ctx.moveTo(px(f, x0, fTop), yT);
    ctx.lineTo(px(f, x1, fTop), yT);
    ctx.lineTo(px(f, x1, fBot), yB);
    ctx.lineTo(px(f, x0, fBot), yB);
    ctx.closePath();
  }

  function pressedColors(kind: PressKind | undefined, black: boolean): [string, string] | null {
    if (!kind) return null;
    if (kind === 'wrong') return black ? ['#ff6b7a', '#9f1239'] : ['#ffd0d6', '#ff7d8c'];
    if (kind === 'free') return black ? ['#ffb06a', '#b8430f'] : ['#ffe2c6', '#ffb27a'];
    const h = kind === 'R' || kind === 'autoR' ? HAND.R : HAND.L;
    return black ? (h.keyBlack as [string, string]) : (h.key as [string, string]);
  }

  function drawKeyboard(f: Frame) {
    const { kb } = f;
    const LIP = 0.075;
    ctx.fillStyle = '#060406';
    ctx.fillRect(0, kb.y, W, H - kb.y);

    for (const [midi, kind] of f.pressed) {
      const k = keyIndex.get(midi);
      if (!k || kind === 'wrong') continue;
      const rgb = kind === 'R' || kind === 'autoR' ? HAND.R.glow : kind === 'L' || kind === 'autoL' ? HAND.L.glow : '255,176,106';
      const x0 = laneX(f, k.x);
      const x1 = laneX(f, k.x + k.w);
      const g = ctx.createLinearGradient(0, kb.y - 130, 0, kb.y);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(1, `rgba(${rgb},${kind.startsWith('auto') ? 0.16 : 0.42})`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, kb.y - 130, x1 - x0, 130);
    }

    for (const k of f.keys) {
      if (k.black) continue;
      const kind = f.pressed.get(k.midi);
      const pc = pressedColors(kind, false);
      const down = pc ? 0.012 : 0;
      keyPath(f, k.x + 0.6, k.x + k.w - 0.6, down, 1 - LIP + down);
      const g = ctx.createLinearGradient(0, kb.y, 0, kb.y + kb.h);
      if (pc) {
        g.addColorStop(0, pc[0]);
        g.addColorStop(1, pc[1]);
      } else if (f.pending.has(k.midi)) {
        const p = 0.5 + 0.5 * Math.sin(f.now * 7);
        g.addColorStop(0, '#fff8f0');
        g.addColorStop(1, `rgb(255,${Math.round(214 - 50 * p)},${Math.round(170 - 90 * p)})`);
      } else {
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.65, '#f5f2f6');
        g.addColorStop(1, '#e6e1e8');
      }
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,40,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      keyPath(f, k.x + 0.6, k.x + k.w - 0.6, 1 - LIP + down, 1);
      const lg = ctx.createLinearGradient(0, kb.y + kb.h * (1 - LIP), 0, kb.y + kb.h);
      lg.addColorStop(0, pc ? pc[1] : '#d8d2db');
      lg.addColorStop(1, pc ? pc[1] : '#a9a1ad');
      ctx.fillStyle = lg;
      ctx.fill();
      if (f.keyLabels && k.midi % 12 === 0 && k.w >= 14) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#2b2530';
        ctx.font = `600 ${Math.min(17, k.w * 0.5)}px ${FONT}`;
        const cx = (px(f, k.x, 0.9) + px(f, k.x + k.w, 0.9)) / 2;
        ctx.fillText('C' + (Math.floor(k.midi / 12) - 1), cx, kb.y + kb.h * (1 - LIP) - 8);
      }
    }

    for (const k of f.keys) {
      if (!k.black) continue;
      const kind = f.pressed.get(k.midi);
      const pc = pressedColors(kind, true);
      const bh = BLACK_HEIGHT;
      const bevel = bh * 0.16;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      keyPath(f, k.x + 1.5, k.x + k.w + 3, 0, bh + 0.03);
      ctx.fill();
      keyPath(f, k.x, k.x + k.w, 0, bh - bevel);
      const g = ctx.createLinearGradient(0, kb.y, 0, kb.y + kb.h * bh);
      if (pc) {
        g.addColorStop(0, pc[0]);
        g.addColorStop(1, pc[1]);
      } else if (f.pending.has(k.midi)) {
        const p = 0.5 + 0.5 * Math.sin(f.now * 7);
        g.addColorStop(0, `rgb(255,${Math.round(150 + 50 * p)},${Math.round(70 + 40 * p)})`);
        g.addColorStop(1, `rgb(${Math.round(170 + 40 * p)},60,14)`);
      } else {
        g.addColorStop(0, '#34333a');
        g.addColorStop(0.5, '#18171c');
        g.addColorStop(1, '#0b0a0e');
      }
      ctx.fillStyle = g;
      ctx.fill();
      keyPath(f, k.x + k.w * 0.06, k.x + k.w * 0.94, bh - bevel, bh);
      const bg = ctx.createLinearGradient(0, kb.y + kb.h * (bh - bevel), 0, kb.y + kb.h * bh);
      bg.addColorStop(0, pc ? pc[1] : '#5d5b64');
      bg.addColorStop(1, pc ? pc[1] : '#1b1a20');
      ctx.fillStyle = bg;
      ctx.fill();
      if (!pc) {
        keyPath(f, k.x + k.w * 0.16, k.x + k.w * 0.3, 0.02, bh - bevel - 0.04);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
      }
    }

    ctx.fillStyle = '#7a0d1c';
    ctx.fillRect(px(f, 0, 0), kb.y - 1, px(f, kb.w, 0) - px(f, 0, 0), 2.5);
    const hg = ctx.createLinearGradient(0, kb.y - 14, 0, kb.y);
    hg.addColorStop(0, 'rgba(255,240,230,0)');
    hg.addColorStop(1, 'rgba(255,240,230,0.55)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, kb.y - 14, W, 14);
    ctx.fillStyle = 'rgba(255,248,240,0.9)';
    ctx.fillRect(0, kb.y - 2.5, W, 1.5);
  }

  function drawEffects(f: Frame) {
    const dt = Math.min(0.05, Math.max(0, f.now - lastNow));
    lastNow = f.now;
    ctx.globalCompositeOperation = 'lighter';
    sparks = sparks.filter((s) => (s.life += dt) < s.max);
    for (const s of sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.8 * dt;
      s.vy = s.vy * (1 - 1.2 * dt) - 40 * dt;
      const a = 1 - s.life / s.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    pops = pops.filter((p) => f.now - p.t0 < 0.75);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pops) {
      const a = (f.now - p.t0) / 0.75;
      ctx.globalAlpha = 1 - a * a;
      ctx.fillStyle = p.color;
      ctx.font = `700 ${20 + (1 - a) * 4}px ${FONT}`;
      ctx.fillText(p.text, p.x, p.y - a * 38);
    }
    ctx.globalAlpha = 1;
  }

  function draw(f: Frame) {
    indexKeys(f.keys);
    drawStage(f);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, f.stageTop, W, f.kb.y - f.stageTop);
    ctx.clip();
    drawTiles(f, f.auto, 'auto');
    drawTiles(f, f.required, 'req');
    drawRising(f);
    ctx.restore();
    drawKeyboard(f);
    drawEffects(f);
  }

  return { resize, draw, burst, pop, clearEffects };
}

export type Renderer = ReturnType<typeof createRenderer>;
