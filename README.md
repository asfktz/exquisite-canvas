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

## Variant B: sharpness tiers (this branch)
Nothing is hidden, but you only see it at different levels of sharpness, measured in square rings around your tiles:
- **Sharp**: all 8 neighbours of your tile at first (instead of 15% edges).
- **Soft** (next ring): low-res, you can tell what's there but not the details.
- **Shapes** (ring after): darker blobs.
- **Colours** (everything else): 2×2 pixel colour blocks. Before you have a tile, the whole map looks like this.

Each tile you submit brings one more ring into focus (with a ripple). Mock credits: start with 4, 1✦ per drawing attempt (including "Again"), 3✦ to sharpen a ring without drawing, plus a fake credit shop. Tapping an out-of-focus tile in explore offers "Sharpen" or "Draw a tile". While composing you can drag/pinch to look around. The ⋯ menu adds "Out of credits" and "+1 ring" simulations.

## Layout variants (⋯ menu or `?v=`)
- **1 Immersive**: splash, then straight into the tile; chat-style prompt bar.
- **2 Guided**: tile on top, step sheet listing what the neighbours drew.
- **3 Map first**: fogged map, tap your tile; neighbours' prompts labelled on each edge.

## Stack
Vite + Svelte 5 + TypeScript, Tailwind 4, Svelte `Tween` / transitions, `@use-gesture/vanilla` via a Svelte action (`src/lib/gestures.ts`). The grid is a CSS-transformed div.
