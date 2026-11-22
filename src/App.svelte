<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { app, IDLE_RELEASE_MS, type Variant } from './lib/app.svelte';
  import { world } from './lib/world.svelte';
  import { fog } from './lib/fog.svelte';
  import { paintMaster } from './lib/art';
  import { panzoom } from './lib/gestures';
  import Board from './components/Board.svelte';
  import ComposerV1 from './components/ComposerV1.svelte';
  import ComposerV2 from './components/ComposerV2.svelte';
  import ComposerV3 from './components/ComposerV3.svelte';
  import Sheets from './components/Sheets.svelte';

  let menu = $state(false);
  let ready = $state(false);

  onMount(() => {
    const vv = window.visualViewport;
    const onResize = () => {
      app.vw = vv?.width ?? window.innerWidth;
      app.vh = vv?.height ?? window.innerHeight;
      app.vvTop = vv?.offsetTop ?? 0;
    };
    onResize();
    vv?.addEventListener('resize', onResize); vv?.addEventListener('scroll', onResize);
    window.addEventListener('resize', onResize);

    paintMaster().then((img) => { app.img = img; app.restart(); ready = true; });

    const clock = setInterval(() => {
      app.now = Date.now();
      if ((app.phase === 'compose' || app.phase === 'review') && (app.idle > IDLE_RELEASE_MS || app.lockLeft <= 0)) app.release();
    }, 250);
    // other artists keep working in the background
    const others = setInterval(() => {
      if (app.phase === 'drawing' || app.phase === 'reveal' || app.phase === 'intro') return;
      app.simulateNeighbour();
    }, 14000);
    return () => { clearInterval(clock); clearInterval(others); window.removeEventListener('resize', onResize); };
  });

  // keep the compose framing right when the viewport changes (rotation, keyboard)
  $effect(() => {
    const _ = [app.vw, app.vh, app.phase];
    if (app.masked && app.mine) app.cam.set(app.composeTarget(app.mine), { duration: 350 });
  });

  const variants: { v: Variant; name: string; note: string }[] = [
    { v: 1, name: 'Immersive', note: 'Splash, then straight into your tile. Chat-style prompt bar.' },
    { v: 2, name: 'Guided', note: 'Tile on top, step-by-step sheet with what neighbours drew.' },
    { v: 3, name: 'Map first', note: 'Land on a fogged map, tap your tile. Edge labels around it.' },
  ];
</script>

