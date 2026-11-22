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
  sheet = $state<null | 'share' | 'info'>(null);
  selected = $state<string | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  img = $state<{ full: string; fog: string } | null>(null);
  lastMine = $state<string | null>(null);
  revealCaption = $state(false);

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 3800, easing: linear });

  get mine(): Tile | null { return world.mineKey ? world.tiles[world.mineKey] : null; }
  get fogged() { return this.phase === 'intro'; }
  get masked() { return this.phase === 'compose' || this.phase === 'drawing' || this.phase === 'review'; }
  get gesturesOn() { return this.phase === 'explore' || (this.phase === 'intro' && this.variant === 3); }
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
    if (this.variant === 3) world.assign();
    this.cam.set(this.fitAll(0.8, this.variant === 3 ? 170 : 0), { duration: 0 });
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
    if (this.phase === 'intro' && this.variant === 3) {
      if (t && t.mine) this.startCompose(key(c, r));
      else if (t?.status === 'open') { world.release(); world.assign(key(c, r)); this.toast('Picked that tile instead'); }
      else if (t?.status === 'locked') this.toast(`${t.author?.name} is drawing there`);
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
