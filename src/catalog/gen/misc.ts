import { box, cushion, cyl, fourLegs, part, rng, roundedRectPts, sph, type Built, type GenCtx, type Part, type V3 } from '../parts';

// ---------------------------------------------------------------------------
// Rugs

export function rug(ctx: GenCtx): Built {
  const { w, d, params: pr } = ctx;
  const shape = pr.shape ?? 'rect';
  const pile = pr.pile ?? 0.012;
  return {
    parts: [
      part({ t: 'floor', w, d, shape, r: pr.corner ?? 0.02, h: pile }, 'rug', [0, 0, 0], {
        plan: 'dash',
        noShadow: true,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Plants — foliage is built procedurally in the 3D layer from the cache key.

export function plant(ctx: GenCtx): Built {
  const { w, d, h, params: pr, seed } = ctx;
  const species = pr.species ?? 'fiddle';
  const potR = pr.potR ?? Math.min(0.28, Math.min(w, d) * 0.3);
  const potH = pr.potH ?? potR * 1.3;
  const potStyle = pr.pot ?? 'cylinder';
  const parts: Part[] = [];
  const prof: [number, number][] =
    potStyle === 'bowl'
      ? [[0.001, 0], [potR * 0.6, 0], [potR, potH * 0.6], [potR * 1.02, potH], [potR * 0.95, potH], [0.001, potH * 0.9]]
      : potStyle === 'tapered'
        ? [[0.001, 0], [potR * 0.72, 0], [potR, potH], [potR * 0.94, potH], [0.001, potH * 0.92]]
        : potStyle === 'urn'
          ? [[0.001, 0], [potR * 0.5, 0], [potR * 0.55, potH * 0.12], [potR * 1.0, potH * 0.55], [potR * 0.9, potH], [potR * 0.82, potH], [0.001, potH * 0.92]]
          : potStyle === 'basket'
            ? [[0.001, 0], [potR * 0.9, 0], [potR, potH], [potR * 0.97, potH], [0.001, potH * 0.92]]
            : [[0.001, 0], [potR * 0.92, 0], [potR, potH * 0.08], [potR, potH], [potR * 0.93, potH], [0.001, potH * 0.93]];
  parts.push(part({ t: 'lathe', pts: prof, seg: 40 }, 'pot', [0, 0, 0], { plan: 'line', planCircle: potR }));
  parts.push(part(cyl(potR * 0.9, potR * 0.9, 0.01, 24), '$soil', [0, potH * 0.9, 0], { plan: false }));
  parts.push(
    part({ t: 'custom', key: 'plant', params: { species, h: h - potH * 0.9, spread: Math.max(w, d), seed } }, '$foliage', [0, potH * 0.9, 0], {
      plan: 'thin',
      planStrokes: foliageStrokes(species, Math.max(w, d) / 2, seed),
    }),
  );
  return { parts };
}

function foliageStrokes(species: string, R: number, seed: number): [number, number][][] {
  const r = rng(seed + 5);
  const n = species === 'olive' ? 22 : species === 'palm' ? 9 : species === 'bird' ? 8 : 12;
  const out: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const rr = R * (0.55 + r() * 0.45);
    const w = species === 'palm' ? 0.08 : 0.22;
    out.push([
      [Math.cos(a) * rr * 0.15, Math.sin(a) * rr * 0.15],
      [Math.cos(a + w) * rr * 0.6, Math.sin(a + w) * rr * 0.6],
      [Math.cos(a) * rr, Math.sin(a) * rr],
      [Math.cos(a - w) * rr * 0.6, Math.sin(a - w) * rr * 0.6],
      [Math.cos(a) * rr * 0.15, Math.sin(a) * rr * 0.15],
    ]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Christmas tree

export function christmasTree(ctx: GenCtx): Built {
  const { w, d, h, params: pr, seed } = ctx;
  const R = Math.min(w, d) / 2;
  const parts: Part[] = [];
  parts.push(part({ t: 'floor', w: R * 1.5, d: R * 1.5, shape: 'round', h: 0.02 }, pr.skirt ?? '$skirt', [0, 0, 0], { plan: false, noShadow: true }));
  parts.push(part(cyl(0.2, 0.22, 0.28, 24), '$woven', [0, 0.14, 0], { plan: false }));
  parts.push(
    part({ t: 'custom', key: 'xmas', params: { h: h - 0.25, r: R * 0.92, seed, lights: pr.lights ?? 'warm', ornaments: pr.ornaments ?? 'gold' } }, '$fir', [0, 0.25, 0], {
      plan: 'thin',
      planCircle: R * 0.92,
      planStrokes: Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return [
          [0, 0],
          [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9],
        ] as [number, number][];
      }),
    }),
  );
  if (pr.presents !== false) {
    const r = rng(seed + 3);
    const colors = ['$wrapA', '$wrapB', '$wrapC'];
    for (let i = 0; i < 5; i++) {
      const a = 0.6 + i * 0.9 + r() * 0.3;
      const s = 0.18 + r() * 0.16;
      const x = Math.cos(a) * R * 0.75;
      const z = Math.sin(a) * R * 0.75 + R * 0.1;
      parts.push(part(box(s, s * (0.6 + r() * 0.5), s * (0.8 + r() * 0.3), 0.004), colors[i % 3], [x, (s * 0.8) / 2, z], { r: [0, r() * 1.5, 0], plan: false }));
    }
  }
  return {
    parts,
    lights: [
      { p: [0, h * 0.45, 0], color: '#FFC77A', intensity: 1.3, distance: 4, kind: 'tree' },
      { p: [0, h * 0.75, 0], color: '#FFC77A', intensity: 0.6, distance: 3, kind: 'tree' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Hi-fi

export function speaker(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'bw800';
  const parts: Part[] = [];
  const mat = 'cabinet';
  if (style === 'bw800') {
    // B&W 800-series: teardrop bass cabinet (flat-ish front baffle, tapering
    // rear), a turned Turbine head with the midrange, and the tweeter-on-top.
    const plinthH = 0.055;
    const R = w * 0.4; // head radius
    const tw = Math.max(0.022, w * 0.07); // tweeter tube radius
    const cabH = Math.max(0.3, h - plinthH - R * 1.9 - tw * 1.8 + 0.03);
    const zf = d / 2 - 0.01;
    const z0 = zf - w * 0.36;
    const rw = w * 0.15;
    const shape: [number, number][] = [];
    for (let i = 0; i <= 28; i++) {
      const th = (Math.PI * i) / 28;
      const c = Math.cos(th);
      shape.push([(w / 2) * Math.sign(c) * Math.sqrt(Math.abs(c)), z0 + (zf - z0) * Math.sqrt(Math.sin(th))]);
    }
    const q = (a: [number, number], c: [number, number], b: [number, number], n: number) => {
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        shape.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
      }
    };
    const rz = -d / 2 + rw;
    q([-w / 2, z0], [-w / 2, -d * 0.2], [-rw, rz], 12);
    for (let i = 1; i < 12; i++) {
      const th = Math.PI + (Math.PI * i) / 12;
      shape.push([rw * Math.cos(th), rz + rw * Math.sin(th)]);
    }
    q([rw, rz], [w / 2, -d * 0.2], [w / 2, z0], 12);
    shape.pop();
    parts.push(part({ t: 'plate', pts: roundedRectPts(w * 1.02, d * 0.94, 0.04, 6), h: plinthH }, '$black', [0, 0, -0.005], { plan: 'line' }));
    parts.push(part({ t: 'plate', pts: shape, h: cabH, bevel: 0.012 }, mat, [0, plinthH, 0], { plan: 'line' }));
    // two Aerofoil bass cones on the baffle
    const wr = w * 0.25;
    const nW = pr.woofers ?? 2;
    for (let i = 0; i < nW; i++) {
      const y = plinthH + cabH * (nW === 1 ? 0.45 : 0.27 + i * 0.37);
      parts.push(part({ t: 'torus', r: wr * 1.03, tube: wr * 0.065, seg: 40 }, '$black', [0, y, zf + 0.018], { r: [Math.PI / 2, 0, 0], plan: false }));
      parts.push(part({ t: 'lathe', pts: [[0.001, -0.016], [wr * 0.24, -0.015], [wr * 0.9, -0.002], [wr, 0.0]], seg: 40 }, '$driverSilver', [0, y, zf + 0.019], { r: [Math.PI / 2, 0, 0], plan: false }));
      parts.push(part(sph(wr * 0.2, wr * 0.2, wr * 0.07, 16), '$driverSilver', [0, y, zf + 0.004], { plan: false }));
    }
    // Turbine head: a turned shell, open at the front for the midrange
    const zc = d * 0.06;
    const headY = plinthH + cabH + R * 0.88;
    const F = R * 0.62;
    parts.push(part({ t: 'lathe', pts: [[0.001, -R * 1.02], [R * 0.42, -R * 0.9], [R * 0.74, -R * 0.62], [R * 0.93, -R * 0.24], [R * 0.96, R * 0.06], [R * 0.88, R * 0.34], [R * 0.72, R * 0.54], [R * 0.64, F], [R * 0.6, F - 0.006], [R * 0.58, F - 0.034], [0.001, F - 0.036]], seg: 40 }, mat, [0, headY, zc], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part({ t: 'torus', r: R * 0.57, tube: R * 0.045, seg: 36 }, '$black', [0, headY, zc + F - 0.004], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part({ t: 'lathe', pts: [[0.001, -0.024], [R * 0.14, -0.022], [R * 0.5, -0.003], [R * 0.54, 0]], seg: 36 }, '$driverSilver', [0, headY, zc + F - 0.004], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part(sph(R * 0.1, R * 0.1, R * 0.05, 16), '$driverSilver', [0, headY, zc + F - 0.026], { plan: false }));
    // neck between cabinet and head
    parts.push(part(cyl(R * 0.36, R * 0.44, 0.05, 24), mat, [0, plinthH + cabH + 0.015, zc - R * 0.1], { plan: false }));
    // tweeter-on-top
    const tLen = R * 1.7;
    const tY = headY + R * 0.95 + tw * 0.75;
    const tFront = zc + F + 0.02;
    parts.push(part(cyl(tw, tw * 0.82, tLen, 24), mat, [0, tY, tFront - tLen / 2], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part(cyl(tw * 0.55, tw * 0.55, 0.02, 12), mat, [0, tY - tw * 0.8, tFront - tLen * 0.45], { plan: false }));
    parts.push(part(cyl(tw * 1.02, tw * 1.02, 0.006, 24), '$black', [0, tY, tFront + 0.002], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part(sph(tw * 0.5, tw * 0.5, tw * 0.28, 16), '$driverSilver', [0, tY, tFront + 0.004], { plan: false }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(cyl(0.016, 0.005, 0.03, 10), '$chrome', [sx * w * 0.42, -0.012, sz * d * 0.36], { plan: false }));
  } else if (style === 'standmount') {
    const standH = h - 0.42;
    parts.push(part(box(0.3, 0.02, 0.3, 0.01), '$black', [0, 0.01, 0], { plan: 'line' }));
    parts.push(part(box(0.06, standH - 0.04, 0.06, 0.005), '$black', [0, standH / 2, 0], { plan: false }));
    parts.push(part(box(0.22, 0.02, 0.26, 0.005), '$black', [0, standH - 0.01, 0], { plan: false }));
    parts.push(part(box(w, 0.42, d, 0.03), mat, [0, standH + 0.21, 0], { plan: 'line' }));
    parts.push(part({ t: 'lathe', pts: [[0.001, -0.02], [0.03, -0.018], [0.075, 0], [0.08, 0.004]], seg: 32 }, '$driverSilver', [0, standH + 0.15, d / 2 + 0.002], { r: [Math.PI / 2, 0, 0], plan: false }));
    parts.push(part(sph(0.025, 0.025, 0.012), '$chrome', [0, standH + 0.34, d / 2 + 0.004], { plan: false }));
  } else if (style === 'sub') {
    parts.push(part(box(w, h, d, 0.03), mat, [0, h / 2, 0], { plan: 'line' }));
    parts.push(part(cyl(w * 0.38, w * 0.38, 0.01, 40), '$black', [0, h / 2, d / 2 + 0.005], { r: [Math.PI / 2, 0, 0], plan: false }));
  } else {
    // slim tower
    parts.push(part(box(w, h - 0.03, d, 0.02), mat, [0, (h - 0.03) / 2 + 0.03, 0], { plan: 'line' }));
    parts.push(part(box(w * 1.2, 0.03, d * 1.05, 0.01), '$black', [0, 0.015, 0], { plan: false }));
    for (let i = 0; i < 3; i++) {
      const y = h * (0.35 + i * 0.18);
      parts.push(part({ t: 'lathe', pts: [[0.001, -0.02], [0.02, -0.018], [w * 0.36, 0], [w * 0.38, 0.004]], seg: 28 }, '$driverSilver', [0, y, d / 2 + 0.002], { r: [Math.PI / 2, 0, 0], plan: false }));
    }
    parts.push(part(sph(0.02, 0.02, 0.01), '$chrome', [0, h * 0.9, d / 2 + 0.004], { plan: false }));
  }
  return { parts };
}

// ---------------------------------------------------------------------------
// Pianos

function grandOutline(w: number, d: number): [number, number][] {
  // keyboard at +z; straight bass side at -x; curved bentside at +x; tail at -z
  const pts: [number, number][] = [];
  pts.push([-w / 2, d / 2]);
  pts.push([w / 2, d / 2]);
  pts.push([w / 2, d / 2 - d * 0.18]);
  // bentside: cubic bezier from (w/2, d/2-0.18d) to (-w/2 + 0.2w, -d/2)
  const p0: [number, number] = [w / 2, d / 2 - d * 0.18];
  const p1: [number, number] = [w / 2, -d * 0.05];
  const p2: [number, number] = [-w * 0.05, -d * 0.1];
  const p3: [number, number] = [-w * 0.1, -d / 2 + d * 0.06];
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const mt = 1 - t;
    pts.push([
      mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  // tail round
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 0.6;
    pts.push([-w * 0.1 - Math.sin(a) * w * 0.2, -d / 2 + d * 0.06 - Math.sin(a * 1.2) * d * 0.06]);
  }
  pts.push([-w / 2, -d / 2 + d * 0.05]);
  return pts;
}

export function piano(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const kind = pr.kind ?? 'grand';
  const mat = 'body';
  if (kind === 'grand') {
    const legH = 0.62;
    const rimH = 0.3;
    const outline = grandOutline(w, d - 0.05);
    parts.push(part({ t: 'plate', pts: outline, h: rimH, bevel: 0.01 }, mat, [0, legH, -0.025], { plan: 'line' }));
    // keybed and keys
    parts.push(part(box(w, 0.08, 0.3, 0.01), mat, [0, legH + 0.02, d / 2 - 0.15], { plan: 'line' }));
    parts.push(part(box(w - 0.1, 0.02, 0.15, 0.002), '$keysWhite', [0, legH + 0.075, d / 2 - 0.12], { plan: 'thin' }));
    const inst: { p: V3; s?: V3 }[] = [];
    const nk = 36;
    for (let i = 0; i < nk; i++) {
      const pos = i % 5;
      if (pos === 2) continue;
      const x = -w / 2 + 0.07 + ((w - 0.14) * i) / nk;
      inst.push({ p: [x, legH + 0.093, d / 2 - 0.15], s: [0.012, 0.015, 0.09] });
    }
    parts.push(part(box(1, 1, 1, 0), '$keysBlack', [0, 0, 0], { inst, plan: false }));
    // lid, propped open
    if (pr.lidOpen !== false) {
      parts.push(part({ t: 'plate', pts: outline, h: 0.02 }, mat, [0, legH + rimH, -0.025], { r: [0, 0, -0.5], plan: false }));
      parts.push(part(cyl(0.008, 0.008, 0.7, 8), mat, [w * 0.25, legH + rimH + 0.32, -0.1], { r: [0, 0, 0.3], plan: false }));
    } else {
      parts.push(part({ t: 'plate', pts: outline, h: 0.02 }, mat, [0, legH + rimH, -0.025], { plan: false }));
    }
    // legs
    for (const [x, z] of [
      [-w / 2 + 0.12, d / 2 - 0.2],
      [w / 2 - 0.12, d / 2 - 0.2],
      [-w * 0.2, -d / 2 + 0.25],
    ])
      parts.push(part(cyl(0.05, 0.035, legH, 16), mat, [x, legH / 2, z], { plan: false }));
    parts.push(part(box(0.2, 0.3, 0.04, 0.01), mat, [0, 0.25, d / 2 - 0.35], { plan: false }));
    // bench
    parts.push(part(cushion(0.8, 0.06, 0.36, 0.02, 0.01), '$black', [0, 0.49, d / 2 + 0.35], { plan: 'line' }));
    parts.push(...fourLegs(0.78, 0.34, 0.46, { style: 'square', size: 0.04, mat, inset: 0.02 }).map((p) => ({ ...p, p: [p.p[0], p.p[1], p.p[2] + d / 2 + 0.35] as V3 })));
  } else {
    parts.push(part(box(w, h, d * 0.6, 0.01), mat, [0, h / 2, -d * 0.2], { plan: 'line' }));
    parts.push(part(box(w, 0.06, d * 0.4, 0.008), mat, [0, 0.72, d * 0.2 - 0.05], { plan: 'line' }));
    parts.push(part(box(w - 0.12, 0.02, 0.15, 0.002), '$keysWhite', [0, 0.76, d * 0.13], { plan: false }));
    for (const sx of [-1, 1]) parts.push(part(box(0.06, 0.7, 0.06, 0.01), mat, [sx * (w / 2 - 0.08), 0.35, d * 0.25], { plan: false }));
    parts.push(part(cushion(0.8, 0.06, 0.36, 0.02, 0.01), '$black', [0, 0.49, d / 2 + 0.3], { plan: 'line' }));
  }
  return { parts };
}

// ---------------------------------------------------------------------------
// Beds

export function bed(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const legH = pr.legH ?? 0.12;
  const frameH = 0.22;
  const mattH = 0.24;
  const headT = 0.1;
  const hb = pr.headboard ?? 'upholstered';
  parts.push(part(box(w, frameH, d - headT, 0.02), 'frame', [0, legH + frameH / 2, headT / 2], { plan: 'line' }));
  if (legH > 0) parts.push(...fourLegs(w, d - headT, legH, { style: 'square', size: 0.05, mat: 'legs', inset: 0.04 }).map((p) => ({ ...p, p: [p.p[0], p.p[1], p.p[2] + headT / 2] as V3 })));
  const mz = headT / 2;
  parts.push(part(cushion(w - 0.06, mattH, d - headT - 0.04, 0.04, 0.012), '$mattress', [0, legH + frameH + mattH / 2 - 0.04, mz], { plan: false }));
  // duvet with fold
  parts.push(part(cushion(w + 0.04, 0.08, (d - headT) * 0.74, 0.04, 0.02), 'bedding', [0, legH + frameH + mattH - 0.02, headT / 2 + (d - headT) * 0.13], { plan: 'cushion' }));
  parts.push(part(cushion(w + 0.02, 0.09, 0.28, 0.04, 0.02), 'bedding', [0, legH + frameH + mattH + 0.02, -d / 2 + headT + 0.52], { plan: 'thin' }));
  // pillows
  const np = w > 1.7 ? 3 : 2;
  const pw = (w - 0.2) / np;
  for (let i = 0; i < np; i++)
    parts.push(part(cushion(pw - 0.02, 0.16, 0.38, 0.06, 0.04), '$linenWhite', [-w / 2 + 0.1 + pw * (i + 0.5), legH + frameH + mattH + 0.02, -d / 2 + headT + 0.22], { r: [-0.35, 0, 0], plan: 'cushion' }));
  if (hb !== 'none') {
    const hh = h - legH;
    if (hb === 'channel') {
      const n = Math.round(w / 0.2);
      for (let i = 0; i < n; i++)
        parts.push(part(cushion(w / n - 0.004, hh, headT, 0.04, 0.015), 'upholstery', [-w / 2 + (w / n) * (i + 0.5), legH + hh / 2, -d / 2 + headT / 2], { plan: i === 0 ? 'line' : false, planPts: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, -d / 2 + headT], [-w / 2, -d / 2 + headT]] }));
    } else parts.push(part(hb === 'wood' ? box(w + 0.04, hh, headT, 0.01) : cushion(w + 0.04, hh, headT, 0.04, 0.02), hb === 'wood' ? 'frame' : 'upholstery', [0, legH + hh / 2, -d / 2 + headT / 2], { plan: 'line' }));
  }
  return { parts };
}

// ---------------------------------------------------------------------------
// Baby and kids

export function baby(ctx: GenCtx): Built {
  const { w, d, h, params: pr, seed } = ctx;
  const kind: string = pr.kind ?? 'play-gym';
  const parts: Part[] = [];
  if (kind === 'play-gym') {
    parts.push(part(cushion(w, 0.04, d, 0.08, 0.008), '$playMat', [0, 0.02, 0], { plan: 'line' }));
    for (const s of [-1, 1]) {
      const pts: V3[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI;
        pts.push([Math.cos(a) * (w * 0.4), 0.04 + Math.sin(a) * (h - 0.06), s * d * 0.12 + Math.cos(a) * s * d * 0.18]);
      }
      parts.push(part({ t: 'tube', pts, r: 0.012, smooth: true }, '$stripes', [0, 0, 0], { plan: 'thin', planStrokes: [[[-w * 0.4, s * d * 0.3], [w * 0.4, -s * d * 0.06]]] }));
    }
    const r = rng(seed);
    for (let i = 0; i < 4; i++) parts.push(part(sph(0.03), ['$toyRed', '$toyYellow', '$toyBlue', '$toyGreen'][i], [(r() - 0.5) * w * 0.4, h * 0.55, (r() - 0.5) * 0.1], { plan: false }));
  } else if (kind === 'bouncer') {
    // Babybjörn-style bouncer: wire frame + fabric sling
    parts.push(part({ t: 'tube', pts: [[-w / 2 + 0.03, 0.01, d / 2 - 0.05], [-w / 2 + 0.03, 0.01, -d / 2 + 0.05], [w / 2 - 0.03, 0.01, -d / 2 + 0.05], [w / 2 - 0.03, 0.01, d / 2 - 0.05]], r: 0.007 }, '$chrome', [0, 0, 0], { plan: 'thin' }));
    parts.push(part(cushion(w * 0.8, 0.06, d * 0.75, 0.08, 0.02), 'upholstery', [0, h * 0.5, 0.03], { r: [-0.55, 0, 0], plan: 'cushion' }));
    parts.push(part(box(w * 0.7, 0.05, 0.05, 0.02), '$plasticWhite', [0, 0.08, d / 2 - 0.08], { plan: false }));
  } else if (kind === 'mat') {
    parts.push(part({ t: 'floor', w, d, r: 0.04, h: h || 0.02 }, '$playMat', [0, 0, 0], { plan: 'dash', noShadow: true }));
  } else if (kind === 'crib') {
    parts.push(part(box(w, 0.04, d, 0.01), 'frame', [0, 0.25, 0], { plan: 'line' }));
    parts.push(part(cushion(w - 0.06, 0.1, d - 0.06, 0.02, 0.005), '$mattress', [0, 0.32, 0], { plan: false }));
    for (const [x, z] of [
      [-w / 2 + 0.025, -d / 2 + 0.025],
      [w / 2 - 0.025, -d / 2 + 0.025],
      [w / 2 - 0.025, d / 2 - 0.025],
      [-w / 2 + 0.025, d / 2 - 0.025],
    ])
      parts.push(part(box(0.05, h, 0.05, 0.01), 'frame', [x, h / 2, z], { plan: false }));
    for (const sz of [-1, 1]) {
      parts.push(part(box(w, 0.04, 0.03, 0.01), 'frame', [0, h - 0.02, sz * (d / 2 - 0.02)], { plan: false }));
      const inst: { p: V3 }[] = [];
      for (let i = 1; i < 16; i++) inst.push({ p: [-w / 2 + (w * i) / 16, (h + 0.27) / 2, sz * (d / 2 - 0.02)] });
      parts.push(part(box(0.02, h - 0.3, 0.02, 0.005), 'frame', [0, 0, 0], { inst, plan: false }));
    }
    for (const sx of [-1, 1]) {
      parts.push(part(box(0.03, 0.04, d, 0.01), 'frame', [sx * (w / 2 - 0.02), h - 0.02, 0], { plan: false }));
      const inst: { p: V3 }[] = [];
      for (let i = 1; i < 8; i++) inst.push({ p: [sx * (w / 2 - 0.02), (h + 0.27) / 2, -d / 2 + (d * i) / 8] });
      parts.push(part(box(0.02, h - 0.3, 0.02, 0.005), 'frame', [0, 0, 0], { inst, plan: false }));
    }
  } else if (kind === 'basket') {
    parts.push(part({ t: 'lathe', pts: [[0.001, 0], [w / 2 * 0.9, 0], [w / 2, h], [w / 2 * 0.96, h], [0.001, 0.01]], seg: 32 }, '$woven', [0, 0, 0], { plan: 'line', planCircle: w / 2 }));
    const r = rng(seed);
    for (let i = 0; i < 3; i++) parts.push(part(sph(0.06), ['$toyRed', '$toyYellow', '$toyBlue'][i], [(r() - 0.5) * w * 0.4, h * 0.9, (r() - 0.5) * w * 0.4], { plan: false }));
  } else if (kind === 'gate') {
    // freestanding hearth gate: a shallow U of panels
    const segs: [number, number, number, number][] = [
      [-w / 2, -d / 2, -w / 2, d / 2],
      [-w / 2, d / 2, w / 2, d / 2],
      [w / 2, d / 2, w / 2, -d / 2],
    ];
    for (const [x0, z0, x1, z1] of segs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const a = Math.atan2(z1 - z0, x1 - x0);
      parts.push(part(box(len, 0.025, 0.025, 0.004), '$plasticWhite', [(x0 + x1) / 2, h - 0.02, (z0 + z1) / 2], { r: [0, -a, 0], plan: 'line', planPts: [[x0, z0], [x1, z1], [x1, z1], [x0, z0]] }));
      parts.push(part(box(len, 0.025, 0.025, 0.004), '$plasticWhite', [(x0 + x1) / 2, 0.03, (z0 + z1) / 2], { r: [0, -a, 0], plan: false }));
      const n = Math.round(len / 0.07);
      const inst: { p: V3 }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        inst.push({ p: [x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t] });
      }
      parts.push(part(cyl(0.006, 0.006, h - 0.04, 6), '$plasticWhite', [0, 0, 0], { inst, plan: false }));
    }
  } else if (kind === 'high-chair') {
    // Tripp Trapp-like: two raked side stringers with plates
    for (const sx of [-1, 1]) parts.push(part(box(0.03, h, 0.1, 0.01), 'frame', [sx * (w / 2 - 0.015), h / 2, 0.05], { r: [0.12, 0, 0], plan: 'line' }));
    for (const sx of [-1, 1]) parts.push(part(box(0.03, 0.04, d, 0.01), 'frame', [sx * (w / 2 - 0.015), 0.02, 0], { plan: false }));
    parts.push(part(box(w - 0.04, 0.02, 0.3, 0.005), 'frame', [0, 0.52, 0.06], { plan: 'line' }));
    parts.push(part(box(w - 0.04, 0.02, 0.26, 0.005), 'frame', [0, 0.3, 0.12], { plan: false }));
    for (const y of [0.72, 0.62]) parts.push(part(box(w - 0.04, 0.07, 0.02, 0.005), 'frame', [0, y, -0.06], { r: [0.12, 0, 0], plan: false }));
  } else {
    // play table: short white table with rounded corners
    parts.push(part({ t: 'plate', pts: roundedRectPts(w, d, 0.05, 6), h: 0.035, bevel: 0.01 }, 'top', [0, h - 0.035, 0], { plan: 'line' }));
    parts.push(...fourLegs(w, d, h - 0.035, { style: 'round', size: 0.05, inset: 0.06, mat: 'base' }));
  }
  return { parts };
}

// ---------------------------------------------------------------------------
// Music, art, media, textiles

export function guitar(ctx: GenCtx): Built {
  const { h } = ctx;
  const parts: Part[] = [];
  // A-frame stand
  parts.push(part({ t: 'tube', pts: [[-0.15, 0.01, 0.12], [0, 0.5, -0.02], [0.15, 0.01, 0.12]], r: 0.008 }, '$black', [0, 0, 0], { plan: 'thin' }));
  parts.push(part({ t: 'tube', pts: [[0, 0.01, -0.2], [0, 0.5, -0.02]], r: 0.008 }, '$black', [0, 0, 0], { plan: false }));
  // body: two overlapping discs; slight lean back
  const lean = -0.2;
  const bodyY = 0.38;
  parts.push(part({ t: 'plate', pts: guitarBody(), h: 0.1, bevel: 0.015 }, '$sunburst', [0, bodyY, 0.08], { r: [Math.PI / 2 + lean, 0, 0], plan: 'line', planPts: [[-0.2, 0.0], [0.2, 0.0], [0.2, 0.12], [-0.2, 0.12]] }));
  parts.push(part(box(0.05, h - 0.55, 0.025, 0.008), '$rosewood', [0, bodyY + 0.28 + (h - 0.55) / 2, 0.02], { r: [lean, 0, 0], plan: false }));
  parts.push(part(box(0.09, 0.18, 0.018, 0.006), '$rosewood', [0, h - 0.1, -0.08], { r: [lean - 0.25, 0, 0], plan: false }));
  parts.push(part(cyl(0.045, 0.045, 0.005, 24), '$black', [0, bodyY + 0.02, 0.19], { r: [Math.PI / 2 + lean, 0, 0], plan: false }));
  return { parts };
}

function guitarBody(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const lower = Math.sin(a) > 0;
    const rx = lower ? 0.2 : 0.15;
    const cz = lower ? 0.1 : -0.12;
    pts.push([Math.cos(a) * rx, cz + Math.sin(a) * (lower ? 0.16 : 0.12)]);
  }
  return pts;
}

export function art(ctx: GenCtx): Built {
  // Origin at the center of the piece; the back sits at z = -d/2 against the wall.
  const { w, h, d, params: pr } = ctx;
  const frame = pr.frame ?? 'thin-black';
  const depth = Math.max(0.015, d);
  const z0 = -depth / 2;
  const parts: Part[] = [];
  const img = pr.image ?? 'abstract';
  if (frame === 'canvas') {
    parts.push(part(box(w, h, depth, 0.003), '$canvasEdge', [0, 0, 0], { plan: 'line' }));
    parts.push(part({ t: 'panel', w: w - 0.004, h: h - 0.004 }, `$art:${img}`, [0, 0, z0 + depth + 0.001], { plan: false }));
  } else {
    const fw = pr.frameW ?? 0.025;
    const matW = pr.mat ? Math.min(w, h) * 0.12 : 0;
    const fmat = frame === 'oak' ? '$oakFrame' : frame === 'white' ? '$ceramicWhite' : frame === 'brass' ? '$brassDecor' : '$black';
    parts.push(part(box(w, h, depth, 0.002), fmat, [0, 0, 0], { plan: 'line' }));
    if (matW > 0) parts.push(part({ t: 'panel', w: w - fw * 2, h: h - fw * 2 }, '$paper', [0, 0, z0 + depth + 0.001], { plan: false }));
    parts.push(part({ t: 'panel', w: w - fw * 2 - matW * 2, h: h - fw * 2 - matW * 2 }, `$art:${img}`, [0, 0, z0 + depth + 0.002], { plan: false }));
    parts.push(part({ t: 'panel', w: w - fw * 2, h: h - fw * 2 }, '$glassArt', [0, 0, z0 + depth + 0.004], { plan: false, noShadow: true }));
  }
  return { parts };
}

export function tv(ctx: GenCtx): Built {
  const { w, h, d } = ctx;
  const t = Math.max(0.025, d);
  return {
    parts: [
      part(box(w, h, t, 0.004), '$black', [0, 0, 0], { plan: 'line' }),
      part({ t: 'panel', w: w - 0.01, h: h - 0.01 }, '$screen', [0, 0, t / 2 + 0.001], { plan: false }),
    ],
  };
}

export function curtain(ctx: GenCtx): Built {
  const { w, h, params: pr } = ctx;
  return {
    parts: [
      part({ t: 'custom', key: 'curtain', params: { w, h: h - 0.03, folds: Math.max(4, Math.round(w / 0.11)), sheer: pr.sheer ?? true } }, pr.sheer === false ? '$drape' : '$sheer', [0, 0, 0], {
        plan: 'thin',
        planStrokes: [wave(w, 0.05)],
      }),
      part(cyl(0.012, 0.012, w + 0.1, 12), '$black', [0, h - 0.015, -0.03], { r: [0, 0, Math.PI / 2], plan: false }),
    ],
  };
}

function wave(w: number, amp: number): [number, number][] {
  const pts: [number, number][] = [];
  const n = Math.max(6, Math.round(w / 0.06));
  for (let i = 0; i <= n; i++) pts.push([-w / 2 + (w * i) / n, (i % 2 ? amp : -amp) * 0.5]);
  return pts;
}

export function mirror(ctx: GenCtx): Built {
  const { w, h, d, params: pr } = ctx;
  const t = Math.max(0.02, d);
  const parts: Part[] = [];
  if (pr.shape === 'round') {
    parts.push(part({ t: 'torus', r: w / 2 - 0.012, tube: 0.012, seg: 48 }, '$brassDecor', [0, 0, 0], { r: [Math.PI / 2, 0, 0], plan: 'line', planPts: [[-w / 2, -t / 2], [w / 2, -t / 2], [w / 2, t / 2], [-w / 2, t / 2]] }));
    parts.push(part({ t: 'cyl', rt: w / 2 - 0.01, rb: w / 2 - 0.01, h: 0.005, seg: 48 }, '$mirror', [0, 0, -0.002], { r: [Math.PI / 2, 0, 0], plan: false }));
  } else {
    parts.push(part(box(w, h, t, 0.003), '$oakFrame', [0, 0, 0], { plan: 'line' }));
    parts.push(part({ t: 'panel', w: w - 0.05, h: h - 0.05 }, '$mirror', [0, 0, t / 2 + 0.001], { plan: false }));
  }
  return { parts };
}

export function person(ctx: GenCtx): Built {
  const { h } = ctx;
  return {
    parts: [
      part(cyl(0.16, 0.12, h * 0.52, 16), '$scale', [0, h * 0.5 + h * 0.13, 0], { plan: 'thin', planCircle: 0.2 }),
      part(cyl(0.1, 0.07, h * 0.47, 12), '$scale', [0.07, h * 0.24, 0], { plan: false }),
      part(cyl(0.1, 0.07, h * 0.47, 12), '$scale', [-0.07, h * 0.24, 0], { plan: false }),
      part(sph(0.1, 0.12, 0.11, 16), '$scale', [0, h - 0.11, 0], { plan: false }),
    ],
  };
}
