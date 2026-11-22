import { C0, C1, R0, R1 } from './art';

export type Status = 'filled' | 'open' | 'locked';
export interface Person { name: string; color: string }
export interface Tile {
  c: number; r: number; status: Status;
  author?: Person; prompt?: string; ago?: string;
  lockUntil?: number; // for 'locked'
  mine?: boolean; obj?: number; fresh?: boolean;
}

export const key = (c: number, r: number) => `${c},${r}`;
export const inBounds = (c: number, r: number) => c >= C0 && c <= C1 && r >= R0 && r <= R1;

const NAMES = ['Noa', 'Itai', 'Maya', 'Lior', 'Yuval', 'Tamar', 'Omer', 'Shira', 'Ari', 'Dana', 'Ben', 'Gal', 'Roni', 'Eden', 'Yoav', 'Michal', 'Nir', 'Hila'];
const COLORS = ['#ff6b4a', '#7fe0c0', '#ffd166', '#c3a6ff', '#ff8fa3', '#4aa3df', '#f4a261'];
export const PROMPTS = [
  'a moon caught in fishing nets', 'violet mountains that breathe slowly', 'an eye that watches the tide',
  'a ladder for climbing out of dreams', 'clouds made of pink cotton and static', 'a tiny island with a lonely tree',
  'a road that forgets where it goes', 'lollipop forest at golden hour', 'a clock melting over a sleepy hill',
  'boats sailing toward the second sun', 'a door standing alone in a wheat field', 'stars leaking from the sky',
  'roots hanging from a floating rock', 'the sea remembering it was a sky', 'snow on mountains made of velvet',
  'a field ploughed by giant snails', 'sunset that tastes like apricot', 'a staircase of fog',
  'a lighthouse made of teeth', 'the hill where eyes go to rest', 'reflections arguing with the moon',
  'a meadow knitted by grandmothers', 'a path of red stitches', 'trees that hum when nobody listens',
];
export const SUGGESTIONS = [
  'continue the river into a waterfall', 'a fox sleeping on the ridge', 'more of the floating island',
  'a sun dissolving into birds', 'a tiny house with a glowing window', 'the road becomes a ribbon',
];
const AGO = ['2m ago', '14m ago', '1h ago', '3h ago', 'yesterday', '2d ago', '5h ago', '40m ago'];

let pi = 0;
const pick = <T>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];
export const randomPerson = (): Person => ({ name: pick(NAMES, pi * 7 + 3), color: pick(COLORS, pi++) });

// initial artwork shape (11 x 9 over C0..C1, R0..R1)
const SHAPE = [
  '...........',
  '....##.....',
  '...####.#..',
  '..########.',
  '..#######..',
  '...#####...',
  '....###....',
  '.....#.....',
  '...........',
];

export const OPEN_LIMIT = 9;

class World {
  tiles = $state<Record<string, Tile>>({});
  mineKey = $state<string | null>(null);

  constructor() { this.reset(); }

  reset() {
    const t: Record<string, Tile> = {};
    let i = 0;
    SHAPE.forEach((row, ri) => [...row].forEach((ch, ci) => {
      if (ch !== '#') return;
      const c = C0 + ci, r = R0 + ri;
      t[key(c, r)] = { c, r, status: 'filled', author: { name: pick(NAMES, i * 5), color: pick(COLORS, i) }, prompt: pick(PROMPTS, i * 3), ago: pick(AGO, i) };
      i++;
    }));
    this.tiles = t;
    this.mineKey = null;
    this.refillOpen();
    // two of the open ones are being drawn by other people
    const opens = this.list.filter((x) => x.status === 'open');
    opens.slice(0, 2).forEach((o, j) => { o.status = 'locked'; o.author = randomPerson(); o.lockUntil = Date.now() + (130 + j * 70) * 1000; });
  }

  get list() { return Object.values(this.tiles); }
  get filled() { return this.list.filter((t) => t.status === 'filled'); }
  get artists() { return new Set(this.filled.map((t) => t.author?.name)).size + 18; }
  get drawingNow() { return this.list.filter((t) => t.status === 'locked').length + (this.mineKey ? 1 : 0); }

