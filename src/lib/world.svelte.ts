import { C0, C1, R0, R1 } from './art';

export type Status = 'filled' | 'open' | 'locked';
export interface Person { name: string; color: string }
export interface Tile {
  c: number; r: number; status: Status;
  author?: Person; prompt?: string; ago?: string;
  lockUntil?: number; // for 'locked'
  mine?: boolean; obj?: number; fresh?: boolean;
}

// ---------- zones ----------
// The map is split into 4x4 zones. A zone is either revealed (everyone sees it), active (being filled:
// you only see the tiles right around your own), or sealed (opens after the active one is revealed).
export const ZS = 4;
export const ZCOLS = (C1 - C0 + 1) / ZS; // 3
export const ZROWS = (R1 - R0 + 1) / ZS; // 2
export type ZoneState = 'revealed' | 'active' | 'sealed';
export interface Zone { i: number; zc: number; zr: number; c0: number; r0: number; name: string; state: ZoneState; artists?: number }

const ZONE_NAMES = ['Moon harbour', 'Sky orchard', 'The far islands', 'Clock hills', 'The red road', 'Door field'];
const START: ZoneState[] = ['revealed', 'revealed', 'sealed', 'sealed', 'active', 'sealed'];
/** sealed zones open in this order */
const OPEN_ORDER = [4, 2, 3, 5];
/** which tiles of the active zone are already drawn (hidden) at start */
const ACTIVE_START = ['###.', '#...', '##.#', '#..#'];

export const key = (c: number, r: number) => `${c},${r}`;
export const inBounds = (c: number, r: number) => c >= C0 && c <= C1 && r >= R0 && r <= R1;
export const zoneIndex = (c: number, r: number) => Math.floor((r - R0) / ZS) * ZCOLS + Math.floor((c - C0) / ZS);

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

export const OTHERS_EVERY_MS = 7000; // simulated pace of other artists

class World {
  tiles = $state<Record<string, Tile>>({});
  zones = $state<Zone[]>([]);
  mineKey = $state<string | null>(null);
  /** tiles this visitor has drawn: they keep seeing those and their 8 neighbours */
  myKeys = $state<string[]>([]);

  constructor() { this.reset(); }

  reset() {
    pi = 0;
    const t: Record<string, Tile> = {};
    const zones: Zone[] = [];
    let i = 0;
    for (let zr = 0; zr < ZROWS; zr++) for (let zc = 0; zc < ZCOLS; zc++) {
      const zi = zr * ZCOLS + zc;
      const z: Zone = { i: zi, zc, zr, c0: C0 + zc * ZS, r0: R0 + zr * ZS, name: ZONE_NAMES[zi], state: START[zi] };
      zones.push(z);
      if (z.state === 'sealed') continue;
      for (let dr = 0; dr < ZS; dr++) for (let dc = 0; dc < ZS; dc++) {
        if (z.state === 'active' && ACTIVE_START[dr][dc] !== '#') continue;
        const c = z.c0 + dc, r = z.r0 + dr;
        t[key(c, r)] = { c, r, status: 'filled', author: { name: pick(NAMES, i * 5), color: pick(COLORS, i) }, prompt: pick(PROMPTS, i * 3), ago: pick(AGO, i) };
        i++;
      }
      if (z.state === 'revealed') z.artists = 12 + (zi * 3) % 5;
    }
    this.tiles = t;
    this.zones = zones;
    this.mineKey = null;
    this.myKeys = [];
    this.refillOpen();
    // two of the open ones are being drawn by other people
    this.openTiles().slice(0, 2).forEach((o, j) => { o.status = 'locked'; o.author = randomPerson(); o.lockUntil = Date.now() + (40 + j * 25) * 1000; });
  }

  get list() { return Object.values(this.tiles); }
  get filled() { return this.list.filter((t) => t.status === 'filled'); }
  get active(): Zone | undefined { return this.zones.find((z) => z.state === 'active'); }
  get nextSealed(): Zone | undefined { const o = OPEN_ORDER.find((i) => this.zones[i]?.state === 'sealed'); return o === undefined ? undefined : this.zones[o]; }
  get artists() { return new Set(this.filled.map((t) => t.author?.name)).size + 18; }
  get drawingNow() { return this.list.filter((t) => t.status === 'locked').length + (this.mineKey ? 1 : 0); }

  zoneTiles(z: Zone) {
    const out: Tile[] = [];
    for (let dr = 0; dr < ZS; dr++) for (let dc = 0; dc < ZS; dc++) { const t = this.tiles[key(z.c0 + dc, z.r0 + dr)]; if (t) out.push(t); }
    return out;
  }
  zoneFilled(z: Zone) { return this.zoneTiles(z).filter((t) => t.status === 'filled').length; }
  zoneOf(c: number, r: number): Zone | undefined { return inBounds(c, r) ? this.zones[zoneIndex(c, r)] : undefined; }

