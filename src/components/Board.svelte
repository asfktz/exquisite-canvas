<script lang="ts">
  import { fade } from 'svelte/transition';
  import { T, W, H, C0, C1, R0, R1 } from '../lib/art';
  import { world, key, SEASONS, LAST_SEASON } from '../lib/world.svelte';
  import { app } from '../lib/app.svelte';
  import { secs } from '../lib/bits';
  import ObjectArt from './ObjectArt.svelte';

  const cam = $derived(app.cam.current);
  const img = $derived(app.img);
  const p = $derived(app.progress.current);
  const sketch = $derived(Math.min(1, p / 0.45));
  const paint = $derived(Math.max(0, Math.min(1, (p - 0.35) / 0.65)));

  const bg = (c: number, r: number, fog = false) =>
    img ? `background-image:url(${fog ? img.fog : img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);
  const mt = $derived(app.mine);

  // every cell of the world, classified for drawing
  type Cell = { c: number; r: number; k: string; kind: 'art' | 'fogged' | 'mist' | 'future' | 'slot' };
  const cells = $derived.by(() => {
    const out: Cell[] = [];
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
      const k = key(c, r);
      const t = world.tiles[k];
      const s = world.seasonAt(c, r);
      let kind: Cell['kind'];
      if (t?.status === 'filled') kind = world.canSee(c, r) ? 'art' : 'fogged';
      else if (t) kind = 'slot';
      else if (s === world.season && world.revealedUpTo < world.season) kind = 'mist';
      else if (s > world.season) kind = 'future';
      else continue;
      out.push({ c, r, k, kind });
    }
    return out;
  });

  // outline of this week's fogged region
  const edges = $derived.by(() => {
    if (world.revealedUpTo >= world.season) return [];
    const out: { x: number; y: number; w: number; h: number }[] = [];
    for (const { c, r } of world.seasonCells) {
      const same = (a: number, b: number) => world.seasonAt(a, b) === world.season && a >= C0 && a <= C1 && b >= R0 && b <= R1;
      if (!same(c, r - 1)) out.push({ x: c * T, y: r * T, w: T, h: 0 });
      if (!same(c, r + 1)) out.push({ x: c * T, y: (r + 1) * T, w: T, h: 0 });
      if (!same(c - 1, r)) out.push({ x: c * T, y: r * T, w: 0, h: T });
      if (!same(c + 1, r)) out.push({ x: (c + 1) * T, y: r * T, w: 0, h: T });
    }
    return out;
  });

  const showLabels = $derived(!app.masked && app.phase !== 'reveal');
  const labelScale = $derived(Math.min(4, 1 / cam.s));
  const seasonsShown = $derived([1, 2, 3, 4].filter((s) => s <= Math.min(LAST_SEASON, world.season + 1)));
</script>

<!-- infinite dotted grid -->
<div class="absolute inset-0 pointer-events-none opacity-60" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.4px, transparent 1.6px);{grid}"></div>

<div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({app.vw / 2}px,{app.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">

  {#each cells as x (x.k)}
    {@const t = world.tiles[x.k]}
    {#if x.kind === 'art' && t}
      <div class="absolute" style="left:{x.c * T - 0.5}px;top:{x.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;{bg(x.c, x.r)}">
        {#if t.obj !== undefined}<ObjectArt obj={t.obj} />{/if}
        {#if world.revealing[x.k] !== undefined}
          <!-- season reveal: the fog burns off in a wave from the centre -->
          <div class="absolute inset-0 overflow-hidden pointer-events-none" style="animation:unfog 1.3s ease-out {world.revealing[x.k] * 260}ms both">
            <div class="absolute inset-0 fogtile" style="{bg(x.c, x.r, true)}"></div>
          </div>
          <div class="absolute inset-0 bg-[#ffe9c4] pointer-events-none" style="animation:revealflash 1.1s ease-out {world.revealing[x.k] * 260 + 400}ms both"></div>
        {/if}
        {#if t.fresh}<div class="absolute inset-0 bg-white pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
      </div>
    {:else if x.kind === 'fogged'}
      <!-- drawn this week by someone else: you only get its mood -->
      <div class="absolute overflow-hidden" style="left:{x.c * T - 0.5}px;top:{x.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;background:#17131f">
        <div class="absolute inset-0 fogtile" style="{bg(x.c, x.r, true)}"></div>
        <div class="absolute inset-0 mist"></div>
        {#if t?.fresh}<div class="absolute inset-0 bg-white/40 pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
      </div>
    {:else if x.kind === 'mist'}
      <div class="absolute" style="left:{x.c * T - 0.5}px;top:{x.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;background:#14111c">
        <div class="absolute inset-0 mist opacity-60"></div>
      </div>
    {:else if x.kind === 'future'}
      <div class="absolute rounded-[10px] border-2 border-dashed border-paper/[.07]" style="left:{x.c * T + 10}px;top:{x.r * T + 10}px;width:{T - 20}px;height:{T - 20}px"></div>
    {/if}
  {/each}

  {#each world.list.filter((t) => t.status !== 'filled') as t (key(t.c, t.r))}
    {@const x = t.c * T}
    {@const y = t.r * T}
    {#if t.mine && (app.phase === 'drawing' || app.phase === 'review')}
      <div class="absolute overflow-hidden" style="left:{x - 0.5}px;top:{y - 0.5}px;width:{T + 1}px;height:{T + 1}px;background:#1d1a2b">
        <div class="absolute inset-0" style="{bg(t.c, t.r)};clip-path:inset(0 0 {100 - sketch * 100}% 0);filter:grayscale({1 - paint}) contrast({1 + (1 - paint) * 1.8}) brightness({1 + (1 - paint) * 0.35}) blur({(1 - paint) * 3}px)">
          <div class="absolute inset-0" style="opacity:{paint}"><ObjectArt obj={app.obj} /></div>
        </div>
        {#if app.phase === 'drawing' && sketch < 1}
          <div class="absolute left-0 right-0 h-[3px] bg-coral shadow-[0_0_18px_6px_rgba(255,107,74,.55)]" style="top:{sketch * 100}%"></div>
        {/if}
      </div>
    {:else if t.mine}
      <div class="absolute rounded-[6px] overflow-hidden" style="left:{x}px;top:{y}px;width:{T}px;height:{T}px;background:#1d1a2b">
        <div class="absolute inset-0 opacity-50" style="background-image:linear-gradient(rgba(244,233,216,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(244,233,216,.06) 1px,transparent 1px);background-size:32px 32px"></div>
        <div class="absolute inset-[6px] rounded-[4px] border-2 border-coral/80 border-dashed"></div>
        {#if app.phase === 'compose'}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center text-paper/35 text-[17px] leading-snug px-8">continue what<br />you see around</div>
          </div>
        {/if}
      </div>
    {:else if t.status === 'locked'}
      <div class="absolute rounded-[10px] overflow-hidden bg-ink-3/80 border border-paper/10" style="left:{x + 8}px;top:{y + 8}px;width:{T - 16}px;height:{T - 16}px">
        <div class="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-paper/5 to-transparent animate-[shimmer_2.4s_linear_infinite]"></div>
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div class="h-14 w-14 rounded-full flex items-center justify-center text-[24px] font-semibold text-ink" style="background:{t.author?.color}">{t.author?.name[0]}</div>
          <div class="text-[17px] text-paper/80">{t.author?.name} is drawing</div>
          <div class="text-[14px] tabular-nums text-paper/45">{secs((t.lockUntil ?? 0) - app.now)} left</div>
        </div>
      </div>
    {:else if t.status === 'open'}
      <div class="absolute bg-[#14111c]" style="left:{x - 0.5}px;top:{y - 0.5}px;width:{T + 1}px;height:{T + 1}px"></div>
      <div class="absolute rounded-[10px] border-2 border-dashed border-mint/40 flex flex-col items-center justify-center gap-1 text-mint/70" style="left:{x + 8}px;top:{y + 8}px;width:{T - 16}px;height:{T - 16}px">
        <div class="text-[40px] leading-none font-light">+</div>
        <div class="text-[15px]">open</div>
      </div>
    {/if}
  {/each}

  {#if !app.masked}
    {#each edges as e, i (i)}
      <div class="absolute pointer-events-none border-mint/60 border-dashed" style="left:{e.x - 3}px;top:{e.y - 3}px;width:{e.w + 6}px;height:{e.h + 6}px;border-width:{e.h ? 0 : 6}px {e.w ? 0 : 6}px 0 0"></div>
    {/each}
  {/if}

  <!-- your tiles this week -->
  {#if !app.masked && app.phase !== 'season'}
    {#each world.seasonFilled.filter((t) => t.byMe) as t (key(t.c, t.r))}
      <div class="absolute pointer-events-none rounded-[4px] border-[5px] border-coral" style="left:{t.c * T - 2}px;top:{t.r * T - 2}px;width:{T + 4}px;height:{T + 4}px;{app.lastMine === key(t.c, t.r) ? 'animation:pulse-ring 1.6s infinite' : ''}"></div>
    {/each}
  {/if}

  {#if app.selected && app.sheet === 'info'}
    {@const [c, r] = app.selected.split(',').map(Number)}
    <div class="absolute pointer-events-none border-[3px] border-paper rounded-[3px]" style="left:{c * T}px;top:{r * T}px;width:{T}px;height:{T}px"></div>
  {/if}

  <!-- season labels on the map -->
  {#if showLabels}
    {#each seasonsShown as s (s)}
      {@const m = world.seasonCentre(s)}
      {@const live = s === world.season && world.revealedUpTo < s}
      <div class="absolute pointer-events-none" style="left:{(m.c + 0.5) * T}px;top:{(m.r + 0.5) * T}px;transform:translate(-50%,-50%) scale({labelScale})" transition:fade>
        {#if live}
          <div class="whitespace-nowrap rounded-2xl bg-ink/85 border border-paper/15 px-3 py-1.5 text-center shadow-xl">
            <div class="text-[11px] uppercase tracking-widest text-mint">Week {s} · in the fog</div>
            <div class="font-display text-[15px] leading-tight">{SEASONS[s]?.name}</div>
            <div class="text-[11px] text-paper/60 tabular-nums">reveals in {secs(app.seasonLeft)}</div>
          </div>
        {:else if s > world.revealedUpTo}
          <div class="whitespace-nowrap rounded-full bg-ink/70 border border-dashed border-paper/20 px-3 py-1 text-[11px] text-paper/55">🔒 Week {s} · {SEASONS[s]?.name}{s > world.season ? (app.seasonOver ? ' · opens next' : ` · opens in ${secs(app.seasonLeft)}`) : ''}</div>
        {:else}
          <div class="whitespace-nowrap rounded-full bg-ink/60 px-2.5 py-1 text-[11px] text-paper/75">Week {s} · {SEASONS[s]?.name}</div>
        {/if}
      </div>
    {/each}
  {/if}

  <!-- while composing you see your tile plus the full ring of neighbours around it -->
  {#if app.masked && mt}
    <div out:fade={{ duration: 900 }} in:fade={{ duration: 600 }} class="absolute pointer-events-none rounded-[22px]"
      style="left:{(mt.c - 1.02) * T}px;top:{(mt.r - 1.02) * T}px;width:{T * 3.04}px;height:{T * 3.04}px;box-shadow:0 0 0 200000px #0f0d17, inset 0 0 50px 26px #0f0d17"></div>
    <div class="absolute pointer-events-none rounded-[4px] border-[3px] border-coral/70" style="left:{mt.c * T - 2}px;top:{mt.r * T - 2}px;width:{T + 4}px;height:{T + 4}px"></div>
  {/if}
</div>

<style>
  @keyframes -global-fadeflash { 0% { opacity: .85 } 100% { opacity: 0 } }
  @keyframes -global-unfog { 0% { opacity: 1; filter: blur(0) } 100% { opacity: 0; filter: blur(30px) } }
  @keyframes -global-revealflash { 0% { opacity: 0 } 30% { opacity: .55 } 100% { opacity: 0 } }
  :global(.fogtile) { filter: blur(22px) saturate(.75) brightness(.6); opacity: .9; transform: scale(1.25); }
  :global(.mist) {
    background:
      radial-gradient(ellipse 60% 40% at 30% 35%, rgba(244,233,216,.08), transparent 70%),
      radial-gradient(ellipse 50% 45% at 75% 70%, rgba(244,233,216,.06), transparent 70%),
      repeating-linear-gradient(135deg, rgba(244,233,216,.025) 0 6px, transparent 6px 14px);
  }
</style>
