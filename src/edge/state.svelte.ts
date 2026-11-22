import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut, linear, elasticOut } from 'svelte/easing';
import { T, W, H, C0, C1, R0, R1 } from '../lib/art';
import { ideasFor, customIdea, jitter, hash, type Idea, type Side } from './ideas';

export type Variant = 'whisper' | 'dream' | 'pull' | 'bloom';
export const VARIANTS: { id: Variant; name: string; hint: string }[] = [
  { id: 'whisper', name: 'Whisper', hint: 'Open edges whisper ideas. Tap one.' },
  { id: 'dream', name: 'Dream', hint: 'Empty spots are dreaming. Catch a dream.' },
  { id: 'pull', name: 'Pull', hint: 'Grab a glowing seam and pull it out.' },
  { id: 'bloom', name: 'Bloom', hint: 'Tap an open edge. Four takes bloom there.' },
];
export const SIDES: Record<Side, [number, number]> = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
export interface Person { name: string; color: string }
export interface Cell { c: number; r: number; author: Person; prompt: string; obj: number; tint: number; jit?: Idea['jit']; fresh?: boolean; mine?: boolean }
export type Phase = 'intro' | 'map' | 'focus' | 'painting' | 'stitching';
export interface Spot { c: number; r: number; k: string; sides: Side[] }

export const key = (c: number, r: number) => `${c},${r}`;
const inBounds = (c: number, r: number) => c >= C0 && c <= C1 && r >= R0 && r <= R1;

const NAMES = ['Noa', 'Itai', 'Maya', 'Lior', 'Yuval', 'Tamar', 'Omer', 'Shira', 'Ari', 'Dana', 'Ben', 'Gal', 'Roni', 'Eden', 'Yoav', 'Michal', 'Nir', 'Hila'];
const COLORS = ['#ff6b4a', '#7fe0c0', '#ffd166', '#c3a6ff', '#ff8fa3', '#4aa3df', '#f4a261'];
const PROMPTS = [
  'a moon caught in fishing nets', 'violet mountains that breathe slowly', 'an eye that watches the tide',
  'a ladder for climbing out of dreams', 'clouds made of pink cotton and static', 'a tiny island with a lonely tree',
  'a road that forgets where it goes', 'lollipop forest at golden hour', 'a clock melting over a sleepy hill',
  'boats sailing toward the second sun', 'a door standing alone in a wheat field', 'stars leaking from the sky',
  'roots hanging from a floating rock', 'the sea remembering it was a sky', 'snow on mountains made of velvet',
  'a field ploughed by giant snails', 'sunset that tastes like apricot', 'a staircase of fog',
];
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
const pick = <X>(a: X[], i: number) => a[((i % a.length) + a.length) % a.length];
let pi = 0;
const person = (): Person => ({ name: pick(NAMES, pi * 7 + 3), color: pick(COLORS, pi++) });

function readVariant(): Variant {
  try { const v = new URLSearchParams(location.search).get('v'); if (VARIANTS.some((x) => x.id === v)) return v as Variant; } catch {}
  return 'whisper';
}

export const ME: Person = { name: 'You', color: '#ff6b4a' };
export const START_CREDITS = 6;

class Edge {
  variant = $state<Variant>(readVariant());
  cells = $state<Record<string, Cell>>({});
  vw = $state(typeof window !== 'undefined' ? window.innerWidth : 390);
  vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  img = $state<string | null>(null);
  beat = $state(0);
  credits = $state(START_CREDITS);
  creditFx = $state(0);
  phase = $state<Phase>('intro');
  focus = $state<string | null>(null);
  idea = $state<Idea | null>(null);
  text = $state('');
  takes = $state<Idea[]>([]);
  pending = $state<Idea | null>(null);
  pick = $state(0);
  panelH = $state(260);
  visitors = $state<Record<string, Person>>({});
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  pull = $state<{ k: string; side: Side } | null>(null);
  pullAmt = new Tween(0, { duration: 0 });
  outOfInk = $state(false);

  cam = new Tween({ x: 0, y: 0, s: 0.2 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 2600, easing: linear });
  private mapCam: { x: number; y: number; s: number } | null = null;

