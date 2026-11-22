<script lang="ts">
  // The "generated" part of a tile: a central object the fake model adds.
  // Kept to the middle of the tile so the edges still join the neighbours.
  let { obj = 0 }: { obj?: number } = $props();
</script>

<svg viewBox="0 0 256 256" class="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
  {#if obj === 0}
    <!-- fish balloon -->
    <g transform="translate(128 120)">
      <path d="M-60 0 C-30 -46 40 -46 58 0 C40 46 -30 46 -60 0 Z" fill="#ff8a5b" stroke="#2a1d3a" stroke-width="4" />
      <path d="M58 0 L92 -26 L86 0 L92 26 Z" fill="#ffd166" stroke="#2a1d3a" stroke-width="4" />
      <circle cx="-30" cy="-8" r="9" fill="#fffaf0" stroke="#2a1d3a" stroke-width="3" /><circle cx="-28" cy="-8" r="4" fill="#120c1d" />
      <path d="M-6 -30 Q4 0 -6 30 M14 -28 Q24 0 14 28" stroke="#c84b3a" stroke-width="4" fill="none" />
      <path d="M0 40 Q-10 70 6 100" stroke="#2a1d3a" stroke-width="2" fill="none" />
    </g>
  {:else if obj === 1}
    <!-- sleeping crescent -->
    <g transform="translate(128 124)">
      <path d="M20 -62 A64 64 0 1 0 20 62 A50 50 0 1 1 20 -62 Z" fill="#fff1c9" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-30 -6 q8 6 16 0" stroke="#2a1d3a" stroke-width="3" fill="none" />
      <path d="M-24 22 q8 4 14 -2" stroke="#c84b3a" stroke-width="3" fill="none" />
      <text x="34" y="-40" font-family="Fraunces, serif" font-size="22" fill="#fff6e0">z</text>
      <text x="50" y="-60" font-family="Fraunces, serif" font-size="16" fill="#fff6e0">z</text>
    </g>
  {:else if obj === 2}
    <!-- hot air balloon -->
    <g transform="translate(128 112)">
      <path d="M0 -70 C46 -70 58 -20 30 18 L12 40 L-12 40 L-30 18 C-58 -20 -46 -70 0 -70 Z" fill="#c3a6ff" stroke="#2a1d3a" stroke-width="4" />
      <path d="M0 -70 C18 -50 18 10 6 40 M0 -70 C-18 -50 -18 10 -6 40" stroke="#ff6b4a" stroke-width="6" fill="none" />
      <path d="M-12 40 L-10 58 M12 40 L10 58" stroke="#2a1d3a" stroke-width="2" />
      <rect x="-13" y="58" width="26" height="18" rx="3" fill="#8a5a3c" stroke="#2a1d3a" stroke-width="3" />
    </g>
  {:else if obj === 4}
    <!-- glass lighthouse -->
    <g transform="translate(128 128)">
      <path d="M-70 -70 L-8 -52 L-8 -40 L-70 -26 Z M70 -70 L8 -52 L8 -40 L70 -26 Z" fill="#fff3c4" opacity=".28" />
      <path d="M-20 78 L-12 -40 L12 -40 L20 78 Z" fill="#f4e9d8" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-17 30 L17 30 L18.5 50 L-18.5 50 Z M-14 -6 L14 -6 L15 12 L-15 12 Z" fill="#ff6b4a" />
      <rect x="-16" y="-62" width="32" height="22" rx="3" fill="#ffd166" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-20 -62 L0 -80 L20 -62 Z" fill="#c3a6ff" stroke="#2a1d3a" stroke-width="4" />
      <circle cx="0" cy="-51" r="26" fill="#ffd166" opacity=".22" />
      <path d="M-34 80 Q0 66 34 80" stroke="#2a1d3a" stroke-width="4" fill="none" />
    </g>
  {:else if obj === 5}
    <!-- whale swimming through the air -->
    <g transform="translate(128 126)">
      <path d="M-78 4 C-70 -40 20 -48 58 -10 C70 0 74 10 70 18 C40 40 -60 44 -78 4 Z" fill="#4aa3df" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-72 18 C-40 36 30 36 66 18 C40 30 -40 32 -72 18 Z" fill="#dff3ff" />
      <path d="M58 -10 L92 -40 L84 -6 L96 14 L66 6" fill="#4aa3df" stroke="#2a1d3a" stroke-width="4" stroke-linejoin="round" />
      <circle cx="-48" cy="-4" r="5" fill="#120c1d" />
      <path d="M-30 -42 Q-36 -64 -24 -70 M-30 -42 Q-22 -62 -10 -62" stroke="#dff3ff" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M-10 20 Q0 34 14 22" stroke="#2a1d3a" stroke-width="3" fill="none" />
    </g>
  {:else if obj === 6}
    <!-- lantern tree -->
    <g transform="translate(128 132)">
      <path d="M0 80 L0 -10 M0 20 L-30 -20 M0 6 L28 -28 M0 -10 L-6 -50" stroke="#3a2433" stroke-width="7" stroke-linecap="round" fill="none" />
      {#each [[-30, -20, '#ffd166'], [28, -28, '#ff8fa3'], [-6, -50, '#ffd166'], [14, -4, '#7fe0c0'], [-18, 4, '#ff6b4a']] as [x, y, c]}
        <circle cx={x} cy={y} r="22" fill={c as string} opacity=".2" />
        <line x1={x} y1={(y as number) - 10} x2={x} y2={(y as number) - 2} stroke="#2a1d3a" stroke-width="2" />
        <rect x={(x as number) - 7} y={(y as number) - 2} width="14" height="18" rx="5" fill={c as string} stroke="#2a1d3a" stroke-width="3" />
      {/each}
    </g>
  {:else if obj === 7}
    <!-- giant snail carrying a garden -->
    <g transform="translate(128 140)">
      <path d="M-80 46 C-80 30 -60 26 -40 30 L60 30 C76 30 84 46 70 50 L-70 52 Z" fill="#e0a948" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-70 36 L-80 4 M-62 34 L-64 0" stroke="#2a1d3a" stroke-width="4" stroke-linecap="round" />
      <circle cx="-80" cy="2" r="5" fill="#2a1d3a" /><circle cx="-64" cy="-2" r="5" fill="#2a1d3a" />
      <circle cx="10" cy="-2" r="46" fill="#c3a6ff" stroke="#2a1d3a" stroke-width="4" />
      <path d="M10 -2 m0 0 a10 10 0 1 1 10 10 a20 20 0 1 1 -22 -20 a32 32 0 1 1 34 32" stroke="#2a1d3a" stroke-width="3" fill="none" />
      <path d="M-10 -46 L-10 -70 M10 -48 L10 -82 M28 -44 L30 -66" stroke="#3f8f5f" stroke-width="4" />
      <circle cx="-10" cy="-74" r="8" fill="#ff8fa3" /><circle cx="10" cy="-86" r="9" fill="#ffd166" /><circle cx="30" cy="-70" r="7" fill="#7fe0c0" />
    </g>
  {:else}
    <!-- house on stilts with a lit window -->
    <g transform="translate(128 120)">
      <path d="M-28 30 L-34 84 M28 30 L34 84 M0 30 L0 86" stroke="#2a1d3a" stroke-width="5" />
      <rect x="-40" y="-20" width="80" height="54" fill="#f4e9d8" stroke="#2a1d3a" stroke-width="4" />
      <path d="M-50 -18 L0 -64 L50 -18 Z" fill="#ff6b4a" stroke="#2a1d3a" stroke-width="4" />
      <rect x="-14" y="-6" width="28" height="24" fill="#ffd166" stroke="#2a1d3a" stroke-width="3" />
      <circle cx="0" cy="6" r="40" fill="#ffd166" opacity=".18" />
    </g>
  {/if}
</svg>
