import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut, linear } from 'svelte/easing';
import { T } from './art';
import { world, key, randomPerson, type Tile } from './world.svelte';

export type Phase = 'intro' | 'compose' | 'drawing' | 'review' | 'reveal' | 'explore' | 'released';
export type Variant = 1 | 2 | 3;

const LOCK_MS = 5 * 60 * 1000;
export const IDLE_WARN_MS = 45 * 1000;
export const IDLE_RELEASE_MS = 65 * 1000;

const OBJ_WORDS: [RegExp, number][] = [[/fish|sea|water|swim|whale/i, 0], [/moon|night|sleep|dream/i, 1], [/balloon|fly|sky|bird|air/i, 2], [/house|home|window|light|lamp/i, 3]];

function readVariant(): Variant { return 1; }

// ---------- dark map with lanterns ----------
export const START_SPARKS = 3;
export const BIG_COST = 3;
export const PEEK_MS = 8000;
export const BIG_MS = 10000;
const PEEK_R = 1.95; // light radius in tiles
const BIG_R = 3.3;
export interface Peek { c: number; r: number; x: number; y: number; big: boolean; until: number; sel: string | null; }

class AppState {
  variant = $state<Variant>(readVariant());
  phase = $state<Phase>('intro');
  vw = $state(typeof window !== 'undefined' ? window.innerWidth : 390);
  vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  vvTop = $state(0);
  now = $state(Date.now());
  lockUntil = $state(0);
  lastActive = $state(Date.now());
  prompt = $state('');
  obj = $state(0);
  tries = $state<number[]>([]);
  sheet = $state<null | 'share' | 'info' | 'shop'>(null);
  selected = $state<string | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  img = $state<{ full: string; fog: string } | null>(null);
  lastMine = $state<string | null>(null);
  revealCaption = $state(false);

