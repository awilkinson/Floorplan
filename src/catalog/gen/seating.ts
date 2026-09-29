import { box, clamp, cushion, cyl, fourLegs, part, sph, type Built, type GenCtx, type Part, type V3 } from '../parts';

// ---------------------------------------------------------------------------
// Sofas

type ArmStyle = 'track' | 'slope' | 'round' | 'none' | 'shelter' | 'block' | 'wood' | 'thin';
type BackStyle = 'loose' | 'tight' | 'pillows' | 'channel' | 'low';
type BaseStyle = 'legs' | 'plinth' | 'floating' | 'skirt' | 'bun' | 'metal' | 'sled' | 'wood-frame';

function legsFor(base: BaseStyle, w: number, d: number, legH: number, mat = 'legs'): Part[] {
  if (base === 'legs') return fourLegs(w, d, legH, { style: 'tapered', size: 0.045, inset: 0.05, mat });
  if (base === 'metal') return fourLegs(w, d, legH, { style: 'metal', size: 0.05, inset: 0.06, mat });
  if (base === 'bun')
    return fourLegs(w, d, legH, { style: 'round', size: 0.07, inset: 0.05, mat }).map((p) => ({ ...p, geo: sph(0.04, legH / 2, 0.04, 16), p: [p.p[0], legH / 2, p.p[2]] as V3 }));
  if (base === 'plinth') return [part(box(w - 0.06, legH, d - 0.06, 0.004), mat, [0, legH / 2, 0.0], { plan: 'hidden' })];
  if (base === 'floating') return [part(box(w - 0.16, legH, d - 0.16, 0.004), '$black', [0, legH / 2, 0], { plan: 'hidden', noShadow: true })];
  if (base === 'sled') {
    const out: Part[] = [];
    for (const sx of [-1, 1]) {
      out.push(part({ t: 'tube', pts: [[sx * (w / 2 - 0.08), 0.01, -d / 2 + 0.06], [sx * (w / 2 - 0.08), 0.01, d / 2 - 0.06], [sx * (w / 2 - 0.08), legH, d / 2 - 0.08]], r: 0.009 }, mat, [0, 0, 0], { plan: 'hidden' }));
    }
    return out;
  }
  return [];
}

export function sofa(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const arm: ArmStyle = pr.arms ?? 'track';
  const back: BackStyle = pr.back ?? 'loose';
  const base: BaseStyle = pr.base ?? 'legs';
  const legH = pr.legH ?? (base === 'skirt' ? 0 : base === 'plinth' || base === 'floating' ? 0.06 : base === 'bun' ? 0.07 : 0.13);
  const seatH = pr.seatH ?? 0.43;
  const cushH = pr.cushionH ?? clamp((seatH - legH) * 0.55, 0.1, 0.2);
  const deckY = seatH - cushH;
  const armW = arm === 'none' ? 0 : pr.armW ?? (arm === 'block' ? 0.24 : arm === 'thin' || arm === 'wood' ? 0.07 : arm === 'shelter' ? 0.2 : 0.16);
  const armH = arm === 'shelter' ? h : pr.armH ?? Math.min(h - 0.06, seatH + 0.2);
  const backT = pr.backT ?? (back === 'loose' || back === 'pillows' ? 0.17 : 0.22);
  const r = pr.round ?? 0.05;
  const seats = pr.seats ?? Math.max(1, Math.round((w - 2 * armW) / 0.75));
  const shell = pr.shell ? 'upholstery' : 'upholstery';
  const cushMat = pr.shell || pr.twoTone ? 'cushions' : 'upholstery';
  const parts: Part[] = [];

  const bodyBottom = legH;
  const innerW = w - 2 * armW;

  // Deck / base block
  parts.push(part(box(w, deckY - bodyBottom, d, Math.min(r, 0.03)), shell, [0, (deckY + bodyBottom) / 2, 0], { plan: 'line' }));

  // Back frame
  const backTop = back === 'loose' || back === 'pillows' ? Math.max(seatH + 0.12, h - 0.2) : h;
  const backW = arm === 'shelter' ? w : innerW + 0.001;
  parts.push(
    part(box(backW, backTop - bodyBottom, backT, r), shell, [0, (backTop + bodyBottom) / 2, -d / 2 + backT / 2], {
      plan: 'line',
    }),
  );

  // Arms
  if (armW > 0) {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - armW / 2);
      if (arm === 'slope') {
        parts.push(
          part(
            {
              t: 'profile',
              width: armW,
              bevel: Math.min(0.04, armW / 3),
              pts: [
                [-d / 2, bodyBottom],
                [d / 2, bodyBottom],
                [d / 2, armH - 0.1],
                [d / 2 - 0.12, armH - 0.03],
                [-d / 2 + 0.05, armH],
                [-d / 2, armH - 0.04],
              ],
            },
            shell,
            [x, 0, 0],
            { plan: 'line', planPts: rectPts(x, 0, armW, d) },
          ),
        );
      } else if (arm === 'round') {
        const rr = armW * 0.62;
        parts.push(part(box(armW * 0.9, armH - bodyBottom - rr, d, 0.02), shell, [x, (armH - rr + bodyBottom) / 2, 0], { plan: false }));
        parts.push(
          part({ t: 'cyl', rt: rr, rb: rr, h: d, seg: 24 }, shell, [x + sx * 0.01, armH - rr * 0.95, 0], {
            r: [Math.PI / 2, 0, 0],
            plan: 'line',
            planPts: rectPts(x + sx * 0.01, 0, rr * 2, d),
          }),
        );
      } else if (arm === 'wood') {
        // wooden arm on two posts
        parts.push(part(box(armW, 0.03, d * 0.92, 0.01), 'frame', [x, armH, 0.01], { plan: 'line' }));
        for (const z of [-d / 2 + 0.06, d / 2 - 0.08]) parts.push(part(box(0.04, armH - legH, 0.04, 0.006), 'frame', [x, (armH + legH) / 2 - 0.015, z], { plan: 'hidden' }));
      } else {
        parts.push(
          part(box(armW, armH - bodyBottom, d, arm === 'block' ? Math.min(0.08, r * 1.4) : Math.min(r, armW / 2.2)), shell, [x, (armH + bodyBottom) / 2, 0], {
            plan: 'line',
          }),
        );
      }
    }
  }

  // Seat cushions
  const seatD = d - backT - 0.02;
  const seatZ = -d / 2 + backT + seatD / 2 + 0.005;
  const plump = pr.plump ?? 0.022;
  if (pr.benchSeat) {
    parts.push(part(cushion(innerW - 0.01, cushH, seatD, 0.05, plump), cushMat, [0, deckY + cushH / 2, seatZ], { plan: 'cushion' }));
  } else {
    const cw = innerW / seats;
    for (let i = 0; i < seats; i++) {
      const x = -innerW / 2 + cw * (i + 0.5);
      parts.push(part(cushion(cw - 0.012, cushH, seatD, 0.055, plump), cushMat, [x, deckY + cushH / 2, seatZ], { plan: 'cushion' }));
    }
  }

  // Back cushions
  if (back === 'loose' || back === 'pillows') {
    const n = back === 'pillows' ? seats + 1 : seats;
    const bw = (backW - (arm === 'shelter' ? 2 * armW : 0)) / n;
    const bh = h - seatH - 0.015;
    const bt = back === 'pillows' ? 0.16 : 0.2;
    for (let i = 0; i < n; i++) {
      const x = -((backW - (arm === 'shelter' ? 2 * armW : 0)) / 2) + bw * (i + 0.5);
      parts.push(
        part(cushion(bw - 0.012, bh, bt, 0.06, plump * 1.3), cushMat, [x, seatH + bh / 2 - 0.01, -d / 2 + backT + bt / 2 - 0.03], {
          r: [-0.16, 0, 0],
          plan: 'cushion',
        }),
      );
    }
  } else if (back === 'channel') {
    const n = pr.channels ?? Math.round(innerW / 0.2);
    const cw = innerW / n;
    for (let i = 0; i < n; i++) {
      const x = -innerW / 2 + cw * (i + 0.5);
      parts.push(part(cushion(cw - 0.004, h - seatH - 0.02, 0.08, 0.035, 0.01), cushMat, [x, seatH + (h - seatH) / 2 - 0.01, -d / 2 + backT + 0.03], { r: [-0.1, 0, 0], plan: false }));
    }
  }

  // Throw pillows
  const pillows = pr.pillows ?? 2;
  if (pillows > 0 && innerW > 0.9) {
    const ps = 0.46;
    const spots = pillows === 1 ? [1] : pillows === 2 ? [-1, 1] : [-1, -0.2, 1];
    spots.forEach((s, i) => {
      const x = s * (innerW / 2 - ps / 2 - 0.04);
      parts.push(
        part(cushion(ps, ps, 0.14, 0.06, 0.035), i === 1 && pillows === 3 ? 'accent' : 'pillows', [x, seatH + ps / 2 - 0.03, -d / 2 + backT + 0.22], {
          r: [-0.28, s * -0.12, s * 0.05],
          plan: false,
        }),
      );
    });
  }

  parts.push(...legsFor(base, w, d, legH, pr.legMat ?? 'legs'));
  return { parts };
}

