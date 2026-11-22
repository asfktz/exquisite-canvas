import { Gesture } from '@use-gesture/vanilla';
import type { Action } from 'svelte/action';

export interface PanZoomOpts {
  enabled: () => boolean;
  get: () => { x: number; y: number; s: number };
  set: (v: { x: number; y: number; s: number }) => void;
  fling?: (v: { x: number; y: number; s: number }) => void;
  onTap?: (sx: number, sy: number) => void;
  onActivity?: () => void;
  minS?: number; maxS?: number;
  /** Listen to touch events instead of pointer events (default true). Set false so mouse taps work too. */
  touchEvents?: boolean;
}

/** Svelte action: drag to pan, pinch / wheel to zoom about the pointer, tap to select. */
export const panzoom: Action<HTMLElement, PanZoomOpts> = (node, initial) => {
  let o = initial;
  const clamp = (s: number) => Math.min(o.maxS ?? 4, Math.max(o.minS ?? 0.08, s));
  const center = () => { const r = node.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };

  const zoomAt = (base: { x: number; y: number; s: number }, sx0: number, sy0: number, sx: number, sy: number, s: number) => {
    const { cx, cy } = center();
    const wx = base.x + (sx0 - cx) / base.s, wy = base.y + (sy0 - cy) / base.s;
    return { x: wx - (sx - cx) / s, y: wy - (sy - cy) / s, s };
  };

  const g = new Gesture(node, {
    onDrag: ({ delta: [dx, dy], pinching, tap, xy, last, velocity: [vx, vy], direction: [dirx, diry], event }) => {
      o.onActivity?.();
      if (tap) { o.onTap?.(xy[0], xy[1]); return; }
      if (!o.enabled() || pinching) return;
      const c = o.get();
      const next = { x: c.x - dx / c.s, y: c.y - dy / c.s, s: c.s };
      if (last && o.fling && (vx > 0.3 || vy > 0.3) && event.type !== 'pointercancel') {
        o.set(next);
        o.fling({ x: next.x - (dirx * vx * 220) / c.s, y: next.y - (diry * vy * 220) / c.s, s: c.s });
      } else o.set(next);
    },
    onPinch: ({ origin: [ox, oy], da: [d], first, memo }) => {
      o.onActivity?.();
      if (!o.enabled()) return memo;
      if (first || !memo) memo = { base: o.get(), ox, oy, d };
      const s = clamp((memo.base.s * d) / memo.d);
      o.set(zoomAt(memo.base, memo.ox, memo.oy, ox, oy, s));
      return memo;
    },
    onWheel: ({ event, delta: [dx, dy] }) => {
      o.onActivity?.();
      if (!o.enabled()) return;
      event.preventDefault();
      const c = o.get();
      const e = event as WheelEvent;
      if (e.ctrlKey || Math.abs(dy) > 0 && Math.abs(dx) < 1 && e.deltaMode === 0 && Math.abs(dy) >= 40) {
        const s = clamp(c.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)));
        o.set(zoomAt(c, e.clientX, e.clientY, e.clientX, e.clientY, s));
      } else {
        o.set({ x: c.x + dx / c.s, y: c.y + dy / c.s, s: c.s });
      }
    },
  }, {
    drag: { filterTaps: true, pointer: { touch: initial.touchEvents ?? true } },
    pinch: { scaleBounds: { min: 0.01, max: 100 }, rubberband: false },
    wheel: { eventOptions: { passive: false } },
  });

  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', stop);
  document.addEventListener('gesturechange', stop);

  return {
    update(n) { o = n; },
    destroy() { g.destroy(); document.removeEventListener('gesturestart', stop); document.removeEventListener('gesturechange', stop); },
  };
};
