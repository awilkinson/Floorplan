import { blobPts, box, cyl, ellipsePts, fourLegs, part, racetrackPts, roundedRectPts, sph, type Built, type GenCtx, type Part, type V3 } from '../parts';
import { bookRow, objects, tableStyling } from './decor';

type Shape = 'rect' | 'round' | 'oval' | 'racetrack' | 'square' | 'blob' | 'noguchi' | 'rounded';

function topPts(shape: Shape, w: number, d: number, seed: number, r = 0.01): [number, number][] {
  switch (shape) {
    case 'round':
      return ellipsePts(w / 2, d / 2, 64);
    case 'oval':
      return ellipsePts(w / 2, d / 2, 64);
    case 'racetrack':
      return racetrackPts(w, d, 20);
    case 'blob':
      return blobPts(w, d, seed, 0.14);
    case 'noguchi': {
      // rounded triangle, like the Noguchi glass top
      const pts: [number, number][] = [];
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const k = 1 + 0.18 * Math.cos(3 * a + 0.4);
        pts.push([(Math.cos(a) * w * k) / 2 / 1.18, (Math.sin(a) * d * k) / 2 / 1.18]);
      }
      return pts;
    }
    case 'rounded':
      return roundedRectPts(w, d, Math.min(w, d) * 0.22, 8);
    default:
      return roundedRectPts(w, d, r, 3);
  }
}

