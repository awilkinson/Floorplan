import type { Item, Opening, Room, Vec2 } from './types';

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const rot = (a: Vec2, r: number): Vec2 => {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Shoelace area; positive for outlines that run clockwise on screen (y down). */
export function signedArea(pts: Vec2[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const polygonArea = (pts: Vec2[]) => Math.abs(signedArea(pts));

/** Ensure clockwise (screen) winding so that inward normals are (-dy, dx). */
export function normalizeOutline(pts: Vec2[]): Vec2[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : pts;
}

export function bounds(pts: Vec2[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function pointInPolygon(p: Vec2, pts: Vec2[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1e-12;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const q = add(a, scale(ab, t));
  return { point: q, t, dist: dist(p, q) };
}

export function segmentIntersect(p: Vec2, p2: Vec2, q: Vec2, q2: Vec2): { t: number; u: number; point: Vec2 } | null {
  const r = sub(p2, p);
  const s = sub(q2, q);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(q, p);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, point: add(p, scale(r, t)) };
}

export interface Wall {
  index: number;
  a: Vec2;
  b: Vec2;
  length: number;
  dir: Vec2;
  /** Unit normal pointing into the room. */
  normal: Vec2;
  /** Plan angle of the wall direction. */
  angle: number;
}

export function walls(room: Pick<Room, 'outline'>): Wall[] {
  const pts = room.outline;
  const ccw = signedArea(pts) < 0;
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const d = sub(b, a);
    const l = len(d) || 1e-9;
    const dir = { x: d.x / l, y: d.y / l };
    const normal = ccw ? { x: dir.y, y: -dir.x } : { x: -dir.y, y: dir.x };
    return { index: i, a, b, length: l, dir, normal, angle: Math.atan2(dir.y, dir.x) };
  });
}

export function wallPoint(w: Wall, t: number): Vec2 {
  return add(w.a, scale(w.dir, t));
}

/** Plan endpoints of an opening, from its near side to its far side along the wall. */
export function openingSpan(room: Room, o: Opening) {
  const w = walls(room)[o.wall];
  if (!w) return null;
  const p0 = wallPoint(w, o.offset);
  const p1 = wallPoint(w, o.offset + o.width);
  return { wall: w, p0, p1, center: lerp2(p0, p1, 0.5) };
}

/** The rotation that makes an item's back sit against a wall with its front facing into the room. */
export function rotationFacingInto(w: Wall) {
  // front direction (local +y) rotated by r is (-sin r, cos r); want it to equal w.normal.
  return Math.atan2(-w.normal.x, w.normal.y);
}

export function itemAxes(rotation: number) {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  // u: width axis, v: toward the item's front.
  return { u: { x: c, y: s }, v: { x: -s, y: c } };
}

/** Corners of an oriented rectangle, clockwise from back-left. */
export function rectCorners(cx: number, cy: number, w: number, d: number, rotation: number): Vec2[] {
  const { u, v } = itemAxes(rotation);
  const hw = w / 2;
  const hd = d / 2;
  const c = { x: cx, y: cy };
  return [
    add(add(c, scale(u, -hw)), scale(v, -hd)),
    add(add(c, scale(u, hw)), scale(v, -hd)),
    add(add(c, scale(u, hw)), scale(v, hd)),
    add(add(c, scale(u, -hw)), scale(v, hd)),
  ];
}

export function toLocal(p: Vec2, cx: number, cy: number, rotation: number): Vec2 {
  return rot({ x: p.x - cx, y: p.y - cy }, -rotation);
}

export function toWorld(p: Vec2, cx: number, cy: number, rotation: number): Vec2 {
  const r = rot(p, rotation);
  return { x: r.x + cx, y: r.y + cy };
}

export interface OBB {
  c: Vec2;
  hw: number;
  hd: number;
  rotation: number;
}

export const obbOf = (x: number, y: number, w: number, d: number, rotation: number): OBB => ({
  c: { x, y },
  hw: w / 2,
  hd: d / 2,
  rotation,
});

/**
 * Separating-axis test between two oriented rectangles. Returns the minimum
 * translation vector that pushes `a` out of `b`, or null when they do not overlap.
 */
export function obbOverlap(a: OBB, b: OBB): { mtv: Vec2; depth: number } | null {
  const ax = itemAxes(a.rotation);
  const bx = itemAxes(b.rotation);
  const axes = [ax.u, ax.v, bx.u, bx.v];
  const d = sub(b.c, a.c);
  let minDepth = Infinity;
  let minAxis: Vec2 = { x: 1, y: 0 };
  for (const axis of axes) {
    const ra = a.hw * Math.abs(dot(ax.u, axis)) + a.hd * Math.abs(dot(ax.v, axis));
    const rb = b.hw * Math.abs(dot(bx.u, axis)) + b.hd * Math.abs(dot(bx.v, axis));
    const dist = dot(d, axis);
    const overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return null;
    if (overlap < minDepth) {
      minDepth = overlap;
      minAxis = dist > 0 ? scale(axis, -1) : axis;
    }
  }
  return { mtv: scale(minAxis, minDepth), depth: minDepth };
}

/** Minimum distance between two oriented rectangles (0 when overlapping). */
export function obbGap(a: OBB, b: OBB): number {
  if (obbOverlap(a, b)) return 0;
  const ca = rectCorners(a.c.x, a.c.y, a.hw * 2, a.hd * 2, a.rotation);
  const cb = rectCorners(b.c.x, b.c.y, b.hw * 2, b.hd * 2, b.rotation);
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      best = Math.min(best, closestOnSegment(ca[i], cb[j], cb[(j + 1) % 4]).dist);
      best = Math.min(best, closestOnSegment(cb[j], ca[i], ca[(i + 1) % 4]).dist);
    }
  }
  return best;
}

/** Cast a ray from p along dir and return the distance to the first wall hit. */
export function rayToWalls(room: Room, p: Vec2, dir: Vec2, maxDist = 100): { dist: number; point: Vec2; wall: number } | null {
  const far = add(p, scale(dir, maxDist));
  let best: { dist: number; point: Vec2; wall: number } | null = null;
  for (const w of walls(room)) {
    const hit = segmentIntersect(p, far, w.a, w.b);
    if (hit) {
      const dd = hit.t * maxDist;
      if (!best || dd < best.dist) best = { dist: dd, point: hit.point, wall: w.index };
    }
  }
  return best;
}

export function nearestWall(room: Room, p: Vec2) {
  let best: { wall: Wall; dist: number; t: number; point: Vec2 } | null = null;
  for (const w of walls(room)) {
    const c = closestOnSegment(p, w.a, w.b);
    if (!best || c.dist < best.dist) best = { wall: w, dist: c.dist, t: c.t * w.length, point: c.point };
  }
  return best!;
}

export function itemSize(item: Item, entry: { w: number; d: number; h: number }) {
  return { w: item.w ?? entry.w, d: item.d ?? entry.d, h: item.h ?? entry.h };
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    const b = bounds(pts);
    return { x: b.cx, y: b.cy };
  }
  let cx = 0,
    cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Offset a closed polygon outward by d (miter joins). */
export function offsetPolygon(pts: Vec2[], d: number): Vec2[] {
  const ws = walls({ outline: pts });
  const n = pts.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ws[(i - 1 + n) % n];
    const cur = ws[i];
    // outward normals are -normal
    const n1 = scale(prev.normal, -1);
    const n2 = scale(cur.normal, -1);
    const bis = norm(add(n1, n2));
    const cosHalf = dot(bis, n1) || 1;
    out.push(add(pts[i], scale(bis, d / cosHalf)));
  }
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