<div class="fixed left-0 top-0 w-full overflow-clip select-none touch-none bg-ink" style="height:{app.vh}px;transform:translateY({app.vvTop}px)">
 <div class="absolute inset-0 overflow-clip" use:panzoom={{
    enabled: () => app.gesturesOn,
    get: () => app.cam.current,
    set: (v) => app.cam.set(v, { duration: 0 }),
    fling: (v) => app.cam.set(v, { duration: 600, easing: cubicOut }),
    onTap: (x, y) => app.tapAt(x, y),
    onActivity: app.touch,
    minS: 0.12, maxS: 3,
  }}>
  {#if ready}<Board />{/if}
 </div>

  {#if !ready}
    <div class="absolute inset-0 flex items-center justify-center text-paper/50 text-[14px]">Mixing paint…</div>
  {/if}

  <!-- ===== intro ===== -->
  {#if ready && app.phase === 'intro' && app.variant !== 3}
    <div class="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-gradient-to-t from-ink via-ink/70 to-ink/20 px-4 pb-8 safe-b" transition:fade={{ duration: 500 }}>
      <div class="w-full max-w-sm text-center" in:fly={{ y: 40, duration: 700, delay: 200, easing: cubicOut }}>
        <div class="font-display text-[46px] leading-none tracking-tight">Exquisite</div>
        <div class="mt-3 text-[16px] text-paper/75 leading-relaxed">A drawing nobody planned, hidden in fog. You'll see the tiles around your spot. Every tile you draw clears the fog a little further.</div>
        <div class="mt-4 flex items-center justify-center gap-4 text-[13px] text-paper/55">
          <span><b class="text-paper">{world.filled.length}</b> tiles</span>
          <span><b class="text-paper">{world.artists}</b> artists</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span><b class="text-paper">{world.drawingNow}</b> drawing now</span>
        </div>
        <button class="mt-6 w-full rounded-2xl bg-coral py-4 text-[17px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => app.startCompose()}>Find me a spot ✦</button>
        <div class="mt-3 text-[12px] text-paper/40">You get {fog.credits} free credits. Each drawing attempt uses one.</div>
      </div>
    </div>
  {/if}

  {#if ready && app.phase === 'intro' && app.variant === 3}
    <div class="absolute inset-x-0 top-0 safe-t px-5 pointer-events-none" in:fade>
      <div class="mt-2 font-display text-[30px] leading-none">Exquisite</div>
      <div class="mt-1 text-[13px] text-paper/55">{world.filled.length} tiles · {world.drawingNow} drawing now · you see around your spot, the rest is fog</div>
    </div>
    <div class="absolute inset-x-0 bottom-0 z-10 px-3 safe-b" in:fly={{ y: 80, duration: 500 }}>
      <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 p-4 flex items-center gap-3">
        <div class="h-11 w-11 shrink-0 rounded-full bg-coral/20 flex items-center justify-center text-coral text-[20px]">✦</div>
        <div class="flex-1 text-[14px] leading-snug"><b>Your spot is ready.</b><br /><span class="text-paper/55">Tap the glowing tile, or any green one.</span></div>
        <button class="rounded-xl bg-coral px-4 py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.startCompose()}>Go</button>
      </div>
    </div>
  {/if}

  <!-- ===== composing ===== -->
  {#if app.masked}
    {#if app.variant === 1}<ComposerV1 />{:else if app.variant === 2}<ComposerV2 />{:else}<ComposerV3 />{/if}
  {/if}

  <!-- ===== reveal ===== -->
  {#if app.phase === 'reveal' && app.revealCaption}
    <div class="absolute inset-x-0 top-0 safe-t px-5 text-center pointer-events-none" in:fly={{ y: -20, duration: 800, delay: 600 }}>
      <div class="mt-4 font-display text-[30px] leading-tight">The fog lifts</div>
      <div class="text-[14px] text-paper/60">You uncovered {app.revealed} new tile{app.revealed === 1 ? '' : 's'}. You've seen {fog.seenPct}% of the drawing.</div>
    </div>
  {/if}

  <!-- ===== explore ===== -->
  {#if app.phase === 'explore'}
    <div class="absolute inset-x-0 top-0 safe-t px-3 flex items-start justify-between gap-2 pointer-events-none" in:fade>
      <div class="mt-1 rounded-2xl bg-ink-2/85 backdrop-blur border border-paper/10 px-3.5 py-2 pointer-events-auto">
        <div class="font-display text-[19px] leading-none">Exquisite</div>
        <div class="text-[12px] text-paper/55 mt-1 flex items-center gap-1.5">{world.filled.length} tiles · <span class="h-1.5 w-1.5 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span>{world.drawingNow} drawing</div>
        <div class="mt-2 flex items-center gap-2 text-[11px] text-paper/55"><div class="h-1 w-20 rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-mint rounded-full transition-[width] duration-700" style="width:{fog.seenPct}%"></div></div>{fog.seenPct}% uncovered</div>
      </div>
    </div>
    {#if app.sheet !== 'info'}
      <div class="absolute inset-x-0 bottom-0 safe-b flex justify-center px-4" in:fly={{ y: 40 }}>
        <div class="flex items-center gap-2 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1.5">
          <button class="rounded-full px-4 py-2.5 text-[14px] text-paper/80" onclick={() => app.cam.set(app.fitAll(0.6), { duration: 700 })}>Fit</button>
          <button class="rounded-full bg-coral px-5 py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.startCompose()}>Draw another tile</button>
        </div>
      </div>
      <div class="absolute bottom-[86px] inset-x-0 text-center text-[12px] text-paper/35 pointer-events-none safe-b">Draw at the edge of the fog to see further</div>
    {/if}
  {/if}

  <Sheets />

  <!-- toasts -->
  <div class="absolute inset-x-0 top-[72px] z-40 flex flex-col items-center gap-2 pointer-events-none px-4">
    {#each app.toasts as t (t.id)}
      <div class="flex items-center gap-2 rounded-full bg-ink-2/95 border border-paper/10 px-4 py-2 text-[13px] shadow-xl" in:fly={{ y: -16 }} out:fade>
        {#if t.color}<span class="h-2.5 w-2.5 rounded-full" style="background:{t.color}"></span>{/if}{t.text}
      </div>
    {/each}
  </div>

  <!-- mock credits -->
  {#if ready}
    <button class="absolute right-12 z-40 h-9 flex items-center gap-1.5 rounded-full bg-ink-2/85 backdrop-blur border border-paper/10 pl-2.5 pr-3 text-[13px] {fog.credits === 0 ? 'text-coral border-coral/50' : ''}" style="top:max(env(safe-area-inset-top),10px)" onclick={() => (app.sheet = 'credits')} aria-label="Credits">
      <span class="text-coral">✦</span><span class="tabular-nums font-semibold">{fog.credits}</span>
    </button>
  {/if}

  <!-- prototype menu -->
  <button class="absolute right-2 z-50 h-9 w-9 rounded-full bg-ink-2/80 border border-paper/10 text-paper/60 text-[15px]" style="top:max(env(safe-area-inset-top),10px)" onclick={() => (menu = !menu)} aria-label="Prototype menu">⋯</button>
  {#if menu}
    <div class="absolute inset-0 z-50 bg-ink/50" onclick={() => (menu = false)} role="presentation" transition:fade={{ duration: 150 }}></div>
    <div class="absolute right-2 z-50 w-[min(320px,calc(100vw-16px))] rounded-3xl bg-ink-2 border border-paper/10 p-3 shadow-2xl" style="top:calc(max(env(safe-area-inset-top),10px) + 44px)" transition:scale={{ start: 0.92, duration: 200, easing: backOut }}>
      <div class="px-2 pb-2 text-[11px] uppercase tracking-widest text-paper/40">Layout variant</div>
      {#each variants as x}
        <button class="w-full text-left rounded-2xl px-3 py-2.5 {app.variant === x.v ? 'bg-ink-3' : ''}" onclick={() => { app.setVariant(x.v); menu = false; }}>
          <div class="text-[14px] font-medium">{x.v}. {x.name} {app.variant === x.v ? '✓' : ''}</div>
          <div class="text-[12px] text-paper/50">{x.note}</div>
        </button>
      {/each}
      <div class="my-2 h-px bg-paper/10"></div>
      <div class="px-2 pb-1 text-[11px] uppercase tracking-widest text-paper/40">Fog clears per tile</div>
      <div class="grid grid-cols-3 gap-1.5 mb-2">
        {#each [1, 2, 3] as rad}
          <button class="rounded-xl px-2 py-2 text-[12px] {fog.radius === rad ? 'bg-coral text-ink font-semibold' : 'bg-ink-3'}" onclick={() => (fog.radius = rad)}>{rad * 2 + 1}×{rad * 2 + 1}</button>
        {/each}
      </div>
      <div class="px-2 pb-1 text-[11px] uppercase tracking-widest text-paper/40">Simulate</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.simulateNeighbour(); menu = false; }}>Someone finishes</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.lastActive = Date.now() - 46000; menu = false; }}>I went idle</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.explore(); menu = false; }}>Skip to explore</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.restart(); menu = false; }}>Restart</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { fog.credits = 0; menu = false; }}>Out of credits</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { fog.clearAll(); menu = false; }}>Clear all fog</button>
      </div>
    </div>
  {/if}
</div>
