import { Tween } from 'svelte/motion';
import { cubicInOut } from 'svelte/easing';
import { T, C0, C1, R0, R1 } from '../lib/art';

export type Variant = 'fabric' | 'scroll' | 'scribble' | 'thread';
export const VARIANTS: { id: Variant; name: string; hint: string }[] = [
  { id: 'fabric', name: 'בד', hint: 'תפסו קצה זוהר ומתחו החוצה' },
  { id: 'scroll', name: 'מגילה', hint: 'גוללו את הנייר מהקצה החוצה' },
  { id: 'scribble', name: 'שרבוט', hint: 'התחילו בקצה וצירו קו פנימה' },
  { id: 'thread', name: 'חוט', hint: 'משכו חוט מהקצה ותגידו מה ממשיך' },
];

export interface Person { name: string; color: string }
export interface Cell { c: number; r: number; by: Person; obj?: number; mine?: boolean; fresh?: number; ox?: number; oy?: number }
export interface Edge { id: string; fc: number; fr: number; c: number; r: number; dx: number; dy: number }
export interface Pending {
  c: number; r: number; dx: number; dy: number;
  tries: number[]; idx: number;
  stage: 'emerge' | 'words' | 'choose' | 'retry' | 'stitch';
  path?: { x: number; y: number }[]; // scribble, tile-local 0..T
  word?: string;
}

export const key = (c: number, r: number) => `${c},${r}`;
export const inBounds = (c: number, r: number) => c >= C0 && c <= C1 && r >= R0 && r <= R1;

const PEOPLE: Person[] = [
  { name: 'נועה', color: '#7fe0c0' }, { name: 'איתי', color: '#ffd166' }, { name: 'מאיה', color: '#c3a6ff' },
  { name: 'ליאור', color: '#ff8fa3' }, { name: 'יובל', color: '#4aa3df' }, { name: 'תמר', color: '#f4a261' },
  { name: 'עומר', color: '#7fe0c0' }, { name: 'שירה', color: '#ffd166' }, { name: 'דנה', color: '#c3a6ff' },
];
export const ME: Person = { name: 'את/ה', color: '#ff6b4a' };

const SHAPE = [
  '...........',
  '...........',
  '...###.....',
  '..#####....',
  '..######...',
  '...#####...',
  '....###....',
  '...........',
  '...........',
];

export const WORDS: { w: string; obj: number }[] = [
  { w: 'דג פורח', obj: 0 }, { w: 'ירח ישנוני', obj: 1 }, { w: 'כדור פורח', obj: 2 }, { w: 'בית על כלונסאות', obj: 3 },
];
export function objFor(text: string): number {
  const t = text.toLowerCase();
  if (/דג|ים|מים|לווי|fish|sea/.test(t)) return 0;
  if (/ירח|לילה|חלום|ישן|moon|night/.test(t)) return 1;
  if (/כדור|עף|שמיים|ציפור|balloon|sky|bird/.test(t)) return 2;
  if (/בית|חלון|אור|מנורה|house|home/.test(t)) return 3;
  return Math.floor(Math.random() * 4);
}

class PullState {
  vw = $state(typeof window !== 'undefined' ? window.innerWidth : 390);
  vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  img = $state<{ full: string; sketch: string } | null>(null);
  variant = $state<Variant>(readVariant());
  cells = $state<Record<string, Cell>>({});
  credits = $state(12);
  pending = $state<Pending | null>(null);
  active = $state<Edge | null>(null); // edge being dragged
  scribble = $state<{ x: number; y: number }[]>([]);
  ghost = $state<{ c: number; r: number; dx: number; dy: number; by: Person } | null>(null);
  toasts = $state<{ id: number; text: string; color?: string }[]>([]);
  added = $state(0);

  cam = new Tween({ x: 0, y: 0, s: 0.5 }, { duration: 800, easing: cubicInOut });
  pull = new Tween(0, { duration: 0 });   // 0..1 how far the active / pending tile is pulled out
  resolve = new Tween(0, { duration: 0 }); // 0..1 sketch -> paint
  ghostP = new Tween(0, { duration: 0 });

  constructor() { this.reset(); }

  reset() {
    const t: Record<string, Cell> = {};
    let i = 0;
    SHAPE.forEach((row, ri) => [...row].forEach((ch, ci) => {
      if (ch !== '#') return;
      const c = C0 + ci, r = R0 + ri;
      t[key(c, r)] = { c, r, by: PEOPLE[(i * 5) % PEOPLE.length] };
      i++;
    }));
    this.cells = t;
    this.pending = null; this.active = null; this.credits = 12; this.added = 0;
    this.pull.set(0, { duration: 0 }); this.resolve.set(0, { duration: 0 });
  }

  filled(c: number, r: number) { return !!this.cells[key(c, r)]; }

  get edges(): Edge[] {
    const out: Edge[] = [];
    const p = this.pending, g = this.ghost;
    for (const f of Object.values(this.cells)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = f.c + dx, r = f.r + dy;
        if (!inBounds(c, r) || this.filled(c, r)) continue;
        if (p && p.c === c && p.r === r) continue;
        if (g && g.c === c && g.r === r) continue;
        out.push({ id: `${f.c},${f.r}>${c},${r}`, fc: f.c, fr: f.r, c, r, dx, dy });
      }
    }
    return out;
  }

  /** empty tiles touching the drawing, with the sides that touch it */
  get frontier() {
    const m = new Map<string, { c: number; r: number; sides: [number, number][] }>();
    for (const e of this.edges) {
      const k = key(e.c, e.r);
      if (!m.has(k)) m.set(k, { c: e.c, r: e.r, sides: [] });
      m.get(k)!.sides.push([e.dx, e.dy]);
    }
    return [...m.values()];
  }

  toScreen(wx: number, wy: number) {
    const c = this.cam.current;
    return { x: this.vw / 2 + (wx - c.x) * c.s, y: this.vh / 2 + (wy - c.y) * c.s };
  }

  fitStart() {
    const cs = Object.values(this.cells);
    const xs = cs.map((t) => t.c), ys = cs.map((t) => t.r);
    const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * T, cy = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * T;
    const s = Math.min(this.vw / (T * 3.8), this.vh / (T * 5.6));
    return { x: cx, y: cy + T * 0.25, s };
  }

  toast(text: string, color?: string) {
    const id = Math.random();
    this.toasts = [...this.toasts, { id, text, color }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3000);
  }
}

function readVariant(): Variant {
  try {
    const v = new URLSearchParams(location.search).get('v');
    if (v && VARIANTS.some((x) => x.id === v)) return v as Variant;
  } catch {}
  return 'fabric';
}

export const S = new PullState();
export { PEOPLE };
