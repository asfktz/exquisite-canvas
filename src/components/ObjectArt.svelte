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
