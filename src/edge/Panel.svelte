<script lang="ts">
  import { untrack } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { T } from '../lib/art';
  import { app } from './state.svelte';
  import TileArt from './TileArt.svelte';

  const fs = $derived(app.focusSpot);
  let first = $state<string | null>(null);
  $effect(() => { if (app.focus) first = untrack(() => app.idea?.text ?? null); });
  const ideas = $derived.by(() => { if (!fs) return []; const l = app.ideas(fs.c, fs.r); const i = l.findIndex((x) => x.text === first); return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l; });
  const nbs = $derived(fs ? app.neighbours(fs.c, fs.r) : []);
  const busy = $derived(app.phase === 'painting' || app.phase === 'stitching');
  const bloom = $derived(app.variant === 'bloom');
  const take = $derived(app.takes[app.pick]);
  const names = $derived([...new Set(nbs.map((n) => (n.author.name === 'You' ? 'you' : n.author.name)))]);
  const who = $derived(names.length <= 1 ? names[0] ?? '' : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1]);
</script>

{#snippet thumb(t: any, i: number)}
  <button class="relative shrink-0 h-12 w-12 rounded-[10px] overflow-hidden border-2 transition-all {app.pick === i ? 'border-coral scale-105' : 'border-transparent opacity-70'}" onclick={() => (app.pick = i)} in:scale={{ start: 0.4, duration: 400, easing: backOut }}>
    <div class="absolute left-0 top-0 origin-top-left" style="width:{T}px;height:{T}px;transform:scale({44 / T})"><TileArt c={fs!.c} r={fs!.r} obj={t.obj} tint={t.tint} jit={t.jit} /></div>
  </button>
{/snippet}

{#snippet primary(label: string, fn: () => void, cost = false)}
  {#if app.outOfInk && cost}
    <button class="flex-1 rounded-2xl bg-[#ffd166] py-3.5 text-[15px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => app.refill()}>Out of ink · top up +5</button>
  {:else}
    <button class="flex-1 rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-ink active:scale-[.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2" disabled={busy} onclick={fn}>
      {label}{#if cost}<span class="rounded-full bg-ink/15 px-2 py-0.5 text-[12px]">✦ 1</span>{/if}
    </button>
  {/if}
{/snippet}

{#if fs && app.phase !== 'map'}
  <div class="absolute inset-x-0 bottom-0 z-30 px-3 safe-b" bind:clientHeight={app.panelH} transition:fly={{ y: 260, duration: 450, easing: cubicOut }}>
    <div class="mx-auto max-w-md rounded-[28px] bg-ink-2/95 backdrop-blur border border-paper/10 p-3.5 shadow-2xl">
      <div class="flex items-center gap-2 mb-2.5">
        <div class="flex -space-x-1.5">
          {#each nbs as n}<span class="h-6 w-6 rounded-full border-2 border-ink-2 flex items-center justify-center text-[10px] font-semibold text-ink" style="background:{n.author.color}">{n.author.name[0]}</span>{/each}
        </div>
        <div class="flex-1 text-[13px] text-paper/60 truncate">Continuing {who}</div>
        <button class="h-8 w-8 rounded-full bg-ink-3 text-paper/60 text-[15px] disabled:opacity-30" disabled={busy} onclick={() => app.close()} aria-label="Close">✕</button>
      </div>

      {#if bloom}
        {#if app.phase === 'painting'}
          <div class="py-1 font-display italic text-[19px] leading-tight">Four takes blooming…</div>
          <div class="text-[13px] text-paper/50 mt-0.5 mb-3">Each one picks up a different thread from the edges.</div>
        {:else if app.pick === -1}
          <div class="py-1 font-display italic text-[19px] leading-tight">Tap the one you love.</div>
          <input class="mt-2 mb-3 w-full rounded-2xl bg-ink-3 border border-paper/10 px-4 py-3 text-[15px] placeholder:text-paper/35 outline-none focus:border-paper/30" placeholder="or steer the next bloom…" value={app.text} oninput={(e) => app.setText(e.currentTarget.value)} />
          <div class="flex gap-2">{@render primary('Bloom again', () => app.bloom(), true)}</div>
        {:else if app.phase !== 'stitching'}
          <div class="flex items-center gap-2 mb-3">
            <button class="h-12 rounded-[10px] bg-ink-3 px-3 text-[13px] text-paper/70" onclick={() => (app.pick = -1)}>▦ all 4</button>
            <div class="flex-1 font-display italic text-[16px] leading-tight">{take?.text}</div>
          </div>
          <div class="flex gap-2">{@render primary('Stitch it in', () => app.stitch())}</div>
        {:else}
          <div class="py-3 text-center font-display italic text-[19px]">Stitching it in…</div>
        {/if}
      {:else if app.phase === 'stitching'}
        <div class="py-3 text-center font-display italic text-[19px]" in:fade>Stitching it in…</div>
      {:else if app.takes.length}
        <div class="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
          {#each app.takes as t, i}{@render thumb(t, i)}{/each}
          {#if app.phase === 'painting'}<div class="shrink-0 h-12 w-12 rounded-[10px] bg-ink-3 border-2 border-coral/60 flex items-center justify-center text-coral text-[16px]" style="animation:blink 1s infinite" in:scale>✦</div>{/if}
          <div class="pl-1 font-display italic text-[16px] leading-tight min-w-[120px]">{take?.text}</div>
        </div>
        <div class="flex gap-2">
          <button class="rounded-2xl bg-ink-3 px-4 py-3.5 text-[14px] text-paper/85 disabled:opacity-50 flex items-center gap-1.5" disabled={busy} onclick={() => (app.outOfInk ? app.refill() : app.paint())}>{app.phase === 'painting' ? 'Painting…' : app.outOfInk ? 'Top up +5' : 'Another take'} <span class="text-[11px] text-paper/50">✦1</span></button>
          {@render primary('Stitch it in', () => app.stitch())}
        </div>
        <button class="mt-2 w-full text-center text-[12px] text-paper/45 py-1" onclick={() => { app.takes = []; app.pick = 0; }}>← try a different idea</button>
      {:else}
        <div class="text-[11px] uppercase tracking-[.14em] text-paper/40 mb-1.5">The edges whisper</div>
        <div class="-mx-3.5 px-3.5 flex gap-1.5 mb-2.5 overflow-x-auto no-scrollbar touch-pan-x">
          {#each ideas as i (i.text)}
            {@const sel = app.idea?.text === i.text && !app.text}
            <button class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 font-display italic text-[13.5px] transition-colors {sel ? 'bg-paper text-ink border-paper' : 'border-paper/20 text-paper/85'}" disabled={busy} onclick={() => app.choose(i)}>{i.text}</button>
          {/each}
        </div>
        <input class="mb-3 w-full rounded-2xl bg-ink-3 border border-paper/10 px-4 py-3 text-[15px] placeholder:text-paper/35 outline-none focus:border-paper/30 disabled:opacity-50" placeholder="or whisper your own…" disabled={busy} value={app.text} oninput={(e) => app.setText(e.currentTarget.value)} onkeydown={(e) => e.key === 'Enter' && app.paint()} />
        <div class="flex gap-2">{@render primary(app.phase === 'painting' ? 'Painting…' : 'Paint it', () => app.paint(), app.phase !== 'painting')}</div>
      {/if}
    </div>
  </div>
{/if}
