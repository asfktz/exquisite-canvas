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

## Behaviour wireframe (`wireframe.html`)

A gray, animation-free wireframe that tests only the rules and the flow, in Hebrew (RTL).

```bash
npm run dev                              # http://localhost:5173/wireframe.html
SINGLE=1 ENTRY=wireframe npm run build   # one self-contained dist/wireframe.html
```

Rules: a cell is filled, empty, or claimed. You can draw in any empty cell touching at least one filled cell, including holes in the middle (blue, labelled with how many sides they touch; a thick bar marks each touching side).

Flow: enter, find (pan / pinch / wheel, or "find me a spot"), claim (3 min lock, 650ms fake round trip so others can win), prompt, attempt / retry (1 mock credit each), confirm, newly opened cells are marked. After confirming: share a "continue from me" link (reserves the adjacent cell for the friend for 10 min, then a simulated friend fills it and you're notified), draw another adjacent, or back to the map.

Edge cases: lost race on claim, out of credits mid-flow (keep the cell, top up, confirm as is, or release), leaving without confirming (confirm and leave, keep it for 1 min, or release), lock running out (warning at 30s, one +2 min extension).

The ⚙ panel switches entry (organic vs. from a friend's link), where organic entry starts (whole map, recent activity, straight to a free cell), credits, time speed, forced claim race, and simulated users. Code: `src/wireframe/`.
