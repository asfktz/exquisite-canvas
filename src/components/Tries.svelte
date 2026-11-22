<script lang="ts">
  import { app } from '../lib/app.svelte';
  import TileThumb from './TileThumb.svelte';
  const m = $derived(app.mine);
</script>
{#if m && app.tries.length > 1}
  <div class="mb-2 flex items-center justify-center gap-2">
    <span class="text-[12px] text-paper/45 mr-1">Versions</span>
    {#each app.tries as o, i (i)}
      <button class="rounded-[12px] p-0.5 border-2 {o === app.obj ? 'border-coral' : 'border-transparent opacity-70'}" onclick={() => app.chooseTry(o)} aria-label="Version {i + 1}">
        <TileThumb c={m.c} r={m.r} obj={o} size={46} radius={9} />
      </button>
    {/each}
  </div>
{/if}
