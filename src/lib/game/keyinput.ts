export interface KeyChange {
  on?: number;
  off?: number;
}

/**
 * Tracks which key each finger (pointer) is on. A note turns on with the first
 * finger to reach it and off only when the last finger leaves it.
 */
export class KeyInput {
  private byPointer = new Map<number, number | null>();
  private count = new Map<number, number>();

  private add(midi: number): boolean {
    const c = (this.count.get(midi) ?? 0) + 1;
    this.count.set(midi, c);
    return c === 1;
  }

  private remove(midi: number): boolean {
    const c = (this.count.get(midi) ?? 0) - 1;
    if (c <= 0) {
      this.count.delete(midi);
      return true;
    }
    this.count.set(midi, c);
    return false;
  }

  down(pointerId: number, midi: number | null): KeyChange {
    const out: KeyChange = {};
    const prev = this.byPointer.get(pointerId);
    if (prev != null && this.remove(prev)) out.off = prev;
    this.byPointer.set(pointerId, midi);
    if (midi != null && this.add(midi)) out.on = midi;
    return out;
  }

  move(pointerId: number, midi: number | null): KeyChange {
    if (!this.byPointer.has(pointerId)) return {};
    const prev = this.byPointer.get(pointerId) ?? null;
    if (prev === midi) return {};
    return this.down(pointerId, midi);
  }

  up(pointerId: number): KeyChange {
    if (!this.byPointer.has(pointerId)) return {};
    const prev = this.byPointer.get(pointerId) ?? null;
    this.byPointer.delete(pointerId);
    return prev != null && this.remove(prev) ? { off: prev } : {};
  }

  cancelAll(): number[] {
    const held = [...this.count.keys()];
    this.byPointer.clear();
    this.count.clear();
    return held;
  }

  held(): number[] {
    return [...this.count.keys()];
  }
}
