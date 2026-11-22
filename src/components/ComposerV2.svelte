<script lang="ts">
  // Variant 2 — "Guided": tile on top, a step-by-step bottom sheet below with what the neighbours drew.
  import { fly, fade } from 'svelte/transition';
  import { app } from '../lib/app.svelte';
  import { world, SUGGESTIONS } from '../lib/world.svelte';
  import { secs, statusText } from '../lib/bits';
  import Tries from './Tries.svelte';

  const m = $derived(app.mine);
  const nb = $derived(m ? world.neighbours(m.c, m.r) : null);
  const sides = $derived(nb ? ([['↑', 'Above', nb.top], ['←', 'Left', nb.left], ['→', 'Right', nb.right], ['↓', 'Below', nb.bottom]] as const).filter(([, , t]) => t?.status === 'filled') : []);
  const step = $derived(app.phase === 'compose' ? (app.prompt.trim() ? 2 : 1) : 3);
  const sheetH = $derived(Math.max(300, app.vh * 0.46));
</script>

<div class="absolute inset-x-0 top-0 safe-t pl-4 pr-14 flex items-center justify-between text-[13px]" in:fade>
  <div class="mt-2 font-display text-[18px]">Tile <span class="text-paper/50">{m ? `${m.c},${m.r}` : ''}</span></div>
  <div class="mt-2 rounded-full bg-ink-2 border border-paper/10 px-3 py-1.5 tabular-nums">🔒 {secs(app.lockLeft)}</div>
</div>

<div class="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-ink-2 border-t border-paper/10 shadow-[0_-20px_60px_rgba(0,0,0,.5)] flex flex-col" style="height:{sheetH}px" in:fly={{ y: 200, duration: 450 }}>
  <div class="mx-auto mt-2.5 h-1 w-10 rounded-full bg-paper/20"></div>
  <div class="flex items-center justify-center gap-2 px-5 pt-3 text-[12px]">
    {#each ['Look', 'Describe', 'Draw'] as s, i}
      <div class="flex items-center gap-1.5 {step >= i + 1 ? 'text-paper' : 'text-paper/35'}">
        <span class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold {step > i + 1 ? 'bg-mint text-ink' : step === i + 1 ? 'bg-coral text-ink' : 'bg-ink-3'}">{step > i + 1 ? '✓' : i + 1}</span>{s}
      </div>
      {#if i < 2}<div class="h-px w-6 bg-paper/15"></div>{/if}
    {/each}
  </div>

  <div class="flex-1 min-h-0 overflow-y-auto px-5 pt-3 safe-b">
    {#if app.phase === 'compose'}
      <div class="text-[13px] text-paper/50 mb-1.5">Your neighbours drew:</div>
      <div class="space-y-1 mb-3">
        {#each sides as [arrow, label, t]}
          <div class="flex items-baseline gap-2 text-[14px]"><span class="text-coral w-4">{arrow}</span><span class="text-paper/45 w-11 shrink-0">{label}</span><span class="font-display italic text-paper/90 truncate">“{t?.prompt}”</span></div>
        {/each}
      </div>
      <textarea bind:value={app.prompt} oninput={app.touch} rows="2" placeholder="What continues here?"
        class="w-full resize-none rounded-2xl bg-ink border border-paper/15 px-4 py-3 text-[16px] outline-none focus:border-coral/60 placeholder:text-paper/35"></textarea>
      <div class="no-scrollbar -mx-5 my-2 flex gap-2 overflow-x-auto px-5">
        {#each SUGGESTIONS as s}
          <button class="shrink-0 rounded-full bg-ink-3 px-3 py-1.5 text-[13px] text-paper/80" onclick={() => { app.prompt = s; app.touch(); }}>{s}</button>
        {/each}
      </div>
      <button class="mt-1 w-full rounded-2xl bg-coral py-3.5 text-[16px] font-semibold text-ink disabled:opacity-30" disabled={!app.prompt.trim()} onclick={() => app.draw()}>Draw it ✦</button>
    {:else if app.phase === 'drawing'}
      <div class="pt-6 text-center" in:fade>
        <div class="font-display text-[22px]">{statusText(app.progress.current)}</div>
        <div class="mx-auto mt-4 h-1.5 max-w-xs rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-coral" style="width:{app.progress.current * 100}%"></div></div>
        <div class="mt-4 text-[14px] text-paper/50 italic font-display">“{app.prompt}”</div>
      </div>
    {:else if app.phase === 'review'}
      <div in:fade>
        <div class="font-display text-[22px] text-center">Does it fit?</div>
        <div class="text-center text-[13px] text-paper/50 mb-3">Check the seams. Once submitted, it's permanent.</div>
        <Tries />
        <div class="grid grid-cols-2 gap-2">
          <button class="rounded-2xl bg-ink-3 py-3 text-[15px]" onclick={() => app.edit()}>Edit prompt</button>
          <button class="rounded-2xl bg-ink-3 py-3 text-[15px]" onclick={() => app.retry()}>↻ Another version</button>
        </div>
        <button class="mt-2 w-full rounded-2xl bg-coral py-3.5 text-[16px] font-semibold text-ink" onclick={() => app.submit()}>Submit to the drawing</button>
      </div>
    {/if}
  </div>
</div>
