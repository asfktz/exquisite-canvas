<script lang="ts">
  // Top bar for the zone-reveal variant: progress of the active zone + credits.
  import { fade } from 'svelte/transition';
  import { app } from '../lib/app.svelte';
  import { world, ZS, OTHERS_EVERY_MS } from '../lib/world.svelte';
  import { secs } from '../lib/bits';

  let { compact = false }: { compact?: boolean } = $props();

  const z = $derived(world.active);
  const tiles = $derived(z ? world.zoneTiles(z) : []);
  const filled = $derived(tiles.filter((t) => t.status === 'filled').length);
  const mineLeft = $derived(tiles.some((t) => t.mine && t.status !== 'filled'));
  const left = $derived(ZS * ZS - filled);
  const othersLeft = $derived(left - (mineLeft ? 1 : 0));
  const eta = $derived(othersLeft * OTHERS_EVERY_MS);
</script>

<div class="absolute inset-x-0 top-0 safe-t pl-3 pr-12 flex items-start gap-2 pointer-events-none z-10" in:fade>
  {#if z}
    <div class="mt-0.5 min-w-0 flex-1 max-w-[340px] rounded-2xl bg-ink-2/90 backdrop-blur border border-paper/10 px-3 py-2 pointer-events-auto">
      <div class="flex items-baseline justify-between gap-2 text-[12px]">
        <span class="truncate"><span class="text-paper/45">Zone</span> <b class="font-semibold">{z.name}</b></span>
        <span class="tabular-nums text-paper/70 shrink-0">{filled}/{ZS * ZS}</span>
      </div>
      <div class="mt-1.5 grid grid-cols-16 gap-[2px]" style="grid-template-columns:repeat(16,minmax(0,1fr))">
        {#each tiles as t, i (i)}
          <div class="h-1.5 rounded-full {t.status === 'filled' ? (t.author?.name === 'You' ? 'bg-coral' : 'bg-paper/80') : t.mine ? 'bg-coral/50' : t.status === 'locked' ? 'bg-paper/25' : 'bg-paper/10'}" style={t.status === 'locked' || (t.mine && t.status !== 'filled') ? 'animation:blink 1.4s infinite' : ''}></div>
        {/each}
      </div>
      {#if !compact}
        <div class="mt-1.5 text-[11px] text-paper/50 leading-tight">
          {#if left === 1 && mineLeft}<span class="text-coral">Yours is the last tile.</span> Submit to reveal it for everyone.
          {:else if left === 0}Revealing…
          {:else}Hidden until full · reveals in ~{secs(eta)}{/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="mt-0.5 rounded-2xl bg-ink-2/90 border border-paper/10 px-3 py-2 text-[12px]">All zones revealed</div>
  {/if}
  <button class="mt-0.5 shrink-0 rounded-full bg-ink-2/90 backdrop-blur border border-paper/10 pl-2.5 pr-3 py-1.5 text-[13px] flex items-center gap-1.5 pointer-events-auto active:scale-95 transition-transform" onclick={() => (app.sheet = 'buy')}>
    <span class="text-[#ffd166]">✦</span><b class="tabular-nums">{app.credits}</b><span class="text-paper/40 text-[15px] leading-none">+</span>
  </button>
</div>
