import { box, cyl, part, rng, type Built, type GenCtx, type Part, type V3 } from '../parts';
import { bookRow, objects } from './decor';

/**
 * A run of built-in shelving: base cabinets with an overhanging top, open shelves
 * above to the ceiling, integrated lighting and books. Front faces +z.
 */
export function shelvingRun(ctx: GenCtx): Built {
  const { w, d, params: pr, seed } = ctx;
  const ceiling = ctx.ceiling ?? 3.2;
  const h = pr.toCeiling === false ? ctx.h : ceiling;
  const baseH = pr.baseH ?? 0.8;
  const baseD = pr.baseD ?? d;
  const upperD = pr.upperD ?? Math.min(0.34, d * 0.65);
  const bays = pr.bays ?? Math.max(1, Math.round(w / 0.95));
  const curved: 'none' | 'left' | 'right' = pr.curvedEnd ?? 'none';
  const curveLen = curved === 'none' ? 0 : pr.curveLen ?? baseD * 0.9;
  const shelfT = 0.035;
  const upperW = w - curveLen;
  const upperX = curved === 'left' ? curveLen / 2 : curved === 'right' ? -curveLen / 2 : 0;
  const parts: Part[] = [];
  const backZ = -d / 2;

  // Base cabinets
  const topT = 0.04;
  const toe = 0.06;
  const cabH = baseH - topT;
  const cabD = baseD - 0.02;
  const fronts = pr.baseStyle ?? 'flat';
  const cabZ = backZ + cabD / 2;
  const straightW = w - curveLen;
  const straightX = curved === 'left' ? curveLen / 2 : curved === 'right' ? -curveLen / 2 : 0;
  parts.push(part(box(straightW, cabH - toe, cabD, 0.003), 'fronts', [straightX, toe + (cabH - toe) / 2, cabZ], { plan: 'line' }));
  parts.push(part(box(straightW - 0.02, toe, cabD - 0.06, 0), '$toeKick', [straightX, toe / 2, cabZ - 0.03], { plan: false, noShadow: true }));
  // door reveals as thin grooves
  const nDoors = pr.doors ?? Math.max(2, Math.round(straightW / 0.5));
  const dw = straightW / nDoors;
  for (let i = 1; i < nDoors; i++)
    parts.push(part(box(0.004, cabH - toe - 0.01, 0.004, 0), '$reveal', [straightX - straightW / 2 + dw * i, toe + (cabH - toe) / 2, cabZ + cabD / 2 + 0.001], { plan: false, noShadow: true }));
  if (fronts === 'panel') {
    for (let i = 0; i < nDoors; i++) {
      const x = straightX - straightW / 2 + dw * (i + 0.5);
      parts.push(part(box(dw - 0.1, cabH - toe - 0.12, 0.012, 0.004), 'fronts', [x, toe + (cabH - toe) / 2, cabZ + cabD / 2 + 0.004], { plan: false }));
    }
  }
  // top
  parts.push(part(box(straightW + 0.004, topT, baseD, 0.004), 'top', [straightX, baseH - topT / 2, backZ + baseD / 2], { plan: 'line' }));
  if (curved !== 'none') {
    // Quarter-round end: the front face sweeps back to meet the wall.
    const sgn = curved === 'left' ? -1 : 1;
    const cx = sgn * (w / 2 - curveLen);
    const quarter = (rx: number, rz: number): [number, number][] => {
      const pts: [number, number][] = [[cx, backZ]];
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * (Math.PI / 2);
        pts.push([cx + sgn * Math.sin(a) * rx, backZ + Math.cos(a) * rz]);
      }
      return pts;
    };
    parts.push(part({ t: 'plate', pts: quarter(curveLen - 0.02, cabD), h: cabH - toe, bevel: 0.002 }, 'fronts', [0, toe, 0], { plan: 'line' }));
    parts.push(part({ t: 'plate', pts: quarter(curveLen - 0.05, cabD - 0.06), h: toe }, '$toeKick', [0, 0, 0], { plan: false, noShadow: true }));
    parts.push(part({ t: 'plate', pts: quarter(curveLen, baseD), h: topT }, 'top', [0, baseH - topT, 0], { plan: 'line' }));
  }

  // Upper shelving
  if (pr.upper !== false) {
    const upperH = h - baseH;
    const uz = backZ + upperD / 2;
    const side = 0.035;
    const bw = upperW / bays;
    const rows = pr.rows ?? Math.max(3, Math.round(upperH / 0.36));
    const rowH = (upperH - 0.06) / rows;
    parts.push(part(box(upperW, upperH, 0.012, 0), 'body', [upperX, baseH + upperH / 2, backZ + 0.006], { plan: false }));
    for (let b = 0; b <= bays; b++) {
      const x = upperX - upperW / 2 + bw * b;
      const cx = b === 0 ? x + side / 2 : b === bays ? x - side / 2 : x;
      parts.push(part(box(side, upperH, upperD, 0.002), 'body', [cx, baseH + upperH / 2, uz], { plan: b === 0 ? 'line' : false }));
    }
    parts.push(part(box(upperW, 0.06, upperD, 0.002), 'body', [upperX, h - 0.03, uz], { plan: 'line' }));
    for (let r = 1; r < rows; r++) parts.push(part(box(upperW - 0.01, shelfT, upperD - 0.005, 0.002), 'body', [upperX, baseH + rowH * r, uz + 0.002], { plan: false }));
    // contents
    const rnd = rng(seed);
    for (let b = 0; b < bays; b++) {
      const x0 = upperX - upperW / 2 + bw * b + side / 2;
      const x1 = x0 + bw - side;
      for (let r = 0; r < rows; r++) {
        const y = baseH + rowH * r + (r === 0 ? 0 : shelfT / 2);
        const k = seed + b * 31 + r * 17;
        const roll = rnd();
        if (pr.books === false) continue;
        if (r === rows - 1 && roll < 0.6) {
          parts.push(...objects((x0 + x1) / 2, y, uz, k, roll < 0.3 ? 'vase' : 'bowl'));
        } else if (roll < 0.14) {
          parts.push(...objects((x0 + x1) / 2 - 0.1, y, uz, k, 'sculpture'));
          parts.push(...bookRow(x0 + bw * 0.45, x1, y, backZ + 0.02, rowH - shelfT, k, 0.9));
        } else if (roll < 0.22) {
          parts.push(...objects((x0 + x1) / 2, y, uz, k, 'frame'));
        } else {
          parts.push(...bookRow(x0, x1, y, backZ + 0.02, rowH - shelfT, k, 0.82));
        }
      }
      if (pr.lit !== false) {
        // puck lights under the top of each bay
        parts.push(part(cyl(0.025, 0.025, 0.006, 16), '$bulb', [(x0 + x1) / 2, h - 0.064, uz + upperD * 0.2], { plan: false, noShadow: true }));
      }
    }
    // lit shelf wash: a subtle emissive strip under the first shelf
    if (pr.lit !== false) parts.push(part(box(upperW - 0.1, 0.004, 0.02, 0), '$ledStrip', [upperX, baseH + rowH - shelfT / 2 - 0.004, uz + upperD * 0.35], { plan: false, noShadow: true }));
  }

  return {
    parts,
    lights:
      pr.lit !== false && pr.upper !== false
        ? Array.from({ length: Math.min(3, bays) }, (_, i) => ({
            p: [upperX - upperW / 2 + (upperW * (i + 0.5)) / Math.min(3, bays), h - 0.4, backZ + upperD + 0.1] as V3,
            color: '#FFD9A8',
            intensity: 0.35,
            distance: 2.5,
            kind: 'picture' as const,
          }))
        : [],
  };
}

