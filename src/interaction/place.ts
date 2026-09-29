import { CATALOG_MAP, isFlat, isSeat } from '../catalog/catalog';
import { bounds, obbOf, obbOverlap, pointInPolygon, rectCorners, rotationFacingInto, walls, nearestWall } from '../model/geometry';
import type { CatalogEntry, Item, Layout, Room, Vec2 } from '../model/types';
import { analyzeLayout } from '../design/checks';

/** Where the eye goes in a room: the fireplace if there is one, else the most-glazed wall. */
export function focalPoint(room: Room, custom: Record<string, CatalogEntry> = {}): Vec2 {
  const fire = room.fixtures.find((f) => (custom[f.ref] ?? CATALOG_MAP[f.ref])?.generator === 'fireplace');
  if (fire) return { x: fire.x, y: fire.y };
  const ws = walls(room);
  let best = ws[0];
  let area = -1;
  for (const w of ws) {
    const a = room.openings.filter((o) => o.wall === w.index && o.kind !== 'niche').reduce((s, o) => s + o.width, 0);
    if (a > area) {
      area = a;
      best = w;
    }
  }
  return { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 };
}

/**
 * Find a free spot for a new piece near `prefer` (defaults to the room's center),
 * facing something sensible: seats face the focal point, wall pieces go on a wall.
 */
export function placeNew(room: Room, layout: Layout | null, entry: CatalogEntry, prefer?: Vec2, custom: Record<string, CatalogEntry> = {}): { x: number; y: number; rotation: number; wall?: number; elevation?: number } {
  const b = bounds(room.outline);
  const target = prefer ?? { x: b.cx, y: b.cy };
  const w = entry.w;
  const d = entry.d;
  if (entry.mount === 'wall') {
    const nw = nearestWall(room, target);
    const rot = rotationFacingInto(nw.wall);
    const n = nw.wall.normal;
    return { x: nw.point.x + n.x * (d / 2 + 0.004), y: nw.point.y + n.y * (d / 2 + 0.004), rotation: rot, wall: nw.wall.index, elevation: Math.max(1.35, entry.h / 2 + 0.9) };
  }
  const focal = focalPoint(room, custom);
  const faceFocal = (x: number, y: number) => {
    const dx = focal.x - x;
    const dy = focal.y - y;
    // front (-sin r, cos r) should point to the focal point
    return Math.atan2(-dx, dy);
  };
  const flat = isFlat(entry);
  const solids = [...room.fixtures, ...(layout?.items ?? [])]
    .map((it) => ({ it, e: custom[it.ref] ?? CATALOG_MAP[it.ref] }))
    .filter((x) => x.e && !isFlat(x.e) && x.e.mount !== 'wall' && x.e.mount !== 'surface')
    .map((x) => obbOf(x.it.x, x.it.y, (x.it.w ?? x.e!.w) + 0.25, (x.it.d ?? x.e!.d) + 0.25, x.it.rotation));
  // keep door swings and the approach to glass doors clear
  const ws = walls(room);
  for (const o of room.openings) {
    if (o.kind === 'window' || o.kind === 'niche') continue;
    const wall = ws[o.wall];
    if (!wall) continue;
    const depth = o.swing === 'in' && (o.kind === 'door' || o.kind === 'double-door' || o.kind === 'french-door') ? (o.kind === 'door' ? o.width : o.width / 2) + 0.1 : 0.75;
    const along = o.offset + o.width / 2;
    const cx = wall.a.x + wall.dir.x * along + wall.normal.x * (depth / 2);
    const cy = wall.a.y + wall.dir.y * along + wall.normal.y * (depth / 2);
    solids.push(obbOf(cx, cy, o.width + 0.1, depth, rotationFacingInto(wall)));
  }
  const cands: { x: number; y: number; rotation: number; score: number }[] = [];
  const step = 0.15;
  for (let y = b.minY + d / 2; y <= b.maxY - d / 2; y += step) {
    for (let x = b.minX + w / 2; x <= b.maxX - w / 2; x += step) {
      const rot = isSeat(entry) ? snap(faceFocal(x, y)) : 0;
      const obb = obbOf(x, y, w, d, rot);
      const corners = rectCorners(x, y, w, d, rot);
      if (corners.some((c) => !pointInPolygon(c, room.outline))) continue;
      if (!flat && solids.some((s) => obbOverlap(obb, s))) continue;
      cands.push({ x, y, rotation: rot, score: Math.hypot(x - target.x, y - target.y) });
    }
  }
  if (!cands.length) {
    // A full room: take the spot that collides with the fewest pieces, so the
    // conflict is small and visible rather than dropped on the sofa.
    let fb = { x: target.x, y: target.y, rotation: 0, n: Infinity, dist: Infinity };
    for (let y = b.minY + d / 2; y <= b.maxY - d / 2; y += step)
      for (let x = b.minX + w / 2; x <= b.maxX - w / 2; x += step) {
        const rot = isSeat(entry) ? snap(faceFocal(x, y)) : 0;
        if (rectCorners(x, y, w, d, rot).some((c) => !pointInPolygon(c, room.outline))) continue;
        const obb = obbOf(x, y, w, d, rot);
        const n = solids.filter((so) => obbOverlap(obb, so)).length;
        const dist = Math.hypot(x - target.x, y - target.y);
        if (n < fb.n || (n === fb.n && dist < fb.dist)) fb = { x, y, rotation: rot, n, dist };
      }
    return { x: fb.x, y: fb.y, rotation: fb.rotation };
  }
  cands.sort((a, b) => a.score - b.score);
  if (flat || !layout) return cands[0];
  // Among the nearest well-spread spots, keep the one that leaves the room working best.
  const picks: typeof cands = [];
  for (const c of cands) {
    if (picks.length >= 7) break;
    if (picks.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 0.5)) picks.push(c);
  }
  let best = picks[0];
  let bestScore = -Infinity;
  for (const c of picks) {
    const trial: Layout = { ...layout, items: [...layout.items, { id: '__new', ref: entry.id, x: c.x, y: c.y, rotation: c.rotation }] };
    const s = analyzeLayout(room, trial, { ...custom, [entry.id]: entry }).score - c.score * 2;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return { x: best.x, y: best.y, rotation: best.rotation };
}

function snap(r: number) {
  const s = Math.PI / 12;
  return Math.round(r / s) * s;
}

export function itemFootprint(it: Item, e: CatalogEntry) {
  return rectCorners(it.x, it.y, it.w ?? e.w, it.d ?? e.d, it.rotation);
}
