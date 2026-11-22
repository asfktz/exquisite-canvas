<script lang="ts">
  import { T } from '../lib/art';
  import { key } from '../lib/world.svelte';
  import { edge, type Side } from './state.svelte';
  import { attemptsFor } from './attempts';
  import Art from './Art.svelte';

  const cam = $derived(edge.cam.current);
  // keeps lines and glyphs a readable size on screen at any zoom
  const k = $derived(Math.max(1, 1 / cam.s));
  const v = $derived(edge.variant);
  const busy = $derived(edge.mode !== 'browse');
  const freshEdges = $derived(new Set((edge.after?.opened ?? []).map((o) => key(o.c, o.r))));

  // gradient direction for a ghost bleeding in from a filled side
  const BLEED: Record<Side, string> = { l: 'to right', r: 'to left', t: 'to bottom', b: 'to top' };
  const ORIGIN: Record<Side, [string, string]> = { l: ['0%', '50%'], r: ['100%', '50%'], t: ['50%', '0%'], b: ['50%', '100%'] };
  const seed = (c: number, r: number) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % 1000 / 1000;

  function seamStyle(s: Side, w = 4) {
    if (s === 'l') return `left:${-w / 2}px;top:0;width:${w}px;height:${T}px`;
    if (s === 'r') return `left:${T - w / 2}px;top:0;width:${w}px;height:${T}px`;
    if (s === 't') return `top:${-w / 2}px;left:0;height:${w}px;width:${T}px`;
    return `top:${T - w / 2}px;left:0;height:${w}px;width:${T}px`;
  }
  function pullClip(s: Side, p: number) {
    const q = ((1 - p) * 100).toFixed(2);
    if (s === 'l') return `inset(0 ${q}% 0 0)`;
    if (s === 'r') return `inset(0 0 0 ${q}%)`;
    if (s === 't') return `inset(0 0 ${q}% 0)`;
    return `inset(${q}% 0 0 0)`;
  }
  function foldStyle(s: Side, p: number) {
    const at = p * T;
    if (s === 'l') return `left:${at - 22}px;top:0;width:22px;height:${T}px;background:linear-gradient(to right,transparent,rgba(255,250,235,.55) 70%,rgba(0,0,0,.35));`;
    if (s === 'r') return `left:${T - at}px;top:0;width:22px;height:${T}px;background:linear-gradient(to left,transparent,rgba(255,250,235,.55) 70%,rgba(0,0,0,.35));`;
    if (s === 't') return `top:${at - 22}px;left:0;height:22px;width:${T}px;background:linear-gradient(to bottom,transparent,rgba(255,250,235,.55) 70%,rgba(0,0,0,.35));`;
    return `top:${T - at}px;left:0;height:22px;width:${T}px;background:linear-gradient(to top,transparent,rgba(255,250,235,.55) 70%,rgba(0,0,0,.35));`;
  }
  // stitches across a seam, in cell coords
  function stitchMarks(s: Side) {
    const out: { d: string; i: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const p = 18 + i * ((T - 36) / 8);
      const a = 9;
      let d = '';
      if (s === 'l') d = `M${-a} ${p - a} L${a} ${p + a} M${-a} ${p + a} L${a} ${p - a}`;
      if (s === 'r') d = `M${T - a} ${p - a} L${T + a} ${p + a} M${T - a} ${p + a} L${T + a} ${p - a}`;
      if (s === 't') d = `M${p - a} ${-a} L${p + a} ${a} M${p + a} ${-a} L${p - a} ${a}`;
      if (s === 'b') d = `M${p - a} ${T - a} L${p + a} ${T + a} M${p + a} ${T - a} L${p - a} ${T + a}`;
      out.push({ d, i });
    }
    return out;
  }
  const seamLine = (s: Side) => (s === 'l' ? `M0 0 L0 ${T}` : s === 'r' ? `M${T} 0 L${T} ${T}` : s === 't' ? `M0 0 L${T} 0` : `M0 ${T} L${T} ${T}`);

  const grid = $derived(`background-size:${T * cam.s}px ${T * cam.s}px;background-position:${edge.vw / 2 - cam.x * cam.s}px ${edge.vh / 2 - cam.y * cam.s}px;`);
  const tgt = $derived(edge.target);
  const pull = $derived(edge.pull);
  const recentStitches = $derived(edge.stitches.filter((s) => edge.now - s.at < 2600));
</script>

<div class="absolute inset-0 pointer-events-none opacity-60" style="background-image:radial-gradient(circle at 0 0, rgba(244,233,216,.2) 1.4px, transparent 1.6px);{grid}"></div>

