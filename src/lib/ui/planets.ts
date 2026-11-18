/**
 * Procedural planets: a seeded equirectangular texture (bands, swirls, storms)
 * rendered onto a lit sphere. Lookup tables are built once per size so a hero
 * planet can spin every frame for very little work.
 */
export interface PlanetPalette {
  deep: [number, number, number];
  mid: [number, number, number];
  light: [number, number, number];
  glow: [number, number, number];
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const PALETTES: Record<string, PlanetPalette> = {
  ember: { deep: hex('#5a0f05'), mid: hex('#d9420f'), light: hex('#ffb35c'), glow: hex('#ff7a2f') },
  crimson: { deep: hex('#3a0610'), mid: hex('#b3182c'), light: hex('#ff7a59'), glow: hex('#ff3d3d') },
  cobalt: { deep: hex('#0b1650'), mid: hex('#3355d6'), light: hex('#b48cff'), glow: hex('#6ea8ff') },
  gold: { deep: hex('#4a2a05'), mid: hex('#c98a1e'), light: hex('#ffe3a1'), glow: hex('#ffc46b') },
  rose: { deep: hex('#3d0a2a'), mid: hex('#c2347a'), light: hex('#ffb0c8'), glow: hex('#ff6aa8') },
  teal: { deep: hex('#03302e'), mid: hex('#138a7e'), light: hex('#9ff2d8'), glow: hex('#3fe0c0') },
  violet: { deep: hex('#1d0b45'), mid: hex('#6a35d1'), light: hex('#e0b8ff'), glow: hex('#a77bff') },
  ash: { deep: hex('#1a1414'), mid: hex('#6b5a55'), light: hex('#e8d8cc'), glow: hex('#c9a48f') },
};

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const TEX_W = 384;
const TEX_H = 192;

/** RGB texture (Uint8ClampedArray, 3 bytes per texel), seamless horizontally. */
export function planetTexture(seed: string, pal: PlanetPalette): Uint8ClampedArray {
  const r = rng(seed);
  const tex = new Uint8ClampedArray(TEX_W * TEX_H * 3);
  const bands = 5 + Math.floor(r() * 9);
  const turb = 0.4 + r() * 1.4;
  const waves = Array.from({ length: 4 }, () => ({ k: 1 + Math.floor(r() * 5), a: r() * 0.12, p: r() * 6.28 }));
  const storms = Array.from({ length: 2 + Math.floor(r() * 4) }, () => ({
    x: r(), y: 0.2 + r() * 0.6, rx: 0.03 + r() * 0.07, ry: 0.015 + r() * 0.03, bright: r() > 0.5,
  }));
  const phase = r() * 6.28;
  const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let y = 0; y < TEX_H; y++) {
    const v = y / TEX_H;
    for (let x = 0; x < TEX_W; x++) {
      const u = x / TEX_W;
      let w = 0;
      for (const wv of waves) w += wv.a * Math.sin(u * 6.2832 * wv.k + wv.p + v * 9);
      const swirl = Math.sin(u * 6.2832 * 3 + v * 20 * turb + phase) * 0.04 * turb;
      const b = 0.5 + 0.5 * Math.sin((v + w + swirl) * bands * 3.1416 + phase);
      const fine = 0.5 + 0.5 * Math.sin((v + w * 1.7) * bands * 3.3 + u * 6.2832 * 2);
      let t = b * 0.85 + fine * 0.15;
      let c = t < 0.5 ? mix(pal.deep, pal.mid, t * 2) : mix(pal.mid, pal.light, (t - 0.5) * 2);
      for (const s of storms) {
        let dx = Math.abs(u - s.x);
        dx = Math.min(dx, 1 - dx);
        const d = (dx / s.rx) ** 2 + ((v - s.y) / s.ry) ** 2;
        if (d < 1) {
          const k = (1 - d) ** 1.5;
          c = mix(c, s.bright ? pal.light : pal.deep, k * 0.85);
        }
      }
      // darker poles
      const pole = Math.pow(Math.abs(v - 0.5) * 2, 3);
      c = mix(c, pal.deep, pole * 0.6);
      const i = (y * TEX_W + x) * 3;
      tex[i] = c[0];
      tex[i + 1] = c[1];
      tex[i + 2] = c[2];
    }
  }
  return tex;
}

