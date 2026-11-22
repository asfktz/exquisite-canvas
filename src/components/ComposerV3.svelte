<script lang="ts">
  // Variant 3 — "Edge hints": entered from the map; each visible edge is labelled with the neighbour's prompt,
  // and the prompt lives in a floating pill.
  import { fly, fade } from 'svelte/transition';
  import { app } from '../lib/app.svelte';
  import { world } from '../lib/world.svelte';
  import { T } from '../lib/art';
  import { secs, statusText } from '../lib/bits';
  import Tries from './Tries.svelte';

  const m = $derived(app.mine);
  const cam = $derived(app.cam.current);
  const nb = $derived(m ? world.neighbours(m.c, m.r) : null);
  const box = $derived.by(() => {
    if (!m) return null;
    const cx = app.vw / 2 + ((m.c + 0.5) * T - cam.x) * cam.s;
    const cy = app.vh / 2 + ((m.r + 0.5) * T - cam.y) * cam.s;
    const h = 0.65 * T * cam.s;
    return { cx, cy, h };
  });
  const ringPct = $derived(app.lockLeft / (5 * 60 * 1000));
</script>

<!-- timer ring -->
<div class="absolute top-0 inset-x-0 safe-t flex justify-center pointer-events-none" in:fade>
  <div class="mt-2 flex items-center gap-2.5 rounded-full bg-ink-2/90 border border-paper/10 pl-1.5 pr-4 py-1.5">
    <svg width="34" height="34" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(244,233,216,.12)" stroke-width="4" />
      <circle cx="18" cy="18" r="15" fill="none" stroke="#ff6b4a" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset={94.2 * (1 - ringPct)} transform="rotate(-90 18 18)" />
    </svg>
    <div class="leading-tight"><div class="text-[13px] font-semibold tabular-nums">{secs(app.lockLeft)}</div><div class="text-[11px] text-paper/50">reserved for you</div></div>
  </div>
</div>

{#if box && nb && (app.phase === 'compose')}
  {@const lbl = 'absolute max-w-[240px] text-[12px] leading-tight text-paper/70 font-display italic pointer-events-none'}
  <div transition:fade>
    {#if nb.top?.status === 'filled'}<div class="{lbl} text-center" style="left:{box.cx}px;top:{box.cy - box.h - 8}px;transform:translate(-50%,-100%)">↓ “{nb.top.prompt}”</div>{/if}
    {#if nb.bottom?.status === 'filled'}<div class="{lbl} text-center" style="left:{box.cx}px;top:{box.cy + box.h + 8}px;transform:translateX(-50%)">↑ “{nb.bottom.prompt}”</div>{/if}
    {#if nb.left?.status === 'filled'}<div class="{lbl} whitespace-nowrap" style="left:{box.cx - box.h - 14}px;top:{box.cy}px;transform:translate(-50%,-50%) rotate(-90deg)">↓ “{nb.left.prompt}”</div>{/if}
    {#if nb.right?.status === 'filled'}<div class="{lbl} whitespace-nowrap" style="left:{box.cx + box.h + 14}px;top:{box.cy}px;transform:translate(-50%,-50%) rotate(90deg)">↓ “{nb.right.prompt}”</div>{/if}
  </div>
{/if}

<div class="absolute inset-x-0 bottom-0 safe-b px-4">
  {#if app.phase === 'compose'}
    <form in:fly={{ y: 40 }} class="mx-auto flex max-w-md items-center gap-2 rounded-full bg-paper text-ink p-1.5 pl-5 shadow-[0_10px_40px_rgba(0,0,0,.5)]" onsubmit={(e) => { e.preventDefault(); app.draw(); }}>
      <input bind:value={app.prompt} oninput={app.touch} placeholder="Continue the edges with…" class="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-ink/40" />
      <button disabled={!app.prompt.trim()} class="rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-paper disabled:opacity-30">Draw</button>
    </form>
    <div class="mt-2 text-center text-[12px] text-paper/45">Labels show what each neighbour asked for</div>
  {:else if app.phase === 'drawing'}
    <div in:fade class="mx-auto max-w-md rounded-full bg-ink-2/90 border border-paper/10 px-5 py-3 flex items-center gap-3">
      <div class="h-4 w-4 rounded-full border-2 border-coral border-t-transparent animate-spin"></div>
      <div class="text-[14px] flex-1">{statusText(app.progress.current)}</div>
      <div class="text-[13px] tabular-nums text-paper/50">{Math.round(app.progress.current * 100)}%</div>
    </div>
  {:else if app.phase === 'review'}
    <div in:fly={{ y: 40 }} class="mx-auto max-w-md">
      <Tries />
      <div class="flex items-center gap-2 rounded-full bg-paper text-ink p-1.5">
        <button class="rounded-full px-4 py-2.5 text-[14px]" onclick={() => app.edit()}>Edit</button>
        <button class="rounded-full px-4 py-2.5 text-[14px]" onclick={() => app.retry()}>↻</button>
        <button class="ml-auto rounded-full bg-coral px-5 py-2.5 text-[14px] font-semibold" onclick={() => app.submit()}>Submit ✓</button>
      </div>
    </div>
  {/if}
</div>
