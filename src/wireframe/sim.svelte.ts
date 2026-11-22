// Behaviour-only simulation of the shared grid. No art, no animation: just rules and state.
export const CELL = 100;
export const LOCK = 180;     // seconds a claim is held while you work
export const AWAY = 60;      // grace period after leaving without confirming
export const FRIEND = 600;   // a "continue from me" link reserves a cell this long
export const EXTEND = 120;

export type Dir = 'n' | 'e' | 's' | 'w';
export const DIRS: Dir[] = ['n', 'e', 's', 'w'];
const D: Record<Dir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
export const DIR_LABEL: Record<Dir, string> = { n: 'למעלה', e: 'מימין', s: 'למטה', w: 'משמאל' };

export const key = (x: number, y: number) => `${x},${y}`;
export const parse = (k: string) => k.split(',').map(Number) as [number, number];
export const nb = (k: string, d: Dir) => { const [x, y] = parse(k); return key(x + D[d][0], y + D[d][1]); };

export interface Tile { prompt: string; author: string; at: number; mine?: boolean; friend?: boolean }
export type ClaimKind = 'bot' | 'me' | 'away' | 'friend' | 'reserved';
export interface Claim { kind: ClaimKind; by: string; until: number; fillAt?: number; prompt?: string | null }
export interface Attempt { prompt: string; n: number }
export interface Draft { k: string; prompt: string; attempts: Attempt[]; pick: number; busy: boolean; extended: boolean }
export interface Toast { id: number; text: string; until: number; action?: { label: string; run: () => void } }
export type Sheet = null | 'cell' | 'filled' | 'race' | 'confirmed' | 'share' | 'nocredits' | 'leave' | 'expired';

