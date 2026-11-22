import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut } from 'svelte/easing';
import { T } from '../lib/art';
import { world, key, inBounds, randomPerson, type Person } from '../lib/world.svelte';
import { attemptsFor, type Attempt } from './attempts';

export type Variant = 'breathe' | 'dream' | 'pull' | 'grow';
export type Side = 'l' | 'r' | 't' | 'b';
export type Mode = 'browse' | 'generating' | 'choose' | 'stitching';

export const VARIANTS: { id: Variant; name: string; he: string; note: string }[] = [
  { id: 'breathe', name: 'Breathe', he: 'נשימה', note: 'The painting bleeds a little past its edge and breathes. Tap, swipe the 4 attempts in place.' },
  { id: 'dream', name: 'Dream', he: 'חלום', note: 'Empty cells quietly dream their own continuations. Tap one to wake it.' },
  { id: 'pull', name: 'Pull', he: 'משיכה', note: 'Grab the edge and pull the picture out. Flick cards off the deck.' },
  { id: 'grow', name: 'Grow', he: 'צמיחה', note: 'Seams glow like embers. Tap a seam and the picture grows out of it.' },
];

export interface Cell {
  c: number; r: number; author: Person; obj?: number; fx?: number;
  mine?: boolean; fresh?: number;
}
export interface Stitch { id: number; c: number; r: number; sides: Side[]; mine: boolean; at: number }

export const DIRS: [Side, number, number][] = [['l', -1, 0], ['r', 1, 0], ['t', 0, -1], ['b', 0, 1]];
export const START_CREDITS = 12;

function readVariant(): Variant {
  try {
    const v = new URLSearchParams(location.search).get('v');
    if (VARIANTS.some((x) => x.id === v)) return v as Variant;
  } catch {}
  return 'breathe';
}

class EdgeState {
  variant = $state<Variant>(readVariant());
  vw = $state(typeof window !== 'undefined' ? window.innerWidth : 390);
  vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  img = $state<{ full: string; fog: string } | null>(null);

  cells = $state<Record<string, Cell>>({});
  mode = $state<Mode>('browse');
  target = $state<{ c: number; r: number } | null>(null);
  attempts = $state<Attempt[]>([]);
  idx = $state(0);
  prevIdx = $state(-1); // grow: what the new attempt paints over
  round = $state(0);
  dragX = $state(0); // live swipe offset in screen px while choosing
  dragging = $state(false);
  growSide = $state<Side>('l');
  growKey = $state(0); // bumps to restart the grow animation
  pull = $state<{ c: number; r: number; side: Side; p: number; live: boolean } | null>(null);
  flung = $state<{ id: number; a: Attempt; dir: number } | null>(null);

