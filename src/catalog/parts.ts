// A piece of furniture is described once, as a list of primitive parts in its
// own frame (x = width, y = up, z = toward the front, origin at the center of the
// footprint on the floor). The same parts drive the 3D mesh and the CAD symbol.

export type V3 = [number, number, number];

export type Geo =
  /** Rounded box; r is the edge radius. */
  | { t: 'box'; w: number; h: number; d: number; r?: number }
  /** Upholstered cushion: rounded box with a domed top and bottom. */
  | { t: 'cushion'; w: number; h: number; d: number; r?: number; bulge?: number }
  /** Cylinder or cone along y. */
  | { t: 'cyl'; rt: number; rb: number; h: number; seg?: number; open?: boolean }
  /** Ellipsoid. */
  | { t: 'sphere'; rx: number; ry: number; rz: number; seg?: number }
  /** Torus in the xz plane (ring lying flat); arc < 2π for partial rings. */
  | { t: 'torus'; r: number; tube: number; arc?: number; seg?: number }
  /** Surface of revolution around y from (radius, y) profile points. */
  | { t: 'lathe'; pts: [number, number][]; seg?: number }
  /** Side profile in the (z, y) plane extruded along x by `width`, centered. */
  | { t: 'profile'; pts: [number, number][]; width: number; bevel?: number }
  /** Plan shape in the (x, z) plane extruded up along y by `h`, bottom at 0. */
  | { t: 'plate'; pts: [number, number][]; h: number; bevel?: number; holes?: [number, number][][] }
  /** Tube swept along a 3D polyline (smoothed). */
  | { t: 'tube'; pts: V3[]; r: number; closed?: boolean; seg?: number; smooth?: boolean }
  /** Flat rectangle facing +z (art, screens, labels). */
  | { t: 'panel'; w: number; h: number }
  /** Horizontal rectangle facing up (rugs, mats). */
  | { t: 'floor'; w: number; d: number; shape?: 'rect' | 'round' | 'organic'; r?: number; h?: number }
  /** Generator-specific mesh built from a cache key (foliage, trees, keys). */
  | { t: 'custom'; key: string; params?: Record<string, unknown> };

export type PlanStyle = 'line' | 'thin' | 'dash' | 'hidden' | 'cushion' | 'fill-dark';

export interface Part {
  geo: Geo;
  /** A material slot name ('upholstery', 'legs'…) or a fixed material ('$black'). */
  mat: string;
  p: V3;
  r?: V3;
  /** CAD drawing style for this part; false leaves it out of the plan. */
  plan?: PlanStyle | false;
  /** Explicit plan footprint in local (x, z), overrides the derived one. */
  planPts?: [number, number][];
  /** Draw a circle footprint in the plan with this radius. */
  planCircle?: number;
  /** Extra plan strokes (open polylines) in local (x, z). */
  planStrokes?: [number, number][][];
  noShadow?: boolean;
  /** Repeated instances of the same geometry (books, slats). */
  inst?: { p: V3; r?: V3; s?: V3; c?: string }[];
  /** Per-part color override (used by instanced books and trims). */
  color?: string;
}

export interface LightSpec {
  p: V3;
  color: string;
  /** Candela-ish intensity used in evening mode. */
  intensity: number;
  distance?: number;
  /** Emissive glow parts use this key to brighten when lit. */
  kind: 'lamp' | 'fire' | 'tree' | 'picture';
}

export interface Built {
  parts: Part[];
  lights?: LightSpec[];
}

export interface GenCtx {
  w: number;
  d: number;
  h: number;
  params: Record<string, any>;
  /** Stable per-item seed for organic variation. */
  seed: number;
  /** Room ceiling height, for built-ins that run to the ceiling. */
  ceiling?: number;
  /** Resolve a finish id for a slot (used by generators that color books etc.). */
  finish: (slot: string) => string | undefined;
}

export type Generator = (ctx: GenCtx) => Built;

// ---------------------------------------------------------------------------
// Small helpers used by the generators.

export const box = (w: number, h: number, d: number, r = 0): Geo => ({ t: 'box', w, h, d, r });
export const cushion = (w: number, h: number, d: number, r = 0.04, bulge = 0.02): Geo => ({ t: 'cushion', w, h, d, r, bulge });
export const cyl = (rt: number, rb: number, h: number, seg = 24): Geo => ({ t: 'cyl', rt, rb, h, seg });
export const sph = (rx: number, ry = rx, rz = rx, seg = 24): Geo => ({ t: 'sphere', rx, ry, rz, seg });