export function table(ctx: GenCtx): Built {
  const { w, d, h, params: pr, seed } = ctx;
  const shape: Shape = pr.shape ?? 'rect';
  const base: string = pr.base ?? 'legs';
  const topT = pr.topT ?? (h < 0.5 ? 0.035 : 0.03);
  const parts: Part[] = [];
  const topY = h - topT;
  const edge = pr.edge ?? 0.006;
  const round = shape === 'round' || shape === 'oval';

  // Top
  if (shape === 'rect' || shape === 'square') {
    parts.push(part(box(w, topT, d, Math.max(0.002, edge)), 'top', [0, topY + topT / 2, 0], { plan: 'line' }));
  } else {
    parts.push(part({ t: 'plate', pts: topPts(shape, w, d, seed), h: topT, bevel: Math.min(edge, topT / 3) }, 'top', [0, topY, 0], { plan: 'line' }));
  }

  const legH = topY - (pr.apron ? 0.08 : 0);
  const legMat = 'base';
  switch (base) {
    case 'legs':
    case 'square':
      parts.push(...fourLegs(w, d, topY, { style: 'square', size: pr.legW ?? 0.05, inset: pr.inset ?? 0.04, mat: legMat }));
      break;
    case 'tapered':
      parts.push(...fourLegs(round ? w * 0.72 : w, round ? d * 0.72 : d, topY, { style: 'tapered', size: pr.legW ?? 0.05, inset: pr.inset ?? 0.07, mat: legMat }));
      break;
    case 'splay':
      parts.push(...fourLegs(round ? w * 0.7 : w, round ? d * 0.7 : d, topY, { style: 'splay', size: pr.legW ?? 0.045, inset: pr.inset ?? 0.09, mat: legMat }));
      break;
    case 'metal':
      parts.push(...fourLegs(w, d, topY, { style: 'metal', size: pr.legW ?? 0.04, inset: pr.inset ?? 0.03, mat: legMat }));
      break;
    case 'pedestal': {
      const col = Math.min(w, d) * 0.12;
      parts.push(part(cyl(col, col * 1.05, topY - 0.03, 32), legMat, [0, (topY - 0.03) / 2 + 0.03, 0], { plan: 'hidden' }));
      parts.push(part(cyl(Math.min(w, d) * 0.32, Math.min(w, d) * 0.34, 0.03, 40), legMat, [0, 0.015, 0], { plan: 'hidden' }));
      break;
    }
    case 'column': {
      // chunky drum pedestal (plaster or stone)
      const col = Math.min(w, d) * (pr.colR ?? 0.22);
      parts.push(part(cyl(col, col, topY, 40), legMat, [0, topY / 2, 0], { plan: 'hidden' }));
      break;
    }
    case 'tulip': {
      const R = Math.min(w, d) * 0.3;
      parts.push(
        part(
          {
            t: 'lathe',
            seg: 48,
            pts: [
              [0.001, 0],
              [R, 0],
              [R * 0.98, 0.02],
              [R * 0.55, 0.06],
              [R * 0.22, 0.18],
              [0.05, topY * 0.55],
              [0.055, topY * 0.8],
              [0.12, topY - 0.005],
              [0.001, topY - 0.005],
            ],
          },
          legMat,
          [0, 0, 0],
          { plan: 'hidden' },
        ),
      );
      break;
    }
    case 'conic': {
      parts.push(part(cyl(0.12, Math.min(w, d) * 0.22, topY, 40), legMat, [0, topY / 2, 0], { plan: 'hidden' }));
      break;
    }
    case 'trestle': {
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.25);
        parts.push(part(box(0.07, topY - 0.06, d * 0.2, 0.006), legMat, [x, (topY - 0.06) / 2 + 0.05, 0], { plan: 'hidden' }));
        parts.push(part(box(0.09, 0.05, d * 0.78, 0.01), legMat, [x, 0.025, 0], { plan: 'hidden' }));
        parts.push(part(box(0.09, 0.05, d * 0.7, 0.01), legMat, [x, topY - 0.025, 0], { plan: 'hidden' }));
      }
      parts.push(part(box(w - 0.5, 0.06, 0.05, 0.006), legMat, [0, topY * 0.35, 0], { plan: false }));
      break;
    }
    case 'plinth':
    case 'block': {
      const k = pr.plinthInset ?? 0.14;
      if (round) parts.push(part({ t: 'plate', pts: ellipsePts(w / 2 - k, d / 2 - k, 48), h: topY }, legMat, [0, 0, 0], { plan: 'hidden' }));
      else parts.push(part(box(w - 2 * k, topY, d - 2 * k, 0.004), legMat, [0, topY / 2, 0], { plan: 'hidden' }));
      break;
    }
    case 'drum': {
      if (round || shape === 'blob') parts.push(part({ t: 'plate', pts: topPts(shape, w * 0.985, d * 0.985, seed), h: topY }, legMat, [0, 0, 0], { plan: 'hidden' }));
      else parts.push(part(box(w * 0.985, topY, d * 0.985, 0.01), legMat, [0, topY / 2, 0], { plan: 'hidden' }));
      break;
    }
    case 'cylinders': {
      // Mangiarotti-like: two or three sculptural cylinders
      const n = pr.cylinders ?? 2;
      const rr = Math.min(w, d) * 0.16;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -w * 0.25 + (w * 0.5 * i) / (n - 1);
        parts.push(part(cyl(rr * 0.8, rr, topY, 32), legMat, [x, topY / 2, 0], { plan: 'hidden' }));
      }
      break;
    }
    case 'panel': {
      for (const sx of [-1, 1]) parts.push(part(box(pr.panelT ?? 0.05, topY, d * 0.9, 0.004), legMat, [sx * (w / 2 - 0.1), topY / 2, 0], { plan: 'hidden' }));
      break;
    }
    case 'waterfall': {
      for (const sx of [-1, 1]) parts.push(part(box(topT, topY, d, 0.003), 'top', [sx * (w / 2 - topT / 2), topY / 2, 0], { plan: 'line' }));
      break;
    }
    case 'platner': {
      const R = Math.min(w, d) * 0.46;
      const n = 48;
      const inst: { p: V3; r?: V3; s?: V3 }[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const tw = Math.sin(a * 3) * 0.1;
        inst.push({ p: [Math.cos(a) * R * 0.7, topY / 2, Math.sin(a) * R * 0.7], r: [Math.sin(a) * 0.25 + tw, 0, -Math.cos(a) * 0.25], s: [1, 1, 1] });
      }
      parts.push(part(cyl(0.003, 0.003, topY, 6), '$nickel', [0, 0, 0], { inst, plan: false }));
      parts.push(part({ t: 'torus', r: R * 0.52, tube: 0.008 }, '$nickel', [0, 0.01, 0], { plan: false }));
      parts.push(part({ t: 'torus', r: R * 0.92, tube: 0.006 }, '$nickel', [0, topY - 0.01, 0], { plan: false }));
      break;
    }
    case 'e1027': {
      const R = Math.min(w, d) / 2;
      parts.push(part({ t: 'tube', pts: [[0, 0.01, -R * 0.9], [0, 0.01, R * 0.2], [-R * 0.55, 0.01, R * 0.9], [R * 0.55, 0.01, R * 0.9]], r: 0.009 }, '$chrome', [0, 0, 0], { plan: false }));
      parts.push(part(cyl(0.01, 0.01, topY, 12), '$chrome', [0, topY / 2, -R * 0.9], { plan: false }));
      parts.push(part({ t: 'torus', r: R * 0.98, tube: 0.008 }, '$chrome', [0, topY - 0.002, 0], { plan: false }));
      break;
    }
    case 'noguchi': {
      // two interlocking curved wood forms
      parts.push(part(box(w * 0.6, topY, 0.04, 0.02), legMat, [-w * 0.08, topY / 2, 0.05], { r: [0, 0.5, 0], plan: 'hidden' }));
      parts.push(part(box(w * 0.55, topY, 0.04, 0.02), legMat, [w * 0.1, topY / 2, -0.04], { r: [0, -0.7, 0], plan: 'hidden' }));
      break;
    }
    case 'x': {
      parts.push(part(box(Math.hypot(w, d) * 0.7, topY, 0.04, 0.004), legMat, [0, topY / 2, 0], { r: [0, Math.atan2(d, w), 0], plan: 'hidden' }));
      parts.push(part(box(Math.hypot(w, d) * 0.7, topY, 0.04, 0.004), legMat, [0, topY / 2, 0], { r: [0, -Math.atan2(d, w), 0], plan: 'hidden' }));
      break;
    }
    case 'hairpin': {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          parts.push(part({ t: 'tube', pts: [[sx * (w / 2 - 0.06), topY, sz * (d / 2 - 0.05)], [sx * (w / 2 - 0.1), 0.005, sz * (d / 2 - 0.08)], [sx * (w / 2 - 0.14), topY, sz * (d / 2 - 0.05)]], r: 0.006 }, legMat, [0, 0, 0], { plan: false }));
      break;
    }
    case 'sawhorse': {
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.2);
        parts.push(part(box(0.05, topY * 1.05, 0.05, 0.005), legMat, [x, topY / 2, -d * 0.2], { r: [0.22, 0, 0], plan: false }));
        parts.push(part(box(0.05, topY * 1.05, 0.05, 0.005), legMat, [x, topY / 2, d * 0.2], { r: [-0.22, 0, 0], plan: false }));
      }
      parts.push(part(box(w - 0.3, 0.05, 0.05, 0.005), legMat, [0, topY - 0.08, 0], { plan: false }));
      break;
    }
  }

  if (pr.apron) {
    if (round) parts.push(part({ t: 'plate', pts: ellipsePts(w / 2 - 0.05, d / 2 - 0.05, 48), h: 0.07 }, legMat, [0, topY - 0.07, 0], { plan: false }));
    else parts.push(part(box(w - 0.08, 0.07, d - 0.08, 0.003), legMat, [0, topY - 0.035, 0], { plan: false }));
  }
  if (pr.shelf) {
    parts.push(part(box(w - 0.1, 0.02, d - 0.1, 0.003), 'top', [0, h * 0.22, 0], { plan: false }));
  }
  if (pr.drawer) {
    parts.push(part(box(w * 0.4, 0.08, d * 0.85, 0.004), 'top', [w * 0.2, topY - 0.04, 0], { plan: false }));
    parts.push(part(box(0.1, 0.012, 0.012, 0.004), '$brassDecor', [w * 0.2, topY - 0.04, d * 0.425 + 0.006], { plan: false }));
  }
  const styling = pr.styling ?? 'none';
  if (styling !== 'none') parts.push(...tableStyling(w, d, h, seed, styling));
  return { parts };
}

