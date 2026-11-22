<script lang="ts">
  import { T, W, H, C0, R0 } from '../lib/art';
  import { app } from '../lib/app.svelte';
  import ObjectArt from './ObjectArt.svelte';
  let { c, r, size = 56, obj, radius = 10 }: { c: number; r: number; size?: number; obj?: number; radius?: number } = $props();
  const k = $derived(size / T);
</script>
<div class="relative overflow-hidden shrink-0" style="width:{size}px;height:{size}px;border-radius:{radius}px;background-color:#1d1a2b;{app.img ? `background-image:url(${app.img.full});background-size:${W * k}px ${H * k}px;background-position:${-(c - C0) * T * k}px ${-(r - R0) * T * k}px` : ''}">
  {#if obj !== undefined}<ObjectArt {obj} />{/if}
</div>
