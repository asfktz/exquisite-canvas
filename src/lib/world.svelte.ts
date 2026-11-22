import { C0, C1, R0, R1 } from './art';

export type Status = 'filled' | 'open' | 'locked';
export interface Person { name: string; color: string }
export interface Tile {
  c: number; r: number; status: Status;
  season: number;
  author?: Person; prompt?: string; ago?: string;
  lockUntil?: number; // for 'locked'
  mine?: boolean; byMe?: boolean; obj?: number; fresh?: boolean;
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
const AGO = ['3 weeks ago', '2 weeks ago', '2 weeks ago', '17 days ago', '3 weeks ago', '12 days ago'];
const AGO_NOW = ['2m ago', '14m ago', '1h ago', '3h ago', 'yesterday', '2d ago', '5h ago', '40m ago'];

let pi = 0;
const pick = <T>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];
export const randomPerson = (): Person => ({ name: pick(NAMES, pi * 7 + 3), color: pick(COLORS, pi++) });

// ---------- seasons ----------
// One world. Each digit is the season (week) a tile belongs to, over C0..C1 x R0..R1.
// Seasons 1-2 are history (fully revealed), 3 is being drawn now (fogged), 4 opens next.
const SEASON_MAP = [
  '22222233333',
  '22221133333',
  '22211111333',
  '22111111133',
  '44111111133',
  '44411111333',
  '44441111433',
  '44444114444',
  '44444444444',
];
export const SEASONS: Record<number, { name: string; when: string }> = {
  1: { name: 'The Sleeping Hills', when: 'Week of Nov 2' },
  2: { name: 'Night Sea', when: 'Week of Nov 9' },
  3: { name: 'The Eastern Sky', when: 'This week' },
  4: { name: 'Underland', when: 'Next week' },
};
export const LAST_SEASON = 4;
const seasonOf = (c: number, r: number) => Number(SEASON_MAP[r - R0]?.[c - C0] ?? 0);

/** how many of the current season's tiles are already drawn (hidden) when the mockup starts */
const START_FILLED = 9;
export const OPEN_LIMIT = 6;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [-1, -1], [1, -1], [-1, 1]];

class World {
  tiles = $state<Record<string, Tile>>({});
  mineKey = $state<string | null>(null);
  season = $state(3);
  /** seasons up to this one are visible to everyone */
  revealedUpTo = $state(2);
  /** tiles that are revealed in a "season reveal" moment, for the staggered animation */
  revealing = $state<Record<string, number>>({});

  constructor() { this.reset(); }