function rectPts(cx: number, cz: number, w: number, d: number): [number, number][] {
  return [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
  ];
}

// ---------------------------------------------------------------------------
// Sectional: an L (or chaise, or U) built from straight runs.

export function sectional(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const side: 'left' | 'right' = pr.side ?? 'left';
  const kind: 'L' | 'chaise' | 'U' = pr.kind ?? 'L';
  const sd = pr.seatDepth ?? 1.0; // depth of each run
  const sx = side === 'left' ? -1 : 1;
  const legH = pr.legH ?? 0.1;
  const seatH = pr.seatH ?? 0.42;
  const cushH = 0.17;
  const deckY = seatH - cushH;
  const backT = 0.2;
  const armW = pr.armW ?? 0.14;
  const armH = pr.armH ?? seatH + 0.18;
  const r = 0.04;
  const parts: Part[] = [];
  const base: BaseStyle = pr.base ?? 'floating';

  // Main run along the back (-z), full width.
  parts.push(part(box(w, deckY - legH, sd, 0.02), 'upholstery', [0, (deckY + legH) / 2, -d / 2 + sd / 2]));
  parts.push(part(box(w, h - legH, backT, r), 'upholstery', [0, (h + legH) / 2, -d / 2 + backT / 2]));

  // Return run along one side.
  const retLen = d - sd;
  const retX = sx * (w / 2 - sd / 2);
  parts.push(part(box(sd, deckY - legH, retLen, 0.02), 'upholstery', [retX, (deckY + legH) / 2, -d / 2 + sd + retLen / 2]));
  if (kind !== 'chaise') {
    parts.push(part(box(backT, h - legH, d, r), 'upholstery', [sx * (w / 2 - backT / 2), (h + legH) / 2, 0]));
  }
  if (kind === 'U') {
    const ux = -sx * (w / 2 - sd / 2);
    parts.push(part(box(sd, deckY - legH, retLen, 0.02), 'upholstery', [ux, (deckY + legH) / 2, -d / 2 + sd + retLen / 2]));
    parts.push(part(box(backT, h - legH, d, r), 'upholstery', [-sx * (w / 2 - backT / 2), (h + legH) / 2, 0]));
  }

  // Arms at open ends
  const armAt = (x: number, z: number, along: 'x' | 'z', len: number) => {
    const g = along === 'z' ? box(armW, armH - legH, len, r) : box(len, armH - legH, armW, r);
    parts.push(part(g, 'upholstery', [x, (armH + legH) / 2, z]));
  };
  if (kind !== 'U') armAt(-sx * (w / 2 - armW / 2), -d / 2 + sd / 2, 'z', sd);
  if (kind === 'L' || kind === 'U') armAt(retX, d / 2 - armW / 2, 'x', sd);
  if (kind === 'U') armAt(-sx * (w / 2 - sd / 2), d / 2 - armW / 2, 'x', sd);

  // Seat cushions — main run
  const mainInnerStart = kind === 'U' ? -w / 2 + backT : sx < 0 ? -w / 2 + backT : -w / 2 + armW;
  const mainInnerEnd = kind === 'U' ? w / 2 - backT : sx < 0 ? w / 2 - armW : w / 2 - backT;
  const mainLen = mainInnerEnd - mainInnerStart;
  const n = Math.max(2, Math.round(mainLen / 0.8));
  const seatDepth = sd - backT - 0.02;
  for (let i = 0; i < n; i++) {
    const cw = mainLen / n;
    const x = mainInnerStart + cw * (i + 0.5);
    parts.push(part(cushion(cw - 0.012, cushH, seatDepth, 0.05, 0.02), 'upholstery', [x, deckY + cushH / 2, -d / 2 + backT + seatDepth / 2 + 0.01], { plan: 'cushion' }));
    parts.push(
      part(cushion(cw - 0.012, h - seatH - 0.02, 0.2, 0.06, 0.03), 'upholstery', [x, seatH + (h - seatH) / 2 - 0.02, -d / 2 + backT + 0.07], {
        r: [-0.16, 0, 0],
        plan: 'cushion',
      }),
    );
  }
  // Return cushions
  const retStart = -d / 2 + sd;
  const retEnd = kind === 'chaise' ? d / 2 : d / 2 - armW;
  const retInner = retEnd - retStart;
  const rn = kind === 'chaise' ? 1 : Math.max(1, Math.round(retInner / 0.8));
  const retSeatW = kind === 'chaise' ? sd - 0.02 : sd - backT - 0.02;
  const retSeatX = kind === 'chaise' ? retX : retX - sx * (backT / 2 + 0.005);
  for (let i = 0; i < rn; i++) {
    const cl = retInner / rn;
    const z = retStart + cl * (i + 0.5);
    parts.push(part(cushion(retSeatW, cushH, cl - 0.012, 0.05, 0.02), 'upholstery', [retSeatX, deckY + cushH / 2, z], { plan: 'cushion' }));
    if (kind !== 'chaise') {
      parts.push(
        part(cushion(0.2, h - seatH - 0.02, cl - 0.012, 0.06, 0.03), 'upholstery', [sx * (w / 2 - backT - 0.07), seatH + (h - seatH) / 2 - 0.02, z], {
          r: [0, 0, sx * 0.16],
          plan: 'cushion',
        }),
      );
    }
  }
  if (kind === 'U') {
    const ux = -sx * (w / 2 - sd / 2) + sx * (backT / 2 + 0.005);
    for (let i = 0; i < rn; i++) {
      const cl = retInner / rn;
      const z = retStart + cl * (i + 0.5);
      parts.push(part(cushion(retSeatW, cushH, cl - 0.012, 0.05, 0.02), 'upholstery', [ux, deckY + cushH / 2, z], { plan: 'cushion' }));
    }
  }
  // Pillows in the corner
  parts.push(part(cushion(0.5, 0.5, 0.15, 0.06, 0.035), 'pillows', [sx * (w / 2 - backT - 0.35), seatH + 0.22, -d / 2 + backT + 0.28], { r: [-0.3, sx * 0.6, 0], plan: false }));
  parts.push(part(cushion(0.46, 0.46, 0.14, 0.06, 0.035), 'accent', [-sx * (w / 2 - armW - 0.35), seatH + 0.2, -d / 2 + backT + 0.25], { r: [-0.3, 0, 0], plan: false }));

  parts.push(...legsFor(base, w - 0.001, sd, legH));
  if (base === 'legs' || base === 'metal') {
    parts.push(...fourLegs(sd, retLen, legH, { style: base === 'metal' ? 'metal' : 'tapered', inset: 0.06 }).map((p) => ({ ...p, p: [p.p[0] + retX, p.p[1], p.p[2] + -d / 2 + sd + retLen / 2] as V3 })));
  } else {
    parts.push(part(box(sd - 0.16, legH, retLen, 0.004), '$black', [retX, legH / 2, -d / 2 + sd + retLen / 2], { plan: 'hidden', noShadow: true }));
  }
  return { parts };
}

