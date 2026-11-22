<script lang="ts">
  // Dark map with lanterns: the whole drawing sits in the dark, open spots glow.
  // Tap a light to peek at its neighbours for a few seconds, then draw there or keep looking.
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { app, BIG_COST, PEEK_MS, BIG_MS } from '../lib/app.svelte';
  import { world, key } from '../lib/world.svelte';

  const p = $derived(app.peek);
  const left = $derived(p ? Math.max(0, p.until - app.now) : 0);
  const frac = $derived(p ? left / (p.big ? BIG_MS : PEEK_MS) : 0);
  const sel = $derived(p?.sel ? world.tiles[p.sel] : null);
  const around = $derived.by(() => {
    if (!sel) return [];
    const out = [];
    for (const [dc, dr] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const t = world.tiles[key(sel.c + dc, sel.r + dr)];
      if (t?.status === 'filled') out.push(t);
    }
    return out;
  });
  const names = $derived([...new Set(around.map((t) => t.author?.name))].slice(0, 3));
  const litCount = $derived(p?.big ? world.list.filter((t) => t.status === 'open' && app.lit(t.c, t.r)).length : 0);
  const openCount = $derived(world.list.filter((t) => t.status === 'open').length);
</script>

<!-- top -->
<div class="absolute inset-x-0 top-0 safe-t px-4 pointer-events-none" in:fade>
  <div class="flex items-start justify-between gap-3 pr-11">
    <div class="mt-1">
      <div class="font-display text-[28px] leading-none">Exquisite</div>
      <div class="mt-1.5 text-[12.5px] text-paper/55 leading-snug">{world.filled.length} tiles hidden in the dark · <span class="inline-block h-1.5 w-1.5 rounded-full bg-mint align-middle" style="animation:blink 1.4s infinite"></span> {world.drawingNow} drawing</div>
    </div>
    <button class="pointer-events-auto mt-1 flex items-center gap-1.5 rounded-full bg-ink-2/90 border border-[#ffc46b]/30 pl-2.5 pr-3 py-1.5 text-[14px] font-semibold tabular-nums" onclick={() => (app.sheet = 'shop')}>
      <span class="text-[#ffc46b]">✧</span>{app.sparks}
    </button>
  </div>
</div>