  reset() {
    pi = 0;
    const t: Record<string, Tile> = {};
    let i = 0;
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
      const s = seasonOf(c, r);
      if (s < 3) {
        t[key(c, r)] = { c, r, season: s, status: 'filled', author: { name: pick(NAMES, i * 5), color: pick(COLORS, i) }, prompt: pick(PROMPTS, i * 3), ago: pick(AGO, i) };
        i++;
      }
    }
    this.tiles = t;
    this.season = 3;
    this.revealedUpTo = 2;
    this.mineKey = null;
    this.revealing = {};
    // part of the current season is already drawn by others (hidden from you)
    for (let n = 0; n < START_FILLED; n++) {
      this.refillOpen();
      const o = this.list.filter((x) => x.status === 'open');
      const g = o[Math.floor(Math.random() * o.length)];
      if (g) Object.assign(g, { status: 'filled', author: randomPerson(), prompt: pick(PROMPTS, n * 5 + 2), ago: pick(AGO_NOW, n) });
    }
    this.refillOpen();
    const opens = this.list.filter((x) => x.status === 'open');
    opens.slice(0, 2).forEach((o, j) => { o.status = 'locked'; o.author = randomPerson(); o.lockUntil = Date.now() + (70 + j * 50) * 1000; });
  }

  get list() { return Object.values(this.tiles); }
  get filled() { return this.list.filter((t) => t.status === 'filled'); }
  /** all tiles of the current season (filled or not), including still-empty cells */
  get seasonCells() {
    const out: { c: number; r: number }[] = [];
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) if (this.seasonAt(c, r) === this.season) out.push({ c, r });
    return out;
  }
  get seasonFilled() { return this.filled.filter((t) => t.season === this.season); }
  get seasonArtists() { return new Set(this.seasonFilled.map((t) => t.author?.name)).size; }
  get pastFilled() { return this.filled.filter((t) => t.season < this.season); }
  get drawingNow() { return this.list.filter((t) => t.status === 'locked').length + (this.mineKey ? 1 : 0); }
  get artists() { return new Set(this.filled.map((t) => t.author?.name)).size + 18; }

  /** season of a cell; leftover empty cells of past seasons roll into the current one */
  seasonAt(c: number, r: number) {
    const t = this.tiles[key(c, r)];
    if (t) return t.season;
    const s = seasonOf(c, r);
    return s && s < this.season ? this.season : s;
  }

  isFilled(c: number, r: number) { return this.tiles[key(c, r)]?.status === 'filled'; }

  /** can the visitor see this tile right now? history yes; this season only around your own tiles */
  canSee(c: number, r: number) {
    const t = this.tiles[key(c, r)];
    if (!t || t.status !== 'filled') return true;
    if (t.season <= this.revealedUpTo) return true;
    if (t.byMe) return true;
    return N8.some(([a, b]) => {
      const n = this.tiles[key(c + a, r + b)];
      return n && n.season === this.season && (n.byMe || n.mine);
    });
  }
  get seenCount() { return this.seasonFilled.filter((t) => this.canSee(t.c, t.r)).length; }

  /** empty cells of the current season touching any drawn tile */
  frontier() {
    const out: { c: number; r: number }[] = [];
    const seen = new Set<string>();
    for (const t of this.filled) {
      for (const [dc, dr] of N4) {
        const c = t.c + dc, r = t.r + dr, k = key(c, r);
        if (!inBounds(c, r) || this.tiles[k] || seen.has(k) || this.seasonAt(c, r) !== this.season) continue;
        seen.add(k); out.push({ c, r });
      }
    }
    return out;
  }

  refillOpen() {
    const openCount = this.list.filter((t) => t.status !== 'filled').length;
    let need = OPEN_LIMIT - openCount;
    if (need <= 0) return;
    const score = (c: number, r: number) => N4.filter(([a, b]) => this.isFilled(c + a, r + b)).length + Math.random() * 0.9;
    const f = this.frontier().map((p) => ({ ...p, s: score(p.c, p.r) })).sort((a, b) => b.s - a.s);
    for (const p of f) { if (need-- <= 0) break; this.tiles[key(p.c, p.r)] = { c: p.c, r: p.r, season: this.season, status: 'open' }; }
  }

  assign(prefer?: string) {
    const free = this.list.filter((t) => t.status === 'open');
    let t = prefer ? this.tiles[prefer] : undefined;
    // prefer spots with many neighbours, and next to your own corner if you have one
    // hidden neighbours count extra: drawing there is what clears the fog
    const nf = (x: Tile) => N8.reduce((s, [a, b]) => {
      const n = this.tiles[key(x.c + a, x.r + b)];
      if (n?.status !== 'filled') return s;
      return s + 1 + (this.canSee(n.c, n.r) ? 0 : 1.5);
    }, 0) + Math.random() * 0.5;
    if (!t || t.status !== 'open') t = free.sort((a, b) => nf(b) - nf(a))[0];
    if (!t) return null;
    t.mine = true;
    this.mineKey = key(t.c, t.r);
    return t;
  }

  release() {
    if (!this.mineKey) return;
    const t = this.tiles[this.mineKey];
    if (t && t.status !== 'filled') t.mine = false;
    this.mineKey = null;
  }

  submitMine(prompt: string, obj: number) {
    const t = this.mineKey ? this.tiles[this.mineKey] : null;
    if (!t) return null;
    Object.assign(t, { status: 'filled', author: { name: 'You', color: '#ff6b4a' }, prompt, ago: 'just now', obj, mine: false, byMe: true, fresh: true });
    this.mineKey = null;
    this.refillOpen();
    return t;
  }

  /** simulate another artist finishing their tile */
  tickOthers(): Tile | null {
    const locked = this.list.filter((t) => t.status === 'locked').sort((a, b) => (a.lockUntil ?? 0) - (b.lockUntil ?? 0));
    const t = locked[0];
    let done: Tile | null = null;
    if (t) {
      Object.assign(t, { status: 'filled', prompt: pick(PROMPTS, Math.floor(Math.random() * 99)), ago: 'just now', fresh: true });
      done = t;
    }
    this.refillOpen();
    const free = this.list.filter((x) => x.status === 'open' && !x.mine);
    const g = free[Math.floor(Math.random() * free.length)];
    if (g) { g.status = 'locked'; g.author = randomPerson(); g.lockUntil = Date.now() + (60 + Math.random() * 90) * 1000; }
    return done;
  }

  /** end of week: everything drawn this season becomes visible to everyone. returns the tiles that were hidden */
  revealSeason(center: { c: number; r: number }) {
    const hidden = this.seasonFilled.filter((t) => !this.canSee(t.c, t.r));
    const rv: Record<string, number> = {};
    for (const t of hidden) rv[key(t.c, t.r)] = Math.hypot(t.c - center.c, t.r - center.r);
    // drop locks and opens: the season is closed
    for (const t of this.list) if (t.season === this.season && t.status !== 'filled') delete this.tiles[key(t.c, t.r)];
    this.revealing = rv;
    this.revealedUpTo = this.season;
    return hidden;
  }

  startSeason(n: number) {
    this.season = n;
    this.revealing = {};
    for (const t of this.list) t.fresh = false;
    this.refillOpen();
    const opens = this.list.filter((x) => x.status === 'open');
    opens.slice(0, 3).forEach((o, j) => { o.status = 'locked'; o.author = randomPerson(); o.lockUntil = Date.now() + (25 + j * 20) * 1000; });
  }

  neighbours(c: number, r: number) {
    return {
      top: this.tiles[key(c, r - 1)], bottom: this.tiles[key(c, r + 1)],
      left: this.tiles[key(c - 1, r)], right: this.tiles[key(c + 1, r)],
    };
  }

  bbox(cells: { c: number; r: number }[]) {
    const xs = cells.map((t) => t.c), ys = cells.map((t) => t.r);
    return { c0: Math.min(...xs), c1: Math.max(...xs), r0: Math.min(...ys), r1: Math.max(...ys) };
  }
  bounds() { return { c0: C0, c1: C1, r0: R0, r1: R1 }; }
  seasonBounds(s = this.season) {
    const cells: { c: number; r: number }[] = [];
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
      const t = this.tiles[key(c, r)];
      if ((t ? t.season : this.seasonAt(c, r)) === s) cells.push({ c, r });
    }
    return cells.length ? this.bbox(cells) : this.bounds();
  }
  /** centre of a season's region, for its label on the map */
  seasonCentre(s: number) {
    const cells: { c: number; r: number }[] = [];
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) if (seasonOf(c, r) === s) cells.push({ c, r });
    const cx = cells.reduce((a, b) => a + b.c, 0) / cells.length, cy = cells.reduce((a, b) => a + b.r, 0) / cells.length;
    // snap to the nearest real cell of that season so the label sits on it
    const best = cells.sort((a, b) => Math.hypot(a.c - cx, a.r - cy) - Math.hypot(b.c - cx, b.r - cy))[0];
    return best;
  }
}

export const world = new World();
