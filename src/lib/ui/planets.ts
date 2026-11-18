/**
 * Vector planets. Each song gets a deterministic design (from its id): wavy
 * cloud bands and storms in its palette, drawn as SVG so it stays razor sharp
 * at any size. Bands repeat every PERIOD units horizontally, so sliding them
 * by one period makes a seamless spin.
 */
export interface Palette {
  deep: string;
  mid: string;
  light: string;
  glow: string;
}

export const PALETTES: Record<string, Palette> = {
  ember: { deep: '#5a0f05', mid: '#d9420f', light: '#ffb35c', glow: '#ff7a2f' },
  crimson: { deep: '#3a0610', mid: '#b3182c', light: '#ff7a59', glow: '#ff3d3d' },
  cobalt: { deep: '#0b1650', mid: '#3355d6', light: '#b48cff', glow: '#6ea8ff' },
  gold: { deep: '#4a2a05', mid: '#c98a1e', light: '#ffe3a1', glow: '#ffc46b' },
  rose: { deep: '#3d0a2a', mid: '#c2347a', light: '#ffb0c8', glow: '#ff6aa8' },
  teal: { deep: '#03302e', mid: '#138a7e', light: '#9ff2d8', glow: '#3fe0c0' },
  violet: { deep: '#1d0b45', mid: '#6a35d1', light: '#e0b8ff', glow: '#a77bff' },
  ash: { deep: '#1a1414', mid: '#6b5a55', light: '#e8d8cc', glow: '#c9a48f' },
};

export const RADIUS = 80;
export const PERIOD = 160;

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface Band {
  path: string;
  color: string;
  opacity: number;
  topAtPeriod: number;
}
export interface Storm {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  opacity: number;
}
export interface PlanetDesign {
  pal: Palette;
  bands: Band[];
  storms: Storm[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function planetDesign(seed: string, palette: string): PlanetDesign {
  const pal = PALETTES[palette] ?? PALETTES.ember;
  const r = rng(seed + '|' + palette);
  const colors = [pal.deep, pal.mid, pal.light, pal.mid, pal.deep];
  const bands: Band[] = [];
  const count = 6 + Math.floor(r() * 5);
  let y = -RADIUS - 6;
  const x0 = -RADIUS;
  const x1 = RADIUS + PERIOD;
  for (let i = 0; i < count && y < RADIUS; i++) {
    const h = 8 + r() * 26;
    const k1 = 1 + Math.floor(r() * 3);
    const k2 = 1 + Math.floor(r() * 3);
    const a1 = 1.5 + r() * 6;
    const a2 = 1.5 + r() * 6;
    const p1 = r() * 6.283;
    const p2 = r() * 6.283;
    const top = (x: number) => y + a1 * Math.sin((6.2832 * k1 * (x - x0)) / PERIOD + p1);
    const bot = (x: number) => y + h + a2 * Math.sin((6.2832 * k2 * (x - x0)) / PERIOD + p2);
    let d = `M${x0},${r1(top(x0))}`;
    for (let x = x0 + 10; x <= x1; x += 10) d += ` L${x},${r1(top(x))}`;
    for (let x = x1; x >= x0; x -= 10) d += ` L${x},${r1(bot(x))}`;
    d += ' Z';
    bands.push({ path: d, color: colors[Math.floor(r() * colors.length)], opacity: 0.35 + r() * 0.55, topAtPeriod: r1(top(x0 + PERIOD)) });
    y += h * (0.55 + r() * 0.35);
  }
  const storms: Storm[] = [];
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = { cx: -60 + r() * 120, cy: -50 + r() * 100, rx: 6 + r() * 14, ry: 3 + r() * 6, color: r() > 0.5 ? pal.light : pal.deep, opacity: 0.5 + r() * 0.4 };
    storms.push(s, { ...s, cx: s.cx + PERIOD });
  }
  return { pal, bands, storms };
}
