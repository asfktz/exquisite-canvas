<script lang="ts">
  // One cell's picture: the master slice (so seams always match) + an interior-only light + the object.
  import { T, W, H, C0, R0 } from '../lib/art';
  import ObjectArt from '../components/ObjectArt.svelte';
  import { FX_FILTER } from './attempts';
  import { edge } from './state.svelte';

  let { c, r, obj, fx = 0, style = '', cls = '' }: { c: number; r: number; obj?: number; fx?: number; style?: string; cls?: string } = $props();
  const bg = $derived(edge.img ? `background-image:url(${edge.img.full});background-size:${W}px ${H}px;background-position:${-(c - C0) * T}px ${-(r - R0) * T}px;` : '');
</script>

<div class="absolute inset-0 {cls}" style="{bg}{style}">
  {#if fx}
    <div class="absolute inset-0" style="{bg}filter:{FX_FILTER[fx]};-webkit-mask-image:radial-gradient(closest-side,#000 45%,transparent 100%);mask-image:radial-gradient(closest-side,#000 45%,transparent 100%)"></div>
    {#if fx === 3}
      <div class="absolute inset-0 fx-stars" style="-webkit-mask-image:radial-gradient(closest-side,#000 30%,transparent 90%);mask-image:radial-gradient(closest-side,#000 30%,transparent 90%)"></div>
    {/if}
  {/if}
  {#if obj !== undefined}<ObjectArt {obj} />{/if}
</div>
