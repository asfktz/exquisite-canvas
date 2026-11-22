// Fake "model": four continuations for an empty cell.
// Every attempt keeps the master painting at the seams (so it always joins its neighbours)
// and varies only the middle: a different object plus a different light.

export interface Attempt { obj: number; fx: number; caption: string }

export const OBJ_CAPTIONS = [
  'a fish balloon drifting up',
  'the moon asleep on the hill',
  'a balloon leaving the field',
  'a house on stilts, one window lit',
  'a lighthouse made of glass',
  'a whale swimming through the air',
  'a tree that grows lanterns',
  'a snail carrying a garden',
];
export const FX_CAPTIONS = ['', 'at dusk', 'in blue hour', 'under falling stars'];
// interior-only light treatments; edges are never touched
export const FX_FILTER = ['none', 'sepia(.35) saturate(1.5) hue-rotate(-18deg) brightness(1.05)', 'hue-rotate(38deg) saturate(1.25) brightness(.9)', 'brightness(.62) saturate(1.3) hue-rotate(12deg)'];

function hash(a: number, b: number, c: number) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function attemptsFor(c: number, r: number, round = 0): Attempt[] {
  const objs = [0, 1, 2, 3, 4, 5, 6, 7];
  // seeded shuffle
  for (let i = objs.length - 1; i > 0; i--) {
    const j = hash(c, r, round * 31 + i) % (i + 1);
    [objs[i], objs[j]] = [objs[j], objs[i]];
  }
  const f0 = hash(r, c, round + 7) % 4;
  return objs.slice(0, 4).map((obj, i) => {
    const fx = (f0 + i) % 4;
    return { obj, fx, caption: `${OBJ_CAPTIONS[obj]}${FX_CAPTIONS[fx] ? ' ' + FX_CAPTIONS[fx] : ''}` };
  });
}
