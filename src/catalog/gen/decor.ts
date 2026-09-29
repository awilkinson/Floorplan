import { box, cyl, part, rng, sph, type Part, type V3 } from '../parts';

// Curated spine colors: mostly quiet cloth and paper tones with a few saturated
// jackets, like a well-used design library.
const SPINES = [
  '#F1EEE6', '#E8E2D4', '#D9D0BD', '#1F1F1F', '#2B2B2E', '#3A3F4B', '#C8452F', '#E07A2F',
  '#D9A441', '#8C2F2A', '#2F4A6B', '#6E8A9C', '#9AA38A', '#556B4A', '#B5654A', '#EDE3C8',
  '#F4F2EC', '#111111', '#7A6F63', '#C9B79C', '#A33B3B', '#315C59', '#E6C9A8', '#4B3B35',
];

/**
 * A row of books standing on a shelf between x0 and x1 (local), sitting at y,
 * against the back at z0 (spines face +z). Returns one instanced part.
 */
export function bookRow(x0: number, x1: number, y: number, zBack: number, maxH: number, seed: number, density = 0.8): Part[] {
  const r = rng(seed);
  const inst: { p: V3; r?: V3; s?: V3; c?: string }[] = [];
  let x = x0 + 0.01;
  const end = x1 - 0.01;
  while (x < end) {
    // gaps and objects
    if (r() > density) {
      x += 0.05 + r() * 0.14;
      continue;
    }
    const group = 3 + Math.floor(r() * 12);
    const lean = r() < 0.12;
    for (let i = 0; i < group && x < end; i++) {
      const t = 0.018 + r() * 0.03;
      if (x + t > end) break;
      const hh = Math.min(maxH - 0.01, 0.17 + r() * 0.13);
      const dd = 0.13 + r() * 0.09;
      const c = SPINES[Math.floor(r() * SPINES.length)];
      inst.push({ p: [x + t / 2, y + hh / 2, zBack + dd / 2], s: [t, hh, dd], c, r: lean && i === group - 1 ? [0, 0, -0.12] : undefined });
      x += t + 0.001;
    }
    // occasionally a horizontal stack
    if (r() < 0.22 && x < end - 0.25) {
      let yy = y;
      const n = 2 + Math.floor(r() * 4);
      const bw = 0.2 + r() * 0.08;
      for (let i = 0; i < n; i++) {
        const t = 0.02 + r() * 0.025;
        inst.push({ p: [x + bw / 2 + 0.01, yy + t / 2, zBack + 0.12], s: [bw - i * 0.01, t, 0.2 + r() * 0.04], c: SPINES[Math.floor(r() * SPINES.length)] });
        yy += t;
      }
      x += bw + 0.04;
    }
    x += 0.004 + r() * 0.02;
  }
  if (!inst.length) return [];
  return [part(box(1, 1, 1, 0), '$books', [0, 0, 0], { inst, plan: false, noShadow: false })];
}

/** Sculptural objects for shelves and table tops. */
export function objects(x: number, y: number, z: number, seed: number, kind?: 'vase' | 'bowl' | 'sculpture' | 'stack' | 'frame' | 'branch'): Part[] {
  const r = rng(seed);
  const k = kind ?? (['vase', 'bowl', 'sculpture', 'vase', 'stack'] as const)[Math.floor(r() * 5)];
  const tones = ['$ceramicBlack', '$ceramicWhite', '$ceramicClay', '$ceramicWhite', '$brassDecor'];
  const mat = tones[Math.floor(r() * tones.length)];
  const out: Part[] = [];
  if (k === 'vase') {
    const hh = 0.18 + r() * 0.16;
    const rr = 0.05 + r() * 0.04;
    out.push(
      part({ t: 'lathe', pts: [[0.001, 0], [rr * 0.7, 0], [rr, hh * 0.35], [rr * 0.9, hh * 0.7], [rr * 0.35, hh * 0.92], [rr * 0.45, hh], [0.001, hh]], seg: 28 }, mat, [x, y, z], {
        plan: false,
      }),
    );
  } else if (k === 'bowl') {
    const rr = 0.1 + r() * 0.07;
    out.push(part({ t: 'lathe', pts: [[0.001, 0], [rr * 0.5, 0], [rr, rr * 0.45], [rr * 0.96, rr * 0.47], [rr * 0.45, rr * 0.06], [0.001, rr * 0.06]], seg: 32 }, mat, [x, y, z], { plan: false }));
  } else if (k === 'sculpture') {
    out.push(part(sph(0.07, 0.09, 0.05, 20), mat, [x, y + 0.09, z], { plan: false }));
    out.push(part(cyl(0.05, 0.05, 0.03, 20), '$stoneDecor', [x, y + 0.015, z], { plan: false }));
  } else if (k === 'stack') {
    let yy = y;
    for (let i = 0; i < 3; i++) {
      const t = 0.025 + r() * 0.02;
      out.push(part(box(0.24 - i * 0.02, t, 0.3 - i * 0.02, 0.002), '$books', [x, yy + t / 2, z], { color: SPINES[Math.floor(r() * SPINES.length)], plan: false }));
      yy += t;
    }
  } else if (k === 'frame') {
    out.push(part(box(0.24, 0.3, 0.02, 0.003), '$ceramicWhite', [x, y + 0.15, z], { r: [-0.12, 0, 0], plan: false }));
  } else if (k === 'branch') {
    out.push(part({ t: 'lathe', pts: [[0.001, 0], [0.06, 0], [0.08, 0.12], [0.05, 0.24], [0.03, 0.3], [0.001, 0.3]], seg: 24 }, '$ceramicBlack', [x, y, z], { plan: false }));
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const len = 0.35 + r() * 0.35;
      out.push(part(cyl(0.004, 0.006, len, 5), '$stem', [x + Math.sin(a) * 0.08, y + 0.3 + len / 2, z + Math.cos(a) * 0.08], { r: [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3], plan: false }));
    }
  }
  return out;
}

/** Styled coffee-table top: a book stack, a bowl, a small vase. */
export function tableStyling(w: number, d: number, y: number, seed: number, style: string): Part[] {
  const r = rng(seed + 7);
  const out: Part[] = [];
  if (style === 'none') return out;
  const sx = w > d ? 1 : 0.5;
  out.push(...objects(-w * 0.22 * sx, y, -d * 0.1, seed + 1, 'stack'));
  out.push(...objects(-w * 0.22 * sx, y + 0.08, -d * 0.1, seed + 2, r() > 0.5 ? 'sculpture' : 'vase'));
  if (style === 'books-bowl' || style === 'full') out.push(...objects(w * 0.2 * sx, y, d * 0.08, seed + 3, 'bowl'));
  if (style === 'full') out.push(...objects(w * 0.05, y, -d * 0.25, seed + 4, 'vase'));
  return out;
}
