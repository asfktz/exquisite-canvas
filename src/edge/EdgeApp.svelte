<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { T, paintMaster } from '../lib/art';
  import { key } from '../lib/world.svelte';
  import { panzoom } from '../lib/gestures';
  import { edge, VARIANTS, type Side } from './state.svelte';
  import Map from './Map.svelte';

  let ready = $state(false);
  let menu = $state(false);
  let touched = $state(false); // hide the first-time hint after the first action

  onMount(() => {
    const vv = window.visualViewport;
    const onResize = () => { edge.vw = vv?.width ?? window.innerWidth; edge.vh = vv?.height ?? window.innerHeight; };
    onResize();
    vv?.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    paintMaster().then((img) => { edge.img = img; edge.restart(); ready = true; });
    // test hook: a screen point on the open edge closest to the centre
    (window as any).__edgePt = () => {
      const cm = edge.cam.current;
      const toS = (wx: number, wy: number) => ({ x: (wx - cm.x) * cm.s + edge.vw / 2, y: (wy - cm.y) * cm.s + edge.vh / 2 });
      const f = [...edge.frontier].sort((a, b) => { const A = toS((a.c + .5) * T, (a.r + .5) * T), B = toS((b.c + .5) * T, (b.r + .5) * T); return Math.hypot(A.x - edge.vw / 2, A.y - edge.vh / 2) - Math.hypot(B.x - edge.vw / 2, B.y - edge.vh / 2); })[0];
      if (!f) return null;
      const s = f.sides[0]; const [ix, iy] = INWARD[s];
      const sx = s === 'l' ? 0.12 : s === 'r' ? 0.88 : 0.5, sy = s === 't' ? 0.12 : s === 'b' ? 0.88 : 0.5;
      const a = toS((f.c + sx) * T, (f.r + sy) * T);
      return { x0: a.x, y0: a.y, x1: a.x + ix * T * cm.s * 0.8, y1: a.y + iy * T * cm.s * 0.8 };
    };
    const clock = setInterval(() => (edge.now = Date.now()), 200);
    const others = setInterval(() => { if (edge.mode === 'browse' || edge.mode === 'choose') edge.simulateOther(); }, 16000);
    return () => { clearInterval(clock); clearInterval(others); window.removeEventListener('resize', onResize); };
  });

  // ---------- pull: grab an open edge instead of panning ----------
  const INWARD: Record<Side, [number, number]> = { l: [1, 0], r: [-1, 0], t: [0, 1], b: [0, -1] };
  function pullDown(e: PointerEvent) {
    if (edge.variant !== 'pull' || edge.mode !== 'browse' || !ready) return;
    if ((e.target as HTMLElement).closest('button, .ui')) return;
    const { c, r, fx, fy } = edge.screenToCell(e.clientX, e.clientY);
    if (!edge.frontier.some((f) => f.k === key(c, r))) return;
    e.stopPropagation();
    touched = true;
    const side = edge.nearestSide(c, r, fx, fy);
    edge.startPull(c, r, side);
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!edge.pull) return;
      const [ix, iy] = INWARD[side];
      const proj = (ev.clientX - x0) * ix + (ev.clientY - y0) * iy;
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) moved = true;
      edge.pull.p = Math.max(0, Math.min(1, 0.15 + proj / (T * edge.cam.current.s)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!moved && edge.pull) { edge.autoPull(c, r, side); return; }
      edge.endPull();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // ---------- choose: swipe between attempts anywhere on screen ----------
  function swipeDown(e: PointerEvent) {
    if (edge.mode !== 'choose') return;
    if ((e.target as HTMLElement).closest('button, .ui')) return;
    const x0 = e.clientX, y0 = e.clientY;
    let horiz: boolean | null = null;
    const follow = edge.variant === 'breathe' || edge.variant === 'pull';
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (horiz === null && Math.hypot(dx, dy) > 8) horiz = Math.abs(dx) > Math.abs(dy) * 0.8;
      if (!horiz) return;
      edge.dragging = true;
      let d = dx;
      // rubber band at the ends of the breathe strip
      if (edge.variant === 'breathe' && ((edge.idx === 0 && d > 0) || (edge.idx === edge.attempts.length - 1 && d < 0))) d *= 0.3;
      edge.dragX = follow ? d : d * 0.15;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const dx = ev.clientX - x0;
      edge.dragging = false;
      if (horiz && Math.abs(dx) > 48) {
        touched = true;
        if (edge.variant === 'pull') edge.go(Math.sign(dx));
        else edge.go(dx < 0 ? 1 : -1);
      }
      edge.dragX = 0;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  const vinfo = $derived(VARIANTS.find((x) => x.id === edge.variant)!);
  const HINT: Record<string, string> = {
    breathe: 'Tap a breathing edge to continue it',
    dream: 'Tap a dreaming cell to wake it',
    pull: 'Grab an edge and pull the picture out',
    grow: 'Tap a glowing seam',
  };
  const SWIPE: Record<string, string> = {
    breathe: 'Swipe to see all 4',
    dream: 'Tap or swipe for the next dream',
    pull: 'Flick it away for the next one',
    grow: 'Swipe, or tap another seam to grow from there',
  };
</script>

<div class="fixed inset-0 overflow-hidden select-none touch-none bg-ink" onpointerdowncapture={pullDown} onpointerdown={swipeDown} role="application">
  <div class="absolute inset-0" use:panzoom={{
    enabled: () => edge.gesturesOn && !edge.pull,
    get: () => edge.cam.current,
    set: (v) => edge.cam.set(v, { duration: 0 }),
    fling: (v) => edge.cam.set(v, { duration: 600, easing: cubicOut }),
    onTap: (x, y) => { if (edge.mode === 'browse') touched = true; edge.after = null; edge.tapAt(x, y); },
    minS: 0.12, maxS: 3,
  }}>
    {#if ready}<Map />{/if}
  </div>

  {#if !ready}
    <div class="absolute inset-0 flex items-center justify-center text-paper/50 text-[14px]">Mixing paint…</div>
  {/if}

  <!-- ===== top bar ===== -->
  <div class="ui absolute inset-x-0 top-0 safe-t px-3 flex items-start justify-between gap-2 pointer-events-none">
    <div class="mt-1 rounded-2xl bg-ink-2/85 backdrop-blur border border-paper/10 pl-3.5 pr-2 py-2 pointer-events-auto flex items-center gap-2">
      <div>
        <div class="font-display text-[19px] leading-none">Exquisite</div>
        <div class="text-[11px] text-paper/55 mt-1">{edge.list.length} tiles · {edge.frontier.length} open edges</div>
      </div>
      <button class="ml-1 rounded-full bg-ink-3 px-2.5 py-1.5 text-[12px] text-paper/80" onclick={() => (menu = !menu)}>{vinfo.name} ▾</button>
    </div>
    <div class="relative mt-1 pointer-events-auto">
      <div class="rounded-full bg-ink-2/85 backdrop-blur border border-paper/10 px-3.5 py-2 text-[14px] font-semibold flex items-center gap-1.5 tabular-nums">
        <span class="text-[#ffd166]">✦</span>{edge.credits}
      </div>
      {#each edge.spent as s (s.id)}
        <div class="absolute right-3 top-9 text-[14px] font-semibold text-coral spent">−{s.n}</div>
      {/each}
    </div>
  </div>

  <!-- ===== bottom ===== -->
  {#if ready}
    <div class="ui absolute inset-x-0 bottom-0 safe-b px-3 flex justify-center pointer-events-none">
      {#if edge.mode === 'browse' && edge.after}
        <div class="w-full max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-4 pointer-events-auto shadow-2xl" in:fly={{ y: 60, duration: 500, delay: 300, easing: backOut }} out:fade={{ duration: 150 }}>
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 shrink-0 rounded-full bg-[#ffd166]/15 flex items-center justify-center text-[#ffd166] text-[20px]">✓</div>
            <div class="flex-1 leading-snug">
              <div class="text-[16px] font-semibold">Stitched in</div>
              <div class="text-[13px] text-paper/60">{edge.after.opened.length ? `Your tile opened ${edge.after.opened.length} new edge${edge.after.opened.length > 1 ? 's' : ''}` : 'It closed a gap in the picture'}</div>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button class="flex-1 rounded-2xl bg-ink-3 py-3 text-[14px] text-paper/80" onclick={() => { edge.after = null; edge.cam.set(edge.fitAll(), { duration: 900 }); }}>See it all</button>
            <button class="flex-[1.4] rounded-2xl bg-coral py-3 text-[15px] font-semibold text-ink" onclick={() => edge.keepGoing()}>Keep going <span class="opacity-60 font-normal">· ✦1</span></button>
          </div>
        </div>
      {:else if edge.mode === 'browse'}
        <div class="flex flex-col items-center gap-2 pb-1" in:fade>
          {#if !touched}
            <div class="rounded-full bg-ink-2/85 backdrop-blur border border-paper/10 px-4 py-2 text-[13px] text-paper/80 hint">{HINT[edge.variant]}</div>
          {/if}
          <button class="pointer-events-auto rounded-full bg-ink-2/80 border border-paper/10 px-4 py-2 text-[13px] text-paper/60" onclick={() => edge.cam.set(edge.fitAll(), { duration: 800 })}>Fit</button>
        </div>
      {:else if edge.mode === 'generating'}
        <div class="w-full max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 px-5 py-5 text-center" in:fly={{ y: 40, duration: 300 }}>
          <div class="text-[15px] text-paper/80 shimmer-text">Imagining 4 ways to continue…</div>
        </div>
      {:else if edge.mode === 'choose' && edge.current}
        <div class="w-full max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-3.5 pointer-events-auto shadow-2xl" in:fly={{ y: 60, duration: 400, easing: cubicOut }}>
          <div class="flex items-start gap-2 px-1">
            <div class="flex-1 min-w-0">
              {#key edge.idx + '-' + edge.round}
                <div class="text-[16px] leading-snug first-letter:uppercase" in:fly={{ y: 6, duration: 250 }}>{edge.current.caption}</div>
              {/key}
              <div class="mt-1.5 flex items-center gap-1.5">
                {#each edge.attempts as _, i}
                  <button aria-label="Attempt {i + 1}" class="h-2 rounded-full transition-all duration-300 {i === edge.idx ? 'w-5 bg-paper' : 'w-2 bg-paper/25'}" onclick={() => { edge.prevIdx = edge.idx; edge.idx = i; edge.growKey++; }}></button>
                {/each}
                <span class="ml-1.5 text-[12px] text-paper/40">{SWIPE[edge.variant]}</span>
              </div>
            </div>
            <button class="h-8 w-8 shrink-0 rounded-full bg-ink-3 text-paper/60 text-[15px]" onclick={() => edge.cancel()} aria-label="Close">✕</button>
          </div>
          <div class="mt-3 flex gap-2">
            <button class="flex-1 rounded-2xl bg-ink-3 py-3 text-[14px] text-paper/85" onclick={() => edge.more()}>↻ 4 more <span class="opacity-50">· ✦1</span></button>
            <button class="flex-[1.3] rounded-2xl bg-coral py-3 text-[15px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => edge.stitch()}>Stitch it in</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- toasts -->
  <div class="ui absolute inset-x-0 top-[74px] z-40 flex flex-col items-center gap-2 pointer-events-none px-4">
    {#each edge.toasts as t (t.id)}
      <div class="flex items-center gap-2 rounded-full bg-ink-2/95 border border-paper/10 px-4 py-2 text-[13px] shadow-xl" in:fly={{ y: -16 }} out:fade>
        {#if t.color}<span class="h-2.5 w-2.5 rounded-full shrink-0" style="background:{t.color}"></span>{/if}{t.text}
      </div>
    {/each}
  </div>

  <!-- variant menu -->
  {#if menu}
    <div class="ui absolute inset-0 z-50 bg-ink/50" onclick={() => (menu = false)} role="presentation" transition:fade={{ duration: 150 }}></div>
    <div class="ui absolute left-3 z-50 w-[min(340px,calc(100vw-24px))] rounded-3xl bg-ink-2 border border-paper/10 p-3 shadow-2xl" style="top:calc(max(env(safe-area-inset-top),10px) + 62px)" transition:scale={{ start: 0.92, duration: 200, easing: backOut }}>
      <div class="px-2 pb-2 text-[11px] uppercase tracking-widest text-paper/40">Inviting edge · 4 takes</div>
      {#each VARIANTS as x}
        <button class="w-full text-left rounded-2xl px-3 py-2.5 {edge.variant === x.id ? 'bg-ink-3' : ''}" onclick={() => { edge.setVariant(x.id); touched = false; menu = false; }}>
          <div class="text-[14px] font-medium">{x.name} <span class="text-paper/40 font-normal">{x.he}</span> {edge.variant === x.id ? '✓' : ''}</div>
          <div class="text-[12px] text-paper/50 leading-snug">{x.note}</div>
        </button>
      {/each}
      <div class="my-2 h-px bg-paper/10"></div>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { edge.simulateOther(); menu = false; }}>Someone adds a tile</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { edge.restart(); touched = false; menu = false; }}>Restart</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .spent { animation: spent 1.1s ease-out forwards; }
  @keyframes spent { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(18px) } }
  .hint { animation: hint 2.6s ease-in-out infinite; }
  @keyframes hint { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
  .shimmer-text { background: linear-gradient(90deg, rgba(244,233,216,.45) 0%, #fff 50%, rgba(244,233,216,.45) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: sh 1.2s linear infinite; }
  @keyframes sh { from { background-position: 100% 0 } to { background-position: -100% 0 } }
</style>
