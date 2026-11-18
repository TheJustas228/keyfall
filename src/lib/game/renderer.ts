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
  dimAuto: boolean;
  judgment: (n: Note) => Judgment | undefined;
  pressed: Map<number, PressKind>;
  pending: Set<number>;
  labels: LabelStyle;
  flats: boolean;
  keyLabels: boolean;
  now: number; // seconds, for animation
  rising?: Rising[];
}

const COLORS = {
  R: { main: '#38bdf8', deep: '#2563eb', light: '#9ddcfb', key: '#7dd3fc', keyDeep: '#1d6fd8' },
  L: { main: '#fb923c', deep: '#ea580c', light: '#fdc58f', key: '#fdba74', keyDeep: '#c2410c' },
};
const IVORY = '#f5efe3';
const BRASS = '#e7b65a';
const LETTERS_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const LETTERS_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SOLFEGE_SHARP = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const SOLFEGE_FLAT = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

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

  function burst(midi: number, f: Frame, hand: 'R' | 'L' | 'brass') {
    const k = keyIndex.get(midi);
    if (!k) return;
    const x = f.kb.x + k.x + k.w / 2;
    const color = hand === 'brass' ? BRASS : COLORS[hand].light;
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 90 + Math.random() * 170;
      sparks.push({ x, y: f.kb.y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, color });
    }
  }

  function pop(text: string, f: Frame, color: string, midi?: number) {
    const k = midi !== undefined ? keyIndex.get(midi) : undefined;
    const x = k ? f.kb.x + k.x + k.w / 2 : f.kb.x + f.kb.w / 2;
    pops.push({ text, x, y: f.kb.y - 40, t0: f.now, color });
    if (pops.length > 6) pops.shift();
  }

  function clearEffects() {
    sparks = [];
    pops = [];
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rr);
  }

  function drawStage(f: Frame) {
    const { kb } = f;
    // background with a soft glow rising from the keys
    ctx.fillStyle = '#101632';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, f.stageTop, 0, kb.y);
    g.addColorStop(0, 'rgba(16,22,50,0)');
    g.addColorStop(1, 'rgba(60,72,140,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, f.stageTop, W, kb.y - f.stageTop);

    // lane lines at every C (stronger) and F
    for (const k of f.keys) {
      if (k.black) continue;
      const pc = k.midi % 12;
      if (pc !== 0 && pc !== 5) continue;
      ctx.fillStyle = pc === 0 ? 'rgba(245,239,227,0.10)' : 'rgba(245,239,227,0.045)';
      ctx.fillRect(Math.round(kb.x + k.x), f.stageTop, 1, kb.y - f.stageTop);
    }
  }

  function drawTiles(f: Frame, notes: Note[], kind: 'req' | 'auto') {
    const { kb } = f;
    const span = kb.y - f.stageTop;
    const pps = span / f.window;
    const end = f.clock + f.window;
    const dim = kind === 'auto' && f.dimAuto;
    ctx.font = '700 11px ui-rounded, -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const n of notes) {
      if (n.start > end) break;
      if (n.start + n.dur < f.clock - 0.05) continue;
      const k = keyIndex.get(n.midi);
      if (!k) continue;
      const bottom = kb.y - (n.start - f.clock) * pps;
      const top = bottom - Math.max(n.dur * pps, 8);
      const inset = k.black ? 1 : Math.max(1.5, k.w * 0.08);
      const x = kb.x + k.x + inset;
      const w = k.w - inset * 2;
      const c = COLORS[n.hand];
      const j = kind === 'req' ? f.judgment(n) : undefined;
      const active = n.start <= f.clock && n.start + n.dur > f.clock;
      ctx.globalAlpha = dim ? 0.32 : j === 'miss' ? 0.35 : 1;
      let fill = k.black ? c.deep : c.main;
      if (j === 'miss') fill = '#64708f';
      else if ((j === 'perfect' || j === 'good') && active) fill = c.light;
      roundRect(x, top, w, bottom - top, Math.min(7, w / 3));
      ctx.fillStyle = fill;
      ctx.fill();
      if (!dim) {
        // pending notes in learn mode pulse with a brass ring
        if (kind === 'req' && f.pending.has(n.midi) && Math.abs(n.start - f.clock) < 0.3) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = `rgba(231,182,90,${0.6 + 0.4 * Math.sin(f.now * 8)})`;
          ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.stroke();
        }
        const label = noteLabel(n.midi, f.labels, f.flats);
        if (label && bottom - top >= 18 && w >= 13 && bottom <= kb.y + 3) {
          ctx.fillStyle = 'rgba(12,16,38,0.82)';
          ctx.font = `700 ${Math.min(12, Math.max(9, w * 0.45))}px ui-rounded, -apple-system, system-ui, sans-serif`;
          ctx.fillText(label, x + w / 2, bottom - 5);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRising(f: Frame) {
    if (!f.rising) return;
    const { kb } = f;
    const speed = 140; // px per second
    for (const r of f.rising) {
      const k = keyIndex.get(r.midi);
      if (!k) continue;
      const bottom = r.t1 === null ? kb.y : kb.y - (f.now - r.t1) * speed;
      const top = Math.min(kb.y - (f.now - r.t0) * speed, bottom - 14);
      if (bottom < f.stageTop) continue;
      const inset = k.black ? 1 : Math.max(1.5, k.w * 0.08);
      const hand = r.midi >= 60 ? COLORS.R : COLORS.L;
      roundRect(kb.x + k.x + inset, Math.max(top, f.stageTop), k.w - inset * 2, bottom - Math.max(top, f.stageTop), 6);
      ctx.globalAlpha = Math.max(0.15, Math.min(1, (bottom - f.stageTop) / 120));
      ctx.fillStyle = k.black ? hand.deep : hand.main;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function keyFill(k: Key, kind: PressKind | undefined, f: Frame): string {
    if (kind === 'wrong') return k.black ? '#be123c' : '#fda4af';
    if (kind === 'free') return k.black ? '#8a6a2a' : '#ecd3a0';
    if (kind === 'R' || kind === 'autoR') return k.black ? COLORS.R.keyDeep : COLORS.R.key;
    if (kind === 'L' || kind === 'autoL') return k.black ? COLORS.L.keyDeep : COLORS.L.key;
    if (f.pending.has(k.midi)) {
      const p = 0.5 + 0.5 * Math.sin(f.now * 7);
      return k.black ? `rgb(${150 + 81 * p},${105 + 77 * p},${40 + 50 * p})` : `rgb(245,${228 - 20 * p},${190 - 60 * p})`;
    }
    return k.black ? '#1c1b22' : IVORY;
  }

  function drawKeyboard(f: Frame) {
    const { kb } = f;
    // felt strip and key bed
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, kb.y, W, H - kb.y);
    ctx.fillStyle = '#7f1d2d';
    ctx.fillRect(kb.x, kb.y, kb.w, 3);
    const top = kb.y + 3;
    const h = kb.h - 3;

    // light beams above pressed keys
    for (const [midi, kind] of f.pressed) {
      const k = keyIndex.get(midi);
      if (!k || kind === 'wrong') continue;
      const color = kind === 'R' || kind === 'autoR' ? '56,189,248' : kind === 'L' || kind === 'autoL' ? '251,146,60' : '231,182,90';
      const g = ctx.createLinearGradient(0, kb.y - 90, 0, kb.y);
      g.addColorStop(0, `rgba(${color},0)`);
      g.addColorStop(1, `rgba(${color},${kind.startsWith('auto') ? 0.18 : 0.38})`);
      ctx.fillStyle = g;
      ctx.fillRect(kb.x + k.x, kb.y - 90, k.w, 90);
    }

    for (const k of f.keys) {
      if (k.black) continue;
      const kind = f.pressed.get(k.midi);
      const x = kb.x + k.x;
      roundRect(x + 0.75, top, k.w - 1.5, h - 1, 5);
      ctx.fillStyle = keyFill(k, kind, f);
      ctx.fill();
      if (f.keyLabels) {
        const pc = k.midi % 12;
        const label = f.labels === 'off' ? (pc === 0 ? 'C' : '') : noteLabel(k.midi, f.labels, f.flats);
        if (label && k.w >= 14) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = pc === 0 ? '#4b4536' : '#9a917e';
          ctx.font = `${pc === 0 ? 800 : 600} ${Math.min(13, k.w * 0.42)}px ui-rounded, -apple-system, system-ui, sans-serif`;
          ctx.fillText(pc === 0 ? label + (Math.floor(k.midi / 12) - 1) : label, x + k.w / 2, top + h - 8);
        }
      }
    }
    const bh = h * BLACK_HEIGHT;
    for (const k of f.keys) {
      if (!k.black) continue;
      const kind = f.pressed.get(k.midi);
      const x = kb.x + k.x;
      roundRect(x, top - 1, k.w, bh, 4);
      ctx.fillStyle = keyFill(k, kind, f);
      ctx.fill();
      if (!kind) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + k.w * 0.18, top + 2, k.w * 0.64, bh * 0.55);
      }
      if (f.pending.has(k.midi)) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = BRASS;
        roundRect(x, top - 1, k.w, bh, 4);
        ctx.stroke();
      }
    }
    // hit line
    const g = ctx.createLinearGradient(0, kb.y - 6, 0, kb.y);
    g.addColorStop(0, 'rgba(231,182,90,0)');
    g.addColorStop(1, 'rgba(231,182,90,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(kb.x, kb.y - 6, kb.w, 6);
  }

  function drawEffects(f: Frame) {
    const dt = Math.min(0.05, Math.max(0, f.now - lastNow));
    lastNow = f.now;
    ctx.globalCompositeOperation = 'lighter';
    sparks = sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 380 * dt;
      ctx.globalAlpha = Math.min(1, s.life * 2);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    pops = pops.filter((p) => f.now - p.t0 < 0.7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pops) {
      const a = (f.now - p.t0) / 0.7;
      ctx.globalAlpha = 1 - a * a;
      ctx.fillStyle = p.color;
      ctx.font = '800 18px ui-rounded, -apple-system, system-ui, sans-serif';
      ctx.fillText(p.text, p.x, p.y - a * 34);
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
