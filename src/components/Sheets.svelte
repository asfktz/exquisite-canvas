<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { app } from '../lib/app.svelte';
  import { world, key, ZS, OTHERS_EVERY_MS } from '../lib/world.svelte';
  import { ZONE_BONUS } from '../lib/app.svelte';
  import { secs } from '../lib/bits';
  import TileThumb from './TileThumb.svelte';

  let copied = $state(false);
  const mineDone = $derived(app.lastMine ? world.tiles[app.lastMine] : null);
  const link = $derived(mineDone ? `https://exquisite.place/t/${mineDone.c}.${mineDone.r}` : '');
  const sel = $derived(app.selected ? world.tiles[app.selected] : null);
  const selHidden = $derived(sel?.status === 'filled' && !world.visible(sel.c, sel.r));
  const zone = $derived(mineDone ? world.zoneOf(mineDone.c, mineDone.r) : null);
  const zFilled = $derived(zone ? world.zoneFilled(zone) : 0);
  const zEta = $derived((ZS * ZS - zFilled) * OTHERS_EVERY_MS);
  const hiddenCount = $derived(zone && zone.state === 'active' ? world.zoneTiles(zone).filter((t) => t.status === 'filled' && !world.visible(t.c, t.r)).length : 0);
  const PACKS = [{ n: 10, price: '$1.99' }, { n: 30, price: '$4.99', tag: 'popular' }, { n: 100, price: '$12.99', tag: 'best value' }];
  /** an open tile next to a hidden one: drawing it uncovers the hidden tile */
  function openNextTo(c: number, r: number) {
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const t = world.tiles[key(c + a, r + b)];
      if (t?.status === 'open') return key(t.c, t.r);
    }
    return undefined;
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {}
    copied = true; setTimeout(() => (copied = false), 1600);
  }
  async function share(text: string) {
    try { if (navigator.share) { await navigator.share({ title: 'My tile in Exquisite', url: text }); return; } } catch { return; }
    copy(text);
  }
</script>