const BOTS = ['נועה', 'יואב', 'מאיה', 'עומר', 'ליה', 'תמר', 'איתי', 'גל'];
const PROMPTS = [
  'חתול ישן על ירח', 'מגדלור בסערה', 'יד שמחזיקה בלון', 'עץ עם מדרגות', 'דג שעף מעל גגות', 'רכבת בתוך ענן',
  'שעון נמס', 'ילדה עם מטריה הפוכה', 'הר געש של גלידה', 'לוויתן בשמיים', 'בית על רגלי תרנגולת', 'גשר חבלים',
  'כוכב נופל לתוך כוס', 'שדה חמניות בלילה', 'רובוט משקה עציץ', 'ספרייה מתחת למים', 'פיל על אופניים',
  'ציפור עם מפתח', 'מדבר ובו דלת', 'אי קטן עם עץ אחד', 'מכונת כתיבה מגדלת פרחים', 'זאב קורא עיתון',
  'סולם לירח', 'עיר בתוך בקבוק', 'שועל עם פנס', 'כדור פורח טלאים', 'מדוזה זוהרת', 'צב נושא עיר',
  'ענן גשם קטן מעל ראש', 'שער סיני בערפל', 'אוהל בשלג', 'נחש עשוי ספרים',
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Seed: '#' filled, '.' empty. Includes a 4-sided hole and a 2-cell hole in the middle.
const SEED = [
  '..###..',
  '.#####.',
  '##.####',
  '####..#',
  '.######',
  '..###..',
];

export interface Settings {
  entry: 'organic' | 'link';
  start: 'center' | 'recent' | 'nearest';
  speed: number;
  race: boolean;
  bots: boolean;
  credits: number;
}

class Sim {
  tiles = $state<Record<string, Tile>>({});
  claims = $state<Record<string, Claim>>({});
  now = $state(0);
  credits = $state(5);
  screen = $state<'intro' | 'map' | 'create'>('intro');
  sheet = $state<Sheet>(null);
  sel = $state<string | null>(null);
  focus = $state<string[]>([]);
  fresh = $state<Record<string, number>>({});
  freshCount = $state(0);
  draft = $state<Draft | null>(null);
  toasts = $state<Toast[]>([]);
  cam = $state({ x: 0, y: 0, s: 1 });
  vw = $state(390);
  vh = $state(760);
  lastMine = $state<string | null>(null);
  linkFrom = $state<string | null>(null);
  reservedFor = $state<string | null>(null);
  shared = $state<Record<string, string>>({});
  pending = $state(false);
  hint = $state<string | null>(null);
  devOpen = $state(false);
  settings = $state<Settings>({ entry: 'organic', start: 'recent', speed: 1, race: false, bots: true, credits: 5 });
  private spotIdx = 0;
  private nextBot = 3;
  private tid = 0;

  touching = (k: string) => DIRS.filter((d) => this.tiles[nb(k, d)]);

  /** Every empty, unclaimed cell that touches at least one filled cell. */
  avail = $derived.by(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const k of Object.keys(this.tiles)) for (const d of DIRS) {
      const n = nb(k, d);
      if (seen.has(n)) continue;
      seen.add(n);
      if (!this.tiles[n] && !this.claims[n]) out.push(n);
    }
    return out;
  });
  availSet = $derived(new Set(this.avail));
  painters = $derived(Object.values(this.claims).filter((c) => c.kind === 'bot').length);

  toast(text: string, action?: Toast['action'], secs = 3.5) {
    const id = ++this.tid;
    this.toasts = [...this.toasts.slice(-2), { id, text, action, until: Date.now() + secs * 1000 }];
  }
  dismiss(id: number) { this.toasts = this.toasts.filter((t) => t.id !== id); }

  center(k: string, s?: number) {
    const [x, y] = parse(k);
    this.cam = { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 + (this.sheet ? 90 : 0) / (s ?? this.cam.s), s: s ?? this.cam.s };
  }
  fitAll() {
    const ks = Object.keys(this.tiles).map(parse);
    const xs = ks.map((p) => p[0]), ys = ks.map((p) => p[1]);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 2;
    const s = Math.max(0.3, Math.min(1.1, Math.min(this.vw / ((x1 - x0) * CELL), (this.vh - 180) / ((y1 - y0) * CELL))));
    this.cam = { x: ((x0 + x1) / 2) * CELL, y: ((y0 + y1) / 2) * CELL, s };
  }
  mostRecent(filter?: (k: string) => boolean) {
    let best: string | null = null;
    for (const [k, t] of Object.entries(this.tiles)) if ((!filter || filter(k)) && (!best || t.at > this.tiles[best].at)) best = k;
    return best;
  }
  adjAvail = (k: string) => DIRS.map((d) => nb(k, d)).filter((n) => this.availSet.has(n));

  reset() {
    const tiles: Record<string, Tile> = {};
    SEED.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#') tiles[key(x - 3, y - 3)] = { prompt: pick(PROMPTS), author: pick(BOTS), at: -rand(60, 3600) };
    }));
    this.tiles = tiles;
    this.claims = {};
    this.now = 0;
    this.credits = this.settings.credits;
    this.screen = 'intro';
    this.sheet = null; this.sel = null; this.focus = []; this.fresh = {}; this.draft = null; this.toasts = [];
    this.lastMine = null; this.linkFrom = null; this.reservedFor = null; this.shared = {}; this.hint = null; this.pending = false;
    this.spotIdx = 0; this.nextBot = 2;
    // a couple of people already drawing
    for (let i = 0; i < 2; i++) this.botClaim();
    if (this.settings.entry === 'link') {
      const from = this.mostRecent((k) => this.adjAvail(k).length > 0)!;
      this.tiles[from] = { ...this.tiles[from], author: 'דנה', at: -40 };
      const r = this.adjAvail(from)[0];
      this.claims[r] = { kind: 'reserved', by: 'אתה', until: FRIEND };
      this.linkFrom = from; this.reservedFor = r;
    }
    this.fitAll();
  }

  botClaim() {
    const free = this.avail.filter((k) => k !== this.sel || Math.random() < 0.3);
    if (!free.length) return;
    const k = pick(free);
    const by = pick(BOTS.filter((b) => !Object.values(this.claims).some((c) => c.by === b)).concat(['אורח']));
    this.claims[k] = { kind: 'bot', by, until: this.now + 120, fillAt: this.now + rand(14, 40), prompt: Math.random() < 0.15 ? null : pick(PROMPTS) };
  }

  fill(k: string, t: Tile) {
    this.tiles[k] = t;
    delete this.claims[k];
  }

  tick(dt: number) {
    this.now += dt * this.settings.speed;
    const now = this.now;
    for (const [k, c] of Object.entries(this.claims)) {
      if (c.fillAt !== undefined && c.fillAt <= now) {
        if (c.kind === 'bot') {
          if (c.prompt) this.fill(k, { prompt: c.prompt, author: c.by, at: now });
          else delete this.claims[k];          // gave up
        } else if (c.kind === 'friend') {
          this.fill(k, { prompt: c.prompt ?? pick(PROMPTS), author: c.by, at: now, friend: true });
          this.toast(`${c.by} המשיך ממך: "${this.tiles[k].prompt}"`, { label: 'הצג', run: () => { this.screen === 'map' && (this.center(k), this.sel = k, this.sheet = 'filled'); } }, 8);
        }
        continue;
      }
      if (c.until > now) continue;
      if (c.kind === 'me') {
        delete this.claims[k];
        if (this.draft?.k === k) { this.draft = null; this.screen = 'map'; this.sel = k; this.sheet = 'expired'; this.center(k); }
      } else if (c.kind === 'away') {
        delete this.claims[k];
        if (this.draft?.k === k) this.draft = null;
        this.toast('הריבוע ששמרת שוחרר לאחרים');
      } else if (c.kind === 'friend') {
        delete this.claims[k];
        this.toast(`השמירה ל${c.by} פגה. הריבוע פנוי לכולם`);
      } else if (c.kind === 'reserved') {
        delete this.claims[k];
        this.reservedFor = null;
        this.toast('הריבוע ששמרו לך שוחרר');
      } else delete this.claims[k];
    }
    for (const [k, t] of Object.entries(this.fresh)) if (t <= now || !this.availSet.has(k)) delete this.fresh[k];
    if (this.settings.bots && now >= this.nextBot) {
      this.nextBot = now + rand(5, 10);
      if (this.painters < 3) this.botClaim();
    }
    if (this.toasts.some((t) => t.until <= Date.now())) this.toasts = this.toasts.filter((t) => t.until > Date.now());
  }

  // ---------- entry ----------
  enter(direct = false) {
    this.screen = 'map';
    if (this.settings.entry === 'link' && this.reservedFor) {
      if (direct) { this.claim(this.reservedFor, true); return; }
      this.center(this.reservedFor, 1); this.sel = this.reservedFor; this.sheet = 'cell';
      return;
    }
    const recent = this.mostRecent()!;
    if (this.settings.start === 'center') { this.fitAll(); this.hint = 'הקש על ריבוע מקווקו כדי לצייר בו'; }
    else if (this.settings.start === 'recent') { this.center(recent, 1); this.hint = 'כאן ציירו לאחרונה. הקש על ריבוע מקווקו'; }
    else {
      const k = this.nearest(recent);
      if (k) { this.sel = k; this.sheet = 'cell'; this.center(k, 1); }
    }
  }

  nearest(from: string, list = this.avail) {
    const [fx, fy] = parse(from);
    return [...list].sort((a, b) => { const [ax, ay] = parse(a), [bx, by] = parse(b); return Math.hypot(ax - fx, ay - fy) - Math.hypot(bx - fx, by - fy); })[0] ?? null;
  }

  // ---------- map ----------
  tap(k: string | null) {
    this.hint = null;
    if (!k) { this.sheet = null; this.sel = null; this.focus = []; return; }
    const c = this.claims[k];
    if (this.tiles[k]) { this.sel = k; this.sheet = 'filled'; this.focus = []; return; }
    if (c) {
      if (c.kind === 'me' || c.kind === 'away') return this.resume(k);
      if (c.kind === 'reserved') { this.sel = k; this.sheet = 'cell'; return; }
      if (c.kind === 'friend') return this.toast(`שמור ל${c.by} עוד ${fmt(c.until - this.now)}`);
      return this.toast(`${c.by} מצייר/ת כאן עכשיו`);
    }
    if (this.availSet.has(k)) { this.sel = k; this.sheet = 'cell'; this.focus = []; return; }
    this.sel = null; this.sheet = null;
    this.toast('אפשר לצייר רק בריבוע שנוגע בציור קיים');
  }

  findSpot() {
    if (!this.avail.length) return this.toast('אין כרגע מקום פנוי. נסה עוד רגע');
    const cx = this.cam.x / CELL, cy = this.cam.y / CELL;
    const sorted = [...this.avail].sort((a, b) => { const [ax, ay] = parse(a), [bx, by] = parse(b); return Math.hypot(ax + 0.5 - cx, ay + 0.5 - cy) - Math.hypot(bx + 0.5 - cx, by + 0.5 - cy); });
    // repeated taps cycle outward instead of returning the same cell
    const k = this.sheet === 'cell' && this.sel ? sorted[(sorted.indexOf(this.sel) + 1) % sorted.length] : sorted[0];
    this.sel = k; this.sheet = 'cell'; this.focus = []; this.hint = null;
    this.center(k, Math.max(this.cam.s, 0.8));
  }

  continueFrom(k: string) {
    const list = this.adjAvail(k);
    if (!list.length) return this.toast('אין ריבוע פנוי צמוד. נסה "מצא לי מקום"');
    if (list.length === 1) { this.sel = list[0]; this.sheet = 'cell'; this.center(list[0]); return; }
    this.sheet = null; this.sel = null; this.focus = list;
    this.hint = `בחר אחד מ-${list.length} הריבועים המסומנים`;
    this.center(k);
  }

  // ---------- claim ----------
  claim(k: string, skipLatency = false) {
    const go = () => {
      this.pending = false;
      const c = this.claims[k];
      const mineRes = c?.kind === 'reserved';
      if (this.settings.race && !mineRes) {
        this.settings.race = false;
        this.claims[k] = { kind: 'bot', by: pick(BOTS), until: this.now + 120, fillAt: this.now + rand(20, 40), prompt: pick(PROMPTS) };
      }
      if (this.tiles[k] || (this.claims[k] && this.claims[k].kind !== 'reserved')) { this.sel = k; this.sheet = 'race'; return; }
      for (const [ok, oc] of Object.entries(this.claims)) if (oc.kind === 'away') { delete this.claims[ok]; }
      if (mineRes) this.reservedFor = null;
      this.claims[k] = { kind: 'me', by: 'אתה', until: this.now + LOCK };
      this.draft = { k, prompt: '', attempts: [], pick: -1, busy: false, extended: false };
      this.screen = 'create'; this.sheet = null; this.sel = null; this.focus = []; this.hint = null;
    };
    if (skipLatency) return go();
    this.pending = true;
    setTimeout(go, 650);   // network round trip: someone else can win in between
  }

  resume(k: string) {
    const c = this.claims[k];
    if (!c || !this.draft || this.draft.k !== k) return;
    c.kind = 'me'; c.until = Math.max(c.until, this.now + 60);
    this.screen = 'create'; this.sheet = null; this.sel = null;
  }

  // ---------- create ----------
  generate(prompt: string) {
    const d = this.draft;
    if (!d || d.busy || !prompt.trim()) return;
    if (this.credits <= 0) { this.sheet = 'nocredits'; return; }
    this.credits--;
    d.busy = true;
    setTimeout(() => {
      if (this.draft !== d) return;
      d.attempts.push({ prompt: prompt.trim(), n: d.attempts.length + 1 });
      d.pick = d.attempts.length - 1;
      d.busy = false;
    }, 1100);
  }
  extend() { const d = this.draft; if (!d) return; this.claims[d.k].until += EXTEND; d.extended = true; }

  confirm() {
    const d = this.draft;
    if (!d || d.pick < 0) return;
    const before = new Set(this.avail);
    this.fill(d.k, { prompt: d.attempts[d.pick].prompt, author: 'אתה', at: this.now, mine: true });
    const opened = DIRS.map((dd) => nb(d.k, dd)).filter((n) => !this.tiles[n] && !this.claims[n] && !before.has(n));
    for (const n of opened) this.fresh[n] = this.now + 40;
    this.freshCount = opened.length;
    this.lastMine = d.k;
    this.draft = null;
    this.screen = 'map';
    this.sel = d.k; this.sheet = 'confirmed';
    this.center(d.k, Math.max(0.8, this.cam.s));
  }

  leaveKeep() {
    const d = this.draft!; const c = this.claims[d.k];
    c.kind = 'away'; c.until = this.now + AWAY;
    this.screen = 'map'; this.sheet = null; this.center(d.k);
    this.toast('הריבוע שמור לך לדקה. הקש עליו כדי לחזור', undefined, 5);
  }
  leaveRelease() {
    const d = this.draft!;
    delete this.claims[d.k];
    this.draft = null; this.screen = 'map'; this.sheet = null; this.center(d.k);
  }
  releaseFromNoCredits() { this.leaveRelease(); this.toast('הריבוע שוחרר'); }

  // ---------- share ----------
  share() {
    const k = this.lastMine;
    if (!k) return;
    if (!this.shared[k]) {
      const r = this.adjAvail(k)[0];
      if (r) {
        this.claims[r] = { kind: 'friend', by: 'רון', until: this.now + FRIEND, fillAt: this.now + rand(25, 40), prompt: pick(PROMPTS) };
        this.shared[k] = r;
      }
    }
    this.sheet = 'share';
  }
  drawAnother() {
    const k = this.lastMine;
    this.sheet = null;
    if (k) this.continueFrom(k);
  }
}

export const fmt = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const ago = (s: number) => (s < 60 ? 'עכשיו' : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : `לפני ${Math.round(s / 3600)} שע׳`);
export const sim = new Sim();
