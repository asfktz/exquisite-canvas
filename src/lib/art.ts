// Procedurally paints one big continuous "surreal landscape" and slices it into tiles.
// Because every tile is a window into the same painting, neighbouring tiles always join up.

export const T = 256; // world units per tile (== master px per tile)
export const C0 = -6, C1 = 5; // column range (inclusive) — 3 zones of 4
export const R0 = -4, R1 = 3; // row range (inclusive) — 2 zones of 4
export const COLS = C1 - C0 + 1;
export const ROWS = R1 - R0 + 1;
export const W = COLS * T;
export const H = ROWS * T;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ridge = (x: number) => number;
function ridge(y0: number, parts: [number, number, number][]): Ridge {
  return (x) => y0 + parts.reduce((s, [a, f, p]) => s + a * Math.sin(x * f + p), 0);
}

export async function paintMaster(): Promise<{ full: string; fog: string }> {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const R = rng(7);
  const hz = H * 0.42;

  // sky
  const sky = g.createLinearGradient(0, 0, 0, hz + 40);
  sky.addColorStop(0, '#140f33');
  sky.addColorStop(0.35, '#33266a');
  sky.addColorStop(0.7, '#a24f86');
  sky.addColorStop(0.9, '#f08a6c');
  sky.addColorStop(1, '#ffc58a');
  g.fillStyle = sky; g.fillRect(0, 0, W, hz + 60);

  // stars
  for (let i = 0; i < 700; i++) {
    const x = R() * W, y = Math.pow(R(), 1.6) * hz * 0.8;
    g.globalAlpha = 0.25 + R() * 0.7 * (1 - y / hz);
    g.fillStyle = R() > 0.85 ? '#ffd6a0' : '#ffffff';
    const s = R() * 2.2 + 0.6;
    g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;

  // big moon + small second sun
  const moon = (x: number, y: number, r: number, c1: string, c2: string) => {
    const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * 3);
    halo.addColorStop(0, 'rgba(255,220,170,.35)'); halo.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 3, 0, 7); g.fill();
    const m = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    m.addColorStop(0, c1); m.addColorStop(1, c2);
    g.fillStyle = m; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  };
  moon(W * 0.66, H * 0.15, 150, '#fff6e0', '#f2c08a');
  g.fillStyle = 'rgba(200,150,110,.35)';
  [[30, -40, 26], [-50, 20, 18], [40, 50, 14], [-10, -70, 10]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(W * 0.66 + dx, H * 0.15 + dy, r, 0, 7); g.fill(); });
  moon(W * 0.22, H * 0.27, 58, '#ffd27a', '#ff7a4a');

  // clouds (soft radial blobs)
  for (let i = 0; i < 18; i++) {
    const cx = R() * W, cy = H * 0.08 + R() * hz * 0.75, w = 160 + R() * 320;
    for (let j = 0; j < 7; j++) {
      const bx = cx + (R() - 0.5) * w, by = cy + (R() - 0.5) * w * 0.18, br = 40 + R() * 70;
      const cg = g.createRadialGradient(bx, by, 0, bx, by, br);
      cg.addColorStop(0, `rgba(255,${200 + R() * 40 | 0},${210 + R() * 30 | 0},.42)`);
      cg.addColorStop(1, 'rgba(255,220,230,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
    }
  }

  // floating island with a tree, hanging roots
  const island = (x: number, y: number, s: number) => {
    g.fillStyle = '#5a3d6e';
    g.beginPath(); g.moveTo(x - 90 * s, y); g.quadraticCurveTo(x, y + 160 * s, x + 90 * s, y); g.closePath(); g.fill();
    g.fillStyle = '#6fbf8c'; g.beginPath(); g.ellipse(x, y, 92 * s, 16 * s, 0, 0, 7); g.fill();
    g.strokeStyle = '#3b2a4a'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x + 10 * s, y); g.lineTo(x + 6 * s, y - 70 * s); g.stroke();
    g.fillStyle = '#ff8fa3'; g.beginPath(); g.arc(x + 6 * s, y - 90 * s, 38 * s, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,61,110,.8)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x - 30 * s + k * 12 * s, y + 70 * s); g.bezierCurveTo(x - 40 * s + k * 14 * s, y + 140 * s, x - 10 * s + k * 9 * s, y + 160 * s, x - 20 * s + k * 12 * s, y + 220 * s); g.stroke(); }
  };
  island(W * 0.36, H * 0.2, 1.1);
  island(W * 0.84, H * 0.32, 0.7);

  // mountains
  const layer = (rf: Ridge, fill: string | CanvasGradient) => {
    g.fillStyle = fill; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, rf(x));
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  const m1 = ridge(hz - 40, [[110, 0.0021, 1], [55, 0.0067, 2], [18, 0.021, 0.3]]);
  layer(m1, '#7a5aa8');
  // snow caps
  g.fillStyle = 'rgba(255,240,245,.75)';
  g.beginPath();
  for (let x = 0; x <= W; x += 8) { const y = m1(x); x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  for (let x = W; x >= 0; x -= 8) g.lineTo(x, Math.max(m1(x), hz - 70) + 6);
  g.closePath(); g.fill();
  const m2 = ridge(hz + 10, [[70, 0.0033, 4], [30, 0.011, 1], [10, 0.03, 2]]);
  layer(m2, '#4b3b8f');

  // sea
  const sea = g.createLinearGradient(0, hz + 40, 0, H * 0.62);
  sea.addColorStop(0, '#f2a06d'); sea.addColorStop(0.4, '#9a5a8e'); sea.addColorStop(1, '#3c3274');
  g.fillStyle = sea; g.fillRect(0, hz + 40, W, H * 0.62 - hz - 20);
  g.fillStyle = 'rgba(255,240,210,.55)';
  for (let i = 0; i < 60; i++) {
    const y = hz + 50 + i * 6 + R() * 4, w = (60 - i) * 4 + R() * 40;
    g.fillRect(W * 0.66 - w / 2 + (R() - 0.5) * 30, y, w, 2);
  }
  // little boats
  for (let i = 0; i < 5; i++) {
    const bx = R() * W, by = hz + 80 + R() * 150, s = 0.6 + R() * 0.6;
    g.fillStyle = '#2a1f45'; g.beginPath(); g.moveTo(bx - 30 * s, by); g.lineTo(bx + 30 * s, by); g.lineTo(bx + 20 * s, by + 10 * s); g.lineTo(bx - 20 * s, by + 10 * s); g.fill();
    g.fillStyle = '#fff1dc'; g.beginPath(); g.moveTo(bx, by - 2); g.lineTo(bx, by - 50 * s); g.lineTo(bx + 26 * s, by - 6); g.fill();
  }

  // hills
  const h1 = ridge(H * 0.62, [[50, 0.0028, 0.5], [22, 0.009, 3]]);
  const h2 = ridge(H * 0.71, [[45, 0.0024, 2.2], [20, 0.011, 1]]);
  const h3 = ridge(H * 0.83, [[35, 0.0031, 5], [16, 0.013, 2]]);
  layer(h1, '#2d6b67');
  layer(h2, '#3f8f5f');
  const field = g.createLinearGradient(0, H * 0.78, 0, H);
  field.addColorStop(0, '#e0a948'); field.addColorStop(1, '#b8622f');
  layer(h3, field);
  // furrows
  g.strokeStyle = 'rgba(120,50,20,.35)'; g.lineWidth = 3;
  for (let k = 1; k < 14; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 12) { const y = h3(x) + k * k * 2.2 + Math.sin(x * 0.004 + k) * 6; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }

  // winding road
  g.strokeStyle = '#f7e6c4'; g.lineWidth = 46; g.lineCap = 'round';
  g.beginPath(); g.moveTo(W * 0.42, H); g.bezierCurveTo(W * 0.2, H * 0.88, W * 0.7, H * 0.8, W * 0.5, H * 0.72); g.bezierCurveTo(W * 0.38, H * 0.67, W * 0.55, H * 0.64, W * 0.5, H * 0.62); g.stroke();
  g.strokeStyle = '#e46b4a'; g.lineWidth = 4; g.setLineDash([22, 18]); g.stroke(); g.setLineDash([]);

  // lollipop trees on hills
  const tree = (x: number, y: number, s: number, c: string) => {
    g.strokeStyle = '#3a2433'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 60 * s); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(x, y - 78 * s, 26 * s, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - 8 * s, y - 86 * s, 9 * s, 0, 7); g.fill();
  };
  const tc = ['#ff8fa3', '#ffd166', '#7fe0c0', '#c3a6ff', '#ff6b4a'];
  for (let i = 0; i < 70; i++) { const x = R() * W; tree(x, h1(x) + 20 + R() * 40, 0.5 + R() * 0.4, tc[i % 5]); }
  for (let i = 0; i < 40; i++) { const x = R() * W; tree(x, h2(x) + 30 + R() * 60, 0.8 + R() * 0.5, tc[(i + 2) % 5]); }

  // floating eyes
  const eye = (x: number, y: number, s: number, iris: string) => {
    g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(x, y, 46 * s, 26 * s, 0, 0, 7); g.fill();
    g.fillStyle = iris; g.beginPath(); g.arc(x + 4 * s, y, 17 * s, 0, 7); g.fill();
    g.fillStyle = '#120c1d'; g.beginPath(); g.arc(x + 5 * s, y, 8 * s, 0, 7); g.fill();
    g.strokeStyle = '#2a1d3a'; g.lineWidth = 3 * s; g.beginPath(); g.ellipse(x, y, 46 * s, 26 * s, 0, 0, 7); g.stroke();
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 14 * s, y - 24 * s); g.lineTo(x + k * 18 * s, y - 40 * s); g.stroke(); }
  };
  [[0.12, 0.12, 1.2, '#4aa3df'], [0.5, 0.33, 0.8, '#7fe0c0'], [0.93, 0.1, 1, '#c3a6ff'], [0.27, 0.5, 0.7, '#ffd166']].forEach(([x, y, s, c]) => eye(W * (x as number), H * (y as number), s as number, c as string));

  // a ladder into the sky
  const lx = W * 0.58, ly0 = H * 0.92, ly1 = H * 0.18;
  g.strokeStyle = '#2b1c2e'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(lx, ly0); g.lineTo(lx + 40, ly1); g.moveTo(lx + 60, ly0); g.lineTo(lx + 80, ly1); g.stroke();
  g.lineWidth = 5;
  for (let y = ly0 - 30; y > ly1; y -= 44) { const t = (ly0 - y) / (ly0 - ly1); g.beginPath(); g.moveTo(lx + 40 * t, y); g.lineTo(lx + 60 + 20 * t, y); g.stroke(); }

  // melting clock draped on a hill
  const mx = W * 0.12, my = h2(W * 0.12) + 70;
  g.fillStyle = '#ffd98a'; g.beginPath(); g.moveTo(mx - 70, my); g.quadraticCurveTo(mx, my - 80, mx + 70, my); g.quadraticCurveTo(mx + 40, my + 50, mx + 10, my + 120); g.quadraticCurveTo(mx - 10, my + 40, mx - 70, my); g.fill();
  g.strokeStyle = '#4b2e2e'; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.moveTo(mx, my - 20); g.lineTo(mx + 26, my - 32); g.moveTo(mx, my - 20); g.lineTo(mx + 6, my + 14); g.stroke();

  // a giant door standing in the field
  const dx = W * 0.8, dy = h3(W * 0.8) + 120;
  g.fillStyle = '#2a1f45'; g.fillRect(dx - 60, dy - 220, 120, 220);
  const dl = g.createLinearGradient(dx, dy - 210, dx, dy);
  dl.addColorStop(0, '#fff3c4'); dl.addColorStop(1, '#ffb36b');
  g.fillStyle = dl; g.fillRect(dx - 48, dy - 208, 96, 208);
  g.fillStyle = 'rgba(255,220,150,.25)'; g.beginPath(); g.moveTo(dx - 48, dy); g.lineTo(dx + 48, dy); g.lineTo(dx + 160, dy + 140); g.lineTo(dx - 160, dy + 140); g.fill();

  // grain
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);

  const full = await toUrl(cv, 0.86);
  const small = document.createElement('canvas');
  small.width = COLS * 10; small.height = ROWS * 10;
  small.getContext('2d')!.drawImage(cv, 0, 0, small.width, small.height);
  const fog = await toUrl(small, 0.8);
  return { full, fog };
}

function toUrl(cv: HTMLCanvasElement, q: number): Promise<string> {
  return new Promise((res) => cv.toBlob((b) => res(URL.createObjectURL(b!)), 'image/jpeg', q));
}