  constructor() { this.seed(); }

  seed() {
    const t: Record<string, Cell> = {};
    let i = 0;
    SHAPE.forEach((row, ri) => [...row].forEach((ch, ci) => {
      if (ch !== '#') return;
      const c = C0 + ci, r = R0 + ri;
      t[key(c, r)] = { c, r, author: { name: pick(NAMES, i * 5), color: pick(COLORS, i) }, prompt: pick(PROMPTS, i * 3), obj: -1, tint: 0 };
      i++;
    }));
    this.cells = t;
  }

  get filled() { return Object.values(this.cells); }
  get spots(): Spot[] {
    const out: Spot[] = [];
    const seen = new Set<string>();
    for (const t of this.filled) for (const [dc, dr] of Object.values(SIDES)) {
      const c = t.c + dc, r = t.r + dr, k = key(c, r);
      if (!inBounds(c, r) || this.cells[k] || seen.has(k)) continue;
      seen.add(k);
      out.push({ c, r, k, sides: this.sidesOf(c, r) });
    }
    return out;
  }
  sidesOf(c: number, r: number): Side[] {
    const s = (Object.keys(SIDES) as Side[]).filter((sd) => this.cells[key(c + SIDES[sd][0], r + SIDES[sd][1])]);
    // rotate so each spot "leans" toward a different neighbour
    const h = hash(key(c, r)) % Math.max(1, s.length);
    return [...s.slice(h), ...s.slice(0, h)];
  }
  ideas(c: number, r: number): Idea[] {
    const sides = this.sidesOf(c, r);
    let np: { side: Side; prompt: string; name: string } | undefined;
    for (const sd of sides) {
      const n = this.cells[key(c + SIDES[sd][0], r + SIDES[sd][1])];
      if (n?.mine) { np = { side: sd, prompt: n.prompt, name: n.author.name }; break; }
    }
    if (!np && sides.length && hash(key(c, r)) % 3 === 0) {
      const sd = sides[0], n = this.cells[key(c + SIDES[sd][0], r + SIDES[sd][1])];
      np = { side: sd, prompt: n.prompt, name: n.author.name };
    }
    return ideasFor(c, r, sides, np);
  }
  neighbours(c: number, r: number) {
    return this.sidesOf(c, r).map((sd) => this.cells[key(c + SIDES[sd][0], r + SIDES[sd][1])]);
  }
  get focusSpot() { if (!this.focus) return null; const [c, r] = this.focus.split(',').map(Number); return { c, r }; }

  toast(text: string, color?: string) {
    const id = Math.random();
    this.toasts = [...this.toasts, { id, text, color }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3000);
  }

  // ---------- camera ----------
  bounds() {
    const xs = this.spots.map((s) => s.c).concat(this.filled.map((t) => t.c));
    const ys = this.spots.map((s) => s.r).concat(this.filled.map((t) => t.r));
    return { c0: Math.min(...xs), c1: Math.max(...xs), r0: Math.min(...ys), r1: Math.max(...ys) };
  }
  overview() {
    const b = this.bounds();
    const w = (b.c1 - b.c0 + 1.4) * T, h = (b.r1 - b.r0 + 1.4) * T;
    const s = Math.min(this.vw / w, (this.vh - 150) / h);
    return { x: ((b.c0 + b.c1 + 1) / 2) * T, y: ((b.r0 + b.r1 + 1) / 2) * T - 20 / s, s };
  }
  mapScale() { return Math.max(this.overview().s, Math.min(0.62, 116 / T)); }
  mapView(c: number, r: number) {
    const s = this.mapScale();
    return { x: (c + 0.5) * T, y: (r + 0.5) * T, s };
  }
  focusTarget(c: number, r: number) {
    const top = 64, bottom = this.panelH + 16;
    const availH = this.vh - top - bottom;
    const tw = Math.max(150, Math.min(this.vw - 56, availH - 24, 440));
    const s = tw / T;
    return { x: (c + 0.5) * T, y: (r + 0.5) * T - (top + availH / 2 - this.vh / 2) / s, s };
  }
  screen(wx: number, wy: number) {
    const c = this.cam.current;
    return { x: this.vw / 2 + (wx - c.x) * c.s, y: this.vh / 2 + (wy - c.y) * c.s };
  }
  screenToTile(sx: number, sy: number) {
    const c = this.cam.current;
    return { c: Math.floor((c.x + (sx - this.vw / 2) / c.s) / T), r: Math.floor((c.y + (sy - this.vh / 2) / c.s) / T) };
  }