// ---------------------------------------------------------------------------
// Storage: credenzas, sideboards, consoles, bookcases, dressers, toy shelves.

export function storage(ctx: GenCtx): Built {
  const { w, d, h, params: pr, seed } = ctx;
  const kind: string = pr.kind ?? 'credenza';
  const legs: string = pr.legs ?? (kind === 'bookcase' ? 'plinth' : 'legs');
  const legH = legs === 'none' ? 0 : legs === 'plinth' ? 0.06 : pr.legH ?? 0.14;
  const parts: Part[] = [];
  const bodyH = h - legH;
  const T = 0.018;

  if (kind === 'bookcase' || kind === 'open' || kind === 'record' || kind === 'toy-shelf') {
    const shelves = pr.shelves ?? Math.max(1, Math.round(bodyH / 0.34));
    const cols = pr.cols ?? Math.max(1, Math.round(w / 0.8));
    // carcass: sides, top, bottom, back
    for (const sx of [-1, 1]) parts.push(part(box(T, bodyH, d, 0.002), 'body', [sx * (w / 2 - T / 2), legH + bodyH / 2, 0], { plan: 'line' }));
    parts.push(part(box(w, T, d, 0.002), 'body', [0, legH + bodyH - T / 2, 0], { plan: 'line' }));
    parts.push(part(box(w, T, d, 0.002), 'body', [0, legH + T / 2, 0], { plan: false }));
    parts.push(part(box(w - 2 * T, bodyH - 2 * T, 0.008, 0), pr.backMat ?? 'body', [0, legH + bodyH / 2, -d / 2 + 0.004], { plan: false }));
    const cw = (w - T) / cols;
    for (let c = 1; c < cols; c++) parts.push(part(box(T, bodyH - 2 * T, d - 0.01, 0.002), 'body', [-w / 2 + T / 2 + cw * c, legH + bodyH / 2, 0.005], { plan: false }));
    const sh = (bodyH - T) / (shelves + (kind === 'toy-shelf' ? 0 : 0));
    for (let s = 1; s < shelves; s++) parts.push(part(box(w - 2 * T, T, d - 0.01, 0.002), 'body', [0, legH + T / 2 + sh * s, 0.005], { plan: false }));
    // contents
    for (let s = 0; s < shelves; s++) {
      for (let c = 0; c < cols; c++) {
        const x0 = -w / 2 + T + cw * c;
        const x1 = x0 + cw - T;
        const y = legH + T + sh * s;
        const k = seed + s * 13 + c * 7;
        if (kind === 'toy-shelf') {
          parts.push(part(box(cw * 0.7, sh * 0.55, d * 0.7, 0.02), (s + c) % 2 ? '$woven' : '$feltGrey', [(x0 + x1) / 2, y + sh * 0.28, 0.02], { plan: false }));
        } else if (kind === 'record') {
          const inst: { p: V3; s?: V3; c?: string }[] = [];
          for (let i = 0; i < Math.floor((x1 - x0) / 0.008); i++) inst.push({ p: [x0 + 0.005 + i * 0.008, y + 0.155, 0.0], s: [0.004, 0.31, 0.31], c: ['#222', '#EEE', '#B43', '#358', '#DA4', '#444'][(i * 7 + k) % 6] });
          parts.push(part(box(1, 1, 1, 0), '$books', [0, 0, 0], { inst, plan: false }));
        } else {
          parts.push(...bookRow(x0, x1, y, -d / 2 + 0.02, sh - T, k, 0.7));
          if ((s + c + seed) % 3 === 0) parts.push(...objects((x0 + x1) / 2 + cw * 0.25, y, 0.0, k + 3));
        }
      }
    }
  } else {
    // closed carcass with fronts
    parts.push(part(box(w, bodyH, d, 0.004), 'body', [0, legH + bodyH / 2, 0], { plan: 'line' }));
    const doors = pr.doors ?? (kind === 'dresser' ? 0 : Math.max(2, Math.round(w / 0.5)));
    const drawers = pr.drawers ?? (kind === 'dresser' ? Math.max(3, Math.round(bodyH / 0.22)) : kind === 'nightstand' ? 2 : 0);
    const openCenter = pr.open ?? false;
    const inset = 0.012;
    const frontZ = d / 2 + 0.004;
    if (drawers > 0 && doors === 0) {
      const cols = pr.cols ?? (w > 1.1 ? 2 : 1);
      const dh = (bodyH - inset * 2) / drawers;
      const dw = (w - inset * 2) / cols;
      for (let c = 0; c < cols; c++)
        for (let i = 0; i < drawers; i++) {
          const x = -w / 2 + inset + dw * (c + 0.5);
          const y = legH + inset + dh * (i + 0.5);
          parts.push(part(box(dw - 0.006, dh - 0.006, 0.012, 0.003), 'fronts', [x, y, frontZ - 0.004], { plan: false }));
          parts.push(...handle(pr.handle, x, y + dh * 0.2, frontZ + 0.004, dw));
        }
    } else {
      const n = doors;
      const dw = (w - inset * 2) / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + inset + dw * (i + 0.5);
        if (openCenter && n >= 3 && i === Math.floor(n / 2)) {
          parts.push(part(box(dw - 0.006, bodyH - 0.06, 0.01, 0.002), '$black', [x, legH + bodyH / 2, d / 2 - 0.1], { plan: false }));
          continue;
        }
        parts.push(part(box(dw - 0.006, bodyH - inset * 2 - (drawers ? bodyH * 0.22 : 0), 0.012, 0.003), 'fronts', [x, legH + inset + (bodyH - inset * 2 - (drawers ? bodyH * 0.22 : 0)) / 2, frontZ - 0.004], { plan: false }));
        parts.push(...handle(pr.handle, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), legH + bodyH * 0.55, frontZ + 0.004, 0.2, true));
        if (drawers) parts.push(part(box(dw - 0.006, bodyH * 0.2, 0.012, 0.003), 'fronts', [x, legH + bodyH - inset - bodyH * 0.1, frontZ - 0.004], { plan: false }));
      }
    }
    if (pr.styled !== false && h < 1.0) {
      parts.push(...objects(-w * 0.28, h, -d * 0.05, seed + 11, 'vase'));
      parts.push(...objects(w * 0.25, h, 0, seed + 12, 'stack'));
    }
  }

  if (legs === 'legs') parts.push(...fourLegs(w, d, legH, { style: 'tapered', size: 0.04, inset: 0.04, mat: 'legs' }));
  else if (legs === 'metal') parts.push(...fourLegs(w, d, legH, { style: 'metal', size: 0.035, inset: 0.03, mat: 'legs' }));
  else if (legs === 'plinth') parts.push(part(box(w - 0.04, legH, d - 0.05, 0.002), '$black', [0, legH / 2, -0.01], { plan: 'hidden', noShadow: true }));
  else if (legs === 'hairpin') parts.push(...fourLegs(w, d, legH, { style: 'metal', size: 0.02, inset: 0.03, mat: 'legs' }));
  return { parts };
}

