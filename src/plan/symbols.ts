import * as THREE from 'three';
import type { Part, PlanStyle } from '../catalog/parts';
import type { CatalogEntry, Item } from '../model/types';
import { buildParts } from '../three/furniture';

// Turn a piece's part tree into CAD linework: each part's footprint, drawn
// low-to-high with a paper fill so upper parts hide what's beneath them.

export interface SymbolShape {
  d: string;
  style: PlanStyle;
  fill: boolean;
  top: number;
}

export interface Symbol2D {
  shapes: SymbolShape[];
  strokes: string[];
  w: number;
  d: number;
}

const cache = new Map<string, Symbol2D>();

function f(n: number) {
  return (Math.round(n * 1000) / 1000).toString();
}

function polyPath(pts: [number, number][], close = true) {
  if (!pts.length) return '';
  let s = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) s += `L${f(pts[i][0])} ${f(pts[i][1])}`;
  return close ? s + 'Z' : s;
}

function circlePath(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
}

function roundedRect(cx: number, cy: number, w: number, d: number, r: number, yaw: number) {
  const rr = Math.max(0, Math.min(r, w / 2, d / 2));
  if (rr < 0.004) return polyPath(rotPts(rectPts(w, d), yaw).map(([x, y]) => [x + cx, y + cy]));
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - rr, -d / 2 + rr, -Math.PI / 2],
    [w / 2 - rr, d / 2 - rr, 0],
    [-w / 2 + rr, d / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -d / 2 + rr, Math.PI],
  ];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
  return polyPath(rotPts(pts, yaw).map(([x, y]) => [x + cx, y + cy]));
}

function rectPts(w: number, d: number): [number, number][] {
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
}

// Plan yaw: a part rotated by +ry about Y (three.js) appears rotated by -ry in plan (x right, z down).
function rotPts(pts: [number, number][], yaw: number): [number, number][] {
  if (!yaw) return pts;
  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (pts.length < 3) return pts;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();

function projectedHull(corners: THREE.Vector3[], p: Part): [number, number][] {
  e.set(p.r?.[0] ?? 0, p.r?.[1] ?? 0, p.r?.[2] ?? 0);
  q.setFromEuler(e);
  m4.compose(new THREE.Vector3(p.p[0], p.p[1], p.p[2]), q, new THREE.Vector3(1, 1, 1));
  return hull(corners.map((c) => v.copy(c).applyMatrix4(m4)).map((w) => [w.x, w.z] as [number, number]));
}

function boxCorners(w: number, h: number, d: number) {
  const out: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(new THREE.Vector3((sx * w) / 2, (sy * h) / 2, (sz * d) / 2));
  return out;
}

function partTop(p: Part): number {
  const g = p.geo;
  const y = p.p[1];
  switch (g.t) {
    case 'box':
    case 'cushion':
      return y + g.h / 2;
    case 'cyl':
      return p.r && (Math.abs(p.r[0]) > 0.5 || Math.abs(p.r[2]) > 0.5) ? y + Math.max(g.rt, g.rb) : y + g.h / 2;
    case 'sphere':
      return y + g.ry;
    case 'lathe':
      return y + Math.max(...g.pts.map((q2) => q2[1]));
    case 'plate':
      return y + g.h;
    case 'profile':
      return y + Math.max(...g.pts.map((q2) => q2[1]));
    case 'floor':
      return y + (g.h ?? 0.01);
    case 'tube':
      return y + Math.max(...g.pts.map((q2) => q2[1]));
    default:
      return y + 0.3;
  }
}

export function partFootprint(p: Part): string | null {
  const g = p.geo;
  const [px, , pz] = p.p;
  const yaw = p.r?.[1] ?? 0;
  const tilted = !!p.r && (Math.abs(p.r[0]) > 0.01 || Math.abs(p.r[2]) > 0.01);
  if (p.planPts) return polyPath(p.planPts.map(([x, z]) => [x, z]));
  if (p.planCircle) return circlePath(px, pz, p.planCircle);
  switch (g.t) {
    case 'box':
    case 'cushion':
      if (tilted) return polyPath(projectedHull(boxCorners(g.w, g.h, g.d), p));
      return roundedRect(px, pz, g.w, g.d, g.r ?? (g.t === 'cushion' ? 0.04 : 0), yaw);
    case 'cyl': {
      const R = Math.max(g.rt, g.rb);
      if (tilted) return polyPath(projectedHull(boxCorners(R * 2, g.h, R * 2), p));
      return circlePath(px, pz, R);
    }
    case 'sphere':
      if (tilted || yaw) return polyPath(projectedHull(boxCorners(g.rx * 2, g.ry * 2, g.rz * 2), p));
      return ellipsePath(px, pz, g.rx, g.rz);
    case 'torus': {
      if (tilted) return polyPath(projectedHull(boxCorners((g.r + g.tube) * 2, g.tube * 2, (g.r + g.tube) * 2), p));
      return circlePath(px, pz, g.r + g.tube);
    }
    case 'lathe':
      return circlePath(px, pz, Math.max(...g.pts.map((q2) => q2[0])));
    case 'profile': {
      const zs = g.pts.map((q2) => q2[0]);
      const z0 = Math.min(...zs);
      const z1 = Math.max(...zs);
      return polyPath(rotPts([[-g.width / 2, z0], [g.width / 2, z0], [g.width / 2, z1], [-g.width / 2, z1]], yaw).map(([x, y]) => [x + px, y + pz]));
    }
    case 'plate':
      if (tilted) {
        const xs = g.pts.map((q2) => q2[0]);
        const zs = g.pts.map((q2) => q2[1]);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...zs) - Math.min(...zs);
        return polyPath(projectedHull(boxCorners(w, g.h, d), { ...p, p: [px + (Math.max(...xs) + Math.min(...xs)) / 2, p.p[1], pz + (Math.max(...zs) + Math.min(...zs)) / 2] }));
      }
      return polyPath(rotPts(g.pts, yaw).map(([x, y]) => [x + px, y + pz]));
    case 'panel':
      return polyPath(rotPts([[-g.w / 2, -0.005], [g.w / 2, -0.005], [g.w / 2, 0.005], [-g.w / 2, 0.005]], yaw).map(([x, y]) => [x + px, y + pz]));
    case 'floor': {
      if (g.shape === 'round') return ellipsePath(px, pz, g.w / 2, g.d / 2);
      if (g.shape === 'organic') {
        const pts: [number, number][] = [];
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          const k = 1 + 0.08 * Math.sin(2 * a + 0.7) + 0.05 * Math.sin(3 * a + 2.1) + 0.03 * Math.sin(5 * a);
          pts.push([px + (Math.cos(a) * g.w * k) / 2 / 1.1, pz + (Math.sin(a) * g.d * k) / 2 / 1.1]);
        }
        return polyPath(pts);
      }
      return roundedRect(px, pz, g.w, g.d, g.r ?? 0.02, yaw);
    }
    default:
      return null;
  }
}