  // ---------- flow ----------
  start() {
    this.phase = 'intro';
    this.cam.set(this.overview(), { duration: 0 });
    // glide from the overview to a juicy edge
    const best = [...this.spots].sort((a, b) => b.sides.length - a.sides.length || Math.hypot(a.c - 0.5, a.r) - Math.hypot(b.c - 0.5, b.r))[0];
    setTimeout(() => {
      const nb = best.sides[0] ? SIDES[best.sides[0]] : [0, 0];
      const v = this.mapView(best.c + nb[0] * 0.5, best.r + nb[1] * 0.5);
      this.cam.set(v, { duration: 1900, easing: cubicInOut }).then(() => { if (this.phase === 'intro') this.phase = 'map'; });
    }, 900);
  }

  restart() {
    this.seed(); this.credits = START_CREDITS; this.focus = null; this.takes = []; this.visitors = {}; this.pull = null; this.outOfInk = false;
    this.start();
  }

  setVariant(v: Variant) {
    if (this.phase !== 'map' && this.phase !== 'intro') this.close();
    this.variant = v;
    try { const u = new URL(location.href); u.searchParams.set('v', v); history.replaceState(null, '', u); } catch {}
  }

  dreamIndex(k: string, n: number) { return (this.beat + (hash(k) % 7)) % n; }
  whisperIndex(k: string, n: number) { const [c, r] = k.split(',').map(Number); return (Math.floor((this.beat + (hash(k) % 5)) / 2) + c * 2 + r) % n; }

  open(k: string, idea?: Idea) {
    if (this.phase !== 'map' || this.visitors[k]) return;
    const [c, r] = k.split(',').map(Number);
    this.mapCam = { ...this.cam.current };
    const ideas = this.ideas(c, r);
    this.focus = k; this.idea = idea ?? ideas[0]; this.text = ''; this.takes = []; this.pick = 0; this.outOfInk = false;
    this.phase = 'focus';
    this.cam.set(this.focusTarget(c, r), { duration: 900, easing: cubicInOut });
    if (this.variant === 'bloom') setTimeout(() => this.bloom(), 650);
  }

  close() {
    if (this.phase === 'painting' || this.phase === 'stitching') return;
    this.phase = 'map'; this.focus = null; this.takes = []; this.pull = null; this.pullAmt.set(0, { duration: 0 });
    if (this.mapCam) this.cam.set(this.mapCam, { duration: 800, easing: cubicInOut });
  }

  choose(i: Idea) { this.idea = i; this.text = ''; if (this.takes.length && this.variant !== 'bloom') { this.takes = []; this.pick = 0; } }
  setText(t: string) { this.text = t; if (t.trim()) { this.idea = customIdea(t.trim()); if (this.variant !== 'bloom') this.takes = []; } }

  spend() {
    if (this.credits < 1) { this.outOfInk = true; return false; }
    this.credits--; this.creditFx++;
    return true;
  }
  refill() { this.credits += 5; this.creditFx++; this.outOfInk = false; this.toast('+5 ink (mock top-up)', '#ffd166'); }

  async paint() {
    if (!this.idea || this.phase !== 'focus' || !this.spend()) return;
    const take = jitter(this.idea);
    this.pending = take;
    this.phase = 'painting';
    await this.progress.set(0, { duration: 0 });
    await this.progress.set(1, { duration: 2400 + Math.random() * 600 });
    this.takes = [...this.takes, take];
    this.pick = this.takes.length - 1;
    this.phase = 'focus';
  }

  async bloom() {
    if (!this.focus || this.phase !== 'focus' || !this.spend()) return;
    const [c, r] = this.focus.split(',').map(Number);
    const base = this.text.trim() ? [customIdea(this.text.trim())] : this.ideas(c, r).filter((i) => i.obj >= 0);
    this.takes = [0, 1, 2, 3].map((i) => jitter(base[i % base.length], Math.random()));
    this.pick = -1;
    this.phase = 'painting';
    await this.progress.set(0, { duration: 0 });
    await this.progress.set(1, { duration: 2600 });
    this.phase = 'focus';
  }