interface Lut {
  size: number;
  idx: Int32Array; // pixel index within the disc, or -1
  lon: Float32Array; // 0..1 around the planet
  lat: Int32Array; // texture row
  shade: Float32Array; // lighting multiplier
  rim: Float32Array; // atmosphere rim amount
}
const luts = new Map<number, Lut>();

function lut(size: number): Lut {
  const hit = luts.get(size);
  if (hit) return hit;
  const n = size * size;
  const l: Lut = { size, idx: new Int32Array(n).fill(-1), lon: new Float32Array(n), lat: new Int32Array(n), shade: new Float32Array(n), rim: new Float32Array(n) };
  const R = size / 2;
  // light from upper left, slightly in front
  const L = [-0.55, -0.45, 0.7];
  const ll = Math.hypot(L[0], L[1], L[2]);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const p = py * size + px;
      const x = (px + 0.5 - R) / R;
      const y = (py + 0.5 - R) / R;
      const d2 = x * x + y * y;
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2);
      const lat = Math.asin(y);
      const lon = Math.atan2(x, z);
      l.idx[p] = p;
      l.lon[p] = lon / (2 * Math.PI); // -0.25..0.25 across the visible hemisphere, continuous
      l.lat[p] = Math.min(TEX_H - 1, Math.floor(((lat / Math.PI) + 0.5) * TEX_H));
      const lambert = Math.max(0, (x * L[0] + y * L[1] + z * L[2]) / ll);
      l.shade[p] = 0.12 + 0.98 * Math.pow(lambert, 0.85);
      l.rim[p] = Math.pow(1 - z, 3);
    }
  }
  luts.set(size, l);
  return l;
}

/** Draw the planet sphere into a size×size ImageData. `spin` is 0..1 of a full turn. */
export function renderSphere(img: ImageData, tex: Uint8ClampedArray, pal: PlanetPalette, spin: number) {
  const size = img.width;
  const l = lut(size);
  const out = img.data;
  const g = pal.glow;
  for (let p = 0; p < size * size; p++) {
    const o = p * 4;
    if (l.idx[p] < 0) {
      out[o + 3] = 0;
      continue;
    }
    let u = l.lon[p] + spin;
    u -= Math.floor(u);
    const t = (l.lat[p] * TEX_W + Math.floor(u * TEX_W)) * 3;
    const s = l.shade[p];
    const rim = l.rim[p];
    out[o] = tex[t] * s + g[0] * rim * 0.9;
    out[o + 1] = tex[t + 1] * s + g[1] * rim * 0.9;
    out[o + 2] = tex[t + 2] * s + g[2] * rim * 0.9;
    out[o + 3] = 255;
  }
}

const texCache = new Map<string, Uint8ClampedArray>();
export function cachedTexture(seed: string, palette: string): Uint8ClampedArray {
  const key = seed + '|' + palette;
  let t = texCache.get(key);
  if (!t) {
    t = planetTexture(seed, PALETTES[palette] ?? PALETTES.ember);
    texCache.set(key, t);
  }
  return t;
}

const thumbCache = new Map<string, string>();
/** A static planet image (data URL) for lists. */
export function planetThumb(seed: string, palette: string, size = 112): string {
  const key = `${seed}|${palette}|${size}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const pad = Math.round(size * 0.12);
  c.width = c.height = size + pad * 2;
  const ctx = c.getContext('2d')!;
  const pal = PALETTES[palette] ?? PALETTES.ember;
  const img = ctx.createImageData(size, size);
  renderSphere(img, cachedTexture(seed, palette), pal, rng(seed)());
  // soft glow halo behind the sphere
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, size * 0.42, c.width / 2, c.height / 2, size * 0.62);
  g.addColorStop(0, `rgba(${pal.glow.join(',')},0.45)`);
  g.addColorStop(1, `rgba(${pal.glow.join(',')},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = size;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.drawImage(tmp, pad, pad);
  const url = c.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

/** Generate thumbnails one per animation frame so scrolling stays smooth. */
const queue: { key: string; run: () => void }[] = [];
let pumping = false;
function pump() {
  const job = queue.shift();
  if (job) job.run();
  if (queue.length) requestAnimationFrame(pump);
  else pumping = false;
}
export function queueThumb(seed: string, palette: string, size: number, cb: (url: string) => void) {
  const key = `${seed}|${palette}|${size}`;
  const hit = thumbCache.get(key);
  if (hit) return cb(hit);
  queue.push({ key, run: () => cb(planetThumb(seed, palette, size)) });
  if (!pumping) {
    pumping = true;
    requestAnimationFrame(pump);
  }
}
