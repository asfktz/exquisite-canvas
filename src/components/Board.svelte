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

  const bg = (c: number, r: number, fog = false) =>
    img ? `background-image:url(${fog ? img.fog : img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  function secs(ms: number) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);
  const mt = $derived(app.mine);
  const M = 7000;
  // keep lights a readable size on screen at any zoom (clamped in world units)
  const core = $derived(Math.min(90, Math.max(36, 20 / cam.s)));
  const emb = $derived(Math.min(64, Math.max(30, 16 / cam.s)));
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
    <div class="absolute" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;{bg(t.c, t.r, app.fogged)}">
      {#if t.obj !== undefined && !app.fogged}<ObjectArt obj={t.obj} />{/if}
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
    {:else if t.status === 'open' && !app.lantern}
      <div class="absolute rounded-[10px] border-2 border-dashed border-mint/40 flex flex-col items-center justify-center gap-1 text-mint/70" style="left:{x + 8}px;top:{y + 8}px;width:{T - 16}px;height:{T - 16}px">
        <div class="text-[40px] leading-none font-light">+</div>
        <div class="text-[15px]">open</div>
      </div>
    {/if}
  {/each}

  <!-- ===== the dark: one big night with a hole where the lantern shines ===== -->
  {#if app.darkOn}
    {@const L = app.light.current}
    {@const R = Math.max(1, L.r)}
    <div class="absolute pointer-events-none" out:fade={{ duration: 700 }}
      style="left:{-M}px;top:{-M}px;width:{2 * M}px;height:{2 * M}px;background:radial-gradient(circle {R}px at {L.x + M}px {L.y + M}px, rgba(255,190,120,.07) 0%, rgba(9,8,14,0) 30%, rgba(9,8,14,.5) 58%, rgba(9,8,14,.9) 82%, #09080e 100%)"></div>
  {/if}

  {#if app.lantern}
    <!-- dust, so the dark still feels like a place -->
    <div class="absolute pointer-events-none opacity-40" style="left:{-M}px;top:{-M}px;width:{2 * M}px;height:{2 * M}px;background-image:radial-gradient(circle, rgba(244,233,216,.35) 2.2px, transparent 2.6px);background-size:{T}px {T}px;background-position:{M}px {M}px"></div>

    <!-- someone just finished: a spark in the dark -->
    {#each world.filled.filter((t) => t.fresh) as t (key(t.c, t.r))}
      <div class="absolute pointer-events-none rounded-full" style="left:{(t.c + 0.5) * T - 60}px;top:{(t.r + 0.5) * T - 60}px;width:120px;height:120px;animation:spark 2.2s ease-out forwards"></div>
    {/each}

    <!-- lights: every open spot glows, people drawing are dim embers -->
    {#each world.list.filter((t) => t.status !== 'filled') as t (key(t.c, t.r))}
      {@const k = key(t.c, t.r)}
      {@const cx = (t.c + 0.5) * T}
      {@const cy = (t.r + 0.5) * T}
      {@const isPeek = app.peek?.sel === k}
      {@const lit = app.lit(t.c, t.r)}
      {#if t.status === 'open'}
        <div class="absolute pointer-events-none" style="left:{cx}px;top:{cy}px;transition:opacity .6s;opacity:{app.peek && !lit ? 0.55 : 1}">
          {#if !isPeek}
            <div class="absolute rounded-full" style="left:-130px;top:-130px;width:260px;height:260px;background:radial-gradient(circle, rgba(255,186,99,.42) 0%, rgba(255,140,70,.14) 38%, rgba(255,120,60,0) 70%);animation:glow 3.2s ease-in-out {(t.c * 7 + t.r * 3) % 10 * -0.37}s infinite"></div>
            <div class="absolute rounded-full" style="left:{-core / 2}px;top:{-core / 2}px;width:{core}px;height:{core}px;background:radial-gradient(circle at 40% 38%, #fff8e6 0%, #ffd38a 35%, #ff9b4f 70%, rgba(255,140,70,0) 72%);filter:drop-shadow(0 0 10px rgba(255,180,90,.9))"></div>
          {/if}
          {#if app.seen.includes(k) && !isPeek}
            <div class="absolute rounded-full border-[5px] border-paper/50" style="left:-56px;top:-56px;width:112px;height:112px"></div>
          {/if}
        </div>
        {#if isPeek}
          <div class="absolute pointer-events-none rounded-[12px] border-[4px] border-dashed border-[#ffd38a]" style="left:{t.c * T + 10}px;top:{t.r * T + 10}px;width:{T - 20}px;height:{T - 20}px;box-shadow:0 0 40px rgba(255,190,110,.35), inset 0 0 40px rgba(255,190,110,.2)">
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div class="text-[44px] leading-none text-[#ffd38a]">✦</div>
              <div class="mt-2 font-display text-[26px] text-paper">this spot</div>
            </div>
          </div>
        {/if}
      {:else}
        <div class="absolute pointer-events-none" style="left:{cx}px;top:{cy}px">
          <div class="absolute rounded-full" style="left:-80px;top:-80px;width:160px;height:160px;background:radial-gradient(circle, {t.author?.color}33 0%, transparent 65%)"></div>
          <div class="absolute rounded-full flex items-center justify-center font-semibold text-ink/80" style="left:{-emb / 2}px;top:{-emb / 2}px;width:{emb}px;height:{emb}px;font-size:{emb * 0.5}px;background:{t.author?.color};opacity:.55">{t.author?.name[0]}</div>
        </div>
      {/if}
    {/each}
  {/if}

  <!-- my finished tile glow -->
  {#if app.lastMine && (app.phase === 'reveal' || app.phase === 'explore')}
    {@const [c, r] = app.lastMine.split(',').map(Number)}
    <div class="absolute pointer-events-none rounded-[4px] border-[5px] border-coral" style="left:{c * T - 2}px;top:{r * T - 2}px;width:{T + 4}px;height:{T + 4}px;animation:pulse-ring 1.6s infinite"></div>
  {/if}

  {#if app.selected && app.sheet === 'info'}
    {@const [c, r] = app.selected.split(',').map(Number)}
    <div class="absolute pointer-events-none border-[3px] border-paper rounded-[3px]" style="left:{c * T}px;top:{r * T}px;width:{T}px;height:{T}px"></div>
  {/if}

  <!-- fog of war: only ~15% of each neighbour is visible while composing -->
  {#if app.masked && mt}
    <div out:fade={{ duration: 900 }} in:fade={{ duration: 600 }} class="absolute pointer-events-none rounded-[14px]"
      style="left:{(mt.c - 0.15) * T}px;top:{(mt.r - 0.15) * T}px;width:{T * 1.3}px;height:{T * 1.3}px;box-shadow:0 0 0 200000px #0f0d17, inset 0 0 22px 10px #0f0d17"></div>
  {/if}
</div>

<style>
  @keyframes -global-fadeflash { 0% { opacity: .85 } 100% { opacity: 0 } }
  @keyframes -global-glow { 0%,100% { transform: scale(.82); opacity: .75 } 50% { transform: scale(1.12); opacity: 1 } }
  @keyframes -global-spark { 0% { transform: scale(.2); opacity: 1; box-shadow: 0 0 0 0 rgba(255,220,160,.9), 0 0 60px 30px rgba(255,200,130,.6) } 100% { transform: scale(3.2); opacity: 0; box-shadow: 0 0 0 30px rgba(255,220,160,0), 0 0 60px 30px rgba(255,200,130,0) } }
</style>
