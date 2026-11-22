<script lang="ts">
  // One tile of artwork, in world units (T x T). Looks: final | sketch | painting (reveal 0..1)
  import ObjectArt from '../components/ObjectArt.svelte';
  import { app, tileBg } from './state.svelte';
  import type { Jit } from './ideas';
  let { c, r, obj = -1, tint = 0, jit, look = 'final', reveal = 1 }: { c: number; r: number; obj?: number; tint?: number; jit?: Jit; look?: 'final' | 'sketch' | 'painting'; reveal?: number } = $props();
  const objT = $derived(jit ? `transform:translate(${jit.dx}px,${jit.dy}px) scale(${jit.f ? -jit.s : jit.s},${jit.s})` : '');
  const SK = 'filter:grayscale(1) contrast(2.4) brightness(1.25) blur(.5px);';
</script>

{#snippet layer(style: string)}
  <div class="absolute inset-0" style="{tileBg(app.img, c, r)}{style}">
    {#if obj >= 0}<div class="absolute inset-0" style={objT}><ObjectArt {obj} /></div>{/if}
  </div>
{/snippet}

<div class="absolute inset-0 overflow-hidden">
  {#if look === 'final'}
    {@render layer(`filter:hue-rotate(${tint}deg) saturate(1.05)`)}
  {:else if look === 'sketch'}
    <div class="absolute inset-0 bg-[#1d1a2b]"></div>
    {@render layer(SK + 'opacity:.78')}
  {:else}
    <div class="absolute inset-0 bg-[#1d1a2b]"></div>
    {@render layer(SK + `opacity:${0.78 * (1 - reveal * 0.4)}`)}
    <div class="absolute inset-0" style="clip-path:inset(0 0 {100 - reveal * 100}% 0)">
      {@render layer(`filter:hue-rotate(${tint}deg) blur(${(1 - reveal) * 2}px)`)}
    </div>
    {#if reveal > 0 && reveal < 1}
      <div class="absolute inset-x-0 h-[3px] bg-coral shadow-[0_0_18px_6px_rgba(255,107,74,.55)]" style="top:{reveal * 100}%"></div>
    {/if}
  {/if}
</div>
