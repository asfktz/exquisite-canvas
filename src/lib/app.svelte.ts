import { Tween } from 'svelte/motion';
import { cubicInOut, cubicOut, linear } from 'svelte/easing';
import { T } from './art';
import { world, key, randomPerson, LAST_SEASON, type Tile } from './world.svelte';

export type Phase = 'intro' | 'compose' | 'drawing' | 'review' | 'reveal' | 'explore' | 'released' | 'season';
export type Variant = 1;

const LOCK_MS = 5 * 60 * 1000;
export const IDLE_WARN_MS = 45 * 1000;
export const IDLE_RELEASE_MS = 65 * 1000;
/** one "week" in the simulation */
export const SEASON_MS = 4 * 60 * 1000;
/** the mockup starts part-way through the week */
const START_LEFT_MS = 2.5 * 60 * 1000;
export const START_CREDITS = 3;
export const SEASON_BONUS = 2;

const OBJ_WORDS: [RegExp, number][] = [[/fish|sea|water|swim|whale/i, 0], [/moon|night|sleep|dream/i, 1], [/balloon|fly|sky|bird|air/i, 2], [/house|home|window|light|lamp/i, 3]];

class AppState {
  variant = $state<Variant>(1);
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

  // seasons + credits
  seasonEndsAt = $state(Date.now() + START_LEFT_MS);
  credits = $state(START_CREDITS);
  spent = $state(0);
  notify = $state(false);
  /** stats captured at the moment a season is revealed */
  recap = $state<null | { season: number; tiles: number; artists: number; mine: number; seen: number; hidden: number }>(null);
  recapStep = $state(0);

  cam = new Tween({ x: 0, y: 0, s: 0.3 }, { duration: 900, easing: cubicInOut });
  progress = new Tween(0, { duration: 3800, easing: linear });

  get mine(): Tile | null { return world.mineKey ? world.tiles[world.mineKey] : null; }
  get masked() { return this.phase === 'compose' || this.phase === 'drawing' || this.phase === 'review'; }
  get gesturesOn() { return this.phase === 'explore' || this.phase === 'intro' || (this.phase === 'season' && this.recapStep >= 2); }
  get lockLeft() { return Math.max(0, this.lockUntil - this.now); }
  get idle() { return this.now - this.lastActive; }
  get idleWarn() { return (this.phase === 'compose' || this.phase === 'review') && this.idle > IDLE_WARN_MS; }
  get seasonLeft() { return Math.max(0, this.seasonEndsAt - this.now); }
  get seasonProgress() { return 1 - this.seasonLeft / SEASON_MS; }
  get seasonOver() { return this.seasonLeft <= 0; }
  get myThisSeason() { return world.seasonFilled.filter((t) => t.byMe).length; }

  touch = () => { this.lastActive = Date.now(); };

  toast(text: string, color?: string) {
    const id = Math.random();
    this.toasts = [...this.toasts, { id, text, color }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3200);
  }

  insets() {
    const { vw, phase } = this;
    const side = vw < 500 ? 14 : 40;
    return { t: 74, b: phase === 'review' ? 150 : 190, l: side, r: side };
  }

  /** frame your tile with its full ring of neighbours */
  composeTarget(t: Tile) {
    const i = this.insets();
    const w = this.vw - i.l - i.r, h = this.vh - i.t - i.b;
    const s = Math.min(1.6, w / (T * 2.35), h / (T * 3.05));
    const cx = (t.c + 0.5) * T, cy = (t.r + 0.5) * T;
    return { x: cx - (i.l + w / 2 - this.vw / 2) / s, y: cy - (i.t + h / 2 - this.vh / 2) / s, s };
  }

  fitBox(b: { c0: number; c1: number; r0: number; r1: number }, pad = 0.4, topInset = 60, bottomInset = 0) {
    const w = (b.c1 - b.c0 + 1 + pad * 2) * T, h = (b.r1 - b.r0 + 1 + pad * 2) * T;
    const availH = this.vh - bottomInset - topInset;
    const s = Math.min(this.vw / w, availH / h);
    const cx = ((b.c0 + b.c1 + 1) / 2) * T, cy = ((b.r0 + b.r1 + 1) / 2) * T;
    return { x: cx, y: cy - (topInset - bottomInset) / 2 / s, s };
  }
  fitAll(pad = 0.3, bottomInset = 0) { return this.fitBox(world.bounds(), pad, 70, bottomInset); }

  screenToTile(sx: number, sy: number) {
    const c = this.cam.current;
    const wx = c.x + (sx - this.vw / 2) / c.s, wy = c.y + (sy - this.vh / 2) / c.s;
    return { c: Math.floor(wx / T), r: Math.floor(wy / T) };
  }

