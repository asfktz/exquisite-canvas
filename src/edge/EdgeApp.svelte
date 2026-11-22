<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { paintMaster } from '../lib/art';
  import { panzoom } from '../lib/gestures';
  import { app, VARIANTS } from './state.svelte';
  import Board from './Board.svelte';
  import Overlay from './Overlay.svelte';
  import Panel from './Panel.svelte';

  let ready = $state(false);
  let lastFx = 0;
  let fx = $state<number[]>([]);

  onMount(() => {
    const vv = window.visualViewport;
    const onResize = () => { app.vw = window.innerWidth; app.vh = window.innerHeight; };
    onResize();
    window.addEventListener('resize', onResize);
    vv?.addEventListener('resize', onResize);
    paintMaster().then((img) => { app.img = img.full; ready = true; app.start(); });
    const beat = setInterval(() => app.beat++, 2600);
    const visit = setInterval(() => app.visit(), 11000);
    const first = setTimeout(() => app.visit(), 5200);
    return () => { clearInterval(beat); clearInterval(visit); clearTimeout(first); window.removeEventListener('resize', onResize); };
  });

  // reframe the focused spot when the panel or viewport changes size
  $effect(() => {
    const _ = [app.panelH, app.vw, app.vh];
    const f = app.focusSpot;
    if (f && app.phase !== 'map' && app.phase !== 'stitching') app.cam.set(app.focusTarget(f.c, f.r), { duration: 350 });
  });

  // floating "-1 ✦"
  $effect(() => {
    const n = app.creditFx;
    if (n === lastFx) return;
    lastFx = n;
    const id = Math.random();
    fx = [...fx, id];
    setTimeout(() => (fx = fx.filter((x) => x !== id)), 900);
  });

  const hint = $derived(VARIANTS.find((v) => v.id === app.variant)!.hint);
  const adding = $derived(Object.keys(app.visitors).length);
</script>

<div class="fixed inset-0 overflow-hidden select-none bg-ink">
  <div class="absolute inset-0 touch-none" use:panzoom={{
    enabled: () => app.phase === 'map' && !app.pull,
    get: () => app.cam.current,
    set: (v) => app.cam.set(v, { duration: 0 }),
    fling: (v) => app.cam.set(v, { duration: 600, easing: cubicOut }),
    onTap: (x, y) => app.tapAt(x, y),
    minS: 0.1, maxS: 2.4,
  }}>
    {#if ready}<Board />{/if}
  </div>

  {#if !ready}<div class="absolute inset-0 flex items-center justify-center text-paper/50 text-[14px]">Mixing paint…</div>{/if}

  {#if ready}<Overlay />{/if}

  <!-- top bar -->
  <div class="absolute inset-x-0 top-0 z-20 safe-t px-3 pointer-events-none">
    <div class="flex items-start justify-between gap-2">
      <div class="mt-1 rounded-2xl bg-ink-2/80 backdrop-blur border border-paper/10 px-3 py-1.5 pointer-events-auto">
        <div class="font-display text-[18px] leading-none">Exquisite</div>
        <div class="text-[11px] text-paper/55 mt-1 flex items-center gap-1.5">{app.filled.length} tiles · {app.spots.length} open edges{#if adding} · <span class="h-1.5 w-1.5 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span>{adding} adding{/if}</div>
      </div>
      <div class="relative mt-1 flex items-center gap-1.5 pointer-events-auto">
        <button class="flex items-center gap-1.5 rounded-full bg-ink-2/80 backdrop-blur border border-paper/10 pl-3 pr-3.5 py-2 text-[14px] font-semibold tabular-nums {app.credits === 0 ? 'text-[#ffd166]' : ''}" onclick={() => app.refill()} title="Mock credits: tap to top up">
          <span class="text-[#ffd166]">✦</span>{app.credits}
        </button>
        {#each fx as id (id)}<span class="absolute right-3 top-9 text-[13px] font-semibold text-[#ffd166] pointer-events-none" in:fly={{ y: -4, duration: 200 }} out:fly={{ y: 16, duration: 700 }}>✦</span>{/each}
        <button class="h-9 w-9 rounded-full bg-ink-2/80 backdrop-blur border border-paper/10 text-paper/60 text-[14px]" onclick={() => app.restart()} aria-label="Restart">↺</button>
      </div>
    </div>
  </div>

  <!-- variant switcher + hint (map only) -->
  {#if ready && (app.phase === 'map' || app.phase === 'intro')}
    <div class="absolute inset-x-0 bottom-0 z-20 safe-b px-3 flex flex-col items-center gap-2 pointer-events-none" transition:fly={{ y: 60, duration: 350 }}>
      {#key app.variant}
        <div class="rounded-full bg-ink/70 backdrop-blur px-3.5 py-1.5 text-[12.5px] text-paper/75 border border-paper/10" in:fade={{ duration: 400 }}>{hint}</div>
      {/key}
      <div class="pointer-events-auto flex rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1 shadow-xl">
        {#each VARIANTS as v}
          <button class="rounded-full px-3.5 py-2 text-[13.5px] transition-colors {app.variant === v.id ? 'bg-paper text-ink font-semibold' : 'text-paper/70'}" onclick={() => app.setVariant(v.id)}>{v.name}</button>
        {/each}
      </div>
    </div>
  {/if}

  <Panel />

  <!-- toasts -->
  <div class="absolute inset-x-0 top-[64px] z-40 flex flex-col items-center gap-2 pointer-events-none px-4">
    {#each app.toasts as t (t.id)}
      <div class="flex items-center gap-2 rounded-full bg-ink-2/95 border border-paper/10 px-4 py-2 text-[13px] shadow-xl max-w-full" in:fly={{ y: -16 }} out:fade>
        {#if t.color}<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{t.color}"></span>{/if}<span class="truncate">{t.text}</span>
      </div>
    {/each}
  </div>
</div>