  isFilled(c: number, r: number) { return this.tiles[key(c, r)]?.status === 'filled'; }

  /** can this visitor see the artwork of a tile? */
  visible(c: number, r: number) {
    if (this.zoneOf(c, r)?.state === 'revealed') return true;
    const ks = this.mineKey ? [...this.myKeys, this.mineKey] : this.myKeys;
    for (const k of ks) { const [mc, mr] = k.split(',').map(Number); if (Math.abs(mc - c) <= 1 && Math.abs(mr - r) <= 1) return true; }
    return false;
  }

  openTiles() { return this.list.filter((t) => t.status === 'open'); }

  /** every empty tile in the active zone is open */
  refillOpen() {
    const z = this.active;
    if (!z) return;
    for (let dr = 0; dr < ZS; dr++) for (let dc = 0; dc < ZS; dc++) {
      const c = z.c0 + dc, r = z.r0 + dr, k = key(c, r);
      if (!this.tiles[k]) this.tiles[k] = { c, r, status: 'open' };
    }
  }

  /** auto-assign a free open tile to the visitor; prefer tiles with many drawn neighbours */
  assign(prefer?: string) {
    const free = this.openTiles();
    let t = prefer ? this.tiles[prefer] : undefined;
    const nf = (x: Tile) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([a, b]) => this.isFilled(x.c + a, x.r + b)).length;
    // a second tile prefers places you can't see yet, so it uncovers more of the zone
    const unseen = (x: Tile) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([a, b]) => this.isFilled(x.c + a, x.r + b) && !this.visible(x.c + a, x.r + b)).length;
    if (!t || t.status !== 'open') t = free.sort((a, b) => unseen(b) - unseen(a) || nf(b) - nf(a))[0];
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

  /** returns the tile and, if this tile completed its zone, that zone */
  submitMine(prompt: string, obj: number) {
    const t = this.mineKey ? this.tiles[this.mineKey] : null;
    if (!t) return null;
    Object.assign(t, { status: 'filled', author: { name: 'You', color: '#ff6b4a' }, prompt, ago: 'just now', obj, mine: true, fresh: true });
    this.myKeys = [...this.myKeys, this.mineKey!];
    setTimeout(() => { t.fresh = false; }, 2000);
    this.mineKey = null;
    return { tile: t, completed: this.checkComplete(t) };
  }

  checkComplete(t: Tile): Zone | null {
    const z = this.zoneOf(t.c, t.r);
    if (!z || z.state !== 'active' || this.zoneFilled(z) < ZS * ZS) return null;
    z.state = 'revealed';
    z.artists = new Set(this.zoneTiles(z).map((x) => x.author?.name)).size;
    const n = this.nextSealed;
    if (n) {
      n.state = 'active';
      this.refillOpen();
      this.openTiles().filter((x) => !x.mine).slice(0, 2).forEach((o, j) => { o.status = 'locked'; o.author = randomPerson(); o.lockUntil = Date.now() + (30 + j * 20) * 1000; });
    }
    return z;
  }

  /** simulate another artist finishing their tile */
  tickOthers(): { tile: Tile | null; completed: Zone | null } {
    const locked = this.list.filter((t) => t.status === 'locked').sort((a, b) => (a.lockUntil ?? 0) - (b.lockUntil ?? 0));
    const t = locked[0];
    let completed: Zone | null = null;
    if (t) {
      Object.assign(t, { status: 'filled', prompt: pick(PROMPTS, Math.floor(Math.random() * 99)), ago: 'just now', fresh: true });
      setTimeout(() => { t.fresh = false; }, 2000);
      completed = this.checkComplete(t);
    }
    // someone new grabs a free one (never the visitor's)
    const free = this.openTiles().filter((x) => !x.mine);
    const g = free[Math.floor(Math.random() * free.length)];
    if (g) { g.status = 'locked'; g.author = randomPerson(); g.lockUntil = Date.now() + (40 + Math.random() * 60) * 1000; }
    return { tile: t ?? null, completed };
  }

  neighbours(c: number, r: number) {
    return {
      top: this.tiles[key(c, r - 1)], bottom: this.tiles[key(c, r + 1)],
      left: this.tiles[key(c - 1, r)], right: this.tiles[key(c + 1, r)],
    };
  }

  bounds() { return { c0: C0, c1: C1, r0: R0, r1: R1 }; }
}

export const world = new World();
