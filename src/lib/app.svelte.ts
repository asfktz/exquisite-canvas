import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut, linear } from 'svelte/easing';
import { T } from './art';
import { world, key, randomPerson, ZS, type Tile, type Zone } from './world.svelte';

export type Phase = 'intro' | 'compose' | 'drawing' | 'review' | 'reveal' | 'explore' | 'released';
export type Variant = 1 | 2 | 3;

const LOCK_MS = 5 * 60 * 1000;
export const IDLE_WARN_MS = 45 * 1000;
export const IDLE_RELEASE_MS = 65 * 1000;

const OBJ_WORDS: [RegExp, number][] = [[/fish|sea|water|swim|whale/i, 0], [/moon|night|sleep|dream/i, 1], [/balloon|fly|sky|bird|air/i, 2], [/house|home|window|light|lamp/i, 3]];

// This branch (variant C, "zone reveal") uses the immersive layout only.
function readVariant(): Variant { return 1; }

export const START_CREDITS = 3;
export const ZONE_BONUS = 2;

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
  sheet = $state<null | 'share' | 'info' | 'buy'>(null);
  credits = $state(START_CREDITS);
  /** zone reveal animation in progress: tiles that were hidden flip open */
  unveil = $state<{ zone: number; keys: string[]; byMe: boolean } | null>(null);
  completedByMe = $state(false);
  private afterBuy: (() => void) | null = null;
  selected = $state<string | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  img = $state<{ full: string; fog: string } | null>(null);
  lastMine = $state<string | null>(null);
  revealCaption = $state(false);

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 3800, easing: linear });

  get mine(): Tile | null { return world.mineKey ? world.tiles[world.mineKey] : null; }
  get fogged() { return false; }
  get masked() { return this.phase === 'compose' || this.phase === 'drawing' || this.phase === 'review'; }
  get gesturesOn() { return this.phase === 'explore' || this.phase === 'compose' || this.phase === 'review'; }
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
    // frame the whole 3x3 around your tile: all 8 neighbours are fully visible
    const s = Math.min(1.2, Math.min(w, h) / (T * 3.1));
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

  fitRect(c0: number, r0: number, c1: number, r1: number, topInset = 110, bottomInset = 0, pad = 0.25) {
    const w = (c1 - c0 + 1 + pad * 2) * T, h = (r1 - r0 + 1 + pad * 2) * T;
    const availH = this.vh - topInset - bottomInset;
    const s = Math.min(this.vw / w, availH / h);
    const cx = ((c0 + c1 + 1) / 2) * T, cy = ((r0 + r1 + 1) / 2) * T;
    return { x: cx, y: cy - (topInset - bottomInset) / 2 / s, s };
  }
  fitZone(z: Zone, bottomInset = 0) { return this.fitRect(z.c0, z.r0, z.c0 + ZS - 1, z.r0 + ZS - 1, 110, bottomInset, 0.35); }

  screenToTile(sx: number, sy: number) {
    const c = this.cam.current;
    const wx = c.x + (sx - this.vw / 2) / c.s, wy = c.y + (sy - this.vh / 2) / c.s;
    return { c: Math.floor(wx / T), r: Math.floor(wy / T) };
  }

  // ---------- flow ----------
  restart() {
    world.reset();
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null; this.lastMine = null; this.revealCaption = false;
    this.credits = START_CREDITS; this.unveil = null; this.completedByMe = false;
    this.progress.set(0, { duration: 0 });
    this.phase = 'intro';
    if (this.variant === 3) world.assign();
    this.cam.set(this.fitAll(0.3, 300), { duration: 0 });
  }

  setVariant(v: Variant) {
    this.variant = v;
    try { const u = new URL(location.href); u.searchParams.set('v', String(v)); history.replaceState(null, '', u); } catch {}
    this.restart();
  }

  startCompose(prefer?: string) {
    if (!this.mine || (prefer && prefer !== world.mineKey)) { world.release(); world.assign(prefer); }
    const t = this.mine;
    if (!t) { this.toast('No free tiles right now. Try again in a minute.'); return; }
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null;
    this.lockUntil = Date.now() + LOCK_MS; this.touch();
    this.phase = 'compose';
    this.cam.set(this.composeTarget(t), { duration: 1500, easing: cubicInOut });
  }

  pickObj(p: string) {
    for (const [re, o] of OBJ_WORDS) if (re.test(p) && !this.tries.includes(o)) return o;
    const left = [0, 1, 2, 3].filter((o) => !this.tries.includes(o));
    return left.length ? left[Math.floor(Math.random() * left.length)] : Math.floor(Math.random() * 4);
  }

  /** run `fn` if there is a credit to spend, otherwise open the shop and run it after a purchase */
  spend(fn: () => void) {
    if (this.credits < 1) { this.afterBuy = fn; this.sheet = 'buy'; return; }
    this.credits--;
    fn();
  }
  buy(n: number) {
    this.credits += n;
    this.sheet = null;
    this.toast(`+${n} credits`, '#ffd166');
    const f = this.afterBuy; this.afterBuy = null;
    if (f) setTimeout(() => this.spend(f), 300);
  }
  closeBuy() { this.sheet = null; this.afterBuy = null; }

  draw() {
    if (!this.prompt.trim()) return;
    this.spend(() => this.runDraw());
  }

  private async runDraw() {
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

  /** keys of the active zone the visitor can't see yet (snapshot before a change that may complete it) */
  private hiddenInActive() {
    const z = world.active;
    return z ? world.zoneTiles(z).filter((t) => !world.visible(t.c, t.r)).map((t) => key(t.c, t.r)) : [];
  }

  submit() {
    const k = world.mineKey;
    const zone = k ? world.zoneOf(...(k.split(',').map(Number) as [number, number])) : null;
    const hidden = this.hiddenInActive();
    const res = world.submitMine(this.prompt.trim(), this.obj);
    if (!res) return;
    this.lastMine = k;
    this.phase = 'reveal';
    this.completedByMe = !!res.completed;
    if (res.completed) {
      // you placed the last tile: the zone opens for everyone
      setTimeout(() => this.zoneRevealed(res.completed!, hidden, true), 700);
      setTimeout(() => { this.sheet = 'share'; }, 5200);
      return;
    }
    setTimeout(() => { this.revealCaption = true; if (zone) this.cam.set(this.fitZone(zone, 330), { duration: 2200, easing: cubicInOut }); }, 500);
    setTimeout(() => { this.sheet = 'share'; }, 2600);
  }

  /** shared reveal moment: every hidden tile of the zone flips open */
  zoneRevealed(z: Zone, hidden: string[], byMe: boolean) {
    const contributed = world.myKeys.some((k) => world.zoneOf(...(k.split(',').map(Number) as [number, number])) === z);
    this.unveil = { zone: z.i, keys: hidden, byMe };
    this.revealCaption = true;
    if (this.phase === 'explore' || this.phase === 'reveal') this.cam.set(this.fitZone(z, byMe ? 0 : 120), { duration: 1400, easing: cubicInOut });
    if (contributed) setTimeout(() => { this.credits += ZONE_BONUS; this.toast(`+${ZONE_BONUS} credits for helping reveal ${z.name}`, '#ffd166'); }, 2600);
    setTimeout(() => { if (this.unveil?.zone === z.i) this.unveil = null; }, 4600);
  }

  explore() {
    this.sheet = null; this.revealCaption = false; this.completedByMe = false;
    this.phase = 'explore';
    const z = world.active;
    this.cam.set(z ? this.fitRect(z.c0 - 1, z.r0 - 1, z.c0 + ZS, z.r0 + ZS, 110, 90, 0) : this.fitAll(0.3, 90), { duration: 900, easing: cubicOut });
  }

  drawAnother() {
    this.sheet = null; this.revealCaption = false; this.completedByMe = false;
    this.startCompose();
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
    const z = world.zoneOf(c, r);
    if (z?.state === 'sealed') {
      const a = world.active;
      this.toast(a && world.nextSealed === z ? `Opens once ${a.name} is revealed` : 'Opens later');
      this.sheet = null; this.selected = null; return;
    }
    if (!t) { this.sheet = null; this.selected = null; return; }
    this.selected = key(c, r);
    this.sheet = 'info';
  }

  simulateNeighbour() {
    const hidden = this.hiddenInActive();
    const { tile: t, completed } = world.tickOthers();
    if (t && !completed) {
      const z = world.zoneOf(t.c, t.r);
      this.toast(`${t.author?.name} added a tile · ${world.zoneFilled(z!)}/${ZS * ZS}`, t.author?.color);
    }
    if (completed) this.zoneRevealed(completed, hidden, false);
  }

  /** prototype helper: other artists finish everything but your tile */
  fastForward() {
    for (let i = 0; i < 60; i++) {
      const z = world.active;
      if (!z) return;
      const left = world.zoneTiles(z).filter((t) => t.status !== 'filled' && !t.mine).length;
      if (left <= 1) {
        if (left === 1) {
          if (!world.list.some((t) => t.status === 'locked')) world.tickOthers();
          this.simulateNeighbour();
        }
        return;
      }
      world.tickOthers();
    }
  }

}

export const app = new AppState();
