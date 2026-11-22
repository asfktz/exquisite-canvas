<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { app, IDLE_RELEASE_MS } from './lib/app.svelte';
  import { world, ZS, OTHERS_EVERY_MS } from './lib/world.svelte';
  import ZoneHud from './components/ZoneHud.svelte';
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
    }, OTHERS_EVERY_MS);
    return () => { clearInterval(clock); clearInterval(others); window.removeEventListener('resize', onResize); };
  });

  // keep the compose framing right when the viewport changes (rotation, keyboard)
  $effect(() => {
    const _ = [app.vw, app.vh, app.phase];
    if (app.masked && app.mine) app.cam.set(app.composeTarget(app.mine), { duration: 350 });
  });

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
  {#if ready && app.phase === 'intro'}
    {@const z = world.active}
    <div class="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-gradient-to-t from-ink via-ink/80 to-transparent px-4 pb-8 safe-b" transition:fade={{ duration: 500 }}>
      <div class="w-full max-w-sm text-center" in:fly={{ y: 40, duration: 700, delay: 200, easing: cubicOut }}>
        <div class="font-display text-[44px] leading-none tracking-tight">Exquisite</div>
        <div class="mt-3 text-[15px] text-paper/75 leading-relaxed">A drawing nobody planned, built zone by zone. Each zone stays hidden while people fill it, and opens for everyone the moment the last tile lands.</div>
        {#if z}
          <div class="mt-4 rounded-2xl bg-ink-2/90 border border-paper/10 px-4 py-3 text-left">
            <div class="flex items-baseline justify-between text-[13px]"><span>Now filling: <b>{z.name}</b></span><span class="tabular-nums text-paper/60">{world.zoneFilled(z)}/{ZS * ZS}</span></div>
            <div class="mt-2 h-1.5 rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-coral rounded-full transition-[width] duration-700" style="width:{(world.zoneFilled(z) / (ZS * ZS)) * 100}%"></div></div>
            <div class="mt-2 text-[12px] text-paper/50 flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span>{world.drawingNow} drawing now · {ZS * ZS - world.zoneFilled(z)} tiles to go</div>
          </div>
        {/if}
        <button class="mt-5 w-full rounded-2xl bg-coral py-4 text-[17px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => app.startCompose()}>Add a tile to {z?.name ?? 'the drawing'} ✦</button>
        <div class="mt-3 text-[12px] text-paper/40">You get {app.credits} free credits. You'll see the 8 tiles around yours right away.</div>
      </div>
    </div>
  {/if}

  <!-- ===== composing ===== -->
  {#if app.masked}
    {#if app.variant === 1}<ComposerV1 />{:else if app.variant === 2}<ComposerV2 />{:else}<ComposerV3 />{/if}
  {/if}

  <!-- ===== reveal ===== -->
  {#if app.unveil}
    {@const uz = world.zones[app.unveil.zone]}
    <div class="absolute inset-x-0 top-0 z-20 safe-t px-5 text-center pointer-events-none" in:fly={{ y: -20, duration: 700 }} out:fade>
      <div class="mx-auto mt-3 max-w-sm rounded-3xl bg-ink-2/90 backdrop-blur border border-[#ffd166]/30 px-5 py-3 shadow-2xl">
        <div class="text-[11px] uppercase tracking-[.2em] text-[#ffd166]">Zone revealed</div>
        <div class="font-display text-[28px] leading-tight">{uz.name}</div>
        <div class="text-[13px] text-paper/60">{app.unveil.byMe ? 'You placed the last tile.' : 'The last tile just landed.'} {uz.artists} artists, seen for the first time.</div>
      </div>
    </div>
  {:else if app.phase === 'reveal' && app.revealCaption && !app.completedByMe}
    <ZoneHud />
  {/if}

  <!-- ===== explore ===== -->
  {#if app.phase === 'explore'}
    {#if !app.unveil}<ZoneHud />{/if}
    {#if app.sheet !== 'info'}
      <div class="absolute inset-x-0 bottom-0 safe-b flex justify-center px-4" in:fly={{ y: 40 }}>
        <div class="flex items-center gap-2 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1.5">
          <button class="rounded-full px-4 py-2.5 text-[14px] text-paper/80" onclick={() => app.cam.set(app.fitAll(0.15, 90), { duration: 700 })}>Map</button>
          <button class="rounded-full px-4 py-2.5 text-[14px] text-paper/80" onclick={() => world.active && app.cam.set(app.fitZone(world.active, 90), { duration: 700 })}>Zone</button>
          <button class="rounded-full bg-coral px-5 py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.startCompose()}>Draw a tile</button>
        </div>
      </div>
      <div class="absolute bottom-[86px] inset-x-0 text-center text-[12px] text-paper/35 pointer-events-none safe-b">Each tile you draw uncovers the 8 around it</div>
    {/if}
  {/if}

  <Sheets />

  <!-- toasts -->
  <div class="absolute inset-x-0 top-[104px] z-40 flex flex-col items-center gap-2 pointer-events-none px-4">
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
      <div class="px-2 pb-2 text-[12px] text-paper/55 leading-snug">Variant C · zone reveal. Others add a tile every {OTHERS_EVERY_MS / 1000}s.</div>
      <div class="px-2 pb-1 text-[11px] uppercase tracking-widest text-paper/40">Simulate</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.simulateNeighbour(); menu = false; }}>Someone finishes</button>
        <button class="col-span-2 rounded-xl bg-[#ffd166]/15 text-[#ffd166] px-2 py-2 text-[12px]" onclick={() => { app.fastForward(); menu = false; }}>Others fill the zone (leaves yours for last)</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.credits = 0; menu = false; }}>Out of credits</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.lastActive = Date.now() - 46000; menu = false; }}>I went idle</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.explore(); menu = false; }}>Skip to explore</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.restart(); menu = false; }}>Restart</button>
      </div>
    </div>
  {/if}
</div>