// ---------------------------------------------------------------------------
// Curved (crescent) sofa: arcs around a center in front of the sofa.

function arcPts(R0: number, R1: number, a0: number, a1: number, cz: number, seg = 40): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([Math.sin(a) * R1, cz - Math.cos(a) * R1]);
  }
  for (let i = seg; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([Math.sin(a) * R0, cz - Math.cos(a) * R0]);
  }
  return pts;
}

export function curvedSofa(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const sd = pr.seatDepth ?? Math.min(0.95, d * 0.85);
  const legH = pr.legH ?? 0.06;
  const seatH = pr.seatH ?? 0.42;
  const cushH = 0.16;
  const deckY = seatH - cushH;
  const backT = 0.2;
  // Choose radius so the chord equals w and total depth equals d.
  const half = w / 2;
  // outer arc sagitta s = d - sd (approx). R = (half^2 + s^2) / (2s)
  const s = Math.max(0.05, d - sd * 0.9);
  const R = (half * half + s * s) / (2 * s);
  const a = Math.asin(clamp(half / R, 0, 1));
  const cz = -d / 2 + R; // circle center z; outer arc apex at z = -d/2
  const parts: Part[] = [];
  const base = arcPts(R - sd, R, -a, a, cz);
  parts.push(part({ t: 'plate', pts: base, h: deckY - legH, bevel: 0.015 }, 'upholstery', [0, legH, 0], { plan: 'line' }));
  parts.push(part({ t: 'plate', pts: arcPts(R - backT, R, -a, a, cz), h: h - legH - 0.02, bevel: 0.05 }, 'upholstery', [0, legH, 0], { plan: 'line' }));
  const n = pr.seats ?? 3;
  const gap = 0.012 / R;
  for (let i = 0; i < n; i++) {
    const a0 = -a + ((2 * a) / n) * i + gap;
    const a1 = -a + ((2 * a) / n) * (i + 1) - gap;
    parts.push(part({ t: 'plate', pts: arcPts(R - sd + 0.02, R - backT - 0.005, a0, a1, cz, 16), h: cushH, bevel: 0.035 }, 'upholstery', [0, deckY - 0.01, 0], { plan: 'cushion' }));
  }
  // ends: rounded arm-less terminations — pillows
  const pa = a * 0.72;
  for (const sgn of [-1, 1]) {
    const px = Math.sin(sgn * pa) * (R - backT - 0.16);
    const pz = cz - Math.cos(sgn * pa) * (R - backT - 0.16);
    parts.push(part(cushion(0.46, 0.46, 0.14, 0.06, 0.035), 'pillows', [px, seatH + 0.2, pz], { r: [-0.25, -sgn * pa, 0], plan: false }));
  }
  if (legH > 0) parts.push(part({ t: 'plate', pts: arcPts(R - sd + 0.1, R - 0.1, -a * 0.95, a * 0.95, cz), h: legH }, '$black', [0, 0, 0], { plan: 'hidden', noShadow: true }));
  return { parts };
}

// ---------------------------------------------------------------------------
// Quilted modular (Camaleonda-like) and low pleated (Togo-like) seating.

export function quiltedModular(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const mod = pr.module ?? 0.96;
  const n = Math.max(1, Math.round(w / mod));
  const mw = w / n;
  const seatH = pr.seatH ?? 0.4;
  const baseH = seatH - 0.08;
  const parts: Part[] = [];
  const backD = pr.back === false ? 0 : 0.26;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + mw * (i + 0.5);
    parts.push(part(box(mw - 0.01, baseH, d, 0.05), 'upholstery', [x, baseH / 2, 0]));
    // quilted top: 2 × 2 puffs
    const q = 2;
    const pw = (mw - 0.02) / q;
    const pd = (d - backD - 0.02) / q;
    for (let a = 0; a < q; a++)
      for (let b = 0; b < q; b++)
        parts.push(
          part(cushion(pw - 0.004, 0.1, pd - 0.004, 0.04, 0.035), 'upholstery', [x - mw / 2 + 0.01 + pw * (a + 0.5), baseH + 0.035, -d / 2 + backD + 0.01 + pd * (b + 0.5)], {
            plan: 'cushion',
          }),
        );
    if (backD > 0) {
      // quilted back: 2 wide × 2 tall
      const bh = h - baseH;
      for (let a = 0; a < 2; a++)
        for (let b = 0; b < 2; b++)
          parts.push(
            part(cushion(pw - 0.004, bh / 2 - 0.004, backD, 0.05, 0.04), 'upholstery', [x - mw / 2 + 0.01 + pw * (a + 0.5), baseH + bh * (b + 0.5) / 2 - 0.01, -d / 2 + backD / 2], {
              r: [-0.06, 0, 0],
              plan: b === 1 ? 'cushion' : false,
            }),
          );
    }
  }
  if (pr.arms) {
    for (const sx of [-1, 1])
      parts.push(
        part({ t: 'cyl', rt: 0.13, rb: 0.13, h: d - 0.1, seg: 24 }, 'upholstery', [sx * (w / 2 - 0.12), baseH + 0.12, 0.02], { r: [Math.PI / 2, 0, 0], plan: 'line', planPts: rectPts(sx * (w / 2 - 0.12), 0.02, 0.26, d - 0.1) }),
      );
  }
  return { parts };
}

