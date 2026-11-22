// Keyhole variant: the map is covered, and a small lens follows your finger while it's down.
// Light (peek time) is limited so you can't sweep the whole map; mock credits buy more.

export const FREE_LIGHT_MS = 12_000;
export const BUY_LIGHT_MS = 8_000;
export const LENS_R = 64;
export const WIDE_LENS_R = 96;
export const MAG = 1.6;

class Keyhole {
  light = $state(FREE_LIGHT_MS);   // ms of peek time left
  maxLight = $state(FREE_LIGHT_MS);
  credits = $state(3);
  wide = $state(false);
  peeked = $state<Record<string, true>>({}); // open spots you've looked at
  shop = $state(false);
  hintSeen = $state(false);

  get radius() { return this.wide ? WIDE_LENS_R : LENS_R; }

  reset() {
    this.light = FREE_LIGHT_MS; this.maxLight = FREE_LIGHT_MS;
    this.credits = 3; this.wide = false; this.peeked = {}; this.shop = false;
  }

  /** a new round after you drew a tile: your light refills, the rest stays */
  refill() { this.light = FREE_LIGHT_MS; this.maxLight = FREE_LIGHT_MS; this.peeked = {}; }

  buyLight() {
    if (this.credits < 1) return false;
    this.credits -= 1; this.light += BUY_LIGHT_MS; this.maxLight = Math.max(this.maxLight, this.light);
    return true;
  }

  buyWide() {
    if (this.credits < 1 || this.wide) return false;
    this.credits -= 1; this.wide = true;
    return true;
  }
}

export const keyhole = new Keyhole();