/** A fireplace breast with a linear gas firebox, flush hearth and optional art ledge. */
export function fireplace(ctx: GenCtx): Built {
  const { w, d, params: pr } = ctx;
  const ceiling = ctx.ceiling ?? 3.2;
  const h = pr.toCeiling === false ? ctx.h : ceiling;
  const fbW = pr.fireboxW ?? Math.min(1.1, w * 0.52);
  const fbH = pr.fireboxH ?? 0.62;
  const sill = pr.sill ?? 0.4;
  const parts: Part[] = [];
  const backZ = -d / 2;
  // breast with a recess for the firebox
  const leftW = (w - fbW) / 2;
  parts.push(part(box(leftW, h, d, 0.002), 'body', [-w / 2 + leftW / 2, h / 2, 0], { plan: 'line', planPts: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] }));
  parts.push(part(box(leftW, h, d, 0.002), 'body', [w / 2 - leftW / 2, h / 2, 0], { plan: false }));
  parts.push(part(box(fbW, sill, d, 0.002), 'body', [0, sill / 2, 0], { plan: false }));
  parts.push(part(box(fbW, h - sill - fbH, d, 0.002), 'body', [0, sill + fbH + (h - sill - fbH) / 2, 0], { plan: false }));
  // firebox interior
  parts.push(part(box(fbW, fbH, 0.02, 0), '$firebox', [0, sill + fbH / 2, backZ + 0.05], { plan: false }));
  parts.push(part(box(fbW, 0.02, d - 0.05, 0), '$firebox', [0, sill + 0.01, 0.02], { plan: false }));
  for (const sx of [-1, 1]) parts.push(part(box(0.02, fbH, d - 0.05, 0), '$firebox', [sx * (fbW / 2 - 0.01), sill + fbH / 2, 0.02], { plan: false }));
  parts.push(part(box(fbW, 0.02, d - 0.05, 0), '$firebox', [0, sill + fbH - 0.01, 0.02], { plan: false }));
  // glass front and flame bed
  parts.push(part({ t: 'panel', w: fbW - 0.04, h: fbH - 0.04 }, '$fireGlass', [0, sill + fbH / 2, d / 2 - 0.02], { plan: false, noShadow: true }));
  const r = rng(ctx.seed);
  for (let i = 0; i < 9; i++) {
    const x = -fbW * 0.4 + (fbW * 0.8 * i) / 8 + (r() - 0.5) * 0.03;
    parts.push(part({ t: 'cyl', rt: 0.0, rb: 0.03 + r() * 0.02, h: 0.12 + r() * 0.16, seg: 8 }, '$flame', [x, sill + 0.1 + 0.07, 0], { plan: false, noShadow: true }));
  }
  const inst: { p: V3; s?: V3 }[] = [];
  for (let i = 0; i < 26; i++) inst.push({ p: [-fbW * 0.45 + r() * fbW * 0.9, sill + 0.035, -0.05 + r() * 0.12], s: [0.04 + r() * 0.04, 0.02 + r() * 0.02, 0.04 + r() * 0.03] });
  parts.push(part({ t: 'sphere', rx: 0.5, ry: 0.5, rz: 0.5, seg: 8 }, '$ember', [0, 0, 0], { inst, plan: false }));
  // hearth
  if (pr.hearth !== false) {
    const hd = pr.hearthD ?? 0.45;
    parts.push(part(box(fbW + 0.5, 0.012, hd, 0.002), pr.hearthMat ?? '$hearth', [0, 0.006, d / 2 + hd / 2], { plan: 'line' }));
  }
  return {
    parts,
    lights: [{ p: [0, sill + 0.3, d / 2 + 0.25], color: '#FF9A4D', intensity: 1.2, distance: 4, kind: 'fire' }],
  };
}

