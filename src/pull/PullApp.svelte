<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, cubicInOut, elasticOut, backOut } from 'svelte/easing';
  import { paintMaster, T, W, H, C0, R0 } from '../lib/art';
  import { panzoom } from '../lib/gestures';
  import ObjectArt from '../components/ObjectArt.svelte';
  import { S, VARIANTS, WORDS, PEOPLE, ME, key, objFor, type Edge, type Variant } from './pull.svelte';

  let ready = $state(false);
  let touched = $state(false); // has the visitor pulled anything yet (hides the coach)
  let steer = $state('');
  let word = $state('');
  let finger = $state<{ x: number; y: number } | null>(null); // screen pos while dragging
  let crossed = $state(false);
  let now = $state(Date.now());

  const THRESH = 0.45;
  const cam = $derived(S.cam.current);
  const img = $derived(S.img);
  const p = $derived(S.pull.current);
  const q = $derived(S.resolve.current);
  const sk = $derived(clamp(q / 0.45));
  const pa = $derived(clamp((q - 0.4) / 0.6));
  const v = $derived(S.variant);
  const hint = $derived(VARIANTS.find((x) => x.id === v)!.hint);

  // what is emerging right now: the edge being dragged, or the pending tile
  const em = $derived(S.pending ?? (S.active ? { c: S.active.c, r: S.active.r, dx: S.active.dx, dy: S.active.dy, tries: [] as number[], idx: 0, stage: 'emerge' as const } : null));
  const tryObj = $derived(S.pending ? S.pending.tries[S.pending.idx] : undefined);

  function clamp(x: number, a = 0, b = 1) { return Math.max(a, Math.min(b, x)); }
  const bg = (c: number, r: number, url?: string) => url ? `background-image:url(${url});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  /** the pulled part of a tile, in tile-local units */
  function region(dx: number, dy: number, pp: number) {
    const L = Math.max(0.001, pp) * T;
    if (dx === 1) return { x: 0, y: 0, w: L, h: T };
    if (dx === -1) return { x: T - L, y: 0, w: L, h: T };
    if (dy === 1) return { x: 0, y: 0, w: T, h: L };
    return { x: 0, y: T - L, w: T, h: L };
  }
  function clipFor(dx: number, dy: number, pp: number) {
    const k = (1 - clamp(pp)) * 100;
    if (dx === 1) return `inset(0 ${k}% 0 0)`;
    if (dx === -1) return `inset(0 0 0 ${k}%)`;
    if (dy === 1) return `inset(0 0 ${k}% 0)`;
    return `inset(${k}% 0 0 0)`;
  }
  const outDir = (dx: number, dy: number) => (dx === 1 ? 'to right' : dx === -1 ? 'to left' : dy === 1 ? 'to bottom' : 'to top');

  /** fabric: extrude the boundary pixels of the source tile across the pulled length */
  function smear(c: number, r: number, dx: number, dy: number, pp: number) {
    const L = 3, len = Math.max(1, pp * T), k = len / L;
    const rg = region(dx, dy, pp);
    let bs = '', bp = '';
    if (dx !== 0) {
      const u0 = dx === 1 ? c * T - L : (c + 1) * T;
      bs = `${W * k}px ${H}px`; bp = `${-(u0 - C0 * T) * k}px ${-(r - R0) * T}px`;
    } else {
      const v0 = dy === 1 ? r * T - L : (r + 1) * T;
      bs = `${W}px ${H * k}px`; bp = `${-(c - C0) * T}px ${-(v0 - R0 * T) * k}px`;
    }
    const bulge = 46 * (1 - sk);
    const br = dx === 1 ? `0 ${bulge}% ${bulge}% 0 / 0 50% 50% 0` : dx === -1 ? `${bulge}% 0 0 ${bulge}% / 50% 0 0 50%` : dy === 1 ? `0 0 ${bulge}% ${bulge}% / 0 0 50% 50%` : `${bulge}% ${bulge}% 0 0 / 50% 50% 0 0`;
    return `left:${rg.x}px;top:${rg.y}px;width:${rg.w}px;height:${rg.h}px;background-image:url(${img?.full});background-size:${bs};background-position:${bp};border-radius:${br};`;
  }

  /** scroll: paper roll sitting on the leading edge */
  function roll(dx: number, dy: number, pp: number) {
    const d = 44 - 20 * clamp(pp);
    const lead = clamp(pp, 0, 1.15) * T;
    if (dx === 1) return `left:${lead - d / 2}px;top:-8px;width:${d}px;height:${T + 16}px;background:linear-gradient(to right,#8f7d62,#efe2c8 30%,#fffaf0 48%,#d9c9a8 70%,#7d6b52)`;
    if (dx === -1) return `left:${T - lead - d / 2}px;top:-8px;width:${d}px;height:${T + 16}px;background:linear-gradient(to right,#7d6b52,#d9c9a8 30%,#fffaf0 52%,#efe2c8 70%,#8f7d62)`;
    if (dy === 1) return `top:${lead - d / 2}px;left:-8px;height:${d}px;width:${T + 16}px;background:linear-gradient(to bottom,#8f7d62,#efe2c8 30%,#fffaf0 48%,#d9c9a8 70%,#7d6b52)`;
    return `top:${T - lead - d / 2}px;left:-8px;height:${d}px;width:${T + 16}px;background:linear-gradient(to bottom,#7d6b52,#d9c9a8 30%,#fffaf0 52%,#efe2c8 70%,#8f7d62)`;
  }

  /** wet paint washing in from the source edge */
  function wash(dx: number, dy: number, t: number) {
    const a = t * 140 - 30;
    const m = `linear-gradient(${outDir(dx, dy)}, #000 ${a}%, transparent ${a + 30}%)`;
    return `-webkit-mask-image:${m};mask-image:${m};`;
  }

  function edgeMid(e: { fc: number; fr: number; dx: number; dy: number }) {
    return { x: (e.fc + 0.5 + e.dx * 0.5) * T, y: (e.fr + 0.5 + e.dy * 0.5) * T };
  }

  // ---------------- dragging an edge ----------------
  let start = { x: 0, y: 0, s: 1 };
  function down(e: PointerEvent, edge: Edge) {
    if (S.pending || !img) return;
    if (S.credits <= 0) { S.toast('נגמרו הקרדיטים לניסיונות. ⋯ › איפוס'); return; }
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    touched = true; crossed = false;
    start = { x: e.clientX, y: e.clientY, s: cam.s };
    S.active = edge;
    S.resolve.set(0, { duration: 0 });
    S.pull.set(0, { duration: 0 });
    finger = { x: e.clientX, y: e.clientY };
    if (v === 'scribble') S.scribble = [local(e.clientX, e.clientY, edge, true)];
  }

  function local(sx: number, sy: number, edge: Edge, snap = false) {
    const wx = cam.x + (sx - S.vw / 2) / cam.s, wy = cam.y + (sy - S.vh / 2) / cam.s;
    let x = clamp(wx - edge.c * T, 6, T - 6), y = clamp(wy - edge.r * T, 6, T - 6);
    if (snap) { if (edge.dx === 1) x = 2; if (edge.dx === -1) x = T - 2; if (edge.dy === 1) y = 2; if (edge.dy === -1) y = T - 2; }
    return { x, y };
  }

  function pathLen(pts: { x: number; y: number }[]) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return l; }

  function move(e: PointerEvent) {
    const a = S.active; if (!a) return;
    finger = { x: e.clientX, y: e.clientY };
    let d: number;
    if (v === 'scribble') {
      const pt = local(e.clientX, e.clientY, a);
      const last = S.scribble[S.scribble.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 3) S.scribble = [...S.scribble, pt];
      d = pathLen(S.scribble) / (T * 1.1);
    } else {
      d = (((e.clientX - start.x) * a.dx + (e.clientY - start.y) * a.dy) / start.s) / T;
      if (d > 1) d = 1 + (d - 1) * 0.22;
    }
    d = Math.max(0, d);
    if (!crossed && d >= THRESH) { crossed = true; try { navigator.vibrate?.(12); } catch {} }
    if (crossed && d < THRESH * 0.8) crossed = false;
    S.pull.set(d, { duration: 0 });
  }

  async function up() {
    const a = S.active; if (!a) return;
    finger = null;
    const pp = S.pull.current;
    if (pp < THRESH) {
      // snap back like elastic
      await S.pull.set(0, { duration: v === 'fabric' ? 520 : 320, easing: v === 'fabric' ? elasticOut : cubicOut });
      S.active = null; S.scribble = [];
      return;
    }
    S.credits -= 1;
    const first = objFor('');
    const path = v === 'scribble' ? S.scribble : undefined;
    S.pending = { c: a.c, r: a.r, dx: a.dx, dy: a.dy, tries: [first], idx: 0, stage: v === 'thread' ? 'words' : 'emerge', path };
    S.active = null; S.scribble = [];
    focusTile(a.c, a.r);
    if (v === 'fabric') await S.pull.set(1, { duration: 900, easing: elasticOut });
    else if (v === 'scroll') await S.pull.set(1.08, { duration: 500, easing: cubicOut });
    else S.pull.set(1, { duration: 0 });
    if (v === 'thread') { word = ''; return; }
    await S.resolve.set(1, { duration: v === 'scribble' ? 2600 : 2200, easing: cubicInOut });
    if (S.pending) S.pending.stage = 'choose';
  }

  function focusTile(c: number, r: number) {
    const s = Math.max(cam.s, Math.min(S.vw / (T * 2.5), S.vh / (T * 3.6)));
    S.cam.set({ x: (c + 0.5) * T, y: (r + 0.5) * T + (S.vh * 0.12) / s, s }, { duration: 700 });
  }

  // ---------------- tries / steering ----------------
  async function sayWord(w: string) {
    const pd = S.pending; if (!pd || !w.trim()) return;
    pd.word = w.trim();
    pd.tries = [objFor(w)];
    pd.stage = 'emerge';
    await S.resolve.set(1, { duration: 2600, easing: cubicInOut });
    if (S.pending) S.pending.stage = 'choose';
  }

  async function newTry(text = '') {
    const pd = S.pending; if (!pd || pd.tries.length >= 4) return;
    if (S.credits <= 0) { S.toast('נגמרו הקרדיטים'); return; }
    S.credits -= 1;
    let o = text ? objFor(text) : (pd.tries[pd.tries.length - 1] + 1 + Math.floor(Math.random() * 2)) % 4;
    if (o === pd.tries[pd.idx]) o = (o + 1) % 4;
    pd.tries = [...pd.tries, o];
    pd.idx = pd.tries.length - 1;
    if (text) pd.word = text;
    pd.stage = 'retry';
    S.resolve.set(0.42, { duration: 260 });
    await new Promise((r) => setTimeout(r, 300));
    await S.resolve.set(1, { duration: 1500, easing: cubicInOut });
    if (S.pending) S.pending.stage = 'choose';
    steer = '';
  }

  function pick(i: number) { if (S.pending) S.pending.idx = i; }

  async function stitch() {
    const pd = S.pending; if (!pd) return;
    pd.stage = 'stitch';
    await new Promise((r) => setTimeout(r, 650));
    const before = S.edges.length;
    const c = pd.path ? centroid(pd.path) : null;
    S.cells[key(pd.c, pd.r)] = { c: pd.c, r: pd.r, by: ME, obj: pd.tries[pd.idx], mine: true, fresh: Date.now(), ox: c?.x, oy: c?.y };
    S.pending = null;
    S.pull.set(0, { duration: 0 }); S.resolve.set(0, { duration: 0 });
    S.added += 1;
    const opened = S.edges.length - before + 1;
    S.toast(opened > 0 ? `נתפר. נפתחו ${opened} קצוות חדשים` : 'נתפר לציור', '#ff6b4a');
    try { navigator.vibrate?.([10, 40, 10]); } catch {}
  }

  async function cancel() {
    const pd = S.pending; if (!pd) return;
    await S.pull.set(0, { duration: 380, easing: cubicInOut });
    S.pending = null; S.resolve.set(0, { duration: 0 });
  }

  function centroid(pts: { x: number; y: number }[]) {
    const n = pts.length; let x = 0, y = 0;
    for (const p of pts) { x += p.x; y += p.y; }
    return { x: clamp(x / n, 70, T - 70), y: clamp(y / n, 70, T - 70) };
  }
  function pathD(pts: { x: number; y: number }[]) {
    if (!pts.length) return '';
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; d += ` Q${pts[i].x} ${pts[i].y} ${mx} ${my}`; }
    if (pts.length > 1) d += ` L${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  }
  function objStyle(ox?: number, oy?: number) {
    return ox === undefined ? '' : `transform:translate(${ox - 128}px,${(oy ?? 128) - 128}px) scale(.8)`;
  }

  // ---------------- other people pulling too ----------------
  async function ghostPull() {
    if (S.active || S.ghost || !ready) return;
    const pd = S.pending;
    const es = S.edges.filter((e) => !pd || Math.abs(e.c - pd.c) + Math.abs(e.r - pd.r) > 1);
    if (!es.length) return;
    const e = es[Math.floor(Math.random() * es.length)];
    const by = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
    S.ghost = { c: e.c, r: e.r, dx: e.dx, dy: e.dy, by };
    S.ghostP.set(0, { duration: 0 });
    await S.ghostP.set(1, { duration: 2400, easing: cubicInOut });
    await new Promise((r) => setTimeout(r, 900));
    S.cells[key(e.c, e.r)] = { c: e.c, r: e.r, by, obj: Math.random() < 0.5 ? Math.floor(Math.random() * 4) : undefined, fresh: Date.now() };
    S.ghost = null;
  }

  // the edge nearest the middle of the screen gets the coach hand
  const coach = $derived.by(() => {
    if (touched || S.pending || S.active || !ready) return null;
    let best: Edge | null = null, bd = 1e9;
    for (const e of S.edges) {
      const m = edgeMid(e), sp = S.toScreen(m.x, m.y);
      const d = Math.hypot(sp.x - S.vw / 2, sp.y - S.vh * 0.45) + (e.dy === -1 ? 400 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  });

  function setVariant(id: Variant) {
    if (S.pending) { S.pending = null; S.pull.set(0, { duration: 0 }); S.resolve.set(0, { duration: 0 }); }
    S.variant = id;
    try { const u = new URL(location.href); u.searchParams.set('v', id); history.replaceState(null, '', u); } catch {}
  }

  let menu = $state(false);

  onMount(() => {
    const vv = window.visualViewport;
    const onResize = () => { S.vw = vv?.width ?? window.innerWidth; S.vh = vv?.height ?? window.innerHeight; };
    onResize();
    vv?.addEventListener('resize', onResize); window.addEventListener('resize', onResize);
    paintMaster().then((m) => { S.img = { full: m.full, sketch: m.sketch }; S.cam.set(S.fitStart(), { duration: 0 }); ready = true; });
    const g = setInterval(ghostPull, 17000);
    const tk = setInterval(() => (now = Date.now()), 500);
    return () => { clearInterval(g); clearInterval(tk); window.removeEventListener('resize', onResize); };
  });

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${S.vw / 2 - cam.x * cam.s}px ${S.vh / 2 - cam.y * cam.s}px;`);
  const lw = $derived(Math.max(3, 5 / cam.s));
