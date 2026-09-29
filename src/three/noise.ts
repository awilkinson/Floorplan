// Small deterministic noise helpers for procedural textures.

export function makeRng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable 2D value noise on a period-sized lattice. */
export function makeValueNoise(seed: number, period: number) {
  const r = makeRng(seed);
  const n = period;
  const grid = new Float32Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % n) + n) % n;
    const y0 = ((yi % n) + n) % n;
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const a = grid[y0 * n + x0];
    const b = grid[y0 * n + x1];
    const c = grid[y1 * n + x0];
    const d = grid[y1 * n + x1];
    const u = fade(xf);
    const v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal noise, tileable when `period` divides the sampled range. */
export function makeFbm(seed: number, period: number, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => makeValueNoise(seed + i * 101, period * 2 ** i));
  return (x: number, y: number) => {
    let s = 0;
    let amp = 0.5;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const f = 2 ** i;
      s += layers[i](x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
}
