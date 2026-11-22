// Ideas that "whisper" from an open edge. They come from what the neighbours drew:
// the band of the painting the empty spot sits in, and any prompt a neighbour wrote.

export type Side = 'l' | 'r' | 't' | 'b';
export interface Jit { f: boolean; dx: number; dy: number; s: number }
export interface Idea { text: string; obj: number; tint: number; jit?: Jit }

// obj: -1 = just continue the painting, 0 fish balloon, 1 sleepy moon, 2 balloon, 3 stilt house
type Band = { noun: string; ideas: [string, number][] };
const SKY: Band = { noun: 'the stars', ideas: [['a moon that wants company', 1], ['a whale swimming through stars', 0], ['a balloon snagged on a star', 2], ['an observatory on a cloud', 3]] };
const CLOUD: Band = { noun: 'the clouds', ideas: [['another island drifting by', 2], ['a fish balloon on a string', 0], ['a moon napping in the clouds', 1], ['a house hanging from roots', 3]] };
const PEAK: Band = { noun: 'the mountains', ideas: [['a cabin on the ridge', 3], ['a balloon over the peaks', 2], ['the moon resting on a summit', 1], ['a fish climbing the snow', 0]] };
const SEA: Band = { noun: 'the sea', ideas: [['a lighthouse?', 3], ['a whale surfacing', 0], ["the moon's reflection, awake", 1], ['a balloon skimming the waves', 2]] };
const HILL: Band = { noun: 'the hills', ideas: [['a hut in the lollipop trees', 3], ['a balloon tied to a tree', 2], ['a hill that fell asleep', 1], ['a fish lost in the grass', 0]] };
const FIELD: Band = { noun: 'the road', ideas: [['the road ends at a house', 3], ['a kite-fish over the wheat', 0], ['a moon rolling down the road', 1], ['a balloon taking off', 2]] };

function band(r: number): Band {
  if (r <= -3) return SKY;
  if (r === -2) return CLOUD;
  if (r === -1) return PEAK;
  if (r <= 1) return SEA;
  if (r === 2) return HILL;
  return FIELD;
}

export const ARROW: Record<Side, string> = { l: '→', r: '←', t: '↓', b: '↑' };
const TINTS = [0, -14, 12, 22, -24];

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** ideas for an empty spot, given which sides have a filled neighbour and their prompts */
export function ideasFor(c: number, r: number, sides: Side[], neighbourPrompt?: { side: Side; prompt: string; name: string }): Idea[] {
  const b = band(r);
  const side = sides[0] ?? 'l';
  const h = hash(`${c},${r}`);
  const out: Idea[] = [{ text: `${ARROW[side]} ${b.noun} keep going`.replace('the road keep', 'the road keeps').replace('the sea keep', 'the sea keeps'), obj: -1, tint: 0 }];
  if (neighbourPrompt) {
    const short = neighbourPrompt.prompt.split(' ').slice(0, 4).join(' ');
    out.push({ text: `more of ${neighbourPrompt.name === 'You' ? 'your' : neighbourPrompt.name + "'s"} “${short}${neighbourPrompt.prompt.split(' ').length > 4 ? '…' : ''}”`, obj: -1, tint: 8 });
  }
  const rot = h % b.ideas.length;
  for (let i = 0; i < b.ideas.length; i++) {
    const [text, obj] = b.ideas[(i + rot) % b.ideas.length];
    out.push({ text, obj, tint: TINTS[(i + h) % TINTS.length] });
  }
  return out;
}

const WORDS: [RegExp, number][] = [[/fish|sea|water|swim|whale|wave/i, 0], [/moon|night|sleep|dream|nap/i, 1], [/balloon|fly|sky|bird|air|kite/i, 2], [/house|home|window|light|lamp|hut|cabin|tower/i, 3]];
export function customIdea(text: string): Idea {
  for (const [re, o] of WORDS) if (re.test(text)) return { text, obj: o, tint: 0 };
  return { text, obj: hash(text) % 4, tint: (hash(text) % 30) - 15 };
}

export function jitter(i: Idea, seed = Math.random()): Idea {
  const R = (k: number) => ((Math.sin(seed * 9301 + k * 49297) + 1) / 2);
  return { ...i, tint: i.tint + Math.round((R(1) - 0.5) * 36), jit: { f: R(2) > 0.5, dx: (R(3) - 0.5) * 50, dy: (R(4) - 0.5) * 36, s: 0.78 + R(5) * 0.4 } };
}