{#if app.aiming}
  <div class="absolute inset-x-0 top-[96px] flex justify-center px-4 pointer-events-none" transition:fly={{ y: -16 }}>
    <div class="rounded-full bg-[#ffc46b] text-ink px-4 py-2 text-[14px] font-semibold shadow-2xl">Tap anywhere to light a wide area</div>
  </div>
{/if}

<!-- bottom -->
<div class="absolute inset-x-0 bottom-0 z-10 px-3 safe-b">
  {#if p}
    {#key p.big}
    <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-[#ffc46b]/20 p-4 shadow-[0_-10px_50px_rgba(0,0,0,.6)]" in:fly={{ y: 60, duration: 350, easing: cubicOut }}>
      <div class="flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 40 40" class="shrink-0 -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(244,233,216,.12)" stroke-width="4" />
          <circle cx="20" cy="20" r="16" fill="none" stroke="#ffc46b" stroke-width="4" stroke-linecap="round" stroke-dasharray={2 * Math.PI * 16} stroke-dashoffset={2 * Math.PI * 16 * (1 - frac)} style="transition:stroke-dashoffset .25s linear" />
        </svg>
        <div class="min-w-0 flex-1">
          {#if p.big && !sel}
            <div class="text-[15px] font-medium">The big lantern is lit</div>
            <div class="text-[13px] text-paper/55">{litCount ? `${litCount} open spot${litCount > 1 ? 's' : ''} in the glow. Tap one to choose it.` : 'No open spots here. Look around while it burns.'}</div>
          {:else}
            <div class="text-[15px] font-medium">{around.length} of 8 neighbours drawn</div>
            <div class="text-[13px] text-paper/55 flex items-center gap-1.5 min-w-0">
              <span class="flex -space-x-1.5 shrink-0">{#each names as n, i}<span class="h-4 w-4 rounded-full border border-ink-2" style="background:{around.find((t) => t.author?.name === n)?.author?.color}"></span>{/each}</span>
              <span class="truncate">by {names.join(', ')}{around.length > names.length ? ' and others' : ''}</span>
            </div>
          {/if}
        </div>
        <div class="text-[13px] tabular-nums text-paper/45">{Math.ceil(left / 1000)}s</div>
      </div>
      {#if sel}
        <div class="mt-3 grid grid-cols-[1fr_1.4fr] gap-2">
          <button class="rounded-2xl bg-ink-3 py-3.5 text-[15px]" onclick={() => app.closePeek()}>Keep looking</button>
          <button class="rounded-2xl bg-coral text-ink font-semibold py-3.5 text-[15px]" onclick={() => app.startCompose(p.sel!)}>I have an idea ✦</button>
        </div>
        <div class="mt-2 text-center text-[12px] text-paper/40">The light fades when the time runs out. Peeking again costs a spark.</div>
      {:else}
        <button class="mt-3 w-full rounded-2xl bg-ink-3 py-3.5 text-[15px]" onclick={() => app.closePeek()}>Put it out</button>
      {/if}
    </div>
    {/key}
  {:else if !app.aiming}
    <div class="mx-auto max-w-md" in:fly={{ y: 40, duration: 350 }}>
      {#if !app.hinted}
        <div class="mb-3 text-center text-[14px] leading-snug text-paper/75 px-4" in:fade>
          The drawing is hidden in the dark. Each <span class="text-[#ffc46b]">light</span> is an open spot.<br />Tap one to peek at what's around it.
          <div class="mt-1 text-[12px] text-paper/40">{openCount} spots open · first peek free, then 1 ✧ each</div>
        </div>
      {/if}
      <div class="grid grid-cols-[1.25fr_1fr] gap-2">
        <button class="rounded-2xl bg-ink-2/95 border border-[#ffc46b]/35 py-3.5 text-[15px] flex items-center justify-center gap-2" onclick={() => app.armBig()}>
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M5 2h6M8 0v2M3 4h10l1 2v8l-1 2H3l-1-2V6l1-2Z" stroke="#ffc46b" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 7c1.6 1.6 1.6 3.4 0 5-1.6-1.6-1.6-3.4 0-5Z" fill="#ffc46b"/><path d="M5 18h6" stroke="#ffc46b" stroke-width="1.6"/></svg>
          Big lantern <span class="text-paper/50 text-[13px]">{BIG_COST}✧</span>
        </button>
        <button class="rounded-2xl bg-ink-2/95 border border-paper/12 py-3.5 text-[15px] text-paper/80" onclick={() => app.surprise()}>Surprise me</button>
      </div>
    </div>
  {:else}
    <div class="mx-auto max-w-md" in:fade>
      <button class="w-full rounded-2xl bg-ink-2/95 border border-paper/12 py-3.5 text-[15px] text-paper/70" onclick={() => (app.aiming = false)}>Cancel</button>
    </div>
  {/if}
</div>

{#if app.sheet === 'shop'}
  <div class="absolute inset-0 z-30 bg-ink/60" onclick={() => (app.sheet = null)} role="presentation" transition:fade={{ duration: 200 }}></div>
  <div class="absolute inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-ink-2 border-t border-paper/10 px-5 pt-3 safe-b" transition:fly={{ y: 340, duration: 450, easing: cubicOut }}>
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-paper/20"></div>
    <div class="flex items-center gap-3">
      <div class="h-12 w-12 rounded-full flex items-center justify-center text-[24px] text-[#ffc46b]" style="background:radial-gradient(circle, rgba(255,196,107,.35), rgba(255,196,107,.05))">✧</div>
      <div>
        <div class="font-display text-[22px] leading-tight">{app.sparks < 1 ? 'Your sparks ran out' : `You have ${app.sparks} spark${app.sparks === 1 ? '' : 's'}`}</div>
        <div class="text-[13px] text-paper/55">A peek costs 1 ✧. The big lantern costs {BIG_COST} ✧.</div>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-3 gap-2">
      {#each [[5, '$0.99'], [15, '$1.99'], [40, '$3.99']] as [n, price]}
        <button class="rounded-2xl bg-ink-3 border border-paper/10 py-3 text-center" onclick={() => app.buy(n as number)}>
          <div class="text-[18px] font-semibold"><span class="text-[#ffc46b]">✧</span> {n}</div>
          <div class="text-[13px] text-paper/55">{price}</div>
        </button>
      {/each}
    </div>
    <div class="mt-3 rounded-2xl bg-ink border border-paper/10 p-3 text-[13px] text-paper/60 flex items-center gap-2">
      <span class="text-[16px]">🌙</span> You get 1 free spark every 4 hours, and 2 for every tile you finish.
    </div>
    <button class="mt-2 w-full rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-ink" onclick={() => app.surprise()}>Just put me somewhere</button>
    <button class="mt-2 mb-1 w-full py-2 text-[14px] text-paper/50" onclick={() => (app.sheet = null)}>Not now</button>
  </div>
{/if}