export function pleatedLounge(ctx: GenCtx): Built {
  // Togo / Pumpkin family: low, puffy, pleated, frameless.
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const seatH = pr.seatH ?? 0.36;
  const rolls = pr.rolls ?? 4;
  const arms = pr.arms ?? w < 1.2;
  // Seat: stacked slabs, the front one rounder.
  parts.push(part(cushion(w * 0.96, seatH * 0.55, d * 0.72, 0.1, 0.05), 'upholstery', [0, seatH * 0.28, d * 0.13]));
  parts.push(part(cushion(w * 0.94, seatH * 0.5, d * 0.66, 0.1, 0.06), 'upholstery', [0, seatH * 0.72, d * 0.15]));
  // Back: rolls rising and leaning back
  for (let i = 0; i < rolls; i++) {
    const t = i / (rolls - 1);
    const rr = (h - seatH * 0.4) / rolls / 1.4 + 0.04;
    const y = seatH * 0.4 + t * (h - seatH * 0.4 - rr);
    const z = -d / 2 + rr + (1 - t) * d * 0.22;
    parts.push(
      part(
        { t: 'cyl', rt: rr, rb: rr, h: w * (0.9 - t * 0.04), seg: 24 },
        'upholstery',
        [0, y + rr * 0.6, z],
        { r: [0, 0, Math.PI / 2], plan: i === rolls - 1 ? 'cushion' : false, planPts: rectPts(0, z, w * 0.9, rr * 2) },
      ),
    );
    parts.push(part(sph(rr * 1.02, rr * 1.02, rr * 1.02, 16), 'upholstery', [(w * (0.9 - t * 0.04)) / 2, y + rr * 0.6, z], { plan: false }));
    parts.push(part(sph(rr * 1.02, rr * 1.02, rr * 1.02, 16), 'upholstery', [-(w * (0.9 - t * 0.04)) / 2, y + rr * 0.6, z], { plan: false }));
  }
  if (arms) {
    for (const sx of [-1, 1])
      parts.push(part(cushion(0.2, seatH + 0.12, d * 0.8, 0.09, 0.05), 'upholstery', [sx * (w / 2 - 0.1), (seatH + 0.12) / 2, 0.02], { plan: 'line' }));
  }
  parts.push(part({ t: 'floor', w: w * 0.98, d: d * 0.98, r: 0.12, h: 0.001 }, 'upholstery', [0, 0, 0], { plan: 'line', noShadow: true }));
  return { parts };
}

// ---------------------------------------------------------------------------
// Lounge chairs

export function loungeChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'club';
  switch (style) {
    case 'club':
    case 'boxy':
      return clubChair(ctx, style === 'boxy');
    case 'barrel':
      return barrelChair(ctx);
    case 'slipper':
      return slipperChair(ctx);
    case 'jeanneret':
      return jeanneretChair(ctx);
    case 'spanish':
      return spanishChair(ctx);
    case 'papercord':
      return papercordChair(ctx);
    case 'eames':
      return eamesLounge(ctx);
    case 'womb':
    case 'egg':
      return shellChair(ctx, style);
    case 'wing':
      return wingChair(ctx);
    case 'barcelona':
      return barcelonaChair(ctx);
    case 'lc2':
      return lc2Chair(ctx);
    case 'pleated':
      return pleatedLounge(ctx);
    case 'swivel':
      return swivelChair(ctx);
    case 'rocker':
      return rockerChair(ctx);
    case 'glider':
      return gliderChair(ctx);
    case 'pacha':
      return pachaChair(ctx);
    case 'wire':
      return wireChair(ctx);
    default:
      return clubChair(ctx, false);
  }
  void w;
  void d;
  void h;
}

function clubChair(ctx: GenCtx, boxy: boolean): Built {
  const { w, d, h, params: pr } = ctx;
  const legH = pr.legH ?? (boxy ? 0.16 : 0.1);
  const seatH = pr.seatH ?? (boxy ? 0.4 : 0.42);
  const armW = pr.armW ?? (boxy ? 0.13 : 0.17);
  const armH = pr.armH ?? (boxy ? seatH + 0.16 : seatH + 0.2);
  const backT = boxy ? 0.2 : 0.2;
  const cushH = 0.14;
  const deckY = seatH - cushH;
  const parts: Part[] = [];
  const r = boxy ? 0.07 : 0.06;
  parts.push(part(box(w, deckY - legH, d, 0.04), 'upholstery', [0, (deckY + legH) / 2, 0]));
  // back — boxy chairs have a raked back
  parts.push(
    part(box(w - 0.001, h - legH, backT, r), 'upholstery', [0, (h + legH) / 2, -d / 2 + backT / 2 + (boxy ? 0.03 : 0)], {
      r: [boxy ? -0.14 : -0.03, 0, 0],
    }),
  );
  for (const sx of [-1, 1]) parts.push(part(box(armW, armH - legH, d, r), 'upholstery', [sx * (w / 2 - armW / 2), (armH + legH) / 2, 0]));
  const innerW = w - 2 * armW;
  parts.push(part(cushion(innerW - 0.01, cushH, d - backT - 0.03, 0.05, 0.025), 'upholstery', [0, deckY + cushH / 2, backT / 2 + 0.005], { plan: 'cushion' }));
  if (pr.backCushion !== false) {
    const bh = h - seatH - 0.02;
    parts.push(part(cushion(innerW - 0.02, bh, 0.16, 0.06, 0.035), 'upholstery', [0, seatH + bh / 2, -d / 2 + backT + 0.06], { r: [-0.2, 0, 0], plan: 'cushion' }));
  }
  if (pr.pillow) parts.push(part(cushion(0.42, 0.34, 0.12, 0.05, 0.03), 'pillows', [0, seatH + 0.2, -d / 2 + backT + 0.2], { r: [-0.3, 0, 0], plan: false }));
  const base: BaseStyle = pr.base ?? (boxy ? 'metal' : 'legs');
  parts.push(...legsFor(base, w, d, legH));
  return { parts };
}

function barrelChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const seatH = pr.seatH ?? 0.42;
  const legH = pr.legH ?? 0.08;
  const R = w / 2;
  const parts: Part[] = [];
  // wrapping back: 3/4 ring from the arms around the back
  const pts: [number, number][] = [];
  const outer = R;
  const inner = R - 0.16;
  const a0 = Math.PI * 0.28;
  const a1 = Math.PI * 1.72;
  const seg = 40;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([Math.sin(a) * outer, Math.cos(a) * outer * (d / w)]);
  }
  for (let i = seg; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([Math.sin(a) * inner, Math.cos(a) * inner * (d / w)]);
  }
  // back rises; arms are lower than the back: two plates
  parts.push(part({ t: 'plate', pts, h: seatH + 0.18 - legH, bevel: 0.05 }, 'upholstery', [0, legH, 0], { plan: 'line' }));
  const backPts = pts.filter((_, i) => {
    const k = i <= seg ? i : 2 * seg + 1 - i;
    return k > seg * 0.25 && k < seg * 0.75;
  });
  if (backPts.length > 4) parts.push(part({ t: 'plate', pts: backPts, h: h - (seatH + 0.18), bevel: 0.05 }, 'upholstery', [0, seatH + 0.16, 0], { plan: false }));
  parts.push(part({ t: 'plate', pts: ellipse(inner * 0.99, inner * (d / w) * 0.99), h: seatH - 0.14 - legH, bevel: 0.02 }, 'upholstery', [0, legH, 0], { plan: false }));
  parts.push(part({ t: 'plate', pts: ellipse(inner - 0.01, inner * (d / w) - 0.01), h: 0.13, bevel: 0.045 }, 'upholstery', [0, seatH - 0.15, 0.02], { plan: 'cushion' }));
  parts.push(part({ t: 'plate', pts: ellipse(R * 0.8, R * (d / w) * 0.8), h: legH }, pr.baseMat ?? 'legs', [0, 0, 0], { plan: 'hidden' }));
  return { parts };
}

function ellipse(rx: number, rz: number, seg = 40): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  return out;
}

function slipperChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const legH = pr.legH ?? 0.14;
  const seatH = pr.seatH ?? 0.42;
  const parts: Part[] = [];
  parts.push(part(cushion(w, seatH - legH, d, 0.05, 0.02), 'upholstery', [0, (seatH + legH) / 2, 0.02], { plan: 'cushion' }));
  parts.push(part(cushion(w, h - seatH + 0.05, 0.17, 0.07, 0.03), 'upholstery', [0, seatH + (h - seatH) / 2 - 0.02, -d / 2 + 0.1], { r: [-0.14, 0, 0] }));
  parts.push(...fourLegs(w, d, legH, { style: pr.legStyle ?? 'tapered', size: 0.04, inset: 0.04 }));
  return { parts };
}

