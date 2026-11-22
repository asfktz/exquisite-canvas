<script lang="ts">
  import { fade } from 'svelte/transition';
  import { T, W, H, C0, R0 } from '../lib/art';
  import { world, key } from '../lib/world.svelte';
  import { app } from '../lib/app.svelte';
  import ObjectArt from './ObjectArt.svelte';

  const cam = $derived(app.cam.current);
  const img = $derived(app.img);
  const frontier = $derived(app.phase === 'explore' || app.phase === 'intro' || app.phase === 'reveal' ? world.frontier().filter((p) => !world.tiles[key(p.c, p.r)]) : []);
  const p = $derived(app.progress.current);
  const sketch = $derived(Math.min(1, p / 0.45));
  const paint = $derived(Math.max(0, Math.min(1, (p - 0.35) / 0.65)));

  const bg = (c: number, r: number) =>
    img ? `background-image:url(${img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  // B: one background per sharpness tier; all are the same painting at different resolutions
  const TIER_FX = ['none', 'saturate(.9) brightness(.9)', 'saturate(.75) brightness(.72)', 'saturate(.6) brightness(.55)'];
  const tierBg = (c: number, r: number, k: number) => {
    if (!img) return '';
    const url = [img.full, img.soft, img.shapes, img.colours][k];
    return `background-image:url(${url});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;filter:${TIER_FX[k]};${k === 3 ? 'image-rendering:pixelated;' : ''}`;
  };

  function secs(ms: number) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);
</script>

<!-- infinite dotted grid -->
<div class="absolute inset-0 pointer-events-none opacity-60" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.4px, transparent 1.6px);{grid}"></div>

<div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({app.vw / 2}px,{app.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">
  <!-- tiles that will open later -->
  {#each frontier as f (key(f.c, f.r))}
    <div class="absolute rounded-[10px] border-2 border-dashed border-paper/10 flex items-center justify-center" style="left:{f.c * T + 10}px;top:{f.r * T + 10}px;width:{T - 20}px;height:{T - 20}px">
      <svg width="34" height="34" viewBox="0 0 24 24" class="opacity-20"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Z"/></svg>
    </div>
  {/each}

  <div class="absolute left-0 top-0 transition-[filter] duration-700" style="filter:{app.fogged ? 'blur(10px) saturate(.8)' : 'none'}">
  {#each world.filled as t (key(t.c, t.r))}
    {@const tier = app.tierOf(t.c, t.r)}
    <div class="absolute" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px">
      {#each [0, 1, 2, 3] as k}
        <div class="absolute inset-0 transition-opacity duration-[1400ms] ease-out" style="{tierBg(t.c, t.r, k)}opacity:{tier === k ? 1 : 0}"></div>
      {/each}
      {#if t.obj !== undefined}<div class="absolute inset-0 transition-[filter] duration-[1400ms]" style="filter:blur({[0, 3, 10, 24][tier]}px)"><ObjectArt obj={t.obj} /></div>{/if}
      {#if t.fresh}<div class="absolute inset-0 bg-white pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
    </div>
  {/each}
  </div>

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
      <div class="absolute rounded-[6px] overflow-hidden" style="left:{x}px;top:{y}px;width:{T}px;height:{T}px;background:#1d1a2b;{app.phase === 'intro' ? 'animation:pulse-ring 1.8s infinite' : ''}">
        <div class="absolute inset-0 opacity-50" style="background-image:linear-gradient(rgba(244,233,216,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(244,233,216,.06) 1px,transparent 1px);background-size:32px 32px"></div>
        <div class="absolute inset-[6px] rounded-[4px] border-2 border-coral/80 border-dashed"></div>
        {#if app.phase === 'intro'}
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <div class="text-[34px] leading-none">✦</div>
            <div class="font-display text-[28px] text-paper">Your spot</div>
            {#if app.variant === 3}<div class="text-[15px] text-paper/60">tap to start</div>{/if}
          </div>
        {:else if app.phase === 'compose'}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center text-paper/35 text-[15px] leading-snug px-10">continue what<br />you see around you</div>
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
      <div class="absolute rounded-[10px] border-2 border-dashed border-mint/40 flex flex-col items-center justify-center gap-1 text-mint/70" style="left:{x + 8}px;top:{y + 8}px;width:{T - 16}px;height:{T - 16}px">
        <div class="text-[40px] leading-none font-light">+</div>
        <div class="text-[15px]">open</div>
      </div>
    {/if}
  {/each}

  <!-- my finished tile glow -->
  {#if app.lastMine && (app.phase === 'reveal' || app.phase === 'explore')}
    {@const [c, r] = app.lastMine.split(',').map(Number)}
    <div class="absolute pointer-events-none rounded-[4px] border-[5px] border-coral" style="left:{c * T - 2}px;top:{r * T - 2}px;width:{T + 4}px;height:{T + 4}px;animation:pulse-ring 1.6s infinite"></div>
  {/if}

  {#if app.selected && app.sheet === 'info'}
    {@const [c, r] = app.selected.split(',').map(Number)}
    <div class="absolute pointer-events-none border-[3px] border-paper rounded-[3px]" style="left:{c * T}px;top:{r * T}px;width:{T}px;height:{T}px"></div>
  {/if}

  <!-- B: ripple when a new ring comes into focus -->
  {#if app.ripple}
    {#key app.ripple.id}
      {@const rp = app.ripple}
      <div class="absolute pointer-events-none rounded-[18px] border-[6px] border-paper/80"
        style="left:{(rp.c + 0.5) * T}px;top:{(rp.r + 0.5) * T}px;--from:{(rp.from * 2 + 1) * T}px;--to:{(rp.to * 2 + 1) * T}px;animation:ring-grow 1.5s cubic-bezier(.2,.7,.2,1) forwards"></div>
    {/key}
  {/if}
</div>

<style>
  @keyframes -global-fadeflash { 0% { opacity: .85 } 100% { opacity: 0 } }
  @keyframes -global-ring-grow {
    0% { width: var(--from); height: var(--from); transform: translate(-50%, -50%); opacity: 0; }
    15% { opacity: 1; }
    100% { width: var(--to); height: var(--to); transform: translate(-50%, -50%); opacity: 0; }
  }
</style>