function tubeStroke(p: Part): string | null {
  if (p.geo.t !== 'tube') return null;
  const pts = p.geo.pts.map(([x, , z]) => [x + p.p[0], z + p.p[2]] as [number, number]);
  return polyPath(pts, !!p.geo.closed);
}

export function symbolFor(item: Item, entry: CatalogEntry, ceiling: number): Symbol2D {
  const key = JSON.stringify([entry.id, entry.custom ? entry.params : null, item.w, item.d, item.h, item.params, entry.generator === 'plant' || entry.generator === 'christmasTree' ? item.id : null]);
  const hit = cache.get(key);
  if (hit) return hit;
  const built = buildParts(item, entry, ceiling);
  const shapes: SymbolShape[] = [];
  const strokes: string[] = [];
  for (const p of built.parts) {
    if (p.plan === false || p.plan === 'hidden') continue;
    if (p.inst) continue;
    const style: PlanStyle = p.plan ?? 'line';
    if (p.geo.t === 'tube') {
      const s = tubeStroke(p);
      if (s) strokes.push(s);
      continue;
    }
    const d = partFootprint(p);
    if (d) shapes.push({ d, style, fill: style !== 'dash' || p.geo.t !== 'floor', top: partTop(p) });
    for (const st of p.planStrokes ?? []) strokes.push(polyPath(st.map(([x, z]) => [x + (p.geo.t === 'custom' ? p.p[0] : 0), z + (p.geo.t === 'custom' ? p.p[2] : 0)]), false));
  }
  shapes.sort((a, b) => a.top - b.top);
  const w = item.w ?? entry.w;
  const d = item.d ?? entry.d;
  const out = { shapes, strokes, w, d };
  cache.set(key, out);
  if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  return out;
}