<div class="absolute left-0 top-0 origin-top-left will-change-transform" style="transform:translate3d({edge.vw / 2}px,{edge.vh / 2}px,0) scale({cam.s}) translate3d({-cam.x}px,{-cam.y}px,0)">

  <!-- ============ the artwork ============ -->
  {#each edge.list as t (key(t.c, t.r))}
    <div class="absolute {t.fresh && edge.now - t.fresh < 3000 ? (t.mine ? 'settle' : 'pop') : ''}" style="left:{t.c * T - 0.5}px;top:{t.r * T - 0.5}px;width:{T + 1}px;height:{T + 1}px">
      <Art c={t.c} r={t.r} obj={t.obj} fx={t.fx} />
      {#if t.fresh && edge.now - t.fresh < 3000}<div class="absolute inset-0 bg-white pointer-events-none flash"></div>{/if}
    </div>
  {/each}

  <!-- ============ open edges (the invitation) ============ -->
  {#each edge.frontier as f (f.k)}
    {#if f.k !== edge.targetKey && !(pull && key(pull.c, pull.r) === f.k)}
      {@const a0 = attemptsFor(f.c, f.r, 0)}
      {@const d = seed(f.c, f.r)}
      <div class="absolute transition-opacity duration-500 {freshEdges.has(f.k) ? 'edge-born' : ''}" style="left:{f.c * T}px;top:{f.r * T}px;width:{T}px;height:{T}px;opacity:{busy ? 0.28 : 1};--d:{-d * 4}s;--born:{[...freshEdges].indexOf(f.k) * 0.12}s">
        {#if v === 'breathe'}
          {#each f.sides as s}
            <div class="absolute inset-0 bleed" style="--dir:{BLEED[s]}"><Art c={f.c} r={f.r} /></div>
            <div class="absolute seam-glow" style={seamStyle(s, 4 * k)}></div>
          {/each}
        {:else if v === 'dream'}
          <div class="absolute inset-[3px] rounded-[6px] border border-paper/10"></div>
          {#each a0 as a, i}
            <div class="absolute inset-0 dream" style="--i:{i}"><Art c={f.c} r={f.r} obj={a.obj} fx={a.fx} /></div>
          {/each}
        {:else if v === 'pull'}
          <div class="absolute inset-[3px] rounded-[6px] border border-dashed border-paper/12"></div>
          {#each f.sides as s}
            <div class="absolute inset-0 lip lip-{s}">
              <div class="absolute inset-0" style="clip-path:{pullClip(s, 0.15)}"><Art c={f.c} r={f.r} obj={a0[0].obj} fx={a0[0].fx} /></div>
              <div class="absolute" style={foldStyle(s, 0.15)}></div>
            </div>
            <div class="absolute chev chev-{s}" style="scale:{k * 0.7}">
              <svg width="34" height="34" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="#f4e9d8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </div>
          {/each}
        {:else}
          <div class="absolute inset-[3px] rounded-[6px] border border-paper/[.07]"></div>
          {#each f.sides as s}
            <div class="absolute ember ember-{s}" style="{seamStyle(s, 2.5 * k)};--k:{k}"><span class="spark"></span></div>
          {/each}
        {/if}
      </div>
    {/if}
  {/each}

  <!-- ============ pulling (before attempts are open) ============ -->
  {#if pull && edge.mode === 'browse'}
    {@const a = attemptsFor(pull.c, pull.r, 0)[0]}
    <div class="absolute overflow-hidden" style="left:{pull.c * T}px;top:{pull.r * T}px;width:{T}px;height:{T}px">
      <div class="absolute inset-0" style="clip-path:{pullClip(pull.side, Math.max(0.15, pull.p))};{pull.live ? '' : 'transition:clip-path .32s cubic-bezier(.2,.9,.3,1)'}"><Art c={pull.c} r={pull.r} obj={a.obj} fx={a.fx} /></div>
      <div class="absolute" style="{foldStyle(pull.side, Math.max(0.15, pull.p))}{pull.live ? '' : 'transition:all .32s cubic-bezier(.2,.9,.3,1)'}"></div>
    </div>
  {/if}

  <!-- ============ attempts, in place ============ -->
  {#if tgt && edge.mode !== 'browse'}
    {@const x = tgt.c * T}
    {@const y = tgt.r * T}
    {@const sides = edge.sidesOf(tgt.c, tgt.r)}
    <div class="absolute overflow-hidden" style="left:{x - 0.5}px;top:{y - 0.5}px;width:{T + 1}px;height:{T + 1}px;background:#1d1a2b">
      {#if edge.mode === 'generating'}
        {#each sides as s}
          <div class="absolute inset-0 bleed gen" style="--dir:{BLEED[s]}"><Art c={tgt.c} r={tgt.r} /></div>
        {/each}
        <div class="absolute inset-0 scan"></div>
      {:else if edge.mode === 'stitching' && edge.current}
        <Art c={tgt.c} r={tgt.r} obj={edge.current.obj} fx={edge.current.fx} />
      {:else if v === 'breathe'}
        <div class="absolute top-0 left-0 h-full flex" style="width:{T * edge.attempts.length}px;transform:translateX({-edge.idx * T + edge.dragX / cam.s}px);{edge.dragging ? '' : 'transition:transform .45s cubic-bezier(.2,.9,.25,1)'}">
          {#each edge.attempts as a, i}
            <div class="relative h-full shrink-0" style="width:{T}px"><Art c={tgt.c} r={tgt.r} obj={a.obj} fx={a.fx} /></div>
          {/each}
        </div>
        <div class="absolute inset-0 arrive"></div>
      {:else if v === 'dream'}
        {#each edge.attempts as a, i}
          <div class="absolute inset-0" style="opacity:{i === edge.idx ? 1 : 0};filter:blur({i === edge.idx ? 0 : 8}px) saturate({i === edge.idx ? 1 : 1.6});transform:scale({i === edge.idx ? 1 : 1.04});transition:opacity .7s ease,filter .7s ease,transform .9s ease"><Art c={tgt.c} r={tgt.r} obj={a.obj} fx={a.fx} /></div>
        {/each}
        <div class="absolute inset-0 wake"></div>
      {:else if v === 'pull'}
        {@const n = edge.attempts.length}
        {@const next = edge.attempts[(edge.idx + 1) % n]}
        <Art c={tgt.c} r={tgt.r} obj={next.obj} fx={next.fx} />
        <div class="absolute inset-0 bg-ink/40" style="opacity:{Math.max(0, 1 - Math.abs(edge.dragX) / 140)}"></div>
        <div class="absolute inset-0 shadow-[0_10px_40px_rgba(0,0,0,.6)]" style="transform:translateX({edge.dragX / cam.s}px) rotate({edge.dragX * 0.06}deg);{edge.dragging ? '' : 'transition:transform .35s cubic-bezier(.2,.9,.3,1.2)'}">
          <Art c={tgt.c} r={tgt.r} obj={edge.current?.obj} fx={edge.current?.fx} />
        </div>
        {#if edge.flung}
          {#key edge.flung.id}
            <div class="absolute inset-0 fling" style="--dir:{edge.flung.dir}"><Art c={tgt.c} r={tgt.r} obj={edge.flung.a.obj} fx={edge.flung.a.fx} /></div>
          {/key}
        {/if}
      {:else}
        {@const [ox, oy] = ORIGIN[edge.growSide]}
        {#if edge.prevIdx >= 0}
          {@const p = edge.attempts[edge.prevIdx]}
          <Art c={tgt.c} r={tgt.r} obj={p.obj} fx={p.fx} />
        {/if}
        {#key edge.growKey}
          <div class="absolute inset-0 grow" style="--ox:{ox};--oy:{oy}"><Art c={tgt.c} r={tgt.r} obj={edge.current?.obj} fx={edge.current?.fx} /></div>
          <div class="absolute grow-ring" style="left:calc({ox} - {T * 1.5}px);top:calc({oy} - {T * 1.5}px);width:{T * 3}px;height:{T * 3}px"></div>
        {/key}
      {/if}
    </div>

    <!-- seams that will be stitched -->
    {#if edge.mode === 'choose'}
      <div class="absolute pointer-events-none" style="left:{x}px;top:{y}px;width:{T}px;height:{T}px">
        {#each sides as s}<div class="absolute seam-pending" style={seamStyle(s, 3)}></div>{/each}
        <div class="absolute inset-0 border-2 border-paper/70 rounded-[2px] choose-frame"></div>
      </div>
    {/if}
  {/if}

  <!-- ============ stitches ============ -->
  {#each recentStitches as st (st.id)}
    {@const col = st.mine ? '#ffd166' : edge.cells[key(st.c, st.r)]?.author.color ?? '#ffd166'}
    <div class="absolute pointer-events-none" style="left:{st.c * T}px;top:{st.r * T}px;width:{T}px;height:{T}px">
      <div class="absolute inset-0 ripple" style="--col:{col}"></div>
      {#if st.mine}<div class="absolute inset-0 ripple" style="--col:{col};animation-delay:.25s"></div>{/if}
      <svg class="absolute overflow-visible stitch-group" style="left:0;top:0" width={T} height={T} viewBox="0 0 {T} {T}">
        {#each st.sides as s}
          <path d={seamLine(s)} class="thread" stroke={col} />
          {#each stitchMarks(s) as m}
            <path d={m.d} class="mark" stroke={col} style="animation-delay:{0.15 + m.i * 0.05}s" />
          {/each}
        {/each}
      </svg>
    </div>
  {/each}
</div>

<style>
  @property --reach { syntax: '<percentage>'; inherits: true; initial-value: 30%; }
  .bleed {
    -webkit-mask-image: linear-gradient(var(--dir), #000 0%, rgba(0,0,0,.55) calc(var(--reach) * .5), transparent var(--reach));
    mask-image: linear-gradient(var(--dir), #000 0%, rgba(0,0,0,.55) calc(var(--reach) * .5), transparent var(--reach));
    animation: breathe 3.8s ease-in-out infinite alternate; animation-delay: var(--d, 0s);
    filter: saturate(.85);
  }
  .bleed.gen { animation: reach-out 1s cubic-bezier(.3,.6,.2,1) forwards; }
  @keyframes breathe { 0% { --reach: 14%; opacity: .55; } 100% { --reach: 52%; opacity: 1; } }
  @keyframes reach-out { 0% { --reach: 30%; opacity: .8; } 100% { --reach: 120%; opacity: 1; filter: saturate(1) blur(2px); } }
  .seam-glow { background: rgba(255, 214, 160, .9); filter: blur(3px); animation: glow 3.8s ease-in-out infinite alternate; animation-delay: var(--d, 0s); }
  @keyframes glow { from { opacity: .15 } to { opacity: .75 } }

  .dream { opacity: 0; filter: blur(1.2px); animation: dream 11s ease-in-out infinite; animation-delay: calc(var(--d) * 2 - var(--i) * 2.75s); }
  @keyframes dream { 0% { opacity: 0; transform: scale(1.03) } 8% { opacity: .42 } 22% { opacity: .42; transform: scale(1) } 32% { opacity: 0 } 100% { opacity: 0 } }

  .lip { animation: lip 2.4s ease-in-out infinite; animation-delay: var(--d); }
  .lip-l { --tx: 7px; --ty: 0px } .lip-r { --tx: -7px; --ty: 0px } .lip-t { --tx: 0px; --ty: 7px } .lip-b { --tx: 0px; --ty: -7px }
  @keyframes lip { 0%, 60%, 100% { transform: translate(0, 0) } 75% { transform: translate(var(--tx), var(--ty)) } 85% { transform: translate(calc(var(--tx) * .3), calc(var(--ty) * .3)) } }
  .chev { opacity: .0; animation: chev 2.4s ease-in-out infinite; animation-delay: var(--d); }
  .chev-l { left: 48px; top: calc(50% - 17px) } .chev-r { right: 48px; top: calc(50% - 17px); rotate: 180deg }
  .chev-t { top: 48px; left: calc(50% - 17px); rotate: 90deg } .chev-b { bottom: 48px; left: calc(50% - 17px); rotate: -90deg }
  @keyframes chev { 0%, 50% { opacity: 0; translate: 0 0 } 75% { opacity: .7 } 100% { opacity: 0; translate: 0 0 } }

  .ember { background: linear-gradient(90deg, #ff6b4a, #ffd166, #ff6b4a); box-shadow: 0 0 calc(7px * var(--k)) calc(2px * var(--k)) rgba(255, 140, 80, .55); border-radius: 99px; animation: ember 2.6s ease-in-out infinite alternate; animation-delay: var(--d); overflow: visible; }
  .ember-t, .ember-b { background: linear-gradient(90deg, #ff6b4a, #ffd166, #ff6b4a); }
  .ember-l, .ember-r { background: linear-gradient(180deg, #ff6b4a, #ffd166, #ff6b4a); }
  @keyframes ember { from { opacity: .35; filter: brightness(.8) } to { opacity: 1; filter: brightness(1.25) } }
  .spark { position: absolute; width: calc(6px * var(--k)); height: calc(6px * var(--k)); border-radius: 50%; background: #fff6d8; box-shadow: 0 0 calc(8px * var(--k)) calc(3px * var(--k)) rgba(255, 220, 150, .9); margin: calc(-3px * var(--k) + 1px); }
  .ember-l .spark, .ember-r .spark { left: 50%; animation: spark-v 3.2s linear infinite; animation-delay: var(--d); }
  .ember-t .spark, .ember-b .spark { top: 50%; animation: spark-h 3.2s linear infinite; animation-delay: var(--d); }
  @keyframes spark-v { 0% { top: 0; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { top: 100%; opacity: 0 } }
  @keyframes spark-h { 0% { left: 0; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { left: 100%; opacity: 0 } }

  .edge-born { animation: born .8s cubic-bezier(.2, 1.4, .4, 1) both; animation-delay: calc(.9s + var(--born)); }
  @keyframes born { from { opacity: 0; transform: scale(.7); filter: brightness(2) } to { opacity: 1; transform: scale(1); filter: none } }

  .scan { background: linear-gradient(180deg, transparent 0%, rgba(255, 240, 210, .0) 35%, rgba(255, 240, 210, .35) 50%, transparent 65%); background-size: 100% 220%; animation: scan 1s linear infinite; }
  @keyframes scan { from { background-position: 0 100% } to { background-position: 0 -100% } }
  .arrive { background: #fff; animation: arrive .7s ease-out forwards; pointer-events: none; }
  @keyframes arrive { from { opacity: .55 } to { opacity: 0 } }
  .wake { background: radial-gradient(closest-side, rgba(255, 250, 230, .8), transparent); animation: wake 1s ease-out forwards; }
  @keyframes wake { from { opacity: 1; transform: scale(.2) } to { opacity: 0; transform: scale(1.6) } }

  .fling { animation: fling .5s cubic-bezier(.4, 0, .9, .6) forwards; }
  @keyframes fling { to { transform: translateX(calc(var(--dir) * 140%)) rotate(calc(var(--dir) * 22deg)); opacity: 0 } }

  .grow { animation: grow 1.1s cubic-bezier(.25, .7, .2, 1) both; }
  @keyframes grow { from { clip-path: circle(0% at var(--ox) var(--oy)) } to { clip-path: circle(150% at var(--ox) var(--oy)) } }
  .grow-ring { border-radius: 50%; box-shadow: inset 0 0 0 4px rgba(255, 214, 140, .9), 0 0 30px 10px rgba(255, 160, 90, .5); animation: ring 1.1s cubic-bezier(.25, .7, .2, 1) forwards; }
  @keyframes ring { from { transform: scale(0); opacity: 1 } 80% { opacity: .8 } to { transform: scale(1); opacity: 0 } }

  .seam-pending { background: repeating-linear-gradient(45deg, rgba(255, 214, 160, .95) 0 6px, transparent 6px 12px); animation: glow 1.2s ease-in-out infinite alternate; }
  .choose-frame { box-shadow: 0 0 0 1px rgba(0, 0, 0, .3), 0 0 40px rgba(255, 220, 170, .25); animation: framein .5s ease-out both; }
  @keyframes framein { from { opacity: 0; transform: scale(1.08) } to { opacity: 1; transform: scale(1) } }

  .settle { animation: settle 1.1s cubic-bezier(.2, 1.3, .4, 1) both; z-index: 2; }
  @keyframes settle { 0% { transform: scale(1.07); filter: brightness(1.35) drop-shadow(0 0 30px rgba(255, 210, 140, .8)) } 100% { transform: scale(1); filter: none } }
  .pop { animation: pop .9s ease-out both; }
  @keyframes pop { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: scale(1) } }
  .flash { animation: flash 1.2s ease-out forwards; }
  @keyframes flash { 0% { opacity: .7 } 100% { opacity: 0 } }

  .ripple { border: 5px solid var(--col); border-radius: 10px; animation: ripple 1.6s cubic-bezier(.2, .7, .3, 1) .2s both; }
  @keyframes ripple { from { transform: scale(1); opacity: .9 } to { transform: scale(2.8); opacity: 0 } }
  .stitch-group { animation: stitch-out .6s ease-in 1.7s forwards; filter: drop-shadow(0 0 6px rgba(255, 200, 120, .9)); }
  @keyframes stitch-out { to { opacity: 0 } }
  .thread { fill: none; stroke-width: 3; stroke-dasharray: 260; stroke-dashoffset: 260; animation: draw .55s ease-out forwards; }
  .mark { fill: none; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 60; stroke-dashoffset: 60; animation: draw .25s ease-out forwards; }
  @keyframes draw { to { stroke-dashoffset: 0 } }
  :global(.fx-stars) { background-image: radial-gradient(1.6px 1.6px at 20% 30%, #fff, transparent), radial-gradient(1.4px 1.4px at 70% 20%, #fff, transparent), radial-gradient(2px 2px at 40% 70%, #ffe7b0, transparent), radial-gradient(1.2px 1.2px at 85% 60%, #fff, transparent), radial-gradient(1.6px 1.6px at 55% 45%, #fff, transparent), linear-gradient(160deg, transparent 40%, rgba(255,255,255,.5) 41%, transparent 43%); }
</style>