{#if app.sheet === 'share' && mineDone}
  <div class="absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-ink-2 border-t border-paper/10 px-5 pt-3 safe-b shadow-[0_-20px_60px_rgba(0,0,0,.6)]" transition:fly={{ y: 320, duration: 500, easing: cubicOut }}>
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-paper/20"></div>
    <div class="flex items-center gap-4">
      <!-- 3x3 crop around my tile: everything I can see -->
      <div class="grid grid-cols-3 shrink-0 rounded-xl overflow-hidden" style="width:96px;height:96px">
        {#each [-1, 0, 1] as dr}
          {#each [-1, 0, 1] as dc}
            {@const t = world.tiles[key(mineDone.c + dc, mineDone.r + dr)]}
            {#if t?.status === 'filled'}
              <div class={dc === 0 && dr === 0 ? 'outline-2 outline-coral -outline-offset-2 relative z-10' : ''}><TileThumb c={t.c} r={t.r} obj={t.obj} size={32} radius={0} /></div>
            {:else}<div class="bg-ink-3/60"></div>{/if}
          {/each}
        {/each}
      </div>
      <div class="min-w-0">
        {#if zone?.state === 'revealed'}
          <div class="font-display text-[24px] leading-tight">{app.completedByMe ? 'You opened the zone.' : 'Zone revealed.'}</div>
          <div class="text-[13px] text-paper/55 mt-1">{zone.name} is now visible to everyone{app.completedByMe ? `, and you got +${ZONE_BONUS} credits for it` : ''}. {world.active ? `${world.active.name} just opened next door.` : ''}</div>
        {:else}
          <div class="font-display text-[24px] leading-tight">Your tile is in.</div>
          <div class="text-[13px] text-paper/55 mt-1">{zone?.name} is <b class="text-paper tabular-nums">{zFilled}/{ZS * ZS}</b>. It opens for everyone when the last tile lands, in about {secs(zEta)}.</div>
        {/if}
      </div>
    </div>
    {#if zone?.state === 'active'}
      <div class="mt-3 grid gap-[3px]" style="grid-template-columns:repeat(16,minmax(0,1fr))">
        {#each world.zoneTiles(zone) as t, i (i)}
          <div class="h-2 rounded-full {t.status === 'filled' ? (t.author?.name === 'You' ? 'bg-coral' : 'bg-paper/80') : t.status === 'locked' ? 'bg-paper/25' : 'bg-paper/10'}"></div>
        {/each}
      </div>
      <div class="mt-3 rounded-2xl bg-ink border border-paper/10 px-4 py-3 text-[13px] text-paper/70 leading-snug">
        {hiddenCount} tiles in this zone are still hidden from you. <b class="text-paper">Each tile you draw uncovers the 8 around it</b>, and everyone who helped gets +{ZONE_BONUS} credits when it opens.
      </div>
    {/if}
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button class="rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-ink" onclick={() => app.drawAnother()}>Draw another <span class="font-normal opacity-60">· 1✦</span></button>
      <button class="rounded-2xl bg-ink-3 py-3.5 text-[15px]" onclick={() => app.explore()}>{zone?.state === 'active' ? 'Watch it fill' : 'Look around'}</button>
    </div>
    <div class="mt-2 flex items-center gap-2 rounded-2xl p-1 pl-3">
      <div class="flex-1 truncate text-[12px] text-paper/40">{link.replace('https://', '')}</div>
      <button class="rounded-xl px-3 py-1.5 text-[12px] text-paper/60" onclick={() => share(link)}>{copied ? 'Copied ✓' : 'Share'}</button>
    </div>
  </div>
{/if}

{#if app.sheet === 'buy'}
  <div class="absolute inset-0 z-40 bg-ink/60" onclick={() => app.closeBuy()} role="presentation" transition:fade={{ duration: 150 }}></div>
  <div class="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-ink-2 border-t border-paper/10 px-5 pt-3 safe-b shadow-[0_-20px_60px_rgba(0,0,0,.6)]" transition:fly={{ y: 360, duration: 450, easing: cubicOut }}>
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-paper/20"></div>
    <div class="font-display text-[24px] leading-tight">{app.credits < 1 ? 'Out of credits' : 'Credits'}</div>
    <div class="text-[13px] text-paper/55 mt-1">You have <b class="text-paper">{app.credits}</b>. Each drawing (or redo) costs 1. Helping a zone open gives +{ZONE_BONUS} back.</div>
    <div class="mt-4 space-y-2">
      {#each PACKS as p}
        <button class="w-full flex items-center gap-3 rounded-2xl bg-ink border border-paper/10 px-4 py-3 text-left active:scale-[.99] transition-transform" onclick={() => app.buy(p.n)}>
          <span class="text-[#ffd166] text-[18px]">✦</span>
          <span class="flex-1 text-[15px]"><b>{p.n}</b> credits {#if p.tag}<span class="ml-1 rounded-full bg-coral/20 text-coral px-2 py-0.5 text-[11px]">{p.tag}</span>{/if}</span>
          <span class="rounded-xl bg-paper text-ink px-3 py-1.5 text-[14px] font-semibold">{p.price}</span>
        </button>
      {/each}
    </div>
    <div class="mt-3 text-center text-[11px] text-paper/35">Mockup: no payment happens, tapping just adds credits.</div>
  </div>
{/if}

{#if app.sheet === 'info' && sel}
  <div class="absolute inset-x-0 bottom-0 z-30 px-3 safe-b" transition:fly={{ y: 200, duration: 300 }}>
    <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-4 shadow-2xl">
      {#if selHidden}
        {@const nb = openNextTo(sel.c, sel.r)}
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-full flex items-center justify-center font-semibold text-ink" style="background:{sel.author?.color}">{sel.author?.name[0]}</div>
          <div class="min-w-0"><div class="text-[15px]">Drawn by {sel.author?.name} · hidden</div><div class="text-[13px] text-paper/50">You'll see it when {world.zoneOf(sel.c, sel.r)?.name} fills, or when you draw next to it.</div></div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="rounded-xl bg-ink-3 py-2.5 text-[14px]" onclick={() => { app.sheet = null; app.selected = null; }}>Wait</button>
          <button class="rounded-xl bg-coral py-2.5 text-[14px] font-semibold text-ink" onclick={() => app.startCompose(nb)}>{nb ? 'Draw next to it' : 'Draw a tile'}</button>
        </div>
      {:else if sel.status === 'filled'}
        <div class="flex gap-3">
          <TileThumb c={sel.c} r={sel.r} obj={sel.obj} size={64} />
          <div class="min-w-0 flex-1">
            <div class="font-display italic text-[17px] leading-snug">“{sel.prompt}”</div>
            <div class="mt-1 flex items-center gap-1.5 text-[13px] text-paper/55">
              <span class="h-2.5 w-2.5 rounded-full" style="background:{sel.author?.color}"></span>{sel.author?.name} · {sel.ago}
            </div>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="rounded-xl bg-ink-3 py-2.5 text-[14px]" onclick={() => copy(`https://exquisite.place/t/${sel.c}.${sel.r}`)}>{copied ? 'Copied ✓' : 'Copy link'}</button>
          <button class="rounded-xl bg-ink-3 py-2.5 text-[14px]" onclick={() => { app.sheet = null; app.selected = null; }}>Close</button>
        </div>
      {:else if sel.status === 'locked'}
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-full flex items-center justify-center font-semibold text-ink" style="background:{sel.author?.color}">{sel.author?.name[0]}</div>
          <div><div class="text-[15px]">{sel.author?.name} is drawing here</div><div class="text-[13px] text-paper/50 tabular-nums">Frees up in {secs((sel.lockUntil ?? 0) - app.now)} if they leave</div></div>
        </div>
      {:else}
        <div class="text-[15px] mb-1">This tile is open</div>
        <div class="text-[13px] text-paper/50 mb-3">Drawing here uncovers the 8 tiles around it.</div>
        <button class="w-full rounded-xl bg-coral py-3 text-[15px] font-semibold text-ink" onclick={() => app.startCompose(app.selected!)}>Draw this tile ✦</button>
      {/if}
    </div>
  </div>
{/if}

{#if app.idleWarn}
  <div class="absolute inset-x-0 top-16 z-40 flex justify-center px-4" transition:fly={{ y: -30 }}>
    <div class="flex items-center gap-3 rounded-2xl bg-paper text-ink px-4 py-3 shadow-2xl max-w-sm">
      <div class="text-[14px] leading-snug"><b>Still there?</b> Your tile goes to someone else in <span class="tabular-nums font-semibold">{secs(65000 - app.idle)}</span></div>
      <button class="shrink-0 rounded-xl bg-ink text-paper px-3 py-2 text-[13px] font-semibold" onclick={app.touch}>I'm here</button>
    </div>
  </div>
{/if}

{#if app.phase === 'released'}
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-ink/80 backdrop-blur-sm px-6" transition:fade>
    <div class="max-w-sm rounded-3xl bg-ink-2 border border-paper/10 p-6 text-center">
      <div class="text-[34px]">⌛</div>
      <div class="font-display text-[24px] mt-1">Your tile was released</div>
      <div class="text-[14px] text-paper/55 mt-2">You were away for a while, so someone else got the chance to draw it. There are still open spots.</div>
      <button class="mt-5 w-full rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-ink" onclick={() => app.startCompose()}>Find me a new tile</button>
      <button class="mt-2 w-full rounded-2xl bg-ink-3 py-3 text-[14px]" onclick={() => app.explore()}>Just look around</button>
    </div>
  </div>
{/if}