function jeanneretChair(ctx: GenCtx): Built {
  // Chandigarh easy armchair: V/compass legs, cane back and seat, loose cushion.
  const { w, d, h, params: pr } = ctx;
  const seatH = pr.seatH ?? 0.38;
  const armH = seatH + 0.22;
  const parts: Part[] = [];
  const f = 'frame';
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.03);
    // compass legs: two slanted members forming an inverted V seen from the side
    parts.push(part(box(0.045, 0.62, 0.05, 0.008), f, [x, 0.3, d / 2 - 0.16], { r: [0.35, 0, 0], plan: 'hidden' }));
    parts.push(part(box(0.045, 0.72, 0.05, 0.008), f, [x, 0.34, -d / 2 + 0.18], { r: [-0.42, 0, 0], plan: 'hidden' }));
    // flat arm
    parts.push(part(box(0.075, 0.035, d * 0.95, 0.012), f, [x, armH, 0.0], { plan: 'line' }));
  }
  // seat frame rails + cane panel
  parts.push(part(box(w - 0.1, 0.04, 0.05, 0.006), f, [0, seatH - 0.1, d / 2 - 0.12], { plan: false }));
  parts.push(part(box(w - 0.1, 0.04, 0.05, 0.006), f, [0, seatH - 0.12, -d / 2 + 0.2], { plan: false }));
  parts.push(part(box(w - 0.1, 0.015, d - 0.34, 0.004), 'panel', [0, seatH - 0.1, 0.02], { r: [-0.05, 0, 0], plan: false }));
  // reclined cane back
  parts.push(part(box(w - 0.1, h - seatH + 0.05, 0.02, 0.004), 'panel', [0, seatH + (h - seatH) / 2 - 0.03, -d / 2 + 0.14], { r: [-0.32, 0, 0], plan: 'line' }));
  parts.push(part(box(w - 0.06, 0.045, 0.045, 0.008), f, [0, h - 0.03, -d / 2 + 0.06], { plan: false }));
  // loose seat cushion
  parts.push(part(cushion(w - 0.12, 0.09, d - 0.36, 0.035, 0.018), 'upholstery', [0, seatH - 0.04, 0.03], { r: [-0.05, 0, 0], plan: 'cushion' }));
  if (pr.backCushion)
    parts.push(part(cushion(w - 0.14, 0.4, 0.09, 0.035, 0.02), 'upholstery', [0, seatH + 0.2, -d / 2 + 0.2], { r: [-0.32, 0, 0], plan: false }));
  return { parts };
}

function spanishChair(ctx: GenCtx): Built {
  // Børge Mogensen: very wide flat arms, low leather sling.
  const { w, d, h, params: pr } = ctx;
  const armW = 0.15;
  const armH = pr.armH ?? 0.62;
  const seatH = 0.33;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - armW / 2);
    parts.push(part(box(armW, 0.045, d, 0.01), 'frame', [x, armH, 0], { plan: 'line' }));
    for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(part(box(0.055, armH, 0.055, 0.006), 'frame', [x, armH / 2, z], { plan: 'hidden' }));
    parts.push(part(box(0.04, 0.08, d - 0.1, 0.004), 'frame', [x, 0.12, 0], { plan: false }));
  }
  parts.push(part(box(w - armW * 2, 0.03, d * 0.72, 0.01), 'upholstery', [0, seatH, 0.04], { r: [-0.08, 0, 0], plan: 'cushion' }));
  parts.push(part(box(w - armW * 2, h - seatH, 0.03, 0.01), 'upholstery', [0, seatH + (h - seatH) / 2, -d / 2 + 0.12], { r: [-0.28, 0, 0], plan: false }));
  parts.push(part(box(w - armW * 2, 0.05, 0.05, 0.008), 'frame', [0, h - 0.04, -d / 2 + 0.03], { plan: false }));
  return { parts };
}

function papercordChair(ctx: GenCtx): Built {
  // Wegner CH25: wood frame with woven paper-cord seat and back.
  const { w, d, h } = ctx;
  const seatH = 0.35;
  const armH = 0.56;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.03);
    parts.push(part(box(0.04, armH, 0.045, 0.01), 'frame', [x, armH / 2, d / 2 - 0.05], { plan: 'hidden' }));
    parts.push(part(box(0.045, h, 0.05, 0.01), 'frame', [x, h / 2, -d / 2 + 0.1], { r: [-0.18, 0, 0], plan: 'hidden' }));
    parts.push(part(box(0.06, 0.035, d * 0.9, 0.012), 'frame', [x, armH, 0.02], { plan: 'line' }));
  }
  parts.push(part(box(w - 0.08, 0.035, d - 0.2, 0.01), 'seat', [0, seatH, 0.05], { r: [-0.1, 0, 0], plan: 'cushion' }));
  parts.push(part(box(w - 0.1, h - seatH - 0.05, 0.03, 0.01), 'seat', [0, seatH + (h - seatH) / 2, -d / 2 + 0.16], { r: [-0.25, 0, 0], plan: false }));
  return { parts };
}

function eamesLounge(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const tilt = -0.28;
  const seatY = 0.4;
  // aluminum star base
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
    parts.push(part(box(0.04, 0.03, 0.34, 0.01), '$chrome', [Math.sin(a) * 0.17, 0.05, Math.cos(a) * 0.17], { r: [0, a, 0], plan: 'thin' }));
  }
  parts.push(part(cyl(0.04, 0.05, 0.25, 16), '$black', [0, 0.18, 0], { plan: false }));
  // seat shell + cushion
  parts.push(part(box(w * 0.86, 0.035, d * 0.55, 0.03), 'shell', [0, seatY - 0.02, 0.1], { r: [tilt * 0.5, 0, 0], plan: 'line' }));
  parts.push(part(cushion(w * 0.84, 0.1, d * 0.52, 0.05, 0.03), 'upholstery', [0, seatY + 0.05, 0.1], { r: [tilt * 0.5, 0, 0], plan: 'cushion' }));
  // back shells and cushions (two stacked, reclined)
  parts.push(part(box(w * 0.82, 0.36, 0.035, 0.03), 'shell', [0, seatY + 0.28, -d / 2 + 0.2], { r: [tilt, 0, 0], plan: false }));
  parts.push(part(cushion(w * 0.8, 0.34, 0.1, 0.05, 0.03), 'upholstery', [0, seatY + 0.29, -d / 2 + 0.25], { r: [tilt, 0, 0], plan: 'cushion' }));
  parts.push(part(box(w * 0.7, 0.24, 0.035, 0.03), 'shell', [0, h - 0.13, -d / 2 + 0.07], { r: [tilt * 1.1, 0, 0], plan: false }));
  parts.push(part(cushion(w * 0.68, 0.22, 0.09, 0.05, 0.03), 'upholstery', [0, h - 0.12, -d / 2 + 0.12], { r: [tilt * 1.1, 0, 0], plan: false }));
  // armrests
  for (const sx of [-1, 1]) {
    parts.push(part(cushion(0.1, 0.06, d * 0.5, 0.025, 0.01), 'upholstery', [sx * (w / 2 - 0.06), seatY + 0.2, 0.02], { r: [tilt * 0.4, 0, 0], plan: 'line' }));
    parts.push(part(box(0.02, 0.24, 0.05, 0.005), '$black', [sx * (w / 2 - 0.06), seatY + 0.08, -0.05], { plan: false }));
  }
  if (pr.ottoman) {
    /* ottoman is its own catalog piece */
  }
  return { parts };
}

