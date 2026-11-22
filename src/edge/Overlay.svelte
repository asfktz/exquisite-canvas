<script lang="ts">
  // Screen-space things that float over the map: whisper chips, dream captions, pull handles, visitors.
  import { fade, fly } from 'svelte/transition';
  import { T } from '../lib/art';
  import { app, SIDES } from './state.svelte';
  import { hash, ARROW, type Side } from './ideas';

  const cam = $derived(app.cam.current);
  const ts = $derived(T * cam.s);
  const on = $derived(app.phase === 'map' && ts > 66);
  const items = $derived(on ? app.spots.map((s) => {
    const nb = s.sides[0] ? SIDES[s.sides[0]] : [0, 0];
    const ctr = app.screen((s.c + 0.5) * T, (s.r + 0.5) * T);
    // lean toward the neighbour it's whispering from
    const lean = { x: ctr.x + nb[0] * ts * 0.12, y: ctr.y + nb[1] * ts * 0.16 };
    return { ...s, ctr, lean, ideas: app.ideas(s.c, s.r) };
  }).filter((s) => s.ctr.x > -ts && s.ctr.x < app.vw + ts && s.ctr.y > -ts && s.ctr.y < app.vh + ts) : []);

  // pull handle drag
  let drag: { x: number; y: number; side: Side; id: number } | null = null;
  function down(e: PointerEvent, k: string, side: Side) {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, side, id: e.pointerId };
    app.pullStart(k, side);
  }
  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = SIDES[drag.side];
    const amt = (-(e.clientX - drag.x) * d[0] - (e.clientY - drag.y) * d[1]) / ts;
    app.pullMove(amt);
  }
  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (app.pullAmt.current < 0.04) { app.pullAmt.set(0.28, { duration: 160 }).then(() => app.pullEnd()); return; }
    app.pullEnd();
  }
  const ROT: Record<Side, number> = { l: 0, r: 180, t: 90, b: -90 };
  const pullA = $derived(app.pullAmt.current);
</script>

<div class="absolute inset-0 pointer-events-none z-10">
  {#each items as s (s.k)}
    {@const visitor = app.visitors[s.k]}
    {#if visitor}
      <div class="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-ink/80 backdrop-blur px-2 py-1 text-[11px] border border-paper/10" style="left:{s.ctr.x}px;top:{s.ctr.y}px" transition:fade>
        <span class="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-ink" style="background:{visitor.color}">{visitor.name[0]}</span>
        <span class="text-paper/80">{visitor.name}</span><span class="dots"><i></i><i></i><i></i></span>
      </div>
    {:else if app.variant === 'whisper'}
      {@const wi = app.whisperIndex(s.k, s.ideas.length)}
      {@const idea = s.ideas[wi]}
      {#key wi}
        <button class="absolute pointer-events-auto whisper" style="left:{s.lean.x}px;top:{s.lean.y}px;max-width:{Math.max(96, ts - 14)}px;animation-delay:-{(hash(s.k) % 5000) / 1000}s"
          in:fly={{ y: 8, duration: 900 }} out:fade={{ duration: 700 }} onclick={() => app.open(s.k, idea)}>
          <span class="block rounded-2xl bg-ink/55 backdrop-blur-sm border border-paper/15 px-2.5 py-1.5 font-display italic text-[12.5px] leading-tight text-paper/90 shadow-lg">{idea.text}</span>
        </button>
      {/key}
    {:else if app.variant === 'dream'}
      {@const di = app.dreamIndex(s.k, s.ideas.length)}
      {#key di}
        <div class="absolute -translate-x-1/2 text-center font-display italic text-[11px] leading-tight text-paper/75 [text-shadow:0_1px_6px_#0f0d17]" style="left:{s.ctr.x}px;top:{s.ctr.y + ts * 0.5 - 30}px;width:{ts - 12}px" in:fade={{ duration: 1200 }} out:fade={{ duration: 900 }}>
          {s.ideas[di].obj < 0 ? 'dreaming further…' : `dreaming of ${s.ideas[di].text.replace(/^(a|an|the)\s/, '').replace('?', '')}…`}
        </div>
      {/key}
    {:else if app.variant === 'pull' && s.sides[0]}
      {@const sd = s.sides[0]}
      {@const nb = SIDES[sd]}
      {@const hp = { x: s.ctr.x + nb[0] * ts * 0.5, y: s.ctr.y + nb[1] * ts * 0.5 }}
      {@const active = app.pull?.k === s.k}
      <button class="absolute pointer-events-auto touch-none handle {active ? 'on' : ''}" aria-label="Pull to extend"
        style="left:{hp.x + (active ? -nb[0] * pullA * ts : 0)}px;top:{hp.y + (active ? -nb[1] * pullA * ts : 0)}px"
        onpointerdown={(e) => down(e, s.k, sd)} onpointermove={move} onpointerup={up} onpointercancel={up}>
        <span class="block h-11 w-11 rounded-full bg-paper/90 text-ink shadow-[0_0_0_6px_rgba(255,214,160,.25),0_6px_20px_rgba(0,0,0,.4)] flex items-center justify-center text-[18px] font-semibold" style="transform:rotate({ROT[sd]}deg)">›</span>
      </button>
      {#if active && pullA > 0.15}
        <div class="absolute -translate-x-1/2 -translate-y-1/2 font-display italic text-[13px] text-paper [text-shadow:0_1px_8px_#0f0d17] whitespace-nowrap" style="left:{s.ctr.x}px;top:{s.ctr.y + ts * 0.62}px" transition:fade={{ duration: 200 }}>
          {pullA < 0.45 ? 'keep pulling…' : `${ARROW[sd]} let go`}
        </div>
      {/if}
    {/if}
  {/each}
</div>
