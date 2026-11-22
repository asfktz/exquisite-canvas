// Variant A — "Expanding fog".
// The visitor only sees what they've uncovered. On entry the 8 neighbours of their tile are clear
// and the ring beyond is hazy. Every tile they submit clears the fog around it, like an RTS map.
import { C0, C1, R0, R1 } from './art';
import { key, world } from './world.svelte';

export type Vis = 0 | 1 | 2; // 0 clear, 1 haze, 2 dark

export const START_CREDITS = 5;
export const PEEK_COST = 2;
export const PACKS = [
  { n: 10, price: '$2.99', note: '' },
  { n: 40, price: '$7.99', note: 'best value' },
  { n: 120, price: '$19.99', note: '' },
];

class Fog {
  /** permanently uncovered cells */
  discovered = $state<Record<string, true>>({});
  /** temporary 3x3 preview around the tile you're about to draw */
  preview = $state<string | null>(null);
  /** how far a submitted tile clears the fog (1 = 3x3, 2 = 5x5, 3 = 7x7) */
  radius = $state(2);
  credits = $state(START_CREDITS);
  spent = $state(0);
  /** where the last reveal started, for the ripple */
  origin = $state<{ c: number; r: number; t: number } | null>(null);
  /** bump to force the fog canvas to snap instead of animating */
  snap = $state(0);

  reset() {
    this.discovered = {};
    this.preview = null;
    this.credits = START_CREDITS;
    this.spent = 0;
    this.origin = null;
    this.snap++;
  }

  /** set of clear cells (discovered + preview) */
  get clear(): Set<string> {
    const s = new Set(Object.keys(this.discovered));
    if (this.preview) {
      const [c, r] = this.preview.split(',').map(Number);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s.add(key(c + dc, r + dr));
    }
    return s;
  }

  /** visibility map for every cell that is clear or hazy; anything missing is dark */
  get visMap(): Map<string, Vis> {
    const clear = this.clear;
    const m = new Map<string, Vis>();
    for (const k of clear) m.set(k, 0);
    for (const k of clear) {
      const [c, r] = k.split(',').map(Number);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const kk = key(c + dc, r + dr);
        if (!m.has(kk)) m.set(kk, 1);
      }
    }
    return m;
  }

  vis(c: number, r: number): Vis { return this.visMap.get(key(c, r)) ?? 2; }

  /** uncover a square around (c, r); returns how many drawn tiles became newly visible */
  uncover(c: number, r: number, rad = this.radius) {
    const before = this.clear;
    const d = { ...this.discovered };
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) d[key(c + dc, r + dr)] = true;
    this.discovered = d;
    this.origin = { c, r, t: performance.now() };
    return Object.keys(d).filter((k) => !before.has(k) && world.tiles[k]?.status === 'filled').length;
  }

  peek(c: number, r: number) {
    if (this.credits < PEEK_COST) return false;
    this.credits -= PEEK_COST; this.spent += PEEK_COST;
    this.discovered = { ...this.discovered, [key(c, r)]: true };
    this.origin = { c, r, t: performance.now() };
    return true;
  }

  spend(n = 1) {
    if (this.credits < n) return false;
    this.credits -= n; this.spent += n;
    return true;
  }

  clearAll() {
    const d: Record<string, true> = {};
    for (let r = R0 - 1; r <= R1 + 1; r++) for (let c = C0 - 1; c <= C1 + 1; c++) d[key(c, r)] = true;
    this.discovered = d;
    this.origin = { c: 0, r: 0, t: performance.now() };
  }

  /** share of the drawn tiles you can see clearly */
  get seenPct() {
    const f = world.filled;
    if (!f.length) return 0;
    const m = this.visMap;
    return Math.round((f.filter((t) => m.get(key(t.c, t.r)) === 0).length / f.length) * 100);
  }

  /** bounds of everything clear or hazy, or null if nothing is uncovered */
  bounds() {
    const ks = [...this.visMap.keys()].map((k) => k.split(',').map(Number));
    if (!ks.length) return null;
    const xs = ks.map((p) => p[0]), ys = ks.map((p) => p[1]);
    return { c0: Math.min(...xs), c1: Math.max(...xs), r0: Math.min(...ys), r1: Math.max(...ys) };
  }

  /** best open tile for the next draw: at the edge of what you've uncovered */
  pickNext(near?: { c: number; r: number }): string | undefined {
    const m = this.visMap;
    const open = world.list.filter((t) => t.status === 'open');
    if (!open.length) return undefined;
    const nf = (c: number, r: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => world.isFilled(c + a, r + b)).length;
    const score = (c: number, r: number) => {
      if (near) return -Math.hypot(c - near.c, r - near.r) * 10 + nf(c, r);
      const v = m.get(key(c, r)) ?? 2;
      // prefer tiles touching what you know (haze > clear > dark), so each tile pushes the fog back
      return (v === 1 ? 20 : v === 0 ? 12 : 0) + nf(c, r) * 2;
    };
    return open.map((t) => ({ k: key(t.c, t.r), s: score(t.c, t.r) })).sort((a, b) => b.s - a.s)[0]?.k;
  }
}

export const fog = new Fog();

// ---- soft masks so clear / hazy areas feather into each other instead of hard tile edges ----
export const FOG_M = 6;
export const FX0 = C0 - FOG_M, FY0 = R0 - FOG_M;
export const FN = C1 - C0 + 1 + FOG_M * 2, FK = R1 - R0 + 1 + FOG_M * 2;
const MP = 4; // mask px per cell; upscaling smooths a ~1/4-cell feather at each boundary

export function visMask(m: Map<string, Vis>, maxVis: Vis): string {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = FN * MP; c.height = FK * MP;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  for (const [k, v] of m) {
    if (v > maxVis) continue;
    const [x, y] = k.split(',').map(Number);
    g.fillRect((x - FX0) * MP, (y - FY0) * MP, MP, MP);
  }
  return c.toDataURL('image/png');
}