  stitch() {
    const k = this.focus, take = this.takes[this.pick];
    if (!k || !take || this.phase !== 'focus') return;
    const [c, r] = k.split(',').map(Number);
    const before = new Set(this.spots.map((s) => s.k));
    this.phase = 'stitching';
    setTimeout(() => {
      this.cells[k] = { c, r, author: ME, prompt: take.text.replace(/^[→←↑↓]\s*/, ''), obj: take.obj, tint: take.tint, jit: take.jit, fresh: true, mine: true };
      const opened = this.spots.filter((s) => !before.has(s.k)).length;
      this.focus = null; this.takes = []; this.phase = 'map';
      this.cam.set(this.mapView(c, r), { duration: 1100, easing: cubicInOut });
      this.toast(opened ? `Stitched in ✦ ${opened} new edge${opened > 1 ? 's' : ''} opened` : 'Stitched in ✦', '#ff6b4a');
      setTimeout(() => { const t = this.cells[k]; if (t) t.fresh = false; }, 1600);
    }, 1500);
  }

  // ---------- pull ----------
  pullStart(k: string, side: Side) { if (this.phase !== 'map') return; this.pull = { k, side }; this.pullAmt.set(0, { duration: 0 }); }
  pullMove(amt: number) { this.pullAmt.set(Math.max(0, Math.min(1.12, amt)), { duration: 0 }); }
  async pullEnd() {
    const p = this.pull; if (!p) return;
    if (this.pullAmt.current > 0.45) {
      await this.pullAmt.set(1, { duration: 220, easing: cubicOut });
      this.open(p.k);
    } else {
      await this.pullAmt.set(0, { duration: 700, easing: elasticOut });
      this.pull = null;
    }
  }

  // ---------- other people ----------
  visit() {
    if (this.phase === 'intro' || this.phase === 'stitching') return;
    const free = this.spots.filter((s) => s.k !== this.focus && s.k !== this.pull?.k && !this.visitors[s.k]);
    const s = free[Math.floor(Math.random() * free.length)];
    if (!s) return;
    const p = person();
    this.visitors[s.k] = p;
    setTimeout(() => {
      if (this.focus === s.k || this.cells[s.k]) { delete this.visitors[s.k]; return; }
      const ideas = this.ideas(s.c, s.r).filter((i) => i.obj >= 0);
      const i = jitter(ideas[Math.floor(Math.random() * ideas.length)]);
      this.cells[s.k] = { c: s.c, r: s.r, author: p, prompt: i.text, obj: i.obj, tint: i.tint, jit: i.jit, fresh: true };
      delete this.visitors[s.k];
      this.toast(`${p.name} added “${i.text}”`, p.color);
      setTimeout(() => { const t = this.cells[s.k]; if (t) t.fresh = false; }, 1600);
    }, 4200);
  }

  tapAt(sx: number, sy: number) {
    const { c, r } = this.screenToTile(sx, sy);
    const k = key(c, r);
    if (this.phase === 'focus') { if (k !== this.focus) this.close(); return; }
    if (this.phase !== 'map') return;
    const spot = this.spots.find((s) => s.k === k);
    if (spot) {
      if (this.visitors[k]) { this.toast(`${this.visitors[k].name} is adding here right now`, this.visitors[k].color); return; }
      const ideas = this.ideas(c, r);
      const idea = this.variant === 'dream' ? ideas[this.dreamIndex(k, ideas.length)] : this.variant === 'whisper' ? ideas[this.whisperIndex(k, ideas.length)] : undefined;
      this.open(k, idea);
      return;
    }
    const t = this.cells[k];
    if (t) this.toast(`${t.author.name}: “${t.prompt}”`, t.author.color);
  }
}

export const app = new Edge();
if (typeof window !== "undefined") (window as any).__edge = app;

export const tileBg = (img: string | null, c: number, r: number) =>
  img ? `background-image:url(${img});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';
