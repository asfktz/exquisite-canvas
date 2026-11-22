<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { T } from '../lib/art';
  import { app, tileBg, SIDES, key } from './state.svelte';
  import { hash, type Side } from './ideas';
  import TileArt from './TileArt.svelte';

  const cam = $derived(app.cam.current);
  const spots = $derived(app.spots);
  const fs = $derived(app.focusSpot);
  const p = $derived(app.progress.current);
  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);

  const DIR: Record<Side, string> = { l: 'to right', r: 'to left', t: 'to bottom', b: 'to top' };
  const mask = (sides: Side[], reach = 'var(--reach)') => {
    const m = sides.map((s) => `linear-gradient(${DIR[s]}, #000 0%, rgba(0,0,0,.55) calc(${reach} * .55), transparent ${reach})`).join(',');
    return `-webkit-mask-image:${m};mask-image:${m};`;
  };
  const delay = (k: string) => `animation-delay:-${(hash(k) % 4000) / 1000}s;`;

  // seams between an open spot and a filled neighbour (world coords)
  function seam(c: number, r: number, s: Side) {
    const t = 10; // glow thickness, world units
    if (s === 'l') return { x: c * T, y: r * T, w: t * 3, h: T, g: 'to right' };
    if (s === 'r') return { x: (c + 1) * T - t * 3, y: r * T, w: t * 3, h: T, g: 'to left' };
    if (s === 't') return { x: c * T, y: r * T, w: T, h: t * 3, g: 'to bottom' };
    return { x: c * T, y: (r + 1) * T - t * 3, w: T, h: t * 3, g: 'to top' };
  }

  function pullClip(s: Side, a: number) {
    const v = Math.max(0, 100 - a * 100);
    if (s === 'l') return `inset(0 ${v}% 0 0)`;
    if (s === 'r') return `inset(0 0 0 ${v}%)`;
    if (s === 't') return `inset(0 0 ${v}% 0)`;
    return `inset(${v}% 0 0 0)`;
  }
  const ORIGIN: Record<Side, string> = { l: 'left center', r: 'right center', t: 'center top', b: 'center bottom' };

  function stitches(c: number, r: number) {
    const out: { x1: number; y1: number; x2: number; y2: number; d: number }[] = [];
    let i = 0;
    for (const s of app.sidesOf(c, r)) {
      for (let u = 14; u < T; u += 22) {
        const a = 9;
        if (s === 'l' || s === 'r') { const x = s === 'l' ? 0 : T; out.push({ x1: x - a, y1: u - a * 0.6, x2: x + a, y2: u + a * 0.6, d: i++ }); }
        else { const y = s === 't' ? 0 : T; out.push({ x1: u - a * 0.6, y1: y - a, x2: u + a * 0.6, y2: y + a, d: i++ }); }
      }
    }
    return out;
  }
</script>

<div class="absolute inset-0 pointer-events-none opacity-50" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.4px, transparent 1.6px);{grid}"></div>

