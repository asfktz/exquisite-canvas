<script lang="ts">
  // Variant 1 — "Immersive": the tile fills the screen, a chat-style prompt bar sits at the bottom.
  import { fly, fade } from 'svelte/transition';
  import { app } from '../lib/app.svelte';
  import { SUGGESTIONS } from '../lib/world.svelte';
  import { secs, statusText } from '../lib/bits';
  import Tries from './Tries.svelte';

  let ta: HTMLTextAreaElement | undefined = $state();
  function grow() { if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; } app.touch(); }
</script>

<div class="absolute inset-x-0 top-0 safe-t px-4 flex justify-center pointer-events-none" in:fade>
  <div class="mt-2 flex items-center gap-2 rounded-full bg-ink-2/90 backdrop-blur px-3.5 py-2 text-[13px] border border-paper/10 pointer-events-auto">
    <span class="h-2 w-2 rounded-full bg-coral" style="animation:blink 1.6s infinite"></span>
    <span class="text-paper/70">This tile is yours for</span>
    <span class="tabular-nums font-semibold">{secs(app.lockLeft)}</span>
  </div>
</div>

<div class="absolute inset-x-0 bottom-0 safe-b px-3">
  {#if app.phase === 'compose'}
    <div in:fly={{ y: 30, duration: 300 }}>
      <div class="mb-2 text-center text-[13px] text-paper/50">Your neighbours are clear, the ring beyond is hazy. Pinch to look around.</div>
      <div class="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
        {#each SUGGESTIONS as s}
          <button class="shrink-0 rounded-full border border-paper/15 bg-ink-2/80 px-3 py-1.5 text-[13px] text-paper/80 active:bg-ink-3" onclick={() => { app.prompt = s; app.touch(); ta?.focus(); }}>{s}</button>
        {/each}
      </div>
      <form class="flex items-end gap-2 rounded-[26px] bg-ink-2 border border-paper/15 p-1.5 pl-4 shadow-2xl" onsubmit={(e) => { e.preventDefault(); app.draw(); }}>
        <textarea bind:this={ta} bind:value={app.prompt} oninput={grow} rows="1" placeholder="Describe what to draw here…"
          class="flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-snug outline-none placeholder:text-paper/35"
          onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); app.draw(); } }}></textarea>
        <button type="submit" disabled={!app.prompt.trim()} class="h-11 w-11 shrink-0 rounded-full bg-coral text-ink text-[20px] font-bold disabled:opacity-30 transition-opacity" aria-label="Draw">✦</button>
      </form>
    </div>
  {:else if app.phase === 'drawing'}
    <div in:fade class="mx-auto max-w-md rounded-3xl bg-ink-2/90 border border-paper/10 p-4 text-center">
      <div class="text-[15px]">{statusText(app.progress.current)}</div>
      <div class="mt-3 h-1.5 rounded-full bg-ink-3 overflow-hidden"><div class="h-full bg-coral rounded-full" style="width:{app.progress.current * 100}%"></div></div>
      <div class="mt-2 text-[13px] text-paper/45 italic font-display">“{app.prompt}”</div>
    </div>
  {:else if app.phase === 'review'}
    <div in:fly={{ y: 30, duration: 300 }} class="mx-auto max-w-md">
      <Tries />
      <div class="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
        <button class="rounded-2xl bg-ink-2 border border-paper/15 py-3.5 text-[15px]" onclick={() => app.edit()}>Edit</button>
        <button class="rounded-2xl bg-ink-2 border border-paper/15 py-3.5 text-[15px]" onclick={() => app.retry()}>↻ Again</button>
        <button class="rounded-2xl bg-coral text-ink font-semibold py-3.5 text-[15px]" onclick={() => app.submit()}>Submit tile</button>
      </div>
    </div>
  {/if}
</div>
