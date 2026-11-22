<script lang="ts">
  // Soft RTS-style fog drawn on a low-res canvas and stretched over the board.
  // Each cell's darkness eases toward its target, with a ripple from the last reveal.
  import { onMount } from 'svelte';
  import { T, C0, C1, R0, R1 } from '../lib/art';
  import { key } from '../lib/world.svelte';
  import { fog } from '../lib/fog.svelte';

  const M = 6; // margin cells around the world (keep in sync with FOG_M)
  const cx0 = C0 - M, cy0 = R0 - M;
  const N = C1 - C0 + 1 + M * 2, K = R1 - R0 + 1 + M * 2;
  const P = 16; // canvas px per cell
  const ALPHA = [0, 0.5, 0.94];

  let cv: HTMLCanvasElement;
  const cur = new Float32Array(N * K).fill(ALPHA[2]);
  const target = new Float32Array(N * K).fill(ALPHA[2]);
  const startAt = new Float64Array(N * K);
  let lo: HTMLCanvasElement, loCtx: CanvasRenderingContext2D, ctx: CanvasRenderingContext2D, mist: HTMLCanvasElement;
  let raf = 0, lastSnap = -1;

  function makeMist() {
    const c = document.createElement('canvas');
    c.width = N * P; c.height = K * P;
    const g = c.getContext('2d')!;
    // a few layers of big soft blobs = cheap clouds
    let s = 11;
    const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const x = R() * c.width, y = R() * c.height, rad = P * (0.6 + R() * 2.6);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const light = R() > 0.5;
      gr.addColorStop(0, light ? 'rgba(70,62,104,.22)' : 'rgba(8,6,14,.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    return c;
  }

  function draw() {
    const img = loCtx.createImageData(N, K);
    for (let i = 0; i < N * K; i++) { img.data[i * 4] = 15; img.data[i * 4 + 1] = 13; img.data[i * 4 + 2] = 23; img.data[i * 4 + 3] = Math.round(cur[i] * 255); }
    loCtx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // lo pixel centres sit at cell centres: offset by half a cell
    ctx.drawImage(lo, 0, 0, N, K, 0, 0, N * P, K * P);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(mist, 0, 0);
  }

  function tick() {
    const now = performance.now();
    let moving = false;
    for (let i = 0; i < N * K; i++) {
      const d = target[i] - cur[i];
      if (Math.abs(d) < 0.004) { cur[i] = target[i]; continue; }
      moving = true;
      if (now < startAt[i]) continue;
      cur[i] += d * (d < 0 ? 0.07 : 0.12);
    }
    draw();
    raf = moving ? requestAnimationFrame(tick) : 0;
  }

  $effect(() => {
    const m = fog.visMap;
    const o = fog.origin;
    const snap = fog.snap;
    const now = performance.now();
    for (let y = 0; y < K; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const v = m.get(key(cx0 + x, cy0 + y)) ?? 2;
      const t = ALPHA[v];
      if (t !== target[i]) {
        target[i] = t;
        startAt[i] = o ? now + Math.hypot(cx0 + x - o.c, cy0 + y - o.r) * 130 : now;
      }
    }
    if (!ctx) return;
    if (snap !== lastSnap) { lastSnap = snap; cur.set(target); draw(); return; }
    if (!raf) raf = requestAnimationFrame(tick);
  });

  onMount(() => {
    lo = document.createElement('canvas'); lo.width = N; lo.height = K;
    loCtx = lo.getContext('2d')!;
    ctx = cv.getContext('2d')!;
    mist = makeMist();
    lastSnap = fog.snap; cur.set(target); draw();
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={cv} width={N * P} height={K * P} class="absolute pointer-events-none"
  style="left:{cx0 * T}px;top:{cy0 * T}px;width:{N * T}px;height:{K * T}px"></canvas>