<div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({app.vw / 2}px,{app.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">
  <!-- filled tiles -->
  {#each app.filled as t (key(t.c, t.r))}
    <div class="absolute {t.fresh ? 'settle' : ''}" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px">
      <TileArt c={t.c} r={t.r} obj={t.obj} tint={t.tint} jit={t.jit} />
      {#if t.fresh}<div class="absolute inset-0 bg-white pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
    </div>
  {/each}

  <!-- open spots: the painting leaks a little past the edge, breathing -->
  {#each spots as s (s.k)}
    {@const isFocus = s.k === app.focus}
    {@const pulling = app.pull?.k === s.k && !isFocus}
    {@const visitor = app.visitors[s.k]}
    <div class="absolute" style="left:{s.c * T}px;top:{s.r * T}px;width:{T}px;height:{T}px" in:scale={{ start: 0.6, duration: 700, easing: backOut, delay: 150 }}>
      {#if !isFocus}
        <!-- seam glow -->
        {#each s.sides as sd}
          {@const g = seam(0, 0, sd)}
          <div class="absolute seam" style="left:{g.x}px;top:{g.y}px;width:{g.w}px;height:{g.h}px;background:linear-gradient({g.g}, rgba(255,214,160,.55), rgba(255,214,160,0));{delay(s.k + sd)}"></div>
        {/each}

        {#if pulling}
          {@const a = app.pullAmt.current}
          {@const sd = app.pull!.side}
          <div class="absolute inset-0" style="clip-path:{pullClip(sd, a)};transform:{sd === 'l' || sd === 'r' ? `scaleX(${0.82 + 0.18 * Math.min(1, a)})` : `scaleY(${0.82 + 0.18 * Math.min(1, a)})`};transform-origin:{ORIGIN[sd]};filter:saturate({0.6 + a * 0.4})">
            <TileArt c={s.c} r={s.r} />
            <div class="absolute {sd === 'l' || sd === 'r' ? 'inset-y-0 w-[6px]' : 'inset-x-0 h-[6px]'} bg-[#ffd166] shadow-[0_0_24px_8px_rgba(255,209,102,.6)]" style="{sd === 'l' ? `left:${a * 100}%` : sd === 'r' ? `right:${a * 100}%` : sd === 't' ? `top:${a * 100}%` : `bottom:${a * 100}%`};transform:translate({sd === 'l' ? '-6px' : sd === 'r' ? '6px' : '0'},{sd === 't' ? '-6px' : sd === 'b' ? '6px' : '0'})"></div>
          </div>
        {:else if app.variant === 'dream' && !visitor}
          {@const ideas = app.ideas(s.c, s.r)}
          {@const di = app.dreamIndex(s.k, ideas.length)}
          {#key di}
            <div class="absolute inset-0 dream" style="{mask(s.sides)}{delay(s.k)}" in:fade={{ duration: 1400 }} out:fade={{ duration: 1400 }}>
              <TileArt c={s.c} r={s.r} obj={ideas[di].obj} tint={ideas[di].tint} />
            </div>
          {/key}
        {:else}
          <div class="absolute inset-0 ghost {visitor ? 'busy' : ''}" style="{tileBg(app.img, s.c, s.r)}{mask(s.sides)}{delay(s.k)}"></div>
        {/if}

        {#if visitor}
          <div class="absolute inset-[10px] rounded-[10px] border-2 border-dashed" style="border-color:{visitor.color}99"></div>
          <div class="absolute inset-0 overflow-hidden"><div class="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-paper/10 to-transparent animate-[shimmer_2.4s_linear_infinite]"></div></div>
        {:else if app.variant === 'bloom'}
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid grid-cols-2 gap-[10px] bud" style={delay(s.k)}>
            {#each [0, 1, 2, 3] as i}<div class="h-[22px] w-[22px] rounded-[7px] border-[3px] border-paper/70 bg-paper/15" style="animation-delay:{i * 0.15}s"></div>{/each}
          </div>
        {/if}
      {/if}
    </div>
  {/each}

  <!-- dim the rest of the map while focused -->
  {#if fs}
    <div class="absolute pointer-events-none" transition:fade={{ duration: 500 }}
      style="left:{fs.c * T}px;top:{fs.r * T}px;width:{T}px;height:{T}px;box-shadow:0 0 0 200000px rgba(15,13,23,.62);border-radius:4px"></div>
  {/if}

  <!-- the focused spot -->
  {#if fs}
    {@const take = app.takes[app.pick]}
    <div class="absolute" style="left:{fs.c * T - 0.5}px;top:{fs.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px" transition:fade={{ duration: 300 }}>
      {#if app.variant === 'bloom' && app.pick === -1}
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[6px] bg-ink p-[6px]">
          {#each app.takes as tk, i}
            {@const rv = Math.max(0, Math.min(1, (p - i * 0.12) / 0.64))}
            <button class="relative overflow-hidden rounded-[6px] pointer-events-auto active:scale-95 transition-transform" onclick={() => app.phase === 'focus' && (app.pick = i)} in:scale={{ start: 0.3, duration: 600, delay: i * 90, easing: backOut }}>
              <div class="absolute left-0 top-0 origin-top-left" style="width:{T}px;height:{T}px;transform:scale({(T - 18) / 2 / T})">
                <TileArt c={fs.c} r={fs.r} obj={tk.obj} tint={tk.tint} jit={tk.jit} look={app.phase === 'painting' ? 'painting' : 'final'} reveal={rv} />
              </div>
            </button>
          {/each}
        </div>
      {:else if app.phase === 'painting' && app.pending}
        <TileArt c={fs.c} r={fs.r} obj={app.pending.obj} tint={app.pending.tint} jit={app.pending.jit} look="painting" reveal={p} />
      {:else if take}
        {#key app.pick}
          <div class="absolute inset-0" in:scale={{ start: 0.5, duration: 450, easing: cubicOut }}>
            <TileArt c={fs.c} r={fs.r} obj={take.obj} tint={take.tint} jit={take.jit} />
          </div>
        {/key}
      {:else if app.idea}
        {#key app.idea.text}
          <div class="absolute inset-0" in:fade={{ duration: 350 }}>
            <TileArt c={fs.c} r={fs.r} obj={app.idea.obj} look="sketch" />
          </div>
        {/key}
        <div class="absolute inset-0 pointer-events-none" style="background:repeating-linear-gradient(135deg, transparent 0 14px, rgba(244,233,216,.05) 14px 15px)"></div>
      {/if}

      <!-- frame -->
      {#if app.phase !== 'stitching'}
        <div class="absolute inset-[-3px] rounded-[5px] border-[3px] border-dashed border-paper/70 pointer-events-none"></div>
      {/if}

      {#if app.phase === 'stitching'}
        <svg class="absolute overflow-visible pointer-events-none" style="left:0;top:0;width:{T}px;height:{T}px" viewBox="0 0 {T} {T}">
          {#each stitches(fs.c, fs.r) as st}
            <line x1={st.x1} y1={st.y1} x2={st.x2} y2={st.y2} class="stitch" style="animation-delay:{st.d * 0.035}s" />
          {/each}
        </svg>
      {/if}
    </div>
  {/if}
</div>
