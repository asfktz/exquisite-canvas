<script lang="ts">
  // The card hand: a few open spots, each shown only as its hole and the neighbour edges
  // around it. No map, no location. Swipe, pick the one you have an idea for.
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { app, RARE_COST } from '../lib/app.svelte';
  import { world } from '../lib/world.svelte';
  import HandArt from './HandArt.svelte';

  const G = 14;
  const cw = $derived(Math.round(Math.min(app.vw * 0.76, 320, (app.vh - 300) * 0.82)));
  const pad = 10;
  const art = $derived(cw - pad * 2);
  let el: HTMLDivElement | undefined = $state();
  let sx = $state(0);
  let dealt = $state(0); // bumps to replay the deal animation

  function onScroll() {
    if (!el) return;
    sx = el.scrollLeft;
    const f = Math.round(sx / (cw + G));
    if (f !== app.focus) { app.focus = Math.max(0, Math.min(app.hand.length - 1, f)); app.touch(); }
  }
  function goTo(i: number) { el?.scrollTo({ left: i * (cw + G), behavior: 'smooth' }); }

  function tapCard(i: number) {
    if (i !== app.focus) { goTo(i); return; }
    pick(i);
  }
  function pick(i: number) {
    const node = document.querySelector<HTMLElement>(`[data-art="${app.hand[i]?.id}"]`);
    const r = node?.getBoundingClientRect();
    app.pickCard(i, r ? { x: r.left, y: r.top - app.vvTop, w: r.width } : undefined);
  }
  function reshuffle() {
    if (app.reshuffle()) { dealt++; el?.scrollTo({ left: 0 }); sx = 0; }
  }

  const style = (i: number) => {
    const d = (i * (cw + G) - sx) / (cw + G);
    const a = Math.min(1, Math.abs(d));
    return `transform:translateY(${a * 22}px) rotate(${d * 3.5}deg) scale(${1 - a * 0.1});opacity:${1 - a * 0.35}`;
  };
  const cur = $derived(app.hand[app.focus]);
  const cost = $derived(app.reshuffleCost());
</script>

