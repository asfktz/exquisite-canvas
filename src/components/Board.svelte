<script lang="ts">
  import { fade } from 'svelte/transition';
  import { T, W, H, C0, R0 } from '../lib/art';
  import { world, key, ZS } from '../lib/world.svelte';
  import { app } from '../lib/app.svelte';
  import ObjectArt from './ObjectArt.svelte';

  const cam = $derived(app.cam.current);
  const img = $derived(app.img);
  const sealed = $derived(world.zones.filter((z) => z.state === 'sealed'));
  const active = $derived(world.active);
  const next = $derived(world.nextSealed);
  const unveilSet = $derived(new Set(app.unveil?.keys ?? []));
  const unveilZone = $derived(app.unveil ? world.zones[app.unveil.zone] : null);
  /** stagger the flip from the centre of the zone outward */
  const delay = (c: number, r: number) => {
    const z = unveilZone; if (!z) return 0;
    return 250 + Math.hypot(c + 0.5 - (z.c0 + ZS / 2), r + 0.5 - (z.r0 + ZS / 2)) * 380;
  };
  const p = $derived(app.progress.current);
  const sketch = $derived(Math.min(1, p / 0.45));
  const paint = $derived(Math.max(0, Math.min(1, (p - 0.35) / 0.65)));

  const bg = (c: number, r: number, fog = false) =>
    img ? `background-image:url(${fog ? img.fog : img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  function secs(ms: number) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);
  const mt = $derived(app.mine);
</script>

<!-- infinite dotted grid -->
<div class="absolute inset-0 pointer-events-none opacity-60" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.4px, transparent 1.6px);{grid}"></div>

<div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({app.vw / 2}px,{app.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">
  <!-- sealed zones: open one after another -->
  {#each sealed as z (z.i)}
    <div class="absolute rounded-[28px] border-[6px] border-dashed border-paper/10 flex flex-col items-center justify-center text-center overflow-hidden"
      style="left:{z.c0 * T + 18}px;top:{z.r0 * T + 18}px;width:{ZS * T - 36}px;height:{ZS * T - 36}px;background:repeating-linear-gradient(45deg,rgba(244,233,216,.025) 0 28px,transparent 28px 56px)">
      <svg width="190" height="190" viewBox="0 0 24 24" class="opacity-25"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Z"/></svg>
      <div class="mt-6 font-display text-[96px] leading-none text-paper/45">Sealed</div>
      <div class="mt-5 text-[60px] leading-tight text-paper/30 px-16">{next === z && active ? `opens when ${active.name} is revealed` : 'opens later'}</div>
    </div>
  {/each}

  <div class="absolute left-0 top-0 transition-[filter] duration-700" style="filter:{app.fogged ? 'blur(10px) saturate(.8)' : 'none'}">
  {#each world.filled as t (key(t.c, t.r))}
    {@const k = key(t.c, t.r)}
    {#if world.visible(t.c, t.r)}
      <div class="absolute" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;{bg(t.c, t.r)}">
        {#if t.obj !== undefined}<ObjectArt obj={t.obj} />{/if}
        {#if t.fresh && !unveilSet.has(k)}<div class="absolute inset-0 bg-white pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
      </div>
      {#if unveilSet.has(k)}
        <!-- was hidden: flips open in the shared reveal -->
        <div class="absolute pointer-events-none" style="left:{t.c * T}px;top:{t.r * T}px;width:{T}px;height:{T}px;animation:unveil .7s ease-in {delay(t.c, t.r)}ms forwards">
          {@render covered(t.author?.color, t.author?.name)}
        </div>
      {/if}
    {:else}
      <div class="absolute" style="left:{t.c * T}px;top:{t.r * T}px;width:{T}px;height:{T}px">
        {@render covered(t.author?.color, t.author?.name)}
        {#if t.fresh}<div class="absolute inset-[6px] rounded-[14px] bg-paper/40 pointer-events-none" style="animation:fadeflash 1.4s ease-out forwards"></div>{/if}
      </div>
    {/if}
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
            <div class="text-center text-paper/35 text-[15px] leading-snug px-10">continue the drawing<br />from the edges</div>
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

  <!-- active zone frame -->
  {#if active}
    <div class="absolute pointer-events-none rounded-[22px] border-[7px] border-coral/70" style="left:{active.c0 * T - 10}px;top:{active.r0 * T - 10}px;width:{ZS * T + 20}px;height:{ZS * T + 20}px;box-shadow:0 0 60px 6px rgba(255,107,74,.25)"></div>
  {/if}
  {#if unveilZone}
    <div class="absolute pointer-events-none rounded-[22px]" style="left:{unveilZone.c0 * T}px;top:{unveilZone.r0 * T}px;width:{ZS * T}px;height:{ZS * T}px;animation:zoneglow 3.6s ease-out forwards"></div>
  {/if}

  <!-- tiles I drew earlier -->
  {#each world.myKeys.filter((k) => k !== app.lastMine) as k (k)}
    {@const [c, r] = k.split(',').map(Number)}
    <div class="absolute pointer-events-none rounded-[4px] border-[4px] border-coral/60" style="left:{c * T}px;top:{r * T}px;width:{T}px;height:{T}px"></div>
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

  <!-- while composing: your 8 neighbours are fully visible, everything else is dimmed -->
  {#if app.masked && mt}
    <div out:fade={{ duration: 900 }} in:fade={{ duration: 600 }} class="absolute pointer-events-none rounded-[18px]"
      style="left:{(mt.c - 1) * T}px;top:{(mt.r - 1) * T}px;width:{T * 3}px;height:{T * 3}px;box-shadow:0 0 0 200000px rgba(15,13,23,.8), inset 0 0 30px 8px rgba(15,13,23,.7)"></div>
  {/if}
</div>

{#snippet covered(color: string | undefined, name: string | undefined)}
  <div class="absolute inset-[6px] rounded-[14px] bg-[#1d1a2b] border-2 border-paper/10 overflow-hidden flex flex-col items-center justify-center gap-3">
    <div class="absolute inset-0 opacity-60" style="background:radial-gradient(circle at 30% 20%, {color ?? '#888'}22, transparent 60%)"></div>
    <div class="h-[72px] w-[72px] rounded-full flex items-center justify-center text-[34px] font-semibold text-ink" style="background:{color}">{name?.[0]}</div>
    <div class="text-[22px] text-paper/45">hidden</div>
  </div>
{/snippet}

<style>
  @keyframes -global-fadeflash { 0% { opacity: .85 } 100% { opacity: 0 } }
  @keyframes -global-unveil { 0% { opacity: 1; transform: perspective(900px) rotateY(0) } 100% { opacity: 0; transform: perspective(900px) rotateY(95deg) scale(.92) } }
  @keyframes -global-zoneglow { 0% { box-shadow: inset 0 0 0 0 rgba(255,209,102,0), 0 0 0 0 rgba(255,209,102,0) } 25% { box-shadow: inset 0 0 120px 20px rgba(255,209,102,.55), 0 0 140px 40px rgba(255,209,102,.5) } 100% { box-shadow: inset 0 0 0 0 rgba(255,209,102,0), 0 0 0 0 rgba(255,209,102,0) } }
</style>