function handle(style: string | undefined, x: number, y: number, z: number, span: number, vertical = false): Part[] {
  if (style === 'none' || style === 'recess') return [];
  if (style === 'knob') return [part(sph(0.012), '$brassDecor', [x, y, z + 0.008], { plan: false })];
  const len = Math.min(0.16, span * 0.4);
  return [part(box(vertical ? 0.01 : len, vertical ? len : 0.01, 0.014, 0.004), '$brassDecor', [x, y, z + 0.007], { plan: false })];
}

// USM Haller-style modular metal system.
export function usm(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const cols = pr.cols ?? Math.max(1, Math.round(w / 0.75));
  const rows = pr.rows ?? Math.max(1, Math.round((h - 0.1) / 0.35));
  const parts: Part[] = [];
  const cw = w / cols;
  const rh = (h - 0.08) / rows;
  const ballR = 0.012;
  for (let c = 0; c <= cols; c++)
    for (let r = 0; r <= rows; r++)
      for (const z of [-d / 2, d / 2]) parts.push(part(sph(ballR), '$chrome', [-w / 2 + c * cw, 0.08 + r * rh, z], { plan: false }));
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = -w / 2 + cw * (c + 0.5);
      const y = 0.08 + rh * (r + 0.5);
      parts.push(part(box(cw - 0.012, rh - 0.012, d - 0.012, 0.002), 'body', [x, y, 0], { plan: r === rows - 1 ? 'line' : false }));
    }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(cyl(0.01, 0.01, 0.08, 10), '$chrome', [sx * (w / 2), 0.04, sz * (d / 2)], { plan: false }));
  return { parts };
}