function shellChair(ctx: GenCtx, kind: string): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const seatH = pr.seatH ?? 0.42;
  const egg = kind === 'egg';
  // shell: lathe-like bowl approximated by scaled sphere halves
  parts.push(part(sph(w / 2, (h - seatH + 0.25) / 2, d / 2, 32), 'upholstery', [0, seatH + (h - seatH) / 2 - 0.05, -0.02], { plan: 'line' }));
  // carve the front by placing a seat cushion and inner back cushion (visual only)
  parts.push(part(cushion(w * 0.66, 0.12, d * 0.62, 0.06, 0.04), 'cushions', [0, seatH, d * 0.14], { plan: 'cushion' }));
  parts.push(part(cushion(w * 0.6, (h - seatH) * 0.7, 0.14, 0.07, 0.05), 'cushions', [0, seatH + (h - seatH) * 0.4, -d * 0.2], { r: [-0.2, 0, 0], plan: false }));
  if (egg) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(part(box(0.05, 0.02, 0.36, 0.008), '$chrome', [Math.sin(a) * 0.18, 0.02, Math.cos(a) * 0.18], { r: [0, a, 0], plan: 'thin' }));
    }
    parts.push(part(cyl(0.025, 0.025, seatH - 0.1, 12), '$chrome', [0, (seatH - 0.1) / 2, 0], { plan: false }));
  } else {
    parts.push(...fourLegs(w * 0.8, d * 0.8, seatH - 0.14, { style: 'metal', size: 0.05, mat: '$chrome', inset: 0.02 }));
  }
  return { parts };
}

function wingChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const legH = 0.12;
  const seatH = 0.42;
  const parts: Part[] = [];
  parts.push(part(box(w * 0.86, seatH - 0.12 - legH, d * 0.92, 0.04), 'upholstery', [0, (seatH - 0.12 + legH) / 2, 0.02]));
  parts.push(part(cushion(w * 0.66, 0.12, d * 0.7, 0.05, 0.03), 'upholstery', [0, seatH - 0.06, 0.1], { plan: 'cushion' }));
  parts.push(part(box(w * 0.8, h - legH, 0.18, 0.06), 'upholstery', [0, (h + legH) / 2, -d / 2 + 0.12], { r: [-0.1, 0, 0] }));
  for (const sx of [-1, 1]) {
    // wings: tall sides flaring
    parts.push(part(box(0.16, h * 0.6, d * 0.55, 0.07), 'upholstery', [sx * (w / 2 - 0.1), h * 0.62, -d * 0.12], { r: [0, sx * 0.25, 0], plan: 'line' }));
    parts.push(part(box(0.14, seatH + 0.18 - legH, d * 0.8, 0.05), 'upholstery', [sx * (w / 2 - 0.08), (seatH + 0.18 + legH) / 2, 0.04]));
    if (pr.woodArms) parts.push(part(box(0.06, 0.05, 0.14, 0.02), 'legs', [sx * (w / 2 - 0.07), seatH + 0.2, d / 2 - 0.1], { plan: false }));
  }
  parts.push(...fourLegs(w * 0.86, d * 0.86, legH, { style: 'tapered', size: 0.045 }));
  return { parts };
}

function barcelonaChair(ctx: GenCtx): Built {
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.04);
    parts.push(part({ t: 'tube', pts: [[x, 0.02, d / 2 - 0.02], [x, 0.3, 0.05], [x, h - 0.02, -d / 2 + 0.08]], r: 0.011, smooth: true }, '$chrome', [0, 0, 0], { plan: 'thin' }));
    parts.push(part({ t: 'tube', pts: [[x, 0.02, -d / 2 + 0.05], [x, 0.3, 0.02], [x, 0.38, d / 2 - 0.08]], r: 0.011, smooth: true }, '$chrome', [0, 0, 0], { plan: false }));
  }
  const tufts = 'upholstery';
  parts.push(part(cushion(w - 0.1, 0.1, d * 0.66, 0.03, 0.02), tufts, [0, 0.38, 0.08], { r: [-0.08, 0, 0], plan: 'cushion' }));
  parts.push(part(cushion(w - 0.1, h * 0.6, 0.1, 0.03, 0.02), tufts, [0, 0.62, -d / 2 + 0.16], { r: [-0.35, 0, 0], plan: false }));
  return { parts };
}

function lc2Chair(ctx: GenCtx): Built {
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  const legH = 0.1;
  // tubular cage
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) parts.push(part(cyl(0.012, 0.012, h - 0.02, 12), '$chrome', [sx * (w / 2 - 0.012), h / 2, sz * (d / 2 - 0.012)], { plan: false }));
  for (const y of [legH, h - 0.12]) {
    parts.push(part({ t: 'tube', pts: [[-w / 2 + 0.012, y, -d / 2 + 0.012], [w / 2 - 0.012, y, -d / 2 + 0.012], [w / 2 - 0.012, y, d / 2 - 0.012], [-w / 2 + 0.012, y, d / 2 - 0.012]], r: 0.012, closed: true }, '$chrome', [0, 0, 0], { plan: y === legH ? 'thin' : false }));
  }
  parts.push(part(cushion(w - 0.06, 0.2, d - 0.06, 0.03, 0.01), 'upholstery', [0, legH + 0.2, 0.0], { plan: 'cushion' }));
  parts.push(part(cushion(w - 0.06, h - legH - 0.3, 0.2, 0.03, 0.01), 'upholstery', [0, legH + 0.3 + (h - legH - 0.3) / 2, -d / 2 + 0.12], { plan: 'cushion' }));
  for (const sx of [-1, 1]) parts.push(part(cushion(0.18, h - legH - 0.32, d - 0.28, 0.03, 0.01), 'upholstery', [sx * (w / 2 - 0.11), legH + 0.3 + (h - legH - 0.32) / 2, 0.1], { plan: 'cushion' }));
  return { parts };
}

function swivelChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const seatH = pr.seatH ?? 0.42;
  const parts: Part[] = [];
  const baseR = Math.min(w, d) * 0.32;
  parts.push(part(cyl(baseR, baseR, 0.05, 32), pr.baseMat ?? 'legs', [0, 0.025, 0], { plan: 'hidden' }));
  parts.push(part(cyl(0.05, 0.05, 0.12, 16), '$black', [0, 0.1, 0], { plan: false }));
  parts.push(part(cushion(w, seatH - 0.28, d, Math.min(w, d) * 0.3, 0.02), 'upholstery', [0, 0.16 + (seatH - 0.28) / 2, 0], { plan: 'line' }));
  parts.push(part(cushion(w * 0.78, 0.14, d * 0.62, 0.12, 0.03), 'upholstery', [0, seatH - 0.05, 0.08], { plan: 'cushion' }));
  // curved back: partial torus lying flat raised up
  parts.push(part({ t: 'torus', r: Math.min(w, d) * 0.38, tube: 0.1, arc: Math.PI * 1.3 }, 'upholstery', [0, seatH + 0.08, 0], { r: [0, Math.PI * 0.85, 0], plan: false }));
  parts.push(part({ t: 'torus', r: Math.min(w, d) * 0.36, tube: 0.09, arc: Math.PI * 0.9 }, 'upholstery', [0, h - 0.1, -0.03], { r: [0, Math.PI * 1.05, 0], plan: false }));
  return { parts };
}