  // ---------- flow ----------
  restart() {
    world.reset();
    this.prompt = ''; this.tries = []; this.sheet = null; this.selected = null; this.lastMine = null; this.revealCaption = false;
    this.credits = START_CREDITS; this.spent = 0; this.notify = false; this.recap = null; this.recapStep = 0;
    this.seasonEndsAt = Date.now() + START_LEFT_MS;
    this.progress.set(0, { duration: 0 });
    this.phase = 'intro';
    this.cam.set(this.fitAll(0.3, 230), { duration: 0 });
  }

  setVariant(_v: Variant) { this.restart(); }

  startCompose(prefer?: string) {
    if (this.seasonOver) { this.toast('This week just closed. The reveal is coming.'); return; }
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
    if (this.credits <= 0) { this.sheet = 'credits'; return; }
    this.credits -= 1; this.spent += 1;
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

  buy(n: number) {
    this.credits += n; this.sheet = null;
    this.toast(`+${n} credits (mock purchase)`, '#ffd166');
  }

  submit() {
    const k = world.mineKey;
    const before = world.seenCount;
    const t = world.submitMine(this.prompt.trim(), this.obj);
    if (!t) return;
    this.lastMine = k;
    this.phase = 'reveal';
    const unlocked = world.seenCount - before;
    setTimeout(() => {
      this.revealCaption = true;
      // zoom out just enough to show the corner you can now see, not the whole season
      const b = { c0: t.c - 2, c1: t.c + 2, r0: t.r - 2, r1: t.r + 2 };
      this.cam.set(this.fitBox(b, 0.1, 150, 330), { duration: 2200, easing: cubicInOut });
      if (unlocked > 0) setTimeout(() => this.toast(`You can now see ${unlocked} more tile${unlocked > 1 ? 's' : ''} of this week`, '#7fe0c0'), 1400);
    }, 500);
    setTimeout(() => { this.sheet = 'share'; }, 2900);
    if (this.seasonOver) setTimeout(() => this.revealSeason(), 4200);
  }

  explore() {
    this.sheet = null; this.revealCaption = false;
    this.phase = 'explore';
    this.cam.set(this.fitAll(0.3, 90), { duration: 900, easing: cubicOut });
  }

  release() {
    const t = this.mine;
    world.release();
    if (t) setTimeout(() => { if (t.status === 'open') { t.status = 'locked'; t.author = randomPerson(); t.lockUntil = Date.now() + 120000; } }, 1200);
    this.phase = 'released';
  }

  /** the end-of-week shared event */
  revealSeason() {
    if (this.phase === 'season' || this.masked) return;
    const s = world.season;
    const seen = world.seenCount;
    const b = world.seasonBounds(s);
    const centre = this.lastMine && world.tiles[this.lastMine]?.season === s ? world.tiles[this.lastMine] : { c: (b.c0 + b.c1) / 2, r: (b.r0 + b.r1) / 2 };
    world.release();
    this.sheet = null; this.selected = null; this.revealCaption = false;
    this.recap = { season: s, tiles: world.seasonFilled.length, artists: world.seasonArtists, mine: this.myThisSeason, seen, hidden: 0 };
    this.recapStep = 0;
    this.phase = 'season';
    this.cam.set(this.fitBox(b, 0.35, 150, 230), { duration: 1400, easing: cubicInOut });
    setTimeout(() => {
      const hidden = world.revealSeason(centre);
      if (this.recap) this.recap.hidden = hidden.length;
      this.recapStep = 1;
    }, 1700);
    setTimeout(() => { this.recapStep = 2; }, 4600);
  }

  nextSeason() {
    const n = world.season + 1;
    if (n > LAST_SEASON) { this.toast('That was the last region in this mockup. Restarting.'); setTimeout(() => this.restart(), 1200); return; }
    world.startSeason(n);
    this.credits += SEASON_BONUS;
    this.seasonEndsAt = Date.now() + SEASON_MS;
    this.recap = null; this.recapStep = 0; this.lastMine = null;
    this.phase = 'explore';
    this.cam.set(this.fitBox(world.seasonBounds(n), 1.2, 110, 200), { duration: 1400, easing: cubicInOut });
    setTimeout(() => this.toast(`Week ${n} is open · +${SEASON_BONUS} free credits`, '#ffd166'), 600);
  }

  /** prototype shortcut: jump to the end of the week */
  endSeasonNow() {
    this.seasonEndsAt = Date.now() + 3000;
  }

  tapAt(sx: number, sy: number) {
    const { c, r } = this.screenToTile(sx, sy);
    const t = world.tiles[key(c, r)];
    if (this.phase !== 'explore' && this.phase !== 'intro') return;
    if (!t) { this.sheet = null; this.selected = null; return; }
    this.selected = key(c, r);
    this.sheet = 'info';
  }

  simulateNeighbour() {
    if (this.seasonOver) return;
    const t = world.tickOthers();
    if (t) {
      const seen = world.canSee(t.c, t.r);
      this.toast(seen ? `${t.author?.name} drew next to you` : `${t.author?.name} finished a tile in the fog`, t.author?.color);
      setTimeout(() => { t.fresh = false; }, 2500);
    }
  }
}

export const app = new AppState();
