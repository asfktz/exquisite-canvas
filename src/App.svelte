<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { app, SEASON_BONUS } from './lib/app.svelte';
  import { world, SEASONS, LAST_SEASON } from './lib/world.svelte';
  import { secs } from './lib/bits';
  import { paintMaster } from './lib/art';
  import { panzoom } from './lib/gestures';
  import Board from './components/Board.svelte';
  import ComposerV1 from './components/ComposerV1.svelte';
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
      if ((app.phase === 'compose' || app.phase === 'review') && (app.idle > 65000 || app.lockLeft <= 0)) app.release();
      // end of the week: the shared reveal (waits until you're not mid-tile)
      if (app.seasonOver && (app.phase === 'intro' || app.phase === 'explore' || app.phase === 'released')) app.revealSeason();
    }, 250);
    // other artists keep working in the background
    const others = setInterval(() => {
      if (app.phase === 'reveal' || app.phase === 'season') return;
      app.simulateNeighbour();
    }, 11000);
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

  <!-- ===== intro: the world, with this week's region in the fog ===== -->
  {#if ready && app.phase === 'intro'}
    <div class="absolute inset-x-0 top-0 safe-t px-5 pointer-events-none" in:fade>
      <div class="mt-2 font-display text-[30px] leading-none">Exquisite</div>
      <div class="mt-1 text-[13px] text-paper/55">One drawing, built a region every week. {world.pastFilled.length} tiles so far.</div>
    </div>
    {#if app.sheet !== 'info'}
      <div class="absolute inset-x-0 bottom-0 z-10 px-3 safe-b" in:fly={{ y: 80, duration: 500 }} out:fade={{ duration: 150 }}>
        <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 p-4">
          <div class="flex items-center justify-between">
            <div class="text-[11px] uppercase tracking-widest text-mint">Week {world.season} · live</div>
            <div class="text-[12px] text-paper/50 tabular-nums">reveals in <b class="text-paper">{secs(app.seasonLeft)}</b></div>
          </div>
          <div class="mt-1 font-display text-[24px] leading-tight">{SEASONS[world.season]?.name}</div>
          <div class="mt-1 text-[14px] text-paper/60 leading-snug">{world.seasonFilled.length} of {world.seasonCells.length} tiles are already drawn, hidden in the fog. Everyone sees them at the end of the week. Draw one to see what's around it now.</div>
          <div class="mt-3 h-1.5 rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-mint/80 rounded-full transition-[width] duration-700" style="width:{(world.seasonFilled.length / world.seasonCells.length) * 100}%"></div></div>
          <button class="mt-4 w-full rounded-2xl bg-coral py-4 text-[17px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => app.startCompose()}>Draw a tile in the fog ✦</button>
          <div class="mt-2 text-center text-[12px] text-paper/40">Each try costs 1 credit · you have {app.credits}</div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ===== composing ===== -->
  {#if app.masked}<ComposerV1 />{/if}

  <!-- ===== after submit: your corner ===== -->
  {#if app.phase === 'reveal' && app.revealCaption}
    <div class="absolute inset-x-0 top-0 safe-t px-5 pb-10 text-center pointer-events-none bg-gradient-to-b from-ink via-ink/85 to-transparent" in:fly={{ y: -20, duration: 800, delay: 400 }}>
      <div class="mt-4 font-display text-[28px] leading-tight">Your corner of the fog</div>
      <div class="text-[14px] text-paper/60">You can see {world.seenCount} of {world.seasonFilled.length} tiles this week. Everyone sees the rest in <span class="tabular-nums">{secs(app.seasonLeft)}</span>.</div>
    </div>
  {/if}

  <!-- ===== end of week: shared reveal ===== -->
  {#if app.phase === 'season' && app.recap}
    {@const rc = app.recap}
    <div class="absolute inset-x-0 top-0 safe-t px-5 text-center pointer-events-none" in:fade>
      <div class="mt-4 text-[11px] uppercase tracking-[.25em] text-mint">{app.recapStep === 0 ? 'Week ' + rc.season + ' is closing' : 'Week ' + rc.season + ' revealed'}</div>
      <div class="font-display text-[30px] leading-tight">{SEASONS[rc.season]?.name}</div>
      {#if app.recapStep >= 1}<div class="text-[14px] text-paper/60" in:fade>{rc.tiles} tiles by {rc.artists} people, revealed to everyone at the same moment</div>{/if}
    </div>
    {#if app.recapStep >= 2}
      <div class="absolute inset-x-0 bottom-0 z-30 px-3 safe-b" in:fly={{ y: 120, duration: 500 }}>
        <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 p-4">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-2xl bg-ink-3/70 py-2.5"><div class="font-display text-[24px] leading-none">{rc.mine}</div><div class="text-[11px] text-paper/50 mt-1">tiles by you</div></div>
            <div class="rounded-2xl bg-ink-3/70 py-2.5"><div class="font-display text-[24px] leading-none">{rc.seen}</div><div class="text-[11px] text-paper/50 mt-1">you saw early</div></div>
            <div class="rounded-2xl bg-ink-3/70 py-2.5"><div class="font-display text-[24px] leading-none">{rc.hidden}</div><div class="text-[11px] text-paper/50 mt-1">surprises</div></div>
          </div>
          {#if world.season < LAST_SEASON}
            <button class="mt-3 w-full rounded-2xl bg-coral py-3.5 text-[16px] font-semibold text-ink" onclick={() => app.nextSeason()}>Week {world.season + 1} is open: {SEASONS[world.season + 1]?.name} →</button>
            <div class="mt-2 text-center text-[12px] text-paper/40">+{SEASON_BONUS} free credits every new week · drag to look around</div>
          {:else}
            <button class="mt-3 w-full rounded-2xl bg-coral py-3.5 text-[16px] font-semibold text-ink" onclick={() => app.restart()}>That's the whole map in this mockup · restart</button>
          {/if}
        </div>
      </div>
    {/if}
  {/if}

  <!-- ===== explore ===== -->
  {#if app.phase === 'explore'}
    <div class="absolute inset-x-0 top-0 safe-t px-3 pr-14 flex items-start gap-2 pointer-events-none" in:fade>
      <div class="mt-1 rounded-2xl bg-ink-2/85 backdrop-blur border border-paper/10 px-3.5 py-2 pointer-events-auto">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-widest text-mint"><span class="h-1.5 w-1.5 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span>Week {world.season} · {SEASONS[world.season]?.name}</div>
        <div class="text-[12px] text-paper/60 mt-1 tabular-nums">{world.seasonFilled.length}/{world.seasonCells.length} drawn · you see {world.seenCount} · reveal in {secs(app.seasonLeft)}</div>
        <div class="mt-1.5 h-1 rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-mint/70" style="width:{app.seasonProgress * 100}%"></div></div>
      </div>
    </div>
    {#if app.sheet !== 'info'}
      <div class="absolute inset-x-0 bottom-0 safe-b flex justify-center px-4" in:fly={{ y: 40 }}>
        <div class="flex items-center gap-2 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 p-1.5">
          <button class="rounded-full px-4 py-2.5 text-[14px] text-paper/80" onclick={() => app.cam.set(app.fitAll(0.3, 90), { duration: 700 })}>Fit</button>
          <button class="rounded-full bg-coral px-5 py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.startCompose()}>{app.myThisSeason ? 'Draw another · see more' : 'Draw a tile'} <span class="opacity-60">1◆</span></button>
        </div>
      </div>
      <div class="absolute bottom-[86px] inset-x-0 text-center text-[12px] text-paper/35 pointer-events-none safe-b">Drag, pinch, tap a tile</div>
    {/if}
  {/if}

  <!-- credits -->
  {#if ready && app.phase !== 'season' && !app.masked}
    <button class="absolute right-12 z-40 h-9 rounded-full bg-ink-2/80 border border-paper/10 px-3 text-[13px] font-semibold tabular-nums flex items-center gap-1.5" style="top:max(env(safe-area-inset-top),10px)" onclick={() => (app.sheet = 'credits')}>
      <span class="text-[#ffd166]">◆</span>{app.credits}
    </button>
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
      <div class="px-2 pb-1 text-[13px] font-medium">Variant D · Weekly seasons</div>
      <div class="px-2 pb-2 text-[12px] text-paper/50">One world. A new region opens every week and stays in the fog until the week ends. In this mockup a week is 4 minutes.</div>
      <div class="my-2 h-px bg-paper/10"></div>
      <div class="px-2 pb-1 text-[11px] uppercase tracking-widest text-paper/40">Simulate</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.simulateNeighbour(); menu = false; }}>Someone finishes</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.endSeasonNow(); menu = false; }}>End the week now</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.credits = 0; menu = false; }}>Out of credits</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.lastActive = Date.now() - 46000; menu = false; }}>I went idle</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.explore(); menu = false; }}>Skip to explore</button>
        <button class="rounded-xl bg-ink-3 px-2 py-2 text-[12px]" onclick={() => { app.restart(); menu = false; }}>Restart</button>
      </div>
    </div>
  {/if}
</div>
