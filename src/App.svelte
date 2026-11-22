<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { app, IDLE_RELEASE_MS } from './lib/app.svelte';
  import { world } from './lib/world.svelte';
  import { paintMaster } from './lib/art';
  import { panzoom } from './lib/gestures';
  import Board from './components/Board.svelte';
  import ComposerV1 from './components/ComposerV1.svelte';
  import ComposerV2 from './components/ComposerV2.svelte';
  import ComposerV3 from './components/ComposerV3.svelte';
  import Sheets from './components/Sheets.svelte';
  import LanternHud from './components/LanternHud.svelte';

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

    if ((import.meta as any).env?.DEV) Object.assign(window, { __app: app, __world: world });
    paintMaster().then((img) => { app.img = img; app.restart(); ready = true; });

    const clock = setInterval(() => {
      app.now = Date.now();
      app.tickPeek();
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

</script>

<div class="fixed left-0 top-0 w-full overflow-hidden select-none touch-none bg-ink" style="height:{app.vh}px;transform:translateY({app.vvTop}px)">
 <div class="absolute inset-0" use:panzoom={{
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

  <!-- ===== dark map with lanterns ===== -->
  {#if ready && app.phase === 'intro'}<LanternHud />{/if}

  <!-- ===== composing ===== -->
  {#if app.masked}
    {#if app.variant === 1}<ComposerV1 />{:else if app.variant === 2}<ComposerV2 />{:else}<ComposerV3 />{/if}
  {/if}

  <!-- ===== reveal ===== -->
  {#if app.phase === 'reveal' && app.revealCaption}
    <div class="absolute inset-x-0 top-0 safe-t px-5 text-center pointer-events-none" in:fly={{ y: -20, duration: 800, delay: 600 }}>
      <div class="mt-4 font-display text-[30px] leading-tight">The whole drawing</div>
      <div class="text-[14px] text-paper/60">{world.filled.length} tiles by {world.artists} people. Yours is glowing.</div>
    </div>
  {/if}

  <!-- ===== explore ===== -->
  {#if app.phase === 'explore'}
    <div class="absolute inset-x-0 top-0 safe-t px-3 flex items-start justify-between gap-2 pointer-events-none" in:fade>
      <div class="mt-1 rounded-2xl bg-ink-2/85 backdrop-blur border border-paper/10 px-3.5 py-2 pointer-events-auto">
        <div class="font-display text-[19px] leading-none">Exquisite</div>
        <div class="text-[12px] text-paper/55 mt-1 flex items-center gap-1.5">{world.filled.length} tiles · <span class="h-1.5 w-1.5 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span>{world.drawingNow} drawing</div>
      </div>
    </div>
    {#if app.sheet !== 'info'}
      <div class="absolute inset-x-0 bottom-0 safe-b flex justify-center px-4" in:fly={{ y: 40 }}>
        <div class="flex items-center gap-2 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1.5">
          <button class="rounded-full px-4 py-2.5 text-[14px] text-paper/80" onclick={() => app.cam.set(app.fitAll(0.6), { duration: 700 })}>Fit</button>
          <button class="rounded-full bg-coral px-5 py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.toDark()}>Draw another tile</button>
        </div>
      </div>
      <div class="absolute bottom-[86px] inset-x-0 text-center text-[12px] text-paper/35 pointer-events-none safe-b">Drag, pinch, tap a tile</div>
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

  <!-- prototype menu -->
  <button class="absolute right-2 z-50 h-9 w-9 rounded-full bg-ink-2/80 border border-paper/10 text-paper/60 text-[15px]" style="top:max(env(safe-area-inset-top),10px)" onclick={() => (menu = !menu)} aria-label="Prototype menu">⋯</button>
  {#if menu}
    <div class="absolute inset-0 z-50 bg-ink/50" onclick={() => (menu = false)} role="presentation" transition:fade={{ duration: 150 }}></div>
    <div class="absolute right-2 z-50 w-[min(320px,calc(100vw-16px))] rounded-3xl bg-ink-2 border border-paper/10 p-3 shadow-2xl" style="top:calc(max(env(safe-area-inset-top),10px) + 44px)" transition:scale={{ start: 0.92, duration: 200, easing: backOut }}>
      <div class="px-2 pb-2 text-[11px] uppercase tracking-widest text-paper/40">Variant: dark map with lanterns</div>
      <div class="px-2 pb-1 text-[12px] text-paper/50 leading-snug">Open spots glow in the dark. Tap one to peek at its neighbours. First peek free, then 1 spark each. Big lantern lights a wide area.</div>
      <div class="my-2 h-px bg-paper/10"></div>
      <div class="px-2 pb-1 text-[11px] uppercase tracking-widest text-paper/40">Simulate</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.simulateNeighbour(); menu = false; }}>Someone finishes</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.lastActive = Date.now() - 46000; menu = false; }}>I went idle</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.explore(); menu = false; }}>Skip to explore</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.restart(); menu = false; }}>Restart</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.sparks = 0; app.freePeek = false; menu = false; }}>Out of sparks</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.sparks += 5; menu = false; }}>+5 sparks</button>
      </div>
    </div>
  {/if}
</div>
