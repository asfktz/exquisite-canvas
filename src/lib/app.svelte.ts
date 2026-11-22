import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut, linear } from 'svelte/easing';
import { T } from './art';
import { world, key, randomPerson, type Tile, type Person } from './world.svelte';

export type Phase = 'intro' | 'hand' | 'compose' | 'drawing' | 'review' | 'reveal' | 'explore' | 'released';
export type Variant = 1 | 2 | 3;

const LOCK_MS = 5 * 60 * 1000;
export const IDLE_WARN_MS = 45 * 1000;
export const IDLE_RELEASE_MS = 65 * 1000;

/** how much of each neighbour you see, on the card and while drawing (fraction of a tile) */
export const PEEK = 0.3;
export const HAND_SIZE = 4;
export const RARE_COST = 2;

export interface Card {
  id: number; key: string; whisper: string; touches: number;
  rare: boolean; unlocked: boolean;
  goneAt?: number; looking?: Person | null;
}
let cardId = 1;

const OBJ_WORDS: [RegExp, number][] = [[/fish|sea|water|swim|whale/i, 0], [/moon|night|sleep|dream/i, 1], [/balloon|fly|sky|bird|air/i, 2], [/house|home|window|light|lamp/i, 3]];

function readVariant(): Variant {
  try { const v = Number(new URLSearchParams(location.search).get('v')); if (v === 2 || v === 3) return v; } catch {}
  return 1;
}

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
  sheet = $state<null | 'share' | 'info' | 'credits'>(null);
  selected = $state<string | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  img = $state<{ full: string; fog: string } | null>(null);
  lastMine = $state<string | null>(null);
  revealCaption = $state(false);

  // ---- card hand ----
  hand = $state<Card[]>([]);
  focus = $state(0);
  credits = $state(5);
  freeShuffles = $state(1);
  hands = 0;
  steals = 0;
  seen = new Set<string>();
  flip = $state<null | { key: string; from: { x: number; y: number; w: number }; to: { x: number; y: number; w: number } }>(null);

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 3800, easing: linear });

  get mine(): Tile | null { return world.mineKey ? world.tiles[world.mineKey] : null; }
  get fogged() { return this.phase === 'intro' || this.phase === 'hand'; }
  get masked() { return this.phase === 'compose' || this.phase === 'drawing' || this.phase === 'review'; }
  get gesturesOn() { return this.phase === 'explore'; }
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
    if (variant === 2) return { t: 70, b: Math.max(300, vh * 0.46), l: side, r: side };
    if (variant === 3) return { t: 96, b: phase === 'review' ? 150 : 132, l: side + 26, r: side + 26 };
    return { t: 74, b: phase === 'review' ? 150 : 178, l: side, r: side };
  }

  composeTarget(t: Tile) {
    const i = this.insets();
    const w = this.vw - i.l - i.r, h = this.vh - i.t - i.b;
    const s = Math.min(2.4, Math.min(w, h) / (T * (1 + 2 * PEEK)));
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
    this.hand = []; this.seen.clear(); this.hands = 0; this.credits = 5; this.freeShuffles = 1; this.flip = null;
    this.phase = 'intro';
    this.cam.set(this.fitAll(0.8, 0), { duration: 0 });
  }

  setVariant(v: Variant) {
    this.variant = v;
    try { const u = new URL(location.href); u.searchParams.set('v', String(v)); history.replaceState(null, '', u); } catch {}
    this.restart();
  }

  /** screen rect of the window (tile + PEEK of each neighbour) once the compose camera has settled */
  windowRect(t: Tile) {
    const cam = this.composeTarget(t);
    return { x: this.vw / 2 + ((t.c - PEEK) * T - cam.x) * cam.s, y: this.vh / 2 + ((t.r - PEEK) * T - cam.y) * cam.s, w: (1 + 2 * PEEK) * T * cam.s };
  }

  makeCard(t: Tile, rare = false): Card {
    // a whisper from one of the neighbours whose edge you can see (sides first, then corners)
    const ok = (x?: Tile) => x?.status === 'filled' && !!x.prompt;
    const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([a, b]) => world.tiles[key(t.c + a, t.r + b)]).filter(ok);
    const corners = [[1, 1], [-1, -1], [1, -1], [-1, 1]].map(([a, b]) => world.tiles[key(t.c + a, t.r + b)]).filter(ok);
    const pool = sides.length ? sides : corners;
    const w = pool[Math.floor(Math.random() * pool.length)]?.prompt ?? 'an empty edge';
    return { id: cardId++, key: key(t.c, t.r), whisper: w, touches: world.filledAround(t.c, t.r), rare, unlocked: false, looking: null };
  }

  /** open tiles you haven't seen yet first, the ones with most drawn neighbours first */
  dealCards(n: number, exclude: Set<string>): Card[] {
    world.refillOpen();
    const open = world.list.filter((t) => t.status === 'open' && !t.mine && !exclude.has(key(t.c, t.r)))
      .map((t) => ({ t, s: (this.seen.has(key(t.c, t.r)) ? -10 : 0) + world.filledAround(t.c, t.r) + Math.random() * 2.5 }))
      .sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.t);
    // shuffle so the "best" spot isn't always first
    for (let i = open.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [open[i], open[j]] = [open[j], open[i]]; }
    const cards = open.map((t) => this.makeCard(t));
    cards.forEach((c) => this.seen.add(c.key));
    return cards;
  }

  dealHand() {
    const cards = this.dealCards(HAND_SIZE, new Set());
    // a rare "golden edge" shows up in the first hand, then now and then
    if (cards.length > 2 && (this.hands === 0 || Math.random() < 0.4)) cards[this.hands === 0 ? 2 : Math.floor(Math.random() * cards.length)].rare = true;
    this.hands++; this.steals = 0;
    this.hand = cards; this.focus = 0;
  }

  openHand() {
    world.release();
    this.sheet = null; this.selected = null; this.flip = null;
    this.prompt = ''; this.tries = [];
    if (!this.hand.length || this.hand.every((c) => c.goneAt)) this.dealHand();
    this.phase = 'hand';
    this.cam.set(this.fitAll(0.8, 0), { duration: 900 });
  }

  reshuffleCost() { return this.freeShuffles > 0 ? 0 : 1; }

  reshuffle() {
    if (this.freeShuffles > 0) this.freeShuffles--;
    else if (this.credits >= 1) this.credits--;
    else { this.sheet = 'credits'; return false; }
    const before = this.hand.map((c) => c.key);
    this.dealHand();
    if (!this.hand.length) { this.toast('No open spots right now. Try again in a minute.'); this.hand = before.map((k) => this.makeCard(world.tiles[k])); }
    return true;
  }

  /** called from the clock: cards someone else grabbed fade out and get replaced */
  handTick() {
    const now = Date.now();
    for (let i = this.hand.length - 1; i >= 0; i--) {
      const c = this.hand[i];
      const t = world.tiles[c.key];
      const gone = !t || t.status !== 'open';
      if (gone && !c.goneAt) c.goneAt = now;
      if (c.goneAt && now - c.goneAt > 2600) {
        const rep = this.dealCards(1, new Set(this.hand.map((h) => h.key)))[0];
        if (rep) this.hand[i] = rep; else this.hand.splice(i, 1);
      }
    }
  }

  /** every few seconds: someone glances at your cards, and now and then takes one */
  handPulse() {
    if (this.phase !== 'hand') return;
    this.hand.forEach((c, i) => { c.looking = !c.goneAt && Math.random() < (i === this.focus ? 0.55 : 0.25) ? randomPerson() : null; });
    if (this.steals >= 2 || Math.random() < 0.35) return;
    const cand = this.hand.filter((c, i) => i !== this.focus && !c.goneAt && !c.rare);
    const c = cand[Math.floor(Math.random() * cand.length)];
    const t = c && world.tiles[c.key];
    if (!t || t.status !== 'open') return;
    t.status = 'locked'; t.author = c.looking ?? randomPerson(); t.lockUntil = Date.now() + 200000;
    this.steals++;
  }

  pickCard(i: number, from?: { x: number; y: number; w: number }) {
    const c = this.hand[i];
    if (!c || c.goneAt) return;
    if (c.rare && !c.unlocked) {
      if (this.credits < RARE_COST) { this.sheet = 'credits'; return; }
      this.credits -= RARE_COST; c.unlocked = true;
      this.toast('Golden edge unlocked ✦', '#ffd166');
      return;
    }
    const t = world.tiles[c.key];
    if (!t) return;
    this.startCompose(c.key, true);
    if (from && this.mine) this.flip = { key: c.key, from, to: this.windowRect(this.mine) };
  }

  backToHand() {
    this.openHand();
  }

  startCompose(prefer?: string, instant = false) {
    if (!this.mine || (prefer && prefer !== world.mineKey)) { world.release(); world.assign(prefer); }
    const t = this.mine;
    if (!t) { this.toast('No free tiles right now. Try again in a minute.'); return; }
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null;
    this.lockUntil = Date.now() + LOCK_MS; this.touch();
    this.phase = 'compose';
    this.cam.set(this.composeTarget(t), { duration: instant ? 0 : 1500, easing: cubicInOut });
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
    this.credits += 1;
    this.hand = [];
    this.phase = 'reveal';
    setTimeout(() => { this.revealCaption = true; this.cam.set(this.fitAll(0.5, 260), { duration: 2600, easing: cubicInOut }); }, 500);
    setTimeout(() => { this.sheet = 'share'; }, 3300);
  }

  explore() {
    this.sheet = null; this.revealCaption = false;
    this.phase = 'explore';
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