  isFilled(c: number, r: number) { return this.tiles[key(c, r)]?.status === 'filled'; }

  /** empty in-bounds tiles touching the artwork (4-neighbour) */
  frontier() {
    const out: { c: number; r: number }[] = [];
    const seen = new Set<string>();
    for (const t of this.filled) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = t.c + dc, r = t.r + dr, k = key(c, r);
        if (!inBounds(c, r) || this.tiles[k] || seen.has(k)) continue;
        seen.add(k); out.push({ c, r });
      }
    }
    return out;
  }

  /** keep up to OPEN_LIMIT empty tiles open; prefer the ones with most filled neighbours */
  refillOpen() {
    const openCount = this.list.filter((t) => t.status !== 'filled').length;
    let need = OPEN_LIMIT - openCount;
    if (need <= 0) return;
    const score = (c: number, r: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => this.isFilled(c + a, r + b)).length + Math.random() * 0.9;
    const f = this.frontier().map((p) => ({ ...p, s: score(p.c, p.r) })).sort((a, b) => b.s - a.s);
    for (const p of f) { if (need-- <= 0) break; this.tiles[key(p.c, p.r)] = { c: p.c, r: p.r, status: 'open' }; }
  }

  /** auto-assign a free open tile to the visitor */
  assign(prefer?: string) {
    const free = this.list.filter((t) => t.status === 'open');
    let t = prefer ? this.tiles[prefer] : undefined;
    const nf = (x: Tile) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([a, b]) => this.isFilled(x.c + a, x.r + b)).length;
    if (!t || t.status !== 'open') t = free.sort((a, b) => nf(b) - nf(a) || Math.hypot(a.c, a.r) - Math.hypot(b.c, b.r))[0];
    if (!t) return null;
    t.mine = true;
    this.mineKey = key(t.c, t.r);
    return t;
  }

  release() {
    if (!this.mineKey) return;
    const t = this.tiles[this.mineKey];
    if (t && t.status !== 'filled') { t.mine = false; }
    this.mineKey = null;
  }

  submitMine(prompt: string, obj: number) {
    const t = this.mineKey ? this.tiles[this.mineKey] : null;
    if (!t) return null;
    Object.assign(t, { status: 'filled', author: { name: 'You', color: '#ff6b4a' }, prompt, ago: 'just now', obj, mine: true, fresh: true });
    this.mineKey = null;
    this.refillOpen();
    return t;
  }

  /** simulate another artist finishing their tile; returns the tile */
  tickOthers(): Tile | null {
    const locked = this.list.filter((t) => t.status === 'locked').sort((a, b) => (a.lockUntil ?? 0) - (b.lockUntil ?? 0));
    const t = locked[0];
    let done: Tile | null = null;
    if (t) {
      Object.assign(t, { status: 'filled', prompt: pick(PROMPTS, Math.floor(Math.random() * 99)), ago: 'just now', fresh: true });
      done = t;
    }
    this.refillOpen();
    // someone new grabs a free one (never the visitor's)
    const free = this.list.filter((x) => x.status === 'open' && !x.mine);
    const g = free[Math.floor(Math.random() * free.length)];
    if (g) { g.status = 'locked'; g.author = randomPerson(); g.lockUntil = Date.now() + (90 + Math.random() * 180) * 1000; }
    return done;
  }

  neighbours(c: number, r: number) {
    return {
      top: this.tiles[key(c, r - 1)], bottom: this.tiles[key(c, r + 1)],
      left: this.tiles[key(c - 1, r)], right: this.tiles[key(c + 1, r)],
    };
  }

  bounds() {
    const f = this.filled;
    const xs = f.map((t) => t.c), ys = f.map((t) => t.r);
    return { c0: Math.min(...xs), c1: Math.max(...xs), r0: Math.min(...ys), r1: Math.max(...ys) };
  }
}

export const world = new World();