function rockerChair(ctx: GenCtx): Built {
  // Wegner J16-style rocking chair with spindle back.
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  const seatH = 0.42;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.03);
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const z = -d / 2 + t * d;
      pts.push([x, 0.02 + 0.08 * Math.pow(2 * t - 1, 2), z]);
    }
    parts.push(part({ t: 'tube', pts, r: 0.018, smooth: true }, 'frame', [0, 0, 0], { plan: 'thin' }));
    parts.push(part(box(0.035, seatH, 0.035, 0.006), 'frame', [x, seatH / 2 + 0.04, d * 0.18], { plan: false }));
    parts.push(part(box(0.035, h - 0.05, 0.035, 0.006), 'frame', [x, h / 2, -d * 0.22], { r: [-0.2, 0, 0], plan: false }));
    parts.push(part(box(0.05, 0.03, d * 0.5, 0.01), 'frame', [x, seatH + 0.2, 0.02], { plan: false }));
  }
  parts.push(part(box(w - 0.06, 0.03, d * 0.42, 0.01), 'seat', [0, seatH, 0.03], { plan: 'cushion' }));
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.08 + ((w - 0.16) * i) / 8;
    parts.push(part(cyl(0.008, 0.008, h - seatH - 0.1, 8), 'frame', [x, seatH + (h - seatH) / 2, -d * 0.26], { r: [-0.2, 0, 0], plan: false }));
  }
  parts.push(part(box(w - 0.04, 0.05, 0.04, 0.01), 'frame', [0, h - 0.06, -d * 0.33], { plan: false }));
  return { parts };
}

function gliderChair(ctx: GenCtx): Built {
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  parts.push(part(box(w * 0.8, 0.05, d * 0.8, 0.02), '$black', [0, 0.025, 0], { plan: 'hidden' }));
  const c = clubChair({ ...ctx, params: { ...ctx.params, legH: 0.14, base: 'plinth', armW: 0.16 } }, false);
  c.parts.forEach((p) => parts.push(p));
  void w;
  void h;
  return { parts };
}

function pachaChair(ctx: GenCtx): Built {
  // Pierre Paulin Pacha: a floor-hugging rounded seat with a curved back.
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  parts.push(part(cushion(w * 0.94, 0.3, d * 0.8, 0.14, 0.05), 'upholstery', [0, 0.15, d * 0.08], { plan: 'line' }));
  parts.push(part({ t: 'torus', r: Math.min(w, d) * 0.3, tube: 0.13, arc: Math.PI }, 'upholstery', [0, h - 0.18, -d * 0.12], { r: [0.35, Math.PI, 0], plan: false }));
  parts.push(part(cushion(w * 0.66, h - 0.2, 0.2, 0.1, 0.05), 'upholstery', [0, 0.3 + (h - 0.3) / 2, -d / 2 + 0.16], { r: [-0.25, 0, 0], plan: 'cushion' }));
  return { parts };
}

function wireChair(ctx: GenCtx): Built {
  // Bertoia diamond: a wire shell on a sled base, with a seat pad.
  const { w, d, h } = ctx;
  const parts: Part[] = [];
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = Math.PI * (0.1 + 0.8 * t);
    pts.push([-Math.cos(a) * w / 2, 0.35 + Math.sin(a) * (h - 0.35) * 0.9, -Math.sin(a) * d * 0.25 + 0.05]);
  }
  for (let k = 0; k < 7; k++) {
    const yy = k * 0.06;
    parts.push(part({ t: 'tube', pts: pts.map(([x, y, z]) => [x * (1 - k * 0.05), y - yy, z + k * 0.03] as [number, number, number]), r: 0.004, smooth: true }, '$chrome', [0, 0, 0], { plan: k === 0 ? 'thin' : false }));
  }
  parts.push(part(cushion(w * 0.6, 0.05, d * 0.5, 0.03, 0.01), 'upholstery', [0, 0.4, 0.05], { plan: 'cushion' }));
  for (const sx of [-1, 1]) parts.push(part({ t: 'tube', pts: [[sx * 0.2, 0.01, -d / 2 + 0.1], [sx * 0.2, 0.01, d / 2 - 0.1], [sx * 0.15, 0.34, 0.1]], r: 0.007 }, '$chrome', [0, 0, 0], { plan: false }));
  return { parts };
}

// ---------------------------------------------------------------------------
// Ottomans, poufs, benches, daybeds

