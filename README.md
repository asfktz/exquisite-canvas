# Exquisite Canvas — clickable mockup

A UX/layout mockup for a shared infinite-grid canvas in the spirit of the Surrealist "Exquisite Corpse" game, with AI.
No backend, no real model: the artwork is one procedurally painted image sliced into tiles, and "generation" is a timed reveal.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (?v=1 | ?v=2 | ?v=3)
SINGLE=1 npm run build   # one self-contained dist/index.html
```

## Flow
1. Land (splash or fogged map) and get auto-assigned a free edge tile, locked to you for 5 minutes.
2. See only ~15% of each neighbouring tile. Type a prompt.
3. Fake model "draws" the tile (sketch, then colour). Try again for another version, or edit.
4. Submit: the fog lifts and the camera zooms out over the whole artwork; share link for your tile.
5. Explore with drag / pinch / wheel; tap tiles for prompt + author; draw another.

Concurrency is simulated: only 6 empty tiles are open at a time, other "artists" hold locks and finish tiles in the background, and idling releases your tile (45s warning, 65s release; the ⋯ menu can simulate it).

## Layout variants (⋯ menu or `?v=`)
- **1 Immersive**: splash, then straight into the tile; chat-style prompt bar.
- **2 Guided**: tile on top, step sheet listing what the neighbours drew.
- **3 Map first**: fogged map, tap your tile; neighbours' prompts labelled on each edge.

## Stack
Vite + Svelte 5 + TypeScript, Tailwind 4, Svelte `Tween` / transitions, `@use-gesture/vanilla` via a Svelte action (`src/lib/gestures.ts`). The grid is a CSS-transformed div.

## Inviting edge (default view)
The whole map is visible; open edges invite you to continue. Four takes, switchable at the bottom (or `?v=`):
- **Whisper** (`?v=whisper`): ideas drawn from the neighbours drift over each open edge. Tap one to see a sketch in place, paint it (1 credit), stitch it in.
- **Dream** (`?v=dream`): empty spots slowly cycle through ghost "dreams" of what could go there. Tap to catch one.
- **Pull** (`?v=pull`): grab the glowing seam handle and drag the painting outward; let go past halfway.
- **Bloom** (`?v=bloom`): tap an edge and four painted takes bloom in a 2x2 right on the map; pick one and it gets stitched in.
Credits are mocked (tap the ✦ pill to top up). Other people keep adding in the background. The previous mockup is at `?legacy`.
Code: `src/edge/`.
