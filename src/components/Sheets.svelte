<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { app } from '../lib/app.svelte';
  import { world, key } from '../lib/world.svelte';
  import { secs } from '../lib/bits';
  import TileThumb from './TileThumb.svelte';

  let copied = $state(false);
  const mineDone = $derived(app.lastMine ? world.tiles[app.lastMine] : null);
  const link = $derived(mineDone ? `https://exquisite.place/t/${mineDone.c}.${mineDone.r}` : '');
  const sel = $derived(app.selected ? world.tiles[app.selected] : null);

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
      <!-- 3x3 crop around my tile -->
      <div class="grid grid-cols-3 shrink-0 rounded-xl overflow-hidden" style="width:96px;height:96px">
        {#each [-1, 0, 1] as dr}
          {#each [-1, 0, 1] as dc}
            {@const t = world.tiles[key(mineDone.c + dc, mineDone.r + dr)]}
            {#if t?.status === 'filled'}
              <div class={dc === 0 && dr === 0 ? 'outline-2 outline-coral -outline-offset-2 relative z-10' : 'opacity-60'}><TileThumb c={t.c} r={t.r} obj={t.obj} size={32} radius={0} /></div>
            {:else}<div class="bg-ink-3/60"></div>{/if}
          {/each}
        {/each}
      </div>
      <div class="min-w-0">
        <div class="font-display text-[24px] leading-tight">Your tile is in.</div>
        <div class="text-[13px] text-paper/55 mt-1">Week {world.season} reveals in <b class="text-paper tabular-nums">{secs(app.seasonLeft)}</b>. Until then only you and your neighbours see it.</div>
      </div>
    </div>
    <button class="mt-4 w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left {app.notify ? 'border-mint/50 bg-mint/10' : 'border-paper/10 bg-ink'}" onclick={() => { app.notify = !app.notify; }}>
      <span class="text-[20px]">{app.notify ? '🔔' : '🔕'}</span>
      <span class="flex-1 text-[14px] leading-snug">{app.notify ? 'We\'ll ping you for the reveal' : 'Remind me when the week is revealed'}</span>
      <span class="text-[13px] text-paper/50">{app.notify ? 'On' : 'Off'}</span>
    </button>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button class="rounded-2xl bg-coral py-3.5 text-[15px] font-semibold text-ink" onclick={() => app.startCompose()}>Draw another <span class="opacity-60">1◆</span></button>
      <button class="rounded-2xl bg-ink-3 py-3.5 text-[15px]" onclick={() => app.explore()}>Look around</button>
    </div>
    <div class="mt-2 flex items-center justify-center gap-3 text-[12px] text-paper/40"><span>Every tile you draw clears the fog around it.</span><button class="underline" onclick={() => share(link)}>{copied ? 'Copied ✓' : 'Share'}</button></div>
  </div>
{/if}

{#if app.sheet === 'info' && sel}
  <div class="absolute inset-x-0 bottom-0 z-30 px-3 safe-b" transition:fly={{ y: 200, duration: 300 }}>
    <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 backdrop-blur border border-paper/10 p-4 shadow-2xl">
      {#if sel.status === 'filled' && !world.canSee(sel.c, sel.r)}
        <div class="flex gap-3 items-center">
          <div class="h-16 w-16 shrink-0 rounded-[10px] bg-ink-3 flex items-center justify-center text-[26px]">🌫️</div>
          <div class="min-w-0 flex-1">
            <div class="text-[15px]">Drawn this week by {sel.author?.name}</div>
            <div class="text-[13px] text-paper/55">Hidden until the reveal in <span class="tabular-nums">{secs(app.seasonLeft)}</span>, or draw next to it to see it now.</div>
          </div>
        </div>
        <button class="mt-3 w-full rounded-xl bg-ink-3 py-2.5 text-[14px]" onclick={() => { app.sheet = null; app.selected = null; }}>Close</button>
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
        <div class="text-[13px] text-paper/50 mb-3">Part of week {world.season}. You'll see the tiles around it while you draw.</div>
        <button class="w-full rounded-xl bg-coral py-3 text-[15px] font-semibold text-ink" onclick={() => app.startCompose(app.selected!)}>Draw this tile ✦ <span class="opacity-60">1◆</span></button>
      {/if}
    </div>
  </div>
{/if}

{#if app.sheet === 'credits'}
  <div class="absolute inset-0 z-40 bg-ink/60" onclick={() => (app.sheet = null)} role="presentation" transition:fade={{ duration: 150 }}></div>
  <div class="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-ink-2 border-t border-paper/10 px-5 pt-3 safe-b shadow-[0_-20px_60px_rgba(0,0,0,.6)]" transition:fly={{ y: 320, duration: 400, easing: cubicOut }}>
    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-paper/20"></div>
    <div class="flex items-baseline justify-between">
      <div class="font-display text-[24px]">Credits</div>
      <div class="text-[15px] tabular-nums"><span class="text-[#ffd166]">◆</span> {app.credits} left</div>
    </div>
    <div class="text-[13px] text-paper/55 mt-1">One credit is one try at a tile. More tiles this week means more of the fog cleared before the reveal.</div>
    <div class="mt-4 grid grid-cols-3 gap-2">
      {#each [{ n: 5, p: '₪9.90' }, { n: 15, p: '₪24.90', tag: 'popular' }, { n: 40, p: '₪54.90' }] as pk}
        <button class="relative rounded-2xl border {pk.tag ? 'border-coral/70 bg-coral/10' : 'border-paper/10 bg-ink'} py-3 text-center" onclick={() => app.buy(pk.n)}>
          {#if pk.tag}<div class="absolute -top-2 inset-x-0 mx-auto w-fit rounded-full bg-coral px-2 text-[10px] font-semibold text-ink">{pk.tag}</div>{/if}
          <div class="font-display text-[24px] leading-none"><span class="text-[#ffd166] text-[16px]">◆</span>{pk.n}</div>
          <div class="text-[12px] text-paper/60 mt-1">{pk.p}</div>
        </button>
      {/each}
    </div>
    <div class="mt-3 rounded-2xl bg-ink px-4 py-3 text-[13px] text-paper/60">🎁 Free: +2 credits when each new week opens.</div>
    <div class="mt-3 text-center text-[11px] text-paper/35">Mock purchase, nothing is charged.</div>
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
