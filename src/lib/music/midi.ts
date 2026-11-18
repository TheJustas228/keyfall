import { sortNotes, songDuration, type Note, type Song } from './types';

export interface MidiNote {
  midi: number;
  start: number;
  dur: number;
  vel: number;
  channel: number;
}
export interface MidiTrack {
  name: string;
  notes: MidiNote[];
}
export interface MidiData {
  tracks: MidiTrack[];
  duration: number;
}

const MIN_DUR = 0.05;

class Reader {
  pos = 0;
  constructor(private b: Uint8Array) {}
  get done() {
    return this.pos >= this.b.length;
  }
  u8() {
    if (this.pos >= this.b.length) throw new Error('Unexpected end of MIDI data');
    return this.b[this.pos++];
  }
  u16() {
    return (this.u8() << 8) | this.u8();
  }
  u32() {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }
  str(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  vlq() {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const c = this.u8();
      v = (v << 7) | (c & 0x7f);
      if (!(c & 0x80)) return v;
    }
    return v;
  }
  bytes(n: number) {
    const out = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

interface RawNote {
  midi: number;
  startTick: number;
  endTick: number;
  vel: number;
  channel: number;
}
interface RawTrack {
  name: string;
  notes: RawNote[];
}

function readTrack(r: Reader, end: number, tempos: { tick: number; us: number }[]): RawTrack {
  const notes: RawNote[] = [];
  const open = new Map<number, RawNote>(); // key: channel*128+midi
  let name = '';
  let tick = 0;
  let status = 0;
  const close = (key: number, at: number) => {
    const n = open.get(key);
    if (!n) return;
    n.endTick = at;
    notes.push(n);
    open.delete(key);
  };
  while (r.pos < end) {
    tick += r.vlq();
    let b = r.u8();
    if (b === 0xff) {
      const type = r.u8();
      const len = r.vlq();
      const data = r.bytes(len);
      if (type === 0x51 && len === 3) tempos.push({ tick, us: (data[0] << 16) | (data[1] << 8) | data[2] });
      else if (type === 0x03 && !name) name = String.fromCharCode(...data);
      else if (type === 0x2f) break;
      continue;
    }
    if (b === 0xf0 || b === 0xf7) {
      r.bytes(r.vlq());
      continue;
    }
    let first: number;
    if (b & 0x80) {
      status = b;
      first = r.u8();
    } else {
      if (!status) throw new Error('Invalid MIDI running status');
      first = b;
    }
    const kind = status & 0xf0;
    const ch = status & 0x0f;
    if (kind === 0xc0 || kind === 0xd0) continue; // one data byte
    const second = r.u8();
    if (kind !== 0x90 && kind !== 0x80) continue;
    if (ch === 9) continue; // General MIDI drums
    const key = ch * 128 + first;
    if (kind === 0x90 && second > 0) {
      close(key, tick); // overlapping same pitch: end the earlier note here
      open.set(key, { midi: first, startTick: tick, endTick: tick, vel: second / 127, channel: ch });
    } else {
      close(key, tick);
    }
  }
  for (const key of [...open.keys()]) close(key, tick);
  r.pos = end;
  return { name, notes };
}

export function parseMidi(bytes: Uint8Array): MidiData {
  const r = new Reader(bytes);
  if (bytes.length < 14 || r.str(4) !== 'MThd') throw new Error('Not a MIDI file (missing MThd header)');
  const hlen = r.u32();
  r.u16(); // format
  const ntracks = r.u16();
  const division = r.u16();
  r.pos = 8 + hlen;
  if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
  if (division === 0) throw new Error('Invalid MIDI time division (0)');

  const tempos: { tick: number; us: number }[] = [];
  const raw: RawTrack[] = [];
  for (let i = 0; i < ntracks && !r.done; i++) {
    const id = r.str(4);
    const len = r.u32();
    const end = Math.min(r.pos + len, bytes.length);
    if (id !== 'MTrk') {
      r.pos = end;
      continue;
    }
    raw.push(readTrack(r, end, tempos));
  }

  // Tempo map: tick → seconds
  tempos.sort((a, b) => a.tick - b.tick);
  const segs: { tick: number; sec: number; us: number }[] = [{ tick: 0, sec: 0, us: 500000 }];
  for (const t of tempos) {
    const last = segs[segs.length - 1];
    const sec = last.sec + ((t.tick - last.tick) * last.us) / 1e6 / division;
    if (t.tick === last.tick) last.us = t.us;
    else segs.push({ tick: t.tick, sec, us: t.us });
  }
  const toSec = (tick: number) => {
    let s = segs[0];
    for (const seg of segs) {
      if (seg.tick <= tick) s = seg;
      else break;
    }
    return s.sec + ((tick - s.tick) * s.us) / 1e6 / division;
  };

  const tracks: MidiTrack[] = raw.map((t) => ({
    name: t.name,
    notes: t.notes
      .map((n) => {
        const start = toSec(n.startTick);
        const dur = toSec(n.endTick) - start;
        return { midi: n.midi, start, dur: dur > 0.001 ? dur : MIN_DUR, vel: n.vel, channel: n.channel };
      })
      .sort((a, b) => a.start - b.start || a.midi - b.midi),
  }));
  let duration = 0;
  for (const t of tracks) for (const n of t.notes) duration = Math.max(duration, n.start + n.dur);
  if (!tracks.some((t) => t.notes.length)) throw new Error('This MIDI file has no piano notes');
  return { tracks, duration };
}

/** Convert MIDI bytes into a Song, assigning notes to hands. */
export function midiToSong(bytes: Uint8Array, meta: Partial<Song> & { id: string; title: string }): Song {
  const data = parseMidi(bytes);
  // A "part" is one channel within one track.
  const parts: MidiNote[][] = [];
  for (const t of data.tracks) {
    const byCh = new Map<number, MidiNote[]>();
    for (const n of t.notes) {
      if (!byCh.has(n.channel)) byCh.set(n.channel, []);
      byCh.get(n.channel)!.push(n);
    }
    parts.push(...byCh.values());
  }
  const notes: Note[] = [];
  const push = (n: MidiNote, hand: 'R' | 'L') => notes.push({ midi: n.midi, start: n.start, dur: n.dur, vel: n.vel, hand });
  const SPLIT = 60;
  if (parts.length === 1) {
    for (const n of parts[0]) push(n, n.midi >= SPLIT ? 'R' : 'L');
  } else {
    // A "wide" part holds both hands (a full piano part): split it note by note at middle C.
    // Narrow parts (a melody, a bass line, one hand) go to one hand by their average pitch.
    const total = parts.reduce((s, p) => s + p.length, 0);
    const info = parts.map((p) => {
      const sorted = p.map((n) => n.midi).sort((x, y) => x - y);
      const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      const p10 = pct(0.1), p90 = pct(0.9);
      return { wide: p90 - p10 >= 20 && p10 < SPLIT - 2 && p90 > SPLIT + 2, mean: sorted.reduce((s, x) => s + x, 0) / sorted.length, big: p.length >= total * 0.05 };
    });
    const narrowMeans = info.filter((i) => !i.wide && i.big).map((i) => i.mean);
    const threshold = narrowMeans.length >= 2 ? (Math.max(...narrowMeans) + Math.min(...narrowMeans)) / 2 : SPLIT;
    parts.forEach((p, i) => {
      if (info[i].wide) for (const n of p) push(n, n.midi >= SPLIT ? 'R' : 'L');
      else for (const n of p) push(n, info[i].mean > threshold ? 'R' : 'L');
    });
  }
  sortNotes(notes);
  return {
    id: meta.id,
    title: meta.title,
    composer: meta.composer ?? 'Imported MIDI',
    difficulty: meta.difficulty ?? 2,
    art: meta.art ?? { emoji: '🎹', from: '#334155', to: '#0f172a' },
    credit: meta.credit,
    source: meta.source ?? 'import',
    notes,
    duration: songDuration(notes),
  };
}