export function part(geo: Geo, mat: string, p: V3, extra: Partial<Part> = {}): Part {
  return { geo, mat, p, ...extra };
}

/** Mulberry32 PRNG so organic pieces look the same every time. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Four legs inset from the corners of a w × d footprint. */
export function fourLegs(
  w: number,
  d: number,
  legH: number,
  opts: { inset?: number; style?: 'square' | 'round' | 'tapered' | 'metal' | 'splay' | 'block'; size?: number; mat?: string; y?: number } = {},
): Part[] {
  const inset = opts.inset ?? 0.04;
  const size = opts.size ?? 0.035;
  const mat = opts.mat ?? 'legs';
  const y0 = opts.y ?? 0;
  const style = opts.style ?? 'tapered';
  const out: Part[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - inset - size / 2);
      const z = sz * (d / 2 - inset - size / 2);
      if (style === 'square' || style === 'block') {
        out.push(part(box(size, legH, size, 0.003), mat, [x, y0 + legH / 2, z], { plan: 'hidden' }));
      } else if (style === 'metal') {
        out.push(part(cyl(size * 0.3, size * 0.3, legH, 12), mat, [x, y0 + legH / 2, z], { plan: 'hidden' }));
      } else if (style === 'splay') {
        const tilt = 0.12;
        out.push(
          part(cyl(size * 0.45, size * 0.3, legH / Math.cos(tilt), 12), mat, [x + sx * legH * 0.06, y0 + legH / 2, z + sz * legH * 0.06], {
            r: [sz * -tilt, 0, sx * tilt],
            plan: 'hidden',
          }),
        );
      } else if (style === 'round') {
        out.push(part(cyl(size / 2, size / 2, legH, 16), mat, [x, y0 + legH / 2, z], { plan: 'hidden' }));
      } else {
        out.push(part(cyl(size * 0.5, size * 0.32, legH, 16), mat, [x, y0 + legH / 2, z], { plan: 'hidden' }));
      }
    }
  }
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Rounded-rectangle outline points in (x, z) for plates and plan shapes. */
export function roundedRectPts(w: number, d: number, r: number, seg = 6): [number, number][] {
  const rr = Math.min(r, w / 2, d / 2);
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - rr, -d / 2 + rr, -Math.PI / 2],
    [w / 2 - rr, d / 2 - rr, 0],
    [-w / 2 + rr, d / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -d / 2 + rr, Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
    }
  }
  return pts;
}

export function ellipsePts(rx: number, rz: number, seg = 48): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  return pts;
}

/** Stadium / racetrack outline. */
export function racetrackPts(w: number, d: number, seg = 16): [number, number][] {
  const r = Math.min(w, d) / 2;
  const straight = Math.max(w, d) / 2 - r;
  const horiz = w >= d;
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + (i / seg) * Math.PI;
    pts.push(horiz ? [straight + Math.cos(a) * r, Math.sin(a) * r] : [Math.cos(a) * r, -straight + Math.sin(a) * r]);
  }
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI / 2 + (i / seg) * Math.PI;
    pts.push(horiz ? [-straight + Math.cos(a) * r, Math.sin(a) * r] : [Math.cos(a) * r, straight + Math.sin(a) * r]);
  }
  return horiz ? pts : pts.map(([x, z]) => [x, z]);
}

/** A soft organic blob outline (kidney / pebble), deterministic per seed. */
export function blobPts(w: number, d: number, seed: number, wobble = 0.12, seg = 64): [number, number][] {
  const r = rng(seed);
  const k1 = r() * Math.PI * 2;
  const k2 = r() * Math.PI * 2;
  const k3 = r() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const f = 1 + wobble * (0.6 * Math.sin(2 * a + k1) + 0.3 * Math.sin(3 * a + k2) + 0.15 * Math.sin(5 * a + k3));
    pts.push([(Math.cos(a) * w * f) / 2 / (1 + wobble), (Math.sin(a) * d * f) / 2 / (1 + wobble)]);
  }
  return pts;
}
