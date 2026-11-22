<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { T, W, H, C0, R0 } from '../lib/art';
  import { world, key, type Tile } from '../lib/world.svelte';
  import { app } from '../lib/app.svelte';
  import { keyhole, MAG, BUY_LIGHT_MS } from '../lib/keyhole.svelte';
  import ObjectArt from './ObjectArt.svelte';

  const HOLD_MS = 140;      // a press must last this long before the lens opens (so taps don't flash the map)
  const TAP_MS = 220, TAP_MOVE = 12, DOUBLE_MS = 340, DOUBLE_DIST = 44;
  const PEEKED_AFTER_MS = 450;

  const cam = $derived(app.cam.current);
  const tileS = $derived(T * cam.s); // tile size on screen
  const toScreen = (c: number, r: number) => ({ x: app.vw / 2 + ((c + 0.5) * T - cam.x) * cam.s, y: app.vh / 2 + ((r + 0.5) * T - cam.y) * cam.s });
  const toWorld = (sx: number, sy: number) => ({ x: cam.x + (sx - app.vw / 2) / cam.s, y: cam.y + (sy - app.vh / 2) / cam.s });

  const spots = $derived(world.list.filter((t) => t.status !== 'filled'));
  const openCount = $derived(spots.filter((t) => t.status === 'open').length);

  // ---------- lens state ----------
  let finger = $state({ x: 0, y: 0 });
  let lensOn = $state(false);
  let pressing = false, pressAt = 0, pressFrom = { x: 0, y: 0 }, moved = 0;
  let touchType = $state(true);
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0, lastT = 0, hoverKey = '', hoverMs = 0;
  let lastTap = { t: 0, x: 0, y: 0 };
  let flicker = $state(false);
  let everPeeked = $state(false);

  const R = $derived(keyhole.radius);
  const S = $derived(cam.s * MAG);
  const lens = $derived.by(() => {
    const off = touchType ? R + 44 : 0; // on touch the lens floats above the finger, like a text loupe
    let x = finger.x, y = finger.y - off;
    if (y - R < 8) { y = finger.y + (touchType ? off : 0); }
    x = Math.max(R + 6, Math.min(app.vw - R - 6, x));
    return { x, y };
  });
  const focus = $derived(toWorld(finger.x, finger.y));

  function nearestOpen(sx: number, sy: number, maxTiles = 0.8): Tile | null {
    let best: Tile | null = null, bd = Infinity;
    for (const t of spots) {
      const p = toScreen(t.c, t.r);
      const d = Math.hypot(p.x - sx, p.y - sy) / tileS;
      if (d < bd && d <= maxTiles) { bd = d; best = t; }
    }
    return best;
  }

  function tick(t: number) {
    const dt = lastT ? t - lastT : 0; lastT = t;
    if (lensOn) {
      keyhole.light = Math.max(0, keyhole.light - dt);
      const near = nearestOpen(finger.x, finger.y, 0.6);
      const k = near ? key(near.c, near.r) : '';
      if (k && k === hoverKey) { hoverMs += dt; if (hoverMs > PEEKED_AFTER_MS && near!.status === 'open') keyhole.peeked[k] = true; }
      else { hoverKey = k; hoverMs = 0; }
      if (keyhole.light <= 0) {
        lensOn = false; flicker = true; setTimeout(() => (flicker = false), 500);
        app.toast('Your light ran out');
        setTimeout(() => { if (app.phase === 'peek') keyhole.shop = true; }, 700);
      }
      everPeeked = true;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  onDestroy(() => cancelAnimationFrame(raf));

  function down(e: PointerEvent) {
    if (keyhole.shop) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pressing = true; pressAt = performance.now(); pressFrom = { x: e.clientX, y: e.clientY }; moved = 0;
    touchType = e.pointerType !== 'mouse';
    finger = { x: e.clientX, y: e.clientY };
    app.touch();
    holdTimer = setTimeout(() => {
      if (!pressing) return;
      if (keyhole.light <= 0) { keyhole.shop = true; return; }
      lensOn = true; app.selected = null;
    }, HOLD_MS);
  }
  function move(e: PointerEvent) {
    if (!pressing) return;
    finger = { x: e.clientX, y: e.clientY };
    moved = Math.max(moved, Math.hypot(e.clientX - pressFrom.x, e.clientY - pressFrom.y));
  }
  function up(e: PointerEvent) {
    if (!pressing) return;
    pressing = false; lensOn = false;
    if (holdTimer) clearTimeout(holdTimer);
    const dur = performance.now() - pressAt;
    if (dur > TAP_MS || moved > TAP_MOVE) return;
    const now = performance.now();
    const dbl = now - lastTap.t < DOUBLE_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_DIST;
    lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
    if (dbl) enter(e.clientX, e.clientY); else select(e.clientX, e.clientY);
  }

  function select(sx: number, sy: number) {
    const t = nearestOpen(sx, sy);
    if (!t) { app.selected = null; return; }
    if (t.status === 'locked') { app.toast(`${t.author?.name} is drawing there`, t.author?.color); app.selected = null; return; }
    app.selected = key(t.c, t.r);
  }

  function enter(sx: number, sy: number) {
    const t = nearestOpen(sx, sy);
    if (!t) { app.toast('Nothing to join there. Look for a glowing spot.'); return; }
    if (t.status === 'locked') { app.toast(`${t.author?.name} is drawing there`, t.author?.color); return; }
    take(key(t.c, t.r));
  }

  function take(k: string) {
    app.selected = null;
    app.startCompose(k);
  }

  const sel = $derived(app.selected ? world.tiles[app.selected] : null);
  const selFilled = $derived(sel ? [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => world.isFilled(sel.c + a, sel.r + b)).length : 0);

  const bg = (c: number, r: number) =>
    app.img ? `background-image:url(${app.img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '';

  const lightPct = $derived(Math.max(0, Math.min(1, keyhole.light / keyhole.maxLight)));
  const grid = $derived(`background-size:${tileS}px ${tileS}px;background-position:${app.vw / 2 - cam.x * cam.s}px ${app.vh / 2 - cam.y * cam.s}px;`);
</script>

<!-- the cover: catches every pointer, hides the drawing -->
<div class="absolute inset-0 z-10 touch-none select-none bg-ink" role="application" aria-label="Hidden map. Press and drag to peek."
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} oncontextmenu={(e) => e.preventDefault()}
  in:fade={{ duration: 500 }} out:fade={{ duration: 700 }}>
  <!-- faint dotted grid so the darkness has a shape -->
  <div class="absolute inset-0 pointer-events-none opacity-40" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.22) 1.2px, transparent 1.5px);{grid}"></div>
  <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(15,13,23,.85) 85%)"></div>

  <!-- open spots glow, people at work show as a dim avatar -->
  {#each spots as t (key(t.c, t.r))}
    {@const p = toScreen(t.c, t.r)}
    {@const k = key(t.c, t.r)}
    {#if t.status === 'open'}
      <div class="absolute pointer-events-none" style="left:{p.x}px;top:{p.y}px;transform:translate(-50%,-50%)">
        <div class="relative h-[18px] w-[18px]">
          <div class="absolute inset-0 rounded-full bg-mint/30" style="animation:lantern 2.4s ease-in-out infinite;animation-delay:{(t.c * 37 + t.r * 11) % 17 / 10}s"></div>
          <div class="absolute inset-[5px] rounded-full {app.selected === k ? 'bg-coral' : 'bg-mint'} shadow-[0_0_14px_4px_rgba(127,224,192,.45)]"></div>
          {#if app.selected === k}<div class="absolute -inset-[9px] rounded-full border-2 border-coral" style="animation:pulse-ring 1.6s infinite"></div>{/if}
          {#if keyhole.peeked[k]}
            <div class="absolute left-[14px] -top-[12px] rounded-full bg-ink-2 border border-paper/20 px-1 text-[9px] leading-[14px] text-paper/70">👁</div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="absolute pointer-events-none flex items-center justify-center rounded-full text-[10px] font-semibold text-ink opacity-45" style="left:{p.x}px;top:{p.y}px;width:18px;height:18px;transform:translate(-50%,-50%);background:{t.author?.color}">
        {t.author?.name[0]}
      </div>
    {/if}
  {/each}

</div>

<!-- the keyhole lens, above the header so text never covers it -->
<div class="absolute inset-0 z-30 pointer-events-none">
  <div class="absolute pointer-events-none rounded-full overflow-hidden"
    style="left:{lens.x - R}px;top:{lens.y - R}px;width:{R * 2}px;height:{R * 2}px;opacity:{lensOn ? 1 : 0};transform:scale({lensOn ? 1 : 0.86});transition:opacity {lensOn ? 120 : 650}ms ease, transform {lensOn ? 160 : 650}ms ease;
      background-color:#0f0d17;background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.25) 1.4px, transparent 1.7px);background-size:{T * S}px {T * S}px;background-position:{R - focus.x * S}px {R - focus.y * S}px;
      -webkit-mask-image:radial-gradient(circle, #000 72%, transparent 100%);mask-image:radial-gradient(circle, #000 72%, transparent 100%)">
    <div class="absolute left-0 top-0 origin-top-left" style="transform:translate({R}px,{R}px) scale({S}) translate({-focus.x}px,{-focus.y}px)">
      {#each world.filled as t (key(t.c, t.r))}
        <div class="absolute" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px;{bg(t.c, t.r)}">
          {#if t.obj !== undefined}<ObjectArt obj={t.obj} />{/if}
        </div>
      {/each}
      {#each spots as t (key(t.c, t.r))}
        {#if t.status === 'open'}
          <div class="absolute rounded-[14px] border-[5px] border-dashed border-mint/60 flex items-center justify-center text-mint/80 text-[80px] font-light" style="left:{t.c * T + 14}px;top:{t.r * T + 14}px;width:{T - 28}px;height:{T - 28}px">+</div>
        {:else}
          <div class="absolute rounded-[14px] bg-ink-3/90 flex flex-col items-center justify-center gap-3" style="left:{t.c * T + 14}px;top:{t.r * T + 14}px;width:{T - 28}px;height:{T - 28}px">
            <div class="h-16 w-16 rounded-full flex items-center justify-center text-[28px] font-semibold text-ink" style="background:{t.author?.color}">{t.author?.name[0]}</div>
            <div class="text-[22px] text-paper/70">drawing…</div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <div class="absolute pointer-events-none rounded-full border-2 border-paper/60 shadow-[0_0_0_1px_rgba(15,13,23,.6),0_10px_40px_rgba(0,0,0,.6),inset_0_0_24px_rgba(15,13,23,.9)]"
    style="left:{lens.x - R}px;top:{lens.y - R}px;width:{R * 2}px;height:{R * 2}px;opacity:{lensOn ? 1 : 0};transform:scale({lensOn ? 1 : 0.86});transition:opacity {lensOn ? 120 : 650}ms ease, transform {lensOn ? 160 : 650}ms ease">
    <div class="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/70"></div>
  </div>
  {#if lensOn && touchType}
    <div class="absolute pointer-events-none h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/25 bg-paper/5" style="left:{finger.x}px;top:{finger.y}px"></div>
  {/if}
  {#if flicker}<div class="absolute inset-0 pointer-events-none bg-paper/10" style="animation:fadeflash .5s ease-out forwards"></div>{/if}
</div>

<!-- header -->
<div class="absolute inset-x-0 top-0 z-20 safe-t px-5 pr-14 pointer-events-none" in:fade>
  <div class="mt-2 font-display text-[30px] leading-none">Exquisite</div>
  <div class="mt-1 text-[13px] text-paper/55 flex items-center gap-1.5 flex-wrap">
    <span>{world.filled.length} tiles, all hidden</span><span>·</span>
    <span class="h-1.5 w-1.5 rounded-full bg-mint" style="animation:blink 1.4s infinite"></span><span>{world.drawingNow} drawing</span><span>·</span>
    <span>{openCount} open spots</span>
  </div>
  {#if !everPeeked}
    <div class="mt-3 inline-flex items-center gap-2 rounded-2xl bg-ink-2/90 border border-paper/10 px-3 py-2 text-[13px] leading-snug" out:fade>
      <span class="relative inline-block h-5 w-5 shrink-0"><span class="absolute inset-0 rounded-full border-2 border-paper/70" style="animation:peekhint 2.2s ease-in-out infinite"></span></span>
      <span><b>Press and drag</b> to peek through the keyhole.<br /><span class="text-paper/55">Double-tap a glowing spot to draw there.</span></span>
    </div>
  {/if}
</div>

<!-- bottom: either the chosen spot, or your light -->
<div class="absolute inset-x-0 bottom-0 z-20 px-3 safe-b">
  {#if sel && sel.status === 'open'}
    {#key app.selected}
      <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 p-4" in:fly={{ y: 40, duration: 320, easing: cubicOut }}>
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 shrink-0 rounded-full bg-mint/15 flex items-center justify-center text-mint text-[22px]">+</div>
          <div class="flex-1 text-[14px] leading-snug">
            <b>An open spot</b><br />
            <span class="text-paper/55">Touches {selFilled} drawn {selFilled === 1 ? 'tile' : 'tiles'}. {keyhole.peeked[app.selected!] ? 'You peeked here.' : "You haven't peeked here yet."}</span>
          </div>
          <button class="shrink-0 h-8 w-8 rounded-full text-paper/50" onclick={() => (app.selected = null)} aria-label="Close">✕</button>
        </div>
        <button class="mt-3 w-full rounded-2xl bg-coral py-3.5 text-[16px] font-semibold text-ink active:scale-[.98] transition-transform" onclick={() => take(app.selected!)}>I have an idea for this spot ✦</button>
      </div>
    {/key}
  {:else}
    <div class="mx-auto max-w-md rounded-3xl bg-ink-2/95 border border-paper/10 p-3.5 flex items-center gap-3" in:fly={{ y: 40, duration: 320 }}>
      <div class="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-[18px] {keyhole.light > 0 ? 'bg-[#ffd166]/15' : 'bg-paper/5'}" style={keyhole.light > 0 ? 'box-shadow:0 0 18px rgba(255,209,102,.25)' : ''}>{keyhole.light > 0 ? '🕯️' : '🌑'}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between text-[13px]">
          <span class="font-medium">{keyhole.light > 0 ? 'Light left' : 'Out of light'}</span>
          <span class="tabular-nums text-paper/60">{(keyhole.light / 1000).toFixed(1)}s</span>
        </div>
        <div class="mt-1.5 h-2 rounded-full bg-paper/10 overflow-hidden">
          <div class="h-full rounded-full" style="width:{lightPct * 100}%;background:linear-gradient(90deg,#ff6b4a,#ffd166)"></div>
        </div>
        <div class="mt-1 text-[11px] text-paper/40">{keyhole.light > 0 ? 'Drains only while you peek.' : 'You can still double-tap a spot and join blind.'}</div>
      </div>
      <button class="shrink-0 rounded-xl bg-ink-3 px-3 py-2.5 text-[13px] font-semibold" onclick={() => (keyhole.shop = true)}>+ Light</button>
    </div>
  {/if}
</div>

<!-- mock store -->
{#if keyhole.shop}
  <div class="absolute inset-0 z-40 bg-ink/60" role="presentation" onclick={() => (keyhole.shop = false)} transition:fade={{ duration: 180 }}></div>
  <div class="absolute inset-x-0 bottom-0 z-50 px-3 safe-b" transition:fly={{ y: 300, duration: 320, easing: cubicOut }}>
    <div class="mx-auto max-w-md rounded-3xl bg-ink-2 border border-paper/10 p-4">
      <div class="flex items-center justify-between">
        <div class="font-display text-[22px]">{keyhole.light > 0 ? 'More light' : 'Your light ran out'}</div>
        <div class="rounded-full bg-ink-3 px-3 py-1 text-[13px] tabular-nums">◆ {keyhole.credits} credits</div>
      </div>
      <div class="text-[13px] text-paper/55 mt-1">The drawing stays a secret until you add your tile. Light lets you look around a little first.</div>
      <div class="mt-3 grid gap-2">
        <button class="flex items-center gap-3 rounded-2xl bg-ink-3 p-3 text-left disabled:opacity-40" disabled={keyhole.credits < 1} onclick={() => { if (keyhole.buyLight()) { app.toast(`+${BUY_LIGHT_MS / 1000}s of light`); keyhole.shop = false; } }}>
          <span class="text-[22px]">🕯️</span>
          <span class="flex-1"><b class="text-[14px]">+{BUY_LIGHT_MS / 1000} seconds of light</b><br /><span class="text-[12px] text-paper/50">Peek a bit longer</span></span>
          <span class="rounded-lg bg-coral px-2.5 py-1 text-[13px] font-semibold text-ink">◆ 1</span>
        </button>
        <button class="flex items-center gap-3 rounded-2xl bg-ink-3 p-3 text-left disabled:opacity-40" disabled={keyhole.credits < 1 || keyhole.wide} onclick={() => { if (keyhole.buyWide()) { app.toast('Wider keyhole'); keyhole.shop = false; } }}>
          <span class="text-[22px]">🔭</span>
          <span class="flex-1"><b class="text-[14px]">Wider keyhole</b><br /><span class="text-[12px] text-paper/50">{keyhole.wide ? 'You have it' : 'A bigger circle, for this visit'}</span></span>
          <span class="rounded-lg bg-coral px-2.5 py-1 text-[13px] font-semibold text-ink">◆ 1</span>
        </button>
        <button class="rounded-2xl border border-paper/10 p-3 text-[13px] text-paper/60" onclick={() => { keyhole.credits += 5; app.toast('+5 credits (pretend purchase)'); }}>Get 5 credits · $1.99 (mock)</button>
      </div>
      <button class="mt-2 w-full py-2.5 text-[14px] text-paper/60" onclick={() => (keyhole.shop = false)}>Not now</button>
    </div>
  </div>
{/if}

<style>
  @keyframes -global-lantern { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.9); opacity: .25 } }
  @keyframes -global-peekhint { 0% { transform: translate(-4px, 2px) } 50% { transform: translate(4px, -2px) } 100% { transform: translate(-4px, 2px) } }
</style>
