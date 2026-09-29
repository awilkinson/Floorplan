import { catalogEntry } from '../state/store';
import type { CatalogEntry, Item, Room, Vec2 } from '../model/types';
import { closestOnSegment, itemAxes, rectCorners, rotationFacingInto, walls } from '../model/geometry';
import { isFlat } from '../catalog/catalog';

export interface Guide {
  a: Vec2;
  b: Vec2;
  kind: 'align' | 'wall';
}

export interface SnapResult {
  x: number;
  y: number;
  rotation: number;
  wall?: number;
  guides: Guide[];
}

const WALL_SNAP = 0.14;
const ALIGN_SNAP = 0.035;

export function sizeOf(item: Item, entry?: CatalogEntry) {
  const e = entry ?? catalogEntry(item.ref);
  return { w: item.w ?? e?.w ?? 0.5, d: item.d ?? e?.d ?? 0.5, h: item.h ?? e?.h ?? 0.5 };
}

/**
 * Snap a moving item: backs slide flush to nearby walls (and turn to face the
 * room), centers and edges align with other pieces.
 */
export function snapItem(room: Room, moving: Item, x: number, y: number, rotation: number, others: Item[], opts: { free?: boolean } = {}): SnapResult {
  const entry = catalogEntry(moving.ref);
  const { w, d } = sizeOf(moving, entry);
  const guides: Guide[] = [];
  let out = { x, y, rotation, wall: undefined as number | undefined };
  if (opts.free) return { ...out, guides };
  const flat = entry ? isFlat(entry) && entry.mount !== 'wall' : false;

  // Wall snap: the item's back edge midpoint near a wall.
  if (!flat) {
    let best: { dist: number; wall: number } | null = null;
    for (const wl of walls(room)) {
      const rot = rotationFacingInto(wl);
      const diff = Math.abs(((rotation - rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 0.45) continue;
      const { v } = itemAxes(rot);
      const back = { x: x - (v.x * d) / 2, y: y - (v.y * d) / 2 };
      const c = closestOnSegment(back, wl.a, wl.b);
      if (c.dist < WALL_SNAP && (!best || c.dist < best.dist)) best = { dist: c.dist, wall: wl.index };
    }
    if (best) {
      const wl = walls(room)[best.wall];
      const rot = rotationFacingInto(wl);
      const { v } = itemAxes(rot);
      // project center onto the line offset by d/2 from the wall
      const along = (x - wl.a.x) * wl.dir.x + (y - wl.a.y) * wl.dir.y;
      const inset = entry?.mount === 'wall' ? d / 2 : d / 2 + 0.005;
      out = { x: wl.a.x + wl.dir.x * along + v.x * inset, y: wl.a.y + wl.dir.y * along + v.y * inset, rotation: rot, wall: best.wall };
      guides.push({ a: wl.a, b: wl.b, kind: 'wall' });
    }
  }

  // Alignment with other items' centers.
  let bx: { d: number; v: number; other: Item } | null = null;
  let by: { d: number; v: number; other: Item } | null = null;
  for (const o of others) {
    if (o.id === moving.id) continue;
    const dx = Math.abs(o.x - out.x);
    const dy = Math.abs(o.y - out.y);
    if (dx < ALIGN_SNAP && (!bx || dx < bx.d)) bx = { d: dx, v: o.x, other: o };
    if (dy < ALIGN_SNAP && (!by || dy < by.d)) by = { d: dy, v: o.y, other: o };
  }
  if (bx && out.wall === undefined) {
    out.x = bx.v;
    guides.push({ a: { x: bx.v, y: Math.min(out.y, bx.other.y) - 0.3 }, b: { x: bx.v, y: Math.max(out.y, bx.other.y) + 0.3 }, kind: 'align' });
  } else if (bx && out.wall !== undefined) {
    const wl = walls(room)[out.wall];
    if (Math.abs(wl.dir.x) > 0.9) {
      out.x = bx.v;
      guides.push({ a: { x: bx.v, y: Math.min(out.y, bx.other.y) - 0.3 }, b: { x: bx.v, y: Math.max(out.y, bx.other.y) + 0.3 }, kind: 'align' });
    }
  }
  if (by && out.wall === undefined) {
    out.y = by.v;
    guides.push({ a: { x: Math.min(out.x, by.other.x) - 0.3, y: by.v }, b: { x: Math.max(out.x, by.other.x) + 0.3, y: by.v }, kind: 'align' });
  } else if (by && out.wall !== undefined) {
    const wl = walls(room)[out.wall];
    if (Math.abs(wl.dir.y) > 0.9) {
      out.y = by.v;
      guides.push({ a: { x: Math.min(out.x, by.other.x) - 0.3, y: by.v }, b: { x: Math.max(out.x, by.other.x) + 0.3, y: by.v }, kind: 'align' });
    }
  }
  void rectCorners;
  void w;
  return { ...out, guides };
}

/** Snap a rotation to 15° steps unless free. */
export function snapAngle(r: number, free = false) {
  if (free) return r;
  const step = Math.PI / 12;
  return Math.round(r / step) * step;
}