  sparks = $state(START_SPARKS);
  freePeek = $state(true);
  peek = $state<Peek | null>(null);
  seen = $state<string[]>([]);
  aiming = $state(false);
  hinted = $state(false);
  /** the lantern light: centre (world px) + radius (world px) */
  light = new Tween({ x: 0, y: 0, r: 0 }, { duration: 700, easing: cubicOut });
  darkOn = $state(true);
  private camBefore: { x: number; y: number; s: number } | null = null;

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 3800, easing: linear });

  get mine(): Tile | null { return world.mineKey ? world.tiles[world.mineKey] : null; }
  get fogged() { return false; }
  get lantern() { return this.phase === 'intro'; }
  get masked() { return this.phase === 'compose' || this.phase === 'drawing' || this.phase === 'review'; }
  get gesturesOn() { return this.phase === 'explore' || this.phase === 'intro'; }
  get lockLeft() { return Math.max(0, this.lockUntil - this.now); }
  get idle() { return this.now - this.lastActive; }
  get idleWarn() { return (this.phase === 'compose' || this.phase === 'review') && this.idle > IDLE_WARN_MS; }

  touch = () => { this.lastActive = Date.now(); };

  toast(text: string, color?: string) {
    const id = Math.random();
    this.toasts = [...this.toasts, { id, text, color }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3200);
  }

  /** screen insets around the compose window, per layout variant */
  insets() {
    const { vw, vh, variant, phase } = this;
    const side = vw < 500 ? 14 : 40;
    if (phase === 'intro') return { t: 96, b: 270, l: side, r: side };
    if (variant === 2) return { t: 70, b: Math.max(300, vh * 0.46), l: side, r: side };
    if (variant === 3) return { t: 96, b: phase === 'review' ? 150 : 132, l: side + 26, r: side + 26 };
    return { t: 74, b: phase === 'review' ? 150 : 178, l: side, r: side };
  }

  composeTarget(t: Tile) {
    const i = this.insets();
    const w = this.vw - i.l - i.r, h = this.vh - i.t - i.b;
    const s = Math.min(2.4, Math.min(w, h) / (T * 1.3));
    const cx = (t.c + 0.5) * T, cy = (t.r + 0.5) * T;
    return { x: cx - (i.l + w / 2 - this.vw / 2) / s, y: cy - (i.t + h / 2 - this.vh / 2) / s, s };
  }

  fitAll(pad = 0.6, bottomInset = 0) {
    const b = world.bounds();
    const w = (b.c1 - b.c0 + 1 + pad * 2) * T, h = (b.r1 - b.r0 + 1 + pad * 2) * T;
    const availH = this.vh - bottomInset - 60;
    const s = Math.min(this.vw / w, availH / h);
    const cx = ((b.c0 + b.c1 + 1) / 2) * T, cy = ((b.r0 + b.r1 + 1) / 2) * T;
    return { x: cx, y: cy - (60 - bottomInset) / 2 / s, s };
  }

  screenToTile(sx: number, sy: number) {
    const c = this.cam.current;
    const wx = c.x + (sx - this.vw / 2) / c.s, wy = c.y + (sy - this.vh / 2) / c.s;
    return { c: Math.floor(wx / T), r: Math.floor(wy / T) };
  }

  // ---------- flow ----------
  restart() {
    world.reset();
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null; this.lastMine = null; this.revealCaption = false;
    this.progress.set(0, { duration: 0 });
    this.phase = 'intro';
    this.sparks = START_SPARKS; this.freePeek = true; this.peek = null; this.seen = []; this.aiming = false; this.hinted = false;
    this.darkOn = true;
    this.light.set({ x: 0, y: 0, r: 0 }, { duration: 0 });
    this.camBefore = null;
    this.cam.set(this.fitAll(0.9, 150), { duration: 0 });
  }

  /** back to the dark map (keeps the world as it is) */
  toDark() {
    this.sheet = null; this.selected = null; this.revealCaption = false; this.peek = null; this.aiming = false; this.camBefore = null;
    this.light.set({ x: 0, y: 0, r: 0 }, { duration: 0 });
    this.darkOn = true;
    this.phase = 'intro';
    this.cam.set(this.fitAll(0.9, 150), { duration: 900, easing: cubicInOut });
  }

  // ---------- lanterns ----------
  peekCost(big = false) { return big ? BIG_COST : this.freePeek ? 0 : 1; }

  private pay(cost: number) {
    if (cost === 0) { this.freePeek = false; return true; }
    if (this.sparks < cost) { this.sheet = 'shop'; return false; }
    this.sparks -= cost;
    return true;
  }

  private framePeek(cx: number, cy: number, tiles: number) {
    const i = this.insets();
    const w = this.vw - i.l - i.r, h = this.vh - i.t - i.b;
    const s = Math.min(2.2, Math.min(w / (T * tiles), h / (T * tiles)));
    return { x: cx - (i.l + w / 2 - this.vw / 2) / s, y: cy - (i.t + h / 2 - this.vh / 2) / s, s };
  }

  /** tap a light: its neighbours are lit for a few seconds */
  startPeek(k: string, free = false) {
    const t = world.tiles[k];
    if (!t || t.status !== 'open') return;
    if (this.peek && !this.peek.big && key(this.peek.c, this.peek.r) === k) return;
    if (!free && !this.pay(this.peekCost())) return;
    this.hinted = true;
    if (!this.peek) this.camBefore = { ...this.cam.current };
    const x = (t.c + 0.5) * T, y = (t.r + 0.5) * T;
    const fromDark = !this.peek;
    this.peek = { c: t.c, r: t.r, x, y, big: false, until: Date.now() + PEEK_MS, sel: k };
    if (!this.seen.includes(k)) this.seen = [...this.seen, k];
    if (fromDark) this.light.set({ x, y, r: 0 }, { duration: 0 });
    this.light.set({ x, y, r: PEEK_R * T }, { duration: fromDark ? 900 : 600, easing: cubicOut });
    this.cam.set(this.framePeek(x, y, 3.3), { duration: 800, easing: cubicInOut });
  }

  armBig() {
    if (this.sparks < BIG_COST) { this.sheet = 'shop'; return; }
    this.closePeek(false);
    this.aiming = true;
  }

  /** the big lantern lights a wide area around any point */
  startBig(wx: number, wy: number) {
    this.aiming = false;
    if (!this.pay(BIG_COST)) return;
    this.hinted = true;
    if (!this.camBefore) this.camBefore = { ...this.cam.current };
    this.peek = { c: Math.floor(wx / T), r: Math.floor(wy / T), x: wx, y: wy, big: true, until: Date.now() + BIG_MS, sel: null };
    this.light.set({ x: wx, y: wy, r: 0 }, { duration: 0 });
    this.light.set({ x: wx, y: wy, r: BIG_R * T }, { duration: 1300, easing: cubicOut });
    for (const t of world.list) if (t.status === 'open' && Math.hypot((t.c + 0.5) * T - wx, (t.r + 0.5) * T - wy) < BIG_R * T * 0.8) { const k = key(t.c, t.r); if (!this.seen.includes(k)) this.seen = [...this.seen, k]; }
    this.cam.set(this.framePeek(wx, wy, 6), { duration: 900, easing: cubicInOut });
  }

  closePeek(restoreCam = true) {
    if (!this.peek) return;
    const { x, y } = this.light.current;
    this.peek = null;
    this.light.set({ x, y, r: 0 }, { duration: 900, easing: cubicInOut });
    if (restoreCam && this.camBefore) this.cam.set(this.camBefore, { duration: 900, easing: cubicInOut });
    this.camBefore = null;
  }

  tickPeek() {
    if (this.peek && this.phase === 'intro' && Date.now() > this.peek.until) this.closePeek();
  }

  lit(c: number, r: number) {
    const p = this.peek; if (!p) return false;
    return Math.hypot((c + 0.5) * T - p.x, (r + 0.5) * T - p.y) < (p.big ? BIG_R : PEEK_R) * T * 0.8;
  }

  buy(n: number) { this.sparks += n; this.sheet = null; this.toast(`+${n} sparks (pretend purchase)`, '#ffc46b'); }

  surprise() {
    this.sheet = null;
    this.closePeek(false);
    this.startCompose();
  }

  setVariant(v: Variant) {
    this.variant = v;
    try { const u = new URL(location.href); u.searchParams.set('v', String(v)); history.replaceState(null, '', u); } catch {}
    this.restart();
  }

  startCompose(prefer?: string) {
    this.aiming = false; this.peek = null; this.camBefore = null;
    if (!this.mine || (prefer && prefer !== world.mineKey)) { world.release(); world.assign(prefer); }
    const t = this.mine;
    if (!t) { this.toast('No free tiles right now. Try again in a minute.'); return; }
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null;
    this.lockUntil = Date.now() + LOCK_MS; this.touch();
    this.phase = 'compose';
    this.darkOn = true;
    const cx = (t.c + 0.5) * T, cy = (t.r + 0.5) * T;
    if (this.light.current.r < 1) this.light.set({ x: cx, y: cy, r: 0 }, { duration: 0 });
    this.light.set({ x: cx, y: cy, r: T * 0.9 }, { duration: 1200, easing: cubicInOut });
    this.cam.set(this.composeTarget(t), { duration: 1500, easing: cubicInOut });
  }

  pickObj(p: string) {
    for (const [re, o] of OBJ_WORDS) if (re.test(p) && !this.tries.includes(o)) return o;
    const left = [0, 1, 2, 3].filter((o) => !this.tries.includes(o));
    return left.length ? left[Math.floor(Math.random() * left.length)] : Math.floor(Math.random() * 4);
  }

  async draw() {
    if (!this.prompt.trim()) return;
    this.touch();
    this.obj = this.pickObj(this.prompt);
    this.tries = [...this.tries, this.obj];
    this.phase = 'drawing';
    (document.activeElement as HTMLElement | null)?.blur?.();
    await this.progress.set(0, { duration: 0 });
    await this.progress.set(1, { duration: 3600 + Math.random() * 1200 });
    if (this.phase === 'drawing') { this.phase = 'review'; this.touch(); }
  }

  retry() { this.draw(); }
  edit() { this.phase = 'compose'; this.touch(); this.progress.set(0, { duration: 0 }); }
  chooseTry(o: number) { this.obj = o; this.touch(); }

  submit() {
    const k = world.mineKey;
    const t = world.submitMine(this.prompt.trim(), this.obj);
    if (!t) return;
    this.lastMine = k;
    this.sparks += 2;
    this.phase = 'reveal';
    const [mc, mr] = (k ?? '0,0').split(',').map(Number);
    this.light.set({ x: (mc + 0.5) * T, y: (mr + 0.5) * T, r: T * 0.9 }, { duration: 0 });
    setTimeout(() => this.light.set({ x: (mc + 0.5) * T, y: (mr + 0.5) * T, r: T * 34 }, { duration: 3600, easing: cubicInOut }), 300);
    setTimeout(() => { this.revealCaption = true; this.cam.set(this.fitAll(0.5, 260), { duration: 2600, easing: cubicInOut }); }, 500);
    setTimeout(() => { this.sheet = 'share'; }, 3300);
  }

  explore() {
    this.sheet = null; this.revealCaption = false;
    this.phase = 'explore';
    this.darkOn = false;
    this.cam.set(this.fitAll(0.6, 0), { duration: 900, easing: cubicOut });
  }

  release() {
    const t = this.mine;
    world.release();
    if (t) setTimeout(() => { if (t.status === 'open') { t.status = 'locked'; t.author = randomPerson(); t.lockUntil = Date.now() + 240000; } }, 1200);
    this.phase = 'released';
  }

  tapAt(sx: number, sy: number) {
    const { c, r } = this.screenToTile(sx, sy);
    const t = world.tiles[key(c, r)];
    if (this.phase === 'intro') {
      if (this.sheet) { this.sheet = null; return; }
      const cam = this.cam.current;
      const wx = cam.x + (sx - this.vw / 2) / cam.s, wy = cam.y + (sy - this.vh / 2) / cam.s;
      if (this.aiming) { this.startBig(wx, wy); return; }
      // lights are small on a zoomed-out map: snap to the nearest light within reach
      const reach = Math.max(T * 0.6, 34 / cam.s);
      let best: Tile | null = null, bd = Infinity;
      for (const x of world.list) {
        if (x.status === 'filled') continue;
        const d = Math.hypot((x.c + 0.5) * T - wx, (x.r + 0.5) * T - wy);
        if (d < reach && d < bd) { bd = d; best = x; }
      }
      if (best?.status === 'locked') { this.toast(`${best.author?.name} is drawing there right now`, best.author?.color); return; }
      if (best?.status === 'open') {
        const k = key(best.c, best.r);
        if (this.peek && this.lit(best.c, best.r)) { this.peek.sel = k; if (!this.peek.big) this.startPeek(k, true); return; }
        this.startPeek(k);
        return;
      }
      if (this.peek) this.closePeek();
      return;
    }
    if (this.phase !== 'explore') return;
    if (!t) { this.sheet = null; this.selected = null; return; }
    this.selected = key(c, r);
    this.sheet = 'info';
  }

  simulateNeighbour() {
    const t = world.tickOthers();
    if (t) this.toast(`${t.author?.name} just finished a tile`, t.author?.color);
    if (t) setTimeout(() => { t.fresh = false; }, 2500);
  }
}

export const app = new AppState();