<div class="absolute inset-0 z-20 flex flex-col bg-gradient-to-b from-ink/85 via-ink/70 to-ink/90" transition:fade={{ duration: 350 }}>
  <!-- header -->
  <div class="safe-t px-5 pr-14 flex items-start justify-between gap-3" in:fly={{ y: -16, duration: 500 }}>
    <div class="mt-1">
      <div class="font-display text-[28px] leading-none">Your hand</div>
      <div class="mt-1.5 text-[14px] text-paper/60 leading-snug">Open spots, edges only. Pick the one you have an idea for.</div>
    </div>
    <button class="mt-1 shrink-0 flex items-center gap-1.5 rounded-full bg-ink-2/90 border border-paper/10 px-3 py-1.5 text-[14px] tabular-nums" onclick={() => (app.sheet = 'credits')}>
      <span class="text-[#ffd166]">✦</span>{app.credits}
    </button>
  </div>

  <!-- the cards -->
  <div class="flex-1 min-h-0 flex flex-col justify-center">
    {#key dealt}
    <div bind:this={el} onscroll={onScroll} class="no-scrollbar flex overflow-x-auto snap-x snap-mandatory touch-pan-x py-6" style="gap:{G}px;padding-inline:{(app.vw - cw) / 2}px">
      {#each app.hand as c, i (c.id)}
        {@const t = world.tiles[c.key]}
        {@const locked = c.rare && !c.unlocked}
        <div class="snap-center shrink-0" style="width:{cw}px" in:fly={{ y: 120, x: 40, duration: 600, delay: 120 + i * 90, easing: backOut }}>
          <button class="relative block w-full text-left transition-[transform,opacity] duration-150 ease-out" style={style(i)} onclick={() => tapCard(i)} aria-label="Card {i + 1}">
            <div class="relative rounded-[26px] p-[2px] {c.rare ? 'bg-gradient-to-br from-[#ffe6a3] via-[#d8a24a] to-[#fff1c9] shadow-[0_0_40px_rgba(255,209,102,.25)]' : 'bg-paper/10'}">
              <div class="relative rounded-[24px] bg-ink-2 overflow-hidden" style="padding:{pad}px">
                <div data-art={c.id} class="relative rounded-[16px] overflow-hidden" style="width:{art}px;height:{art}px">
                  {#if t}<HandArt c={t.c} r={t.r} size={art} blur={locked} />{/if}
                  {#if c.rare}<div class="absolute inset-0 pointer-events-none bg-[linear-gradient(115deg,transparent_30%,rgba(255,236,180,.22)_45%,transparent_60%)] bg-[length:250%_100%]" style="animation:sheen 3.2s ease-in-out infinite"></div>{/if}
                  {#if locked}
                    <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                      <div class="text-[30px] leading-none text-[#ffd166]">★</div>
                      <div class="font-display text-[20px] leading-tight">Golden edge</div>
                      <div class="text-[13px] text-paper/70 leading-snug">Touches the most-loved tile this week</div>
                      <div class="mt-1 rounded-full bg-[#ffd166] text-ink px-4 py-2 text-[14px] font-semibold">Unlock · ✦{RARE_COST}</div>
                    </div>
                  {/if}
                  {#if c.goneAt}
                    <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/75 backdrop-blur-[2px]" in:fade={{ duration: 250 }}>
                      <div class="h-12 w-12 rounded-full flex items-center justify-center text-[20px] font-semibold text-ink" style="background:{t?.author?.color ?? '#7fe0c0'}" in:scale={{ start: 0.4, duration: 400, easing: backOut }}>{t?.author?.name?.[0] ?? '?'}</div>
                      <div class="text-[16px]">{t?.author?.name ?? 'Someone'} took this one</div>
                      <div class="text-[12px] text-paper/50">dealing you another…</div>
                    </div>
                  {/if}
                </div>
                <div class="px-1.5 pt-3 pb-1">
                  {#if c.rare}<div class="mb-1 text-[11px] uppercase tracking-[.18em] text-[#ffd166]">★ Rare card</div>{/if}
                  <div class="font-display italic text-[16px] leading-snug text-paper/85 line-clamp-2 min-h-[2.6em]">“…{c.whisper}”</div>
                  <div class="mt-2 flex items-center justify-between text-[12px] text-paper/45">
                    <span>touches {c.touches} drawing{c.touches === 1 ? '' : 's'}</span>
                    {#if c.looking && !c.goneAt}
                      <span class="flex items-center gap-1.5" in:fade><span class="h-2 w-2 rounded-full" style="background:{c.looking.color};animation:blink 1.4s infinite"></span>{c.looking.name} is looking too</span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      {/each}
    </div>
    {/key}

    <div class="flex justify-center gap-1.5 -mt-1">
      {#each app.hand as c, i (c.id)}
        <button class="h-1.5 rounded-full transition-all {i === app.focus ? 'w-5 bg-paper/80' : 'w-1.5 bg-paper/25'}" onclick={() => goTo(i)} aria-label="Go to card {i + 1}"></button>
      {/each}
    </div>
  </div>

  <!-- actions -->
  <div class="px-4 safe-b" in:fly={{ y: 40, duration: 500, delay: 300 }}>
    <div class="mx-auto max-w-md grid grid-cols-[1fr_1.5fr] gap-2">
      <button class="rounded-2xl bg-ink-2 border border-paper/15 py-3.5 text-[15px] flex flex-col items-center leading-tight active:scale-[.98] transition-transform" onclick={reshuffle}>
        <span>↻ New hand</span>
        <span class="text-[11px] text-paper/45 mt-0.5">{cost === 0 ? 'first one free' : `✦${cost}`}</span>
      </button>
      <button class="rounded-2xl py-3.5 text-[16px] font-semibold text-ink active:scale-[.98] transition-transform disabled:opacity-40 {cur?.rare && !cur.unlocked ? 'bg-[#ffd166]' : 'bg-coral'}" disabled={!cur || !!cur.goneAt} onclick={() => pick(app.focus)}>
        {cur?.rare && !cur.unlocked ? `Unlock ✦${RARE_COST}` : 'Draw here ✦'}
      </button>
    </div>
    <div class="mt-2.5 text-center text-[12px] text-paper/40">The rest of the drawing stays hidden until you add your tile.</div>
  </div>
</div>

<style>
  @keyframes -global-sheen { 0% { background-position: 120% 0 } 60%, 100% { background-position: -120% 0 } }
</style>