  credits = $state(START_CREDITS);
  spent = $state<{ id: number; n: number }[]>([]);
  stitches = $state<Stitch[]>([]);
  after = $state<{ opened: { c: number; r: number }[]; at: number } | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  now = $state(Date.now());

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });

  get list() { return Object.values(this.cells); }
  isFilled(c: number, r: number) { return !!this.cells[key(c, r)]; }
  sidesOf(c: number, r: number): Side[] { return DIRS.filter(([, dc, dr]) => this.isFilled(c + dc, r + dr)).map(([s]) => s); }

  get frontier() {
    const out: { c: number; r: number; k: string; sides: Side[] }[] = [];
    const seen = new Set<string>();
    for (const t of this.list) for (const [, dc, dr] of DIRS) {
      const c = t.c + dc, r = t.r + dr, k = key(c, r);
      if (!inBounds(c, r) || this.cells[k] || seen.has(k)) continue;
      seen.add(k); out.push({ c, r, k, sides: this.sidesOf(c, r) });
    }
    return out;
  }
  get current(): Attempt | null { return this.attempts[this.idx] ?? null; }
  get targetKey() { return this.target ? key(this.target.c, this.target.r) : null; }
  get gesturesOn() { return this.mode === 'browse'; }
  get mineCount() { return this.list.filter((t) => t.mine).length; }

  toast(text: string, color?: string) {
    const id = Math.random();
    this.toasts = [...this.toasts, { id, text, color }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3200);
  }

  // ---------- camera ----------
  fitAll() {
    const all = [...this.list, ...this.frontier];
    const cs = all.map((t) => t.c), rs = all.map((t) => t.r);
    const c0 = Math.min(...cs), c1 = Math.max(...cs), r0 = Math.min(...rs), r1 = Math.max(...rs);
    const w = (c1 - c0 + 1.3) * T, h = (r1 - r0 + 1.3) * T;
    const top = 70, bot = 110;
    const s = Math.min(this.vw / w, (this.vh - top - bot) / h);
    return { x: ((c0 + c1 + 1) / 2) * T, y: ((r0 + r1 + 1) / 2) * T - (top - bot) / 2 / s, s };
  }
  focus(c: number, r: number, span = 2.25) {
    const top = 70, bot = 210;
    const s = Math.min(2.4, this.vw / (T * span), (this.vh - top - bot) / (T * span));
    return { x: (c + 0.5) * T, y: (r + 0.5) * T - (top - bot) / 2 / s, s };
  }
  screenToCell(sx: number, sy: number) {
    const cm = this.cam.current;
    const wx = cm.x + (sx - this.vw / 2) / cm.s, wy = cm.y + (sy - this.vh / 2) / cm.s;
    return { c: Math.floor(wx / T), r: Math.floor(wy / T), fx: wx / T - Math.floor(wx / T), fy: wy / T - Math.floor(wy / T) };
  }

  // ---------- flow ----------
  restart() {
    world.reset();
    const cells: Record<string, Cell> = {};
    for (const t of world.filled) cells[key(t.c, t.r)] = { c: t.c, r: t.r, author: t.author! };
    this.cells = cells;
    this.mode = 'browse'; this.target = null; this.attempts = []; this.pull = null; this.after = null;
    this.stitches = []; this.credits = START_CREDITS;
    this.cam.set(this.overview(), { duration: 0 });
  }

  /** a close, friendly first view: the middle of the picture, edges big enough to feel */
  overview() {
    const cs = this.list.map((t) => t.c), rs = this.list.map((t) => t.r);
    const cx = (Math.min(...cs) + Math.max(...cs) + 1) / 2, cy = (Math.min(...rs) + Math.max(...rs) + 1) / 2;
    const s = Math.min(this.vw / (T * 5.2), (this.vh - 200) / (T * 6));
    return { x: cx * T, y: (cy - 0.6) * T, s };
  }

  setVariant(v: Variant) {
    this.variant = v;
    try { const u = new URL(location.href); u.searchParams.set('v', v); history.replaceState(null, '', u); } catch {}
    this.restart();
  }

  spend(n: number) {
    if (this.credits < n) { this.toast('Out of credits. (mock) Top up to keep going'); return false; }
    this.credits -= n;
    const id = Math.random();
    this.spent = [...this.spent, { id, n }];
    setTimeout(() => (this.spent = this.spent.filter((x) => x.id !== id)), 1200);
    return true;
  }

  /** nearest filled side to a point inside the cell (fx, fy in 0..1) */
  nearestSide(c: number, r: number, fx: number, fy: number): Side {
    const sides = this.sidesOf(c, r);
    const d: Record<Side, number> = { l: fx, r: 1 - fx, t: fy, b: 1 - fy };
    return sides.sort((a, b) => d[a] - d[b])[0] ?? 'l';
  }

  /** open a cell: spend a credit, "generate", show attempts in place */
  open(c: number, r: number, opts: { side?: Side; instant?: boolean } = {}) {
    if (!this.spend(1)) return;
    this.after = null;
    this.target = { c, r };
    this.round = 0;
    this.attempts = attemptsFor(c, r, 0);
    this.idx = 0; this.prevIdx = -1; this.dragX = 0; this.flung = null;
    this.growSide = opts.side ?? this.sidesOf(c, r)[0] ?? 'l';
    this.cam.set(this.focus(c, r), { duration: 800, easing: cubicInOut });
    if (opts.instant) { this.mode = 'choose'; this.growKey++; return; }
    this.mode = 'generating';
    setTimeout(() => { if (this.mode === 'generating') { this.mode = 'choose'; this.growKey++; } }, this.variant === 'grow' ? 350 : 900);
  }

  more() {
    if (!this.target || !this.spend(1)) return;
    this.round++;
    this.attempts = attemptsFor(this.target.c, this.target.r, this.round);
    this.idx = 0; this.prevIdx = -1; this.dragX = 0; this.flung = null;
    this.mode = 'generating';
    setTimeout(() => { if (this.mode === 'generating') { this.mode = 'choose'; this.growKey++; } }, 700);
  }

  go(d: number) {
    const n = this.attempts.length;
    this.prevIdx = this.idx;
    if (this.variant === 'pull' && d !== 0) {
      this.flung = { id: Math.random(), a: this.attempts[this.idx], dir: d };
      this.idx = (this.idx + 1) % n;
    } else if (this.variant === 'breathe') {
      this.idx = Math.max(0, Math.min(n - 1, this.idx + d));
    } else {
      this.idx = (this.idx + d + n) % n;
    }
    this.growKey++;
  }

  cancel() {
    this.mode = 'browse'; this.target = null; this.pull = null;
    this.cam.set(this.fitAll(), { duration: 900, easing: cubicInOut });
  }

  stitch() {
    const t = this.target, a = this.current;
    if (!t || !a) return;
    const before = new Set(this.frontier.map((f) => f.k));
    const sides = this.sidesOf(t.c, t.r);
    this.cells[key(t.c, t.r)] = { c: t.c, r: t.r, author: { name: 'You', color: '#ff6b4a' }, obj: a.obj, fx: a.fx, mine: true, fresh: Date.now() };
    this.stitches = [...this.stitches, { id: Math.random(), c: t.c, r: t.r, sides, mine: true, at: Date.now() }];
    this.mode = 'stitching';
    this.pull = null;
    try { navigator.vibrate?.([12, 40, 12, 40, 24]); } catch {}
    const opened = this.frontier.filter((f) => !before.has(f.k)).map(({ c, r }) => ({ c, r }));
    setTimeout(() => {
      this.mode = 'browse'; this.target = null;
      this.after = { opened, at: Date.now() };
      this.cam.set(this.focus(t.c, t.r, 3.4), { duration: 1100, easing: cubicOut });
    }, 1500);
  }

  keepGoing() {
    const next = this.after?.opened[0] ?? this.frontier[0];
    this.after = null;
    if (next) this.open(next.c, next.r);
  }

  tapAt(sx: number, sy: number) {
    const { c, r, fx, fy } = this.screenToCell(sx, sy);
    const k = key(c, r);
    if (this.mode === 'choose') {
      if (k === this.targetKey) {
        if (this.variant === 'grow') { const s = this.nearestSide(c, r, fx, fy); if (s !== this.growSide) { this.prevIdx = this.idx; this.growSide = s; this.growKey++; } else this.go(1); }
        else if (this.variant === 'dream') this.go(1);
      }
      return;
    }
    if (this.mode !== 'browse') return;
    const f = this.frontier.find((x) => x.k === k);
    if (f) {
      if (this.variant === 'pull') { this.autoPull(c, r, this.nearestSide(c, r, fx, fy)); return; }
      this.open(c, r, { side: this.nearestSide(c, r, fx, fy) });
      return;
    }
    const t = this.cells[k];
    if (t) this.toast(t.mine ? 'Your tile' : `${t.author.name}`, t.author.color);
  }

  // ---------- pull variant ----------
  startPull(c: number, r: number, side: Side) { this.after = null; this.pull = { c, r, side, p: 0, live: true }; }
  endPull() {
    const p = this.pull;
    if (!p) return;
    if (p.p > 0.33) this.finishPull();
    else { p.live = false; p.p = 0; setTimeout(() => { if (this.pull && !this.pull.live && this.pull.p === 0) this.pull = null; }, 350); }
  }
  autoPull(c: number, r: number, side: Side) {
    this.pull = { c, r, side, p: 0.18, live: false };
    setTimeout(() => this.finishPull(), 220);
  }
  finishPull() {
    const p = this.pull;
    if (!p) return;
    if (this.credits < 1) { this.pull = null; this.spend(1); return; }
    p.live = false; p.p = 1;
    this.open(p.c, p.r, { side: p.side, instant: true });
  }

  // ---------- other artists ----------
  simulateOther() {
    const f = this.frontier.filter((x) => x.k !== this.targetKey && !(this.pull && key(this.pull.c, this.pull.r) === x.k));
    if (!f.length) return;
    // prefer cells next to one of mine, so you see people continuing you
    const nearMine = f.filter((x) => DIRS.some(([, dc, dr]) => this.cells[key(x.c + dc, x.r + dr)]?.mine));
    const pool = nearMine.length && Math.random() < 0.7 ? nearMine : f;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const a = attemptsFor(pick.c, pick.r, 9)[Math.floor(Math.random() * 4)];
    const person = randomPerson();
    const continuesMe = DIRS.some(([, dc, dr]) => this.cells[key(pick.c + dc, pick.r + dr)]?.mine);
    this.cells[pick.k] = { c: pick.c, r: pick.r, author: person, obj: a.obj, fx: a.fx, fresh: Date.now() };
    this.stitches = [...this.stitches, { id: Math.random(), c: pick.c, r: pick.r, sides: pick.sides, mine: false, at: Date.now() }];
    this.toast(continuesMe ? `${person.name} just continued your tile ✦` : `${person.name} added ${a.caption}`, person.color);
  }
}

export const edge = new EdgeState();