export function ottoman(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'box';
  const parts: Part[] = [];
  if (style === 'round' || style === 'pouf') {
    const r = Math.min(w, d) / 2;
    if (style === 'pouf') parts.push(part(sph(r, h / 2, r, 32), 'upholstery', [0, h / 2, 0], { plan: 'line', planCircle: r }));
    else parts.push(part({ t: 'plate', pts: ellipse(r, r * (d / w)), h, bevel: 0.03 }, 'upholstery', [0, 0, 0], { plan: 'line' }));
  } else if (style === 'eames') {
    parts.push(part(box(w * 0.9, 0.035, d * 0.9, 0.03), 'shell', [0, h - 0.1, 0], { plan: 'line' }));
    parts.push(part(cushion(w * 0.88, 0.1, d * 0.88, 0.04, 0.03), 'upholstery', [0, h - 0.05, 0], { plan: 'cushion' }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(part(box(0.035, 0.03, 0.26, 0.01), '$chrome', [Math.sin(a) * 0.12, 0.04, Math.cos(a) * 0.12], { r: [0, a, 0], plan: false }));
    }
    parts.push(part(cyl(0.035, 0.04, h - 0.15, 16), '$black', [0, (h - 0.15) / 2 + 0.04, 0], { plan: false }));
  } else {
    const legH = pr.legH ?? 0.06;
    parts.push(part(cushion(w, h - legH, d, 0.05, 0.02), 'upholstery', [0, legH + (h - legH) / 2, 0], { plan: 'line' }));
    if (legH > 0) parts.push(...fourLegs(w, d, legH, { style: 'round', size: 0.04, inset: 0.05 }));
  }
  return { parts };
}

export function bench(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const top: string = pr.top ?? 'upholstered';
  const parts: Part[] = [];
  const topH = top === 'upholstered' ? 0.1 : 0.04;
  if (top === 'upholstered') parts.push(part(cushion(w, topH, d, 0.03, 0.015), 'upholstery', [0, h - topH / 2, 0], { plan: 'line' }));
  else if (top === 'woven') {
    parts.push(part(box(w, 0.035, d, 0.01), 'frame', [0, h - 0.0175, 0], { plan: 'line' }));
    parts.push(part(box(w - 0.08, 0.012, d - 0.06, 0.003), 'seat', [0, h + 0.002, 0], { plan: 'thin' }));
  } else parts.push(part(box(w, topH, d, 0.008), 'frame', [0, h - topH / 2, 0], { plan: 'line' }));
  const legStyle = pr.legs ?? 'square';
  if (legStyle === 'panel') {
    for (const sx of [-1, 1]) parts.push(part(box(0.04, h - topH, d, 0.006), 'frame', [sx * (w / 2 - 0.08), (h - topH) / 2, 0], { plan: 'hidden' }));
  } else {
    parts.push(...fourLegs(w, d, h - topH, { style: legStyle, size: 0.04, inset: 0.04, mat: 'frame' }));
    parts.push(part(box(w - 0.12, 0.03, 0.02, 0.004), 'frame', [0, 0.12, 0], { plan: false }));
  }
  return { parts };
}

export function daybed(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const legH = pr.legH ?? 0.2;
  const parts: Part[] = [];
  parts.push(part(box(w, 0.06, d, 0.01), 'frame', [0, legH + 0.03, 0], { plan: 'line' }));
  parts.push(...fourLegs(w, d, legH, { style: pr.legStyle ?? 'square', size: 0.05, inset: 0.05, mat: 'frame' }));
  parts.push(part(cushion(w - 0.02, h - legH - 0.06, d - 0.02, 0.03, 0.015), 'upholstery', [0, legH + 0.06 + (h - legH - 0.06) / 2, 0], { plan: 'cushion' }));
  if (pr.bolster !== false)
    parts.push(part({ t: 'cyl', rt: 0.1, rb: 0.1, h: d - 0.06, seg: 24 }, 'upholstery', [-w / 2 + 0.14, h + 0.08, 0], { r: [Math.PI / 2, 0, 0], plan: 'cushion', planPts: rectPts(-w / 2 + 0.14, 0, 0.2, d - 0.06) }));
  return { parts };
}

// ---------------------------------------------------------------------------
// Dining chairs

export function diningChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'upholstered';
  const seatH = pr.seatH ?? 0.46;
  const parts: Part[] = [];
  if (style === 'wishbone') {
    // CH24: curved top rail, Y-back splat, paper-cord seat
    for (const sx of [-1, 1]) {
      parts.push(part(cyl(0.017, 0.014, seatH, 12), 'frame', [sx * (w / 2 - 0.04), seatH / 2, d / 2 - 0.05], { plan: 'hidden' }));
      parts.push(part(cyl(0.017, 0.014, h - 0.02, 12), 'frame', [sx * (w / 2 - 0.06), (h - 0.02) / 2, -d / 2 + 0.07], { r: [-0.1, 0, 0], plan: 'hidden' }));
    }
    parts.push(part({ t: 'torus', r: w * 0.42, tube: 0.016, arc: Math.PI }, 'frame', [0, h - 0.06, -d / 2 + 0.2], { r: [0, Math.PI, 0], plan: 'thin' }));
    parts.push(part(box(0.1, 0.24, 0.015, 0.005), 'frame', [0, seatH + 0.14, -d / 2 + 0.1], { r: [-0.12, 0, 0], plan: false }));
    parts.push(part(box(w - 0.06, 0.03, d - 0.08, 0.01), 'seat', [0, seatH, 0.01], { plan: 'cushion' }));
    return { parts };
  }
  if (style === 'cane') {
    // Jeanneret office chair: V legs, cane seat and curved cane back
    for (const sx of [-1, 1]) {
      parts.push(part(box(0.04, seatH + 0.26, 0.045, 0.008), 'frame', [sx * (w / 2 - 0.03), (seatH + 0.2) / 2, 0.02], { r: [0.3, 0, 0], plan: 'hidden' }));
      parts.push(part(box(0.04, seatH + 0.1, 0.045, 0.008), 'frame', [sx * (w / 2 - 0.03), (seatH + 0.05) / 2, 0.04], { r: [-0.32, 0, 0], plan: 'hidden' }));
      parts.push(part(box(0.05, 0.03, d * 0.7, 0.01), 'frame', [sx * (w / 2 - 0.03), seatH + 0.2, -0.02], { plan: 'line' }));
    }
    parts.push(part(box(w - 0.08, 0.03, d - 0.12, 0.008), 'seat', [0, seatH, 0.03], { plan: 'cushion' }));
    parts.push(part({ t: 'torus', r: w * 0.45, tube: 0.05, arc: Math.PI * 0.8 }, 'seat', [0, seatH + 0.26, 0.05], { r: [0, Math.PI * 1.1, 0], plan: false }));
    return { parts };
  }
  if (style === 'shell') {
    parts.push(part(cushion(w, 0.05, d * 0.8, 0.12, 0.01), 'shell', [0, seatH, 0.04], { plan: 'line' }));
    parts.push(part(cushion(w * 0.92, h - seatH, 0.04, 0.12, 0.01), 'shell', [0, seatH + (h - seatH) / 2, -d / 2 + 0.08], { r: [-0.15, 0, 0], plan: false }));
    parts.push(...fourLegs(w * 0.85, d * 0.75, seatH - 0.02, { style: 'splay', size: 0.035, inset: 0.02, mat: 'frame' }));
    return { parts };
  }
  if (style === 'bentwood') {
    parts.push(part({ t: 'plate', pts: ellipse(w / 2 - 0.01, d / 2 - 0.04), h: 0.03, bevel: 0.008 }, 'seat', [0, seatH - 0.03, 0.02], { plan: 'cushion' }));
    parts.push(...fourLegs(w * 0.9, d * 0.8, seatH - 0.03, { style: 'splay', size: 0.03, mat: 'frame' }));
    parts.push(part({ t: 'torus', r: w * 0.32, tube: 0.012, arc: Math.PI * 2 }, 'frame', [0, h - 0.18, -d / 2 + 0.08], { r: [Math.PI / 2 - 0.1, 0, 0], plan: false }));
    return { parts };
  }
  // upholstered (the default) or 'cab' leather
  const legH = seatH - 0.07;
  parts.push(part(cushion(w - 0.02, 0.08, d - 0.04, 0.03, 0.01), 'upholstery', [0, seatH - 0.04, 0.02], { plan: 'cushion' }));
  parts.push(part(cushion(w - 0.04, h - seatH - 0.02, 0.06, 0.03, 0.012), style === 'cab' ? 'upholstery' : 'upholstery', [0, seatH + (h - seatH) / 2, -d / 2 + 0.05], { r: [-0.1, 0, 0], plan: 'line' }));
  parts.push(...fourLegs(w, d, legH, { style: style === 'cab' ? 'square' : 'tapered', size: 0.035, inset: 0.02, mat: 'frame' }));
  parts.push(part(box(w - 0.02, 0.05, d - 0.04, 0.01), 'frame', [0, legH - 0.01, 0.02], { plan: 'line' }));
  if (pr.backFrame !== false)
    for (const sx of [-1, 1]) parts.push(part(box(0.035, h - legH, 0.035, 0.008), 'frame', [sx * (w / 2 - 0.03), legH + (h - legH) / 2, -d / 2 + 0.03], { r: [-0.1, 0, 0], plan: false }));
  return { parts };
}

export function officeChair(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const parts: Part[] = [];
  const seatH = 0.47;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(part(box(0.04, 0.03, 0.32, 0.01), pr.baseMat ?? '$chrome', [Math.sin(a) * 0.16, 0.07, Math.cos(a) * 0.16], { r: [0, a, 0], plan: 'thin' }));
    parts.push(part(sph(0.025), '$black', [Math.sin(a) * 0.31, 0.03, Math.cos(a) * 0.31], { plan: false }));
  }
  parts.push(part(cyl(0.025, 0.025, seatH - 0.12, 12), '$chrome', [0, (seatH - 0.12) / 2 + 0.08, 0], { plan: false }));
  parts.push(part(cushion(w * 0.8, 0.07, d * 0.7, 0.05, 0.015), 'upholstery', [0, seatH, 0.05], { plan: 'cushion' }));
  parts.push(part(cushion(w * 0.74, h - seatH - 0.1, 0.06, 0.06, 0.015), 'upholstery', [0, seatH + (h - seatH) / 2 + 0.02, -d / 2 + 0.1], { r: [-0.12, 0, 0], plan: 'line' }));
  for (const sx of [-1, 1]) parts.push(part(box(0.04, 0.03, 0.3, 0.01), '$black', [sx * (w / 2 - 0.05), seatH + 0.22, 0.02], { plan: false }));
  return { parts };
}
