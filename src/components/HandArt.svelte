<script lang="ts">
  // The picture on a card: an empty tile with PEEK of each neighbour around it, nothing more.
  // Drawn in the same proportions as the fog window while composing, so the card can
  // grow straight into the drawing screen.
  import { T, W, H, C0, R0 } from '../lib/art';
  import { app, PEEK } from '../lib/app.svelte';
  import { world, key } from '../lib/world.svelte';
  import ObjectArt from './ObjectArt.svelte';

  let { c, r, size, hole = true, blur = false }: { c: number; r: number; size: number; hole?: boolean; blur?: boolean } = $props();
  const k = $derived(size / ((1 + 2 * PEEK) * T));
  const img = $derived(app.img);
  const cells = $derived([-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => ({ dc, dr, t: world.tiles[key(c + dc, r + dr)] }))).filter((x) => x.dc || x.dr));
  const at = (d: number) => ((d + PEEK) * T) * k;
</script>

<div class="relative overflow-hidden bg-ink" style="width:{size}px;height:{size}px;border-radius:{14 * k}px">
  <div class="absolute inset-0" style={blur ? `filter:blur(${10 * k}px) saturate(.7)` : ''}>
    {#each cells as { dc, dr, t } (dc + ',' + dr)}
      {#if t?.status === 'filled'}
        <div class="absolute" style="left:{at(dc) - 0.5}px;top:{at(dr) - 0.5}px;width:{T * k + 1}px;height:{T * k + 1}px;{img ? `background-image:url(${img.full});background-size:${W * k}px ${H * k}px;background-position:${-(c + dc - C0) * T * k}px ${-(r + dr - R0) * T * k}px` : ''}">
          {#if t.obj !== undefined}<ObjectArt obj={t.obj} />{/if}
        </div>
      {:else if t?.status === 'locked'}
        <div class="absolute bg-ink-3/80 border border-paper/10" style="left:{at(dc) + 8 * k}px;top:{at(dr) + 8 * k}px;width:{(T - 16) * k}px;height:{(T - 16) * k}px;border-radius:{10 * k}px"></div>
      {:else if t?.status === 'open'}
        <div class="absolute border-dashed border-mint/40" style="left:{at(dc) + 8 * k}px;top:{at(dr) + 8 * k}px;width:{(T - 16) * k}px;height:{(T - 16) * k}px;border-radius:{10 * k}px;border-width:{Math.max(1, 2 * k)}px"></div>
      {/if}
    {/each}
  </div>

  {#if hole}
    <!-- the empty tile: yours, if you want it -->
    <div class="absolute" style="left:{at(0)}px;top:{at(0)}px;width:{T * k}px;height:{T * k}px;background:#1d1a2b">
      <div class="absolute inset-0 opacity-50" style="background-image:linear-gradient(rgba(244,233,216,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(244,233,216,.06) 1px,transparent 1px);background-size:{32 * k}px {32 * k}px"></div>
      <div class="absolute border-coral/80 border-dashed" style="inset:{6 * k}px;border-width:{Math.max(1.5, 2 * k)}px;border-radius:{4 * k}px"></div>
    </div>
  {/if}

  <!-- same soft vignette as the fog window -->
  <div class="absolute inset-0 pointer-events-none" style="border-radius:{14 * k}px;box-shadow:inset 0 0 {22 * k}px {10 * k}px #0f0d17"></div>
</div>
