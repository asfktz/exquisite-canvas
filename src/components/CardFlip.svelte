<script lang="ts">
  // The picked card grows from its place in the hand into the drawing window, then dissolves
  // into the real board underneath (which is already framed exactly there).
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import { app } from '../lib/app.svelte';
  import { world } from '../lib/world.svelte';
  import HandArt from './HandArt.svelte';

  const f = app.flip!;
  const t = world.tiles[f.key];
  const tw = new Tween({ x: f.from.x, y: f.from.y, s: f.from.w / f.to.w, rot: -4 }, { duration: 720, easing: cubicInOut });
  let gone = $state(false);

  onMount(() => {
    tw.set({ x: f.to.x, y: f.to.y, s: 1, rot: 0 }).then(() => {
      gone = true;
      setTimeout(() => { if (app.flip === f) app.flip = null; }, 400);
    });
  });
</script>

{#if t}
  <div class="absolute left-0 top-0 z-30 origin-top-left pointer-events-none transition-opacity duration-[400ms]" style="transform:translate({tw.current.x}px,{tw.current.y}px) scale({tw.current.s}) rotate({tw.current.rot}deg);opacity:{gone ? 0 : 1}">
    <div class="shadow-[0_30px_80px_rgba(0,0,0,.6)]" style="border-radius:16px"><HandArt c={t.c} r={t.r} size={f.to.w} /></div>
  </div>
{/if}