</script>

<div class="fixed inset-0 overflow-hidden select-none touch-none bg-ink" dir="ltr">
  <div class="absolute inset-0" use:panzoom={{
      enabled: () => !S.active,
      get: () => S.cam.current,
      set: (x) => S.cam.set(x, { duration: 0 }),
      fling: (x) => S.cam.set(x, { duration: 600, easing: cubicOut }),
      onTap: () => {},
      minS: 0.12, maxS: 2.5,
    }}>
    <div class="absolute inset-0 pointer-events-none opacity-50" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.4px, transparent 1.6px);{grid}"></div>

    {#if ready}
    <div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({S.vw / 2}px,{S.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">

      <!-- hints: the continuation, faintly sketched, breathing out of each open edge -->
      {#each S.frontier as f (key(f.c, f.r))}
        {#each f.sides as [dx, dy] (dx + ',' + dy)}
          <div class="absolute pointer-events-none hint {dx ? 'hx' : 'hy'}"
            style="left:{f.c * T}px;top:{f.r * T}px;width:{T}px;height:{T}px;{bg(f.c, f.r, img?.sketch)};--g:linear-gradient({outDir(dx, dy)}, rgba(0,0,0,.75), transparent);-webkit-mask-position:{dx === -1 ? 'right' : dy === -1 ? 'bottom' : 'left top'};mask-position:{dx === -1 ? 'right' : dy === -1 ? 'bottom' : 'left top'}"></div>
          <div class="absolute pointer-events-none bleed"
            style="left:{f.c * T}px;top:{f.r * T}px;width:{T}px;height:{T}px;{bg(f.c, f.r, img?.full)};--g:linear-gradient({outDir(dx, dy)}, #000, rgba(0,0,0,.75) 6%, rgba(0,0,0,.3) 15%, transparent 30%);-webkit-mask-position:{dx === -1 ? 'right' : dy === -1 ? 'bottom' : 'left top'};mask-position:{dx === -1 ? 'right' : dy === -1 ? 'bottom' : 'left top'}"></div>
          <div class="absolute pointer-events-none edge-glow"
            style="left:{(f.c + (dx === -1 ? 1 : 0)) * T - (dx ? lw / 2 : 0)}px;top:{(f.r + (dy === -1 ? 1 : 0)) * T - (dy ? lw / 2 : 0)}px;width:{dx ? lw : T}px;height:{dx ? T : lw}px"></div>
        {/each}
      {/each}

      <!-- the drawing -->
      {#each Object.values(S.cells) as t (key(t.c, t.r))}
        <div class="absolute" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;{bg(t.c, t.r, img?.full)}">
          {#if t.obj !== undefined}<div class="absolute inset-0" style={objStyle(t.ox, t.oy)}><ObjectArt obj={t.obj} /></div>{/if}
          {#if t.fresh && now - t.fresh < 1600}<div class="absolute inset-0 pointer-events-none bg-white" style="animation:fadeflash 1.3s ease-out forwards"></div>{/if}
          {#if t.mine}<div class="absolute right-2 bottom-2 h-6 min-w-6 px-1.5 rounded-full bg-coral text-ink text-[13px] font-semibold flex items-center justify-center shadow">✦</div>{/if}
        </div>
      {/each}

      <!-- someone else pulling -->
      {#if S.ghost}
        {@const g = S.ghost}
        {@const gp = S.ghostP.current}
        <div class="absolute pointer-events-none" style="left:{g.c * T}px;top:{g.r * T}px;width:{T}px;height:{T}px">
          <div class="absolute inset-0" style="{bg(g.c, g.r, img?.sketch)};clip-path:{clipFor(g.dx, g.dy, gp)};opacity:{1 - clamp((gp - 0.6) / 0.4)}"></div>
          <div class="absolute inset-0" style="{bg(g.c, g.r, img?.full)};clip-path:{clipFor(g.dx, g.dy, gp)};opacity:{clamp((gp - 0.6) / 0.4)}"></div>
          <div class="absolute inset-[4px] rounded-[6px] border-[3px] border-dashed" style="border-color:{g.by.color};opacity:.8"></div>
        </div>
      {/if}

      <!-- the tile being pulled out -->
      {#if em && img}
        {@const c = em.c}
        {@const r = em.r}
        {@const dx = em.dx}
        {@const dy = em.dy}
        {@const stage = em.stage}
        <div class="absolute pointer-events-none" style="left:{c * T}px;top:{r * T}px;width:{T}px;height:{T}px">
          {#if v === 'fabric'}
            <div class="absolute inset-0" style="{bg(c, r, img.sketch)};clip-path:{clipFor(dx, dy, p)};opacity:{sk * (1 - pa)}"></div>
            <div class="absolute fabric" style="{smear(c, r, dx, dy, p)};opacity:{1 - sk}"></div>
          {:else if v === 'scroll'}
            <div class="absolute inset-0 shadow-[inset_0_0_30px_rgba(120,90,50,.35)]" style="{bg(c, r, img.sketch)};clip-path:{clipFor(dx, dy, p)}"></div>
            <div class="absolute rounded-full shadow-[0_6px_18px_rgba(0,0,0,.45)]" style="{roll(dx, dy, p)};opacity:{1 - clamp(q * 3)}"></div>
          {:else if v === 'scribble'}
            {@const pts = S.pending?.path ?? S.scribble}
            <svg class="absolute inset-0 overflow-visible" width={T} height={T} viewBox="0 0 {T} {T}">
              <defs>
                <mask id="mk-s" maskUnits="userSpaceOnUse" x="-10" y="-10" width={T + 20} height={T + 20}><path d={pathD(pts)} stroke="#fff" stroke-width={64 + sk * 700} stroke-linecap="round" stroke-linejoin="round" fill="none" style="filter:blur(6px)" /></mask>
                <mask id="mk-p" maskUnits="userSpaceOnUse" x="-10" y="-10" width={T + 20} height={T + 20}><path d={pathD(pts)} stroke="#fff" stroke-width={pa * 760} stroke-linecap="round" stroke-linejoin="round" fill="none" style="filter:blur(10px)" /></mask>
                <clipPath id="cp-t"><rect width={T} height={T} /></clipPath>
              </defs>
              <g clip-path="url(#cp-t)">
                <image href={img.sketch} x={-(c - C0) * T} y={-(r - R0) * T} width={W} height={H} mask="url(#mk-s)" preserveAspectRatio="none" />
                <image href={img.full} x={-(c - C0) * T} y={-(r - R0) * T} width={W} height={H} mask="url(#mk-p)" preserveAspectRatio="none" />
              </g>
              <path d={pathD(pts)} stroke="#ff6b4a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity={1 - pa} />
            </svg>
          {:else if v === 'thread'}
            {@const per = T * 4}
            <div class="absolute inset-0" style="{bg(c, r, img.sketch)};opacity:{stage === 'words' ? 0.5 : 0.35 * clamp(p) + 0.65 * sk};{stage !== 'words' && !S.active ? `-webkit-mask-image:radial-gradient(circle at 50% 50%, #000 ${sk * 80}%, transparent ${sk * 80 + 30}%);mask-image:radial-gradient(circle at 50% 50%, #000 ${sk * 80}%, transparent ${sk * 80 + 30}%)` : ''}"></div>
            <svg class="absolute inset-0 overflow-visible" width={T} height={T}>
              <rect x="5" y="5" width={T - 10} height={T - 10} rx="8" fill="none" stroke="#ff6b4a" stroke-width="4" stroke-dasharray="14 10" stroke-dashoffset={-q * 120}
                style="clip-path:inset(0)" pathLength={per} stroke-opacity={1 - pa * 0.9}
                opacity={S.active ? clamp(p / THRESH) : 1} />
            </svg>
          {/if}

          <!-- final paint + the generated thing, shared by all -->
          {#if v !== 'scribble'}
            <div class="absolute inset-0" style="{bg(c, r, img.full)};opacity:{pa};{v === 'scroll' || v === 'fabric' ? wash(dx, dy, pa) : ''};filter:blur({(1 - pa) * 3}px)"></div>
          {/if}
          {#if tryObj !== undefined}
            {@const cen = S.pending?.path ? centroid(S.pending.path) : null}
            <div class="absolute inset-0" style="opacity:{pa};{objStyle(cen?.x, cen?.y)}">
              {#key S.pending?.idx}<ObjectArt obj={tryObj} />{/key}
            </div>
          {/if}
          {#if stage === 'retry'}
            <div class="absolute inset-0 overflow-hidden"><div class="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-paper/25 to-transparent" style="animation:shimmer 1s linear infinite"></div></div>
          {/if}
          {#if S.pending && (stage === 'choose' || stage === 'retry')}
            <div class="absolute -inset-[3px] rounded-[4px] border-[3px] border-dashed border-coral/90" style="animation:march 1.2s linear infinite"></div>
          {/if}
          {#if stage === 'stitch'}
            <div class="absolute -inset-[3px] rounded-[4px] border-[4px] border-coral" style="animation:stitchdone .65s ease-out forwards"></div>
          {/if}
        </div>
      {/if}
    </div>
    {/if}
  </div>

  <!-- ===== screen layer: edge handles ===== -->
  {#if ready}
    <div class="absolute inset-0 pointer-events-none">
      {#each S.edges as e (e.id)}
        {@const m = edgeMid(e)}
        {@const sp = S.toScreen(m.x, m.y)}
        {@const isActive = S.active?.id === e.id}
        {#if (sp.x > -40 && sp.y > -40 && sp.x < S.vw + 40 && sp.y < S.vh + 40) || isActive}
          <button class="absolute h-14 w-14 -ml-7 -mt-7 flex items-center justify-center pointer-events-auto touch-none transition-opacity duration-300"
            style="left:{sp.x}px;top:{sp.y}px;opacity:{isActive ? 0 : S.pending || S.active ? 0.15 : 1}"
            onpointerdown={(ev) => down(ev, e)} onpointermove={move} onpointerup={up} onpointercancel={up}
            aria-label="pull this edge" in:scale={{ start: 0.2, duration: 500, delay: 200, easing: backOut }}>
            <span class="grip {e.dx ? 'gv' : 'gh'}"></span>
            <span class="absolute text-[11px] text-paper/90 font-bold pointer-events-none" style="transform:translate({e.dx * 17}px,{e.dy * 17}px) rotate({e.dx === 1 ? 0 : e.dx === -1 ? 180 : e.dy === 1 ? 90 : -90}deg)">›</span>
          </button>
        {/if}
      {/each}
      <!-- the handle you are holding follows your finger -->
      {#if S.active && finger}
        <div class="absolute pointer-events-none -ml-6 -mt-6 h-12 w-12 rounded-full border-2 transition-colors {crossed ? 'border-coral bg-coral/25' : 'border-paper/70 bg-paper/10'}" style="left:{finger.x}px;top:{finger.y}px"></div>
        {#if crossed}
          <div class="absolute pointer-events-none -translate-x-1/2 rounded-full bg-coral text-ink px-2 py-0.5 text-[12px] font-semibold" style="left:{clamp(finger.x, 50, S.vw - 50)}px;top:{finger.y - 52}px" in:scale={{ start: 0.5, duration: 200, easing: backOut }}>שחררו ✦1</div>
        {/if}
      {/if}
      {#if v === 'thread' && (S.active || S.pending?.stage === 'words')}
        {@const e0 = S.active ? edgeMid({ fc: S.active.c - S.active.dx, fr: S.active.r - S.active.dy, dx: S.active.dx, dy: S.active.dy }) : edgeMid({ fc: S.pending!.c - S.pending!.dx, fr: S.pending!.r - S.pending!.dy, dx: S.pending!.dx, dy: S.pending!.dy })}
        {@const a = S.toScreen(e0.x, e0.y)}
        {@const b = finger ?? S.toScreen((S.pending!.c + 0.5) * T, (S.pending!.r + 0.5) * T)}
        {@const sag = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.25)}
        <svg class="absolute inset-0 w-full h-full overflow-visible">
          <path d="M{a.x} {a.y} Q{(a.x + b.x) / 2} {(a.y + b.y) / 2 + sag} {b.x} {b.y}" stroke="#ff6b4a" stroke-width="2.5" fill="none" stroke-dasharray="1 0" />
          <g transform="translate({b.x} {b.y}) rotate({(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})">
            <path d="M-4 -3 L22 0 L-4 3 Z" fill="#f4e9d8" /><circle cx="-1" cy="0" r="1.6" fill="#0f0d17" />
          </g>
        </svg>
      {/if}
      {#if coach}
        {@const m = edgeMid(coach)}
        {@const sp = S.toScreen(m.x, m.y)}
        <div class="absolute pointer-events-none" style="left:{sp.x}px;top:{sp.y}px;--dx:{coach.dx * 90}px;--dy:{coach.dy * 90}px">
          <div class="coach -ml-5 -mt-5 h-10 w-10 rounded-full bg-paper/80 shadow-[0_0_0_6px_rgba(244,233,216,.25)]"></div>
        </div>
      {/if}
    </div>
  {/if}

  {#if !ready}
    <div class="absolute inset-0 flex items-center justify-center text-paper/50 text-[14px]" dir="rtl">מערבבים צבעים…</div>
  {/if}

  <!-- ===== top bar ===== -->
  <div class="absolute inset-x-0 top-0 safe-t px-3 pointer-events-none" dir="rtl">
    <div class="mt-1 flex items-center justify-between gap-2">
      <div class="flex items-center gap-1 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1 pointer-events-auto">
        {#each VARIANTS as x}
          <button class="rounded-full px-3 py-1.5 text-[14px] transition-colors {v === x.id ? 'bg-paper text-ink font-semibold' : 'text-paper/70'}" onclick={() => setVariant(x.id)}>{x.name}</button>
        {/each}
      </div>
      <div class="flex items-center gap-1.5 pointer-events-auto">
        <div class="rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 px-3 py-1.5 text-[14px] tabular-nums"><span class="text-coral">✦</span> {S.credits}</div>
        <button class="h-9 w-9 rounded-full bg-ink-2/80 border border-paper/10 text-paper/60" onclick={() => (menu = !menu)} aria-label="menu">⋯</button>
      </div>
    </div>
  </div>

  {#if menu}
    <div class="absolute inset-0 z-50 bg-ink/40" onclick={() => (menu = false)} role="presentation" transition:fade={{ duration: 120 }}></div>
    <div class="absolute left-3 z-50 w-56 rounded-2xl bg-ink-2 border border-paper/10 p-2 shadow-2xl" dir="rtl" style="top:calc(max(env(safe-area-inset-top),10px) + 50px)" transition:scale={{ start: 0.92, duration: 180 }}>
      <button class="w-full text-right rounded-xl px-3 py-2.5 text-[14px] active:bg-ink-3" onclick={() => { ghostPull(); menu = false; }}>מישהו אחר מושך קצה</button>
      <button class="w-full text-right rounded-xl px-3 py-2.5 text-[14px] active:bg-ink-3" onclick={() => { S.cam.set(S.fitStart(), { duration: 700 }); menu = false; }}>חזרה למרכז</button>
      <button class="w-full text-right rounded-xl px-3 py-2.5 text-[14px] active:bg-ink-3" onclick={() => { S.reset(); touched = false; S.cam.set(S.fitStart(), { duration: 700 }); menu = false; }}>איפוס (12 קרדיטים)</button>
    </div>
  {/if}

  <!-- ===== bottom ===== -->
  <div class="absolute inset-x-0 bottom-0 safe-b px-3 pointer-events-none" dir="rtl">
    {#if !S.pending && !S.active}
      {#key v}
        <div class="mx-auto mb-2 w-fit rounded-full bg-ink-2/85 backdrop-blur border border-paper/10 px-4 py-2 text-[14px] text-paper/80" in:fly={{ y: 16, duration: 350 }}>
          {hint}{#if S.added > 0}<span class="text-paper/45"> · הוספת {S.added}</span>{/if}
        </div>
      {/key}
    {/if}

    {#if S.pending?.stage === 'words'}
      <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-3 pointer-events-auto shadow-2xl" in:fly={{ y: 40, duration: 350 }}>
        <div class="px-1 pb-2 text-[15px] font-medium">מה ממשיך מכאן?</div>
        <div class="flex flex-wrap gap-2 pb-2">
          {#each WORDS as w}
            <button class="rounded-full border border-paper/15 bg-ink-3 px-3 py-1.5 text-[14px] active:bg-coral active:text-ink" onclick={() => sayWord(w.w)}>{w.w}</button>
          {/each}
        </div>
        <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); sayWord(word); }}>
          <input class="flex-1 min-w-0 rounded-2xl bg-ink px-3 py-2.5 text-[16px] outline-none border border-paper/10 focus:border-coral/60" placeholder="כמה מילים…" bind:value={word} />
          <button class="rounded-2xl bg-coral px-4 text-[15px] font-semibold text-ink disabled:opacity-40" disabled={!word.trim()}>תפור</button>
        </form>
      </div>
    {/if}

    {#if S.pending && (S.pending.stage === 'choose' || S.pending.stage === 'retry' || S.pending.stage === 'stitch')}
      {@const pd = S.pending}
      <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-3 pointer-events-auto shadow-2xl" in:fly={{ y: 40, duration: 350 }} out:fly={{ y: 40, duration: 250 }}>
        <div class="flex items-center gap-2 pb-2.5">
          {#each [0, 1, 2, 3] as i}
            {#if i < pd.tries.length}
              <button class="h-11 w-11 rounded-xl border-2 overflow-hidden relative {pd.idx === i ? 'border-coral' : 'border-paper/15'}" style={bg(pd.c, pd.r, img?.full) + `background-size:${W / 5.8}px ${H / 5.8}px;background-position:${(-(pd.c - C0) * T) / 5.8}px ${(-(pd.r - R0) * T) / 5.8}px`} onclick={() => pick(i)} aria-label="try {i + 1}">
                <ObjectArt obj={pd.tries[i]} />
              </button>
            {:else if i === pd.tries.length}
              <button class="h-11 flex-1 rounded-xl border-2 border-dashed border-paper/25 text-[14px] text-paper/80 disabled:opacity-40" disabled={pd.stage !== 'choose' || S.credits <= 0} onclick={() => newTry()}>עוד ניסיון <span class="text-coral">✦1</span></button>
            {/if}
          {/each}
        </div>
        {#if v !== 'thread'}
          <form class="flex gap-2 pb-2.5" onsubmit={(e) => { e.preventDefault(); if (steer.trim()) newTry(steer); }}>
            <input class="flex-1 min-w-0 rounded-2xl bg-ink px-3 py-2 text-[16px] outline-none border border-paper/10 focus:border-coral/60" placeholder="לכוון במילים (לא חובה)" bind:value={steer} />
            {#if steer.trim()}<button class="rounded-2xl bg-ink-3 px-3 text-[14px]" disabled={pd.tries.length >= 4}>נסה <span class="text-coral">✦1</span></button>{/if}
          </form>
        {:else if pd.word}
          <div class="pb-2.5 text-[13px] text-paper/55">ביקשת: <span class="text-paper">{pd.word}</span></div>
        {/if}
        <div class="flex gap-2">
          <button class="rounded-2xl px-4 py-3 text-[15px] text-paper/70" onclick={cancel}>ביטול</button>
          <button class="flex-1 rounded-2xl bg-coral py-3 text-[16px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={stitch}>תפור לציור ✓</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- ghost avatar -->
  {#if S.ghost}
    {@const g = S.ghost}
    {@const sp = S.toScreen((g.c + 0.5) * T, (g.r + 0.5) * T)}
    <div class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-ink-2/95 border border-paper/10 pl-3 pr-1 py-1 text-[13px]" dir="rtl" style="left:{sp.x}px;top:{sp.y}px" in:scale={{ start: 0.6, duration: 300, easing: backOut }} out:fade>
      <span class="h-6 w-6 rounded-full flex items-center justify-center text-ink font-semibold text-[12px]" style="background:{g.by.color}">{g.by.name[0]}</span>{g.by.name} מושכת
    </div>
  {/if}

  <!-- toasts -->
  <div class="absolute inset-x-0 top-[64px] z-40 flex flex-col items-center gap-2 pointer-events-none px-4" dir="rtl">
    {#each S.toasts as t (t.id)}
      <div class="flex items-center gap-2 rounded-full bg-ink-2/95 border border-paper/10 px-4 py-2 text-[14px] shadow-xl" in:fly={{ y: -16 }} out:fade>
        {#if t.color}<span class="h-2.5 w-2.5 rounded-full" style="background:{t.color}"></span>{/if}{t.text}
      </div>
    {/each}
  </div>
</div>

<style>
  .bleed { -webkit-mask-image: var(--g); mask-image: var(--g); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; animation: bleed 3.2s ease-in-out infinite; }
  @keyframes bleed { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
  .hint { -webkit-mask-image: var(--g); mask-image: var(--g); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; filter: invert(1) sepia(.3) brightness(1.5) contrast(1.3); mix-blend-mode: screen; opacity: 1; }
  .hx { animation: breatheX 3.2s ease-in-out infinite; }
  .hy { animation: breatheY 3.2s ease-in-out infinite; }
  @keyframes breatheX { 0%, 100% { -webkit-mask-size: 22% 100%; mask-size: 22% 100%; } 50% { -webkit-mask-size: 42% 100%; mask-size: 42% 100%; } }
  @keyframes breatheY { 0%, 100% { -webkit-mask-size: 100% 22%; mask-size: 100% 22%; } 50% { -webkit-mask-size: 100% 42%; mask-size: 100% 42%; } }
  .edge-glow { background: #ffb38a; box-shadow: 0 0 18px 6px rgba(255, 107, 74, .55); border-radius: 99px; animation: glow 3.2s ease-in-out infinite; }
  @keyframes glow { 0%, 100% { opacity: .35; } 50% { opacity: .9; } }
  .grip { display: block; border-radius: 99px; background: #f4e9d8; box-shadow: 0 0 0 4px rgba(255, 107, 74, .35), 0 0 16px rgba(255, 107, 74, .8); animation: gripPulse 1.6s ease-in-out infinite; }
  .gv { width: 9px; height: 34px; }
  .gh { width: 34px; height: 9px; }
  @keyframes gripPulse { 0%, 100% { box-shadow: 0 0 0 3px rgba(255, 107, 74, .35), 0 0 12px rgba(255, 107, 74, .6); } 50% { box-shadow: 0 0 0 7px rgba(255, 107, 74, .15), 0 0 22px rgba(255, 107, 74, .9); } }
  .fabric { box-shadow: 0 0 24px rgba(0, 0, 0, .35), inset 0 0 18px rgba(0, 0, 0, .25); filter: saturate(1.2) brightness(1.05); }
  .fabric::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .06) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(0, 0, 0, .07) 0 2px, transparent 2px 7px); }
  .coach { animation: coach 2.4s cubic-bezier(.5, 0, .3, 1) infinite; }
  @keyframes coach { 0% { transform: translate(0, 0) scale(.6); opacity: 0; } 15% { transform: translate(0, 0) scale(1); opacity: .9; } 70% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: .9; } 100% { transform: translate(var(--dx), var(--dy)) scale(.7); opacity: 0; } }
  @keyframes -global-fadeflash { 0% { opacity: .8 } 100% { opacity: 0 } }
  @keyframes -global-march { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
  @keyframes -global-stitchdone { 0% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1.06) } }
</style>