/** Base cabinets with a counter (kitchens, bars, window seats). */
export function cabinetRun(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const toe = 0.1;
  const topT = pr.topT ?? 0.03;
  parts.push(part(box(w, h - topT - toe, d - 0.03, 0.003), 'fronts', [0, toe + (h - topT - toe) / 2, -0.015], { plan: 'line' }));
  parts.push(part(box(w - 0.02, toe, d - 0.1, 0), '$toeKick', [0, toe / 2, -0.05], { plan: false, noShadow: true }));
  parts.push(part(box(w, topT, d, 0.004), 'top', [0, h - topT / 2, 0], { plan: 'line' }));
  const n = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < n; i++) parts.push(part(box(0.004, h - topT - toe - 0.01, 0.004, 0), '$reveal', [-w / 2 + (w * i) / n, toe + (h - topT - toe) / 2, d / 2 - 0.029], { plan: false, noShadow: true }));
  if (pr.cushion) parts.push(part({ t: 'cushion', w: w - 0.04, h: 0.08, d: d - 0.04, r: 0.03, bulge: 0.01 }, 'upholstery', [0, h + 0.04, 0], { plan: 'cushion' }));
  return { parts };
}

export function column(ctx: GenCtx): Built {
  const { w, d, params: pr } = ctx;
  const h = ctx.ceiling ?? ctx.h;
  if (pr.round) return { parts: [part(cyl(w / 2, w / 2, h, 40), 'body', [0, h / 2, 0], { plan: 'fill-dark' })] };
  return { parts: [part(box(w, h, d, 0.002), 'body', [0, h / 2, 0], { plan: 'fill-dark' })] };
}
