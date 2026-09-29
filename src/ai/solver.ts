import { CATALOG_MAP, isFlat } from '../catalog/catalog';
import { FINISH_MAP } from '../catalog/finishes';
import { bounds, nearestWall, obbOf, obbOverlap, pointInPolygon, polygonCentroid, rectCorners, rotationFacingInto, walls, type OBB } from '../model/geometry';
import type { CatalogEntry, Item, Layout, Room, Zone } from '../model/types';
import { bearingToRotation, inch } from '../model/units';

// Turn a designer's JSON into a clean layout: resolve refs, convert units, and
// fix anything physically wrong (overlaps, walls, doors) with small nudges.

export interface RawItem {
  id?: string;
  ref: string;
  x: number;
  y: number;
  facing?: number;
  w?: number;
  d?: number;
  h?: number;
  finish?: Record<string, string>;
  elevation?: number;
}

export interface RawIdea {
  name?: string;
  direction?: string;
  concept?: string;
  moves?: string[];
  items?: RawItem[];
  zones?: { kind?: string; label?: string; x: number; y: number; w?: number; d?: number; r?: number }[];
  shopping?: string[];
}

export function resolveRef(ref: string, catalog: Record<string, CatalogEntry>): CatalogEntry | null {
  if (!ref) return null;
  if (catalog[ref]) return catalog[ref];
  const low = ref.toLowerCase();
  const exact = Object.values(catalog).find((e) => e.id.toLowerCase() === low || e.name.toLowerCase() === low);
  if (exact) return exact;
  const tokens = low.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  let best: { e: CatalogEntry; s: number } | null = null;
  for (const e of Object.values(catalog)) {
    const hay = `${e.id} ${e.name} ${e.brand ?? ''} ${e.designer ?? ''} ${e.category}`.toLowerCase();
    const s = tokens.filter((t) => hay.includes(t)).length;
    if (s > 0 && (!best || s > best.s)) best = { e, s };
  }
  return best && best.s >= Math.min(2, tokens.length) ? best.e : null;
}

function cleanFinishes(f: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!f) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (FINISH_MAP[v]) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

function sizeOverride(v: number | undefined, def: number, resizable: boolean) {
  if (v == null || !resizable) return undefined;
  const m = inch(v);
  if (!isFinite(m) || m < def * 0.3 || m > def * 3.2) return undefined;
  if (Math.abs(m - def) < 0.01) return undefined;
  return m;
}

export function rawToItems(raw: RawItem[], catalog: Record<string, CatalogEntry>, fixes: string[]): Item[] {
  const used = new Set<string>();
  const out: Item[] = [];
  for (const r of raw ?? []) {
    const e = resolveRef(r.ref, catalog);
    if (!e) {
      fixes.push(`Left out “${r.ref}”, which isn’t in the library`);
      continue;
    }
    if (e.category === 'builtin') continue;
    let id = (r.id || e.id.replace(/^own-/, '')).replace(/[^\w-]/g, '-').slice(0, 40);
    while (used.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    used.add(id);
    const x = inch(Number(r.x));
    const y = inch(Number(r.y));
    if (!isFinite(x) || !isFinite(y)) {
      fixes.push(`Skipped ${e.name} — it came without a position`);
      continue;
    }
    const resizable = e.resizable !== false;
    out.push({
      id,
      ref: e.id,
      x,
      y,
      rotation: bearingToRotation(Number(r.facing ?? 180)),
      w: sizeOverride(r.w, e.w, resizable),
      d: sizeOverride(r.d, e.d, resizable),
      h: sizeOverride(r.h, e.h, resizable),
      finishes: cleanFinishes(r.finish),
      elevation: r.elevation != null && isFinite(r.elevation) ? inch(r.elevation) : undefined,
    });
  }
  return out;
}

interface Body {
  it: Item;
  e: CatalogEntry;
  obb: OBB;
  fixed: boolean;
  circle?: number;
  weight: number;
  kind: 'seat' | 'table' | 'chair' | 'other';
}

function bodyOf(it: Item, e: CatalogEntry, fixed: boolean): Body | null {
  if (isFlat(e) || e.mount === 'wall' || e.mount === 'surface' || e.generator === 'curtain') return null;
  let w = it.w ?? e.w;
  let d = it.d ?? e.d;
  let circle: number | undefined;
  if (e.category === 'plant') {
    const pr = (e.params.potR as number) ?? Math.min(0.28, Math.min(w, d) * 0.3);
    w = d = pr * 2;
    circle = pr;
  } else if (e.category === 'floor-lamp' && e.params.style !== 'arc') {
    w = d = 0.3;
    circle = 0.15;
  } else if (e.params.shape === 'round' && Math.abs(w - d) < 0.05) circle = w / 2;
  const kind: Body['kind'] = e.category === 'dining-chair' || e.category === 'office-chair' ? 'chair' : e.category.endsWith('table') || e.category === 'desk' ? 'table' : e.category === 'sofa' || e.category === 'sectional' || e.category === 'lounge-chair' ? 'seat' : 'other';
  return { it, e, obb: obbOf(it.x, it.y, w, d, it.rotation), fixed, circle, weight: w * d * (e.h + 0.3), kind };
}

function overlap(a: Body, b: Body): { x: number; y: number; depth: number } | null {
  if (a.circle && b.circle) {
    const dx = b.obb.c.x - a.obb.c.x;
    const dy = b.obb.c.y - a.obb.c.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const depth = a.circle + b.circle - dist;
    if (depth <= 0) return null;
    return { x: (-dx / dist) * depth, y: (-dy / dist) * depth, depth };
  }
  const ov = obbOverlap(a.obb, b.obb);
  if (!ov) return null;
  return { x: ov.mtv.x, y: ov.mtv.y, depth: ov.depth };
}

function allowed(a: Body, b: Body, depth: number) {
  const pair = (x: Body['kind'], y: Body['kind']) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x);
  if (pair('chair', 'table')) return depth < 0.3;
  if (a.e.category === 'bench' || b.e.category === 'bench' || a.e.category === 'console' || b.e.category === 'console') return depth < 0.02;
  if (a.e.category === 'ottoman' || b.e.category === 'ottoman') return depth < 0.02;
  return depth < 0.008;
}

function doorZones(room: Room): OBB[] {
  const ws = walls(room);
  const out: OBB[] = [];
  for (const o of room.openings) {
    const w = ws[o.wall];
    if (!w || o.kind === 'niche' || o.kind === 'window') continue;
    const mid = o.offset + o.width / 2;
    const inward = o.swing !== 'out' && (o.kind === 'door' || o.kind === 'double-door' || o.kind === 'french-door');
    // match the planner's checks: 0.5 m in front of out-swinging glass, 0.75 m for openings
    const depth = inward ? Math.max(o.kind === 'door' ? o.width : o.width / 2, 0.78) : o.swing === 'out' ? 0.53 : 0.78;
    const cx = w.a.x + w.dir.x * mid + w.normal.x * (depth / 2);
    const cy = w.a.y + w.dir.y * mid + w.normal.y * (depth / 2);
    out.push(obbOf(cx, cy, o.width * (inward ? 1 : 0.6), depth, rotationFacingInto(w)));
  }
  return out;
}

function pushInside(room: Room, b: Body) {
  const c = polygonCentroid(room.outline);
  for (let k = 0; k < 40; k++) {
    const corners = rectCorners(b.it.x, b.it.y, b.obb.hw * 2, b.obb.hd * 2, b.it.rotation);
    const out = corners.filter((p) => !pointInPolygon(p, room.outline));
    if (!out.length) return k > 0;
    const dx = c.x - b.it.x;
    const dy = c.y - b.it.y;
    const l = Math.hypot(dx, dy) || 1;
    b.it.x += (dx / l) * 0.03;
    b.it.y += (dy / l) * 0.03;
    b.obb = { ...b.obb, c: { x: b.it.x, y: b.it.y } };
  }
  return true;
}

/** Nudge items until nothing overlaps, crosses a wall or blocks a door. */
export function settle(room: Room, items: Item[], catalog: Record<string, CatalogEntry>, opts: { movable?: Set<string> } = {}): { items: Item[]; fixes: string[] } {
  const fixes: string[] = [];
  const work = items.map((it) => ({ ...it }));
  const orig = new Map(work.map((it) => [it.id, { x: it.x, y: it.y }]));
  const bodies: Body[] = [];
  for (const f of room.fixtures) {
    const e = catalog[f.ref] ?? CATALOG_MAP[f.ref];
    if (!e) continue;
    const b = bodyOf(f, e, true);
    if (b) bodies.push(b);
  }
  const dz = doorZones(room);
  for (const z of dz) bodies.push({ it: { id: '__door', ref: '', x: z.c.x, y: z.c.y, rotation: z.rotation }, e: CATALOG_MAP['builtin-column'], obb: z, fixed: true, weight: 1e9, kind: 'other' });
  const movers: Body[] = [];
  for (const it of work) {
    const e = catalog[it.ref];
    if (!e) continue;
    // wall pieces: seat them on the nearest wall
    if (e.mount === 'wall') {
      const nw = nearestWall(room, it);
      const rot = rotationFacingInto(nw.wall);
      const dd = (it.d ?? e.d) / 2 + 0.004;
      it.x = nw.point.x + nw.wall.normal.x * dd;
      it.y = nw.point.y + nw.wall.normal.y * dd;
      it.rotation = rot;
      it.wall = nw.wall.index;
      if (it.elevation == null) it.elevation = Math.max(1.3, (it.h ?? e.h) / 2 + 0.9);
      continue;
    }
    const b = bodyOf(it, e, !!it.locked || (opts.movable ? !opts.movable.has(it.id) : false));
    if (!b) continue;
    bodies.push(b);
    if (!b.fixed) movers.push(b);
  }
  for (const b of movers) pushInside(room, b);
  for (let iter = 0; iter < 60; iter++) {
    let any = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const c = bodies[j];
        if (a.fixed && c.fixed) continue;
        const ov = overlap(a, c);
        if (!ov || allowed(a, c, ov.depth)) continue;
        any = true;
        // mtv pushes a away from c
        const wa = a.fixed ? 0 : c.fixed ? 1 : c.weight / (a.weight + c.weight);
        const wc = 1 - wa;
        const k = 1.02;
        if (!a.fixed) {
          a.it.x += ov.x * wa * k;
          a.it.y += ov.y * wa * k;
          a.obb = { ...a.obb, c: { x: a.it.x, y: a.it.y } };
        }
        if (!c.fixed) {
          c.it.x -= ov.x * wc * k;
          c.it.y -= ov.y * wc * k;
          c.obb = { ...c.obb, c: { x: c.it.x, y: c.it.y } };
        }
      }
    }
    for (const b of movers) if (pushInside(room, b)) any = true;
    if (!any) break;
  }
  // report meaningful nudges
  for (const it of work) {
    const o = orig.get(it.id);
    if (!o) continue;
    const moved = Math.hypot(it.x - o.x, it.y - o.y);
    if (moved > 0.08) {
      const e = catalog[it.ref];
      fixes.push(`Nudged ${e?.name.replace(/^Your /, 'your ') ?? it.id} ${Math.round(moved / 0.0254)}″ to clear its surroundings`);
    }
  }
  return { items: work, fixes };
}

export function ideaToLayout(room: Room, raw: RawIdea, catalog: Record<string, CatalogEntry>, idPrefix: string): { layout: Layout; fixes: string[] } {
  const fixes: string[] = [];
  const items = rawToItems(raw.items ?? [], catalog, fixes);
  const settled = settle(room, items, catalog);
  fixes.push(...settled.fixes);
  const zones: Zone[] = (raw.zones ?? [])
    .filter((z) => isFinite(Number(z.x)) && isFinite(Number(z.y)))
    .map((z) => ({
      kind: (['play', 'listening', 'conversation', 'reading', 'tea', 'tree', 'work', 'dining', 'path', 'note'].includes(String(z.kind)) ? z.kind : 'note') as Zone['kind'],
      label: z.label,
      x: inch(Number(z.x)),
      y: inch(Number(z.y)),
      w: z.w ? inch(Number(z.w)) : undefined,
      d: z.d ? inch(Number(z.d)) : undefined,
      r: z.r ? inch(Number(z.r)) : undefined,
    }));
  const b = bounds(room.outline);
  const zonesIn = zones.filter((z) => z.x > b.minX - 0.5 && z.x < b.maxX + 0.5 && z.y > b.minY - 0.5 && z.y < b.maxY + 0.5);
  const now = Date.now();
  return {
    layout: {
      id: `${idPrefix}`,
      roomId: room.id,
      name: (raw.name ?? 'Designer idea').slice(0, 48),
      direction: raw.direction?.slice(0, 40),
      concept: raw.concept,
      moves: raw.moves?.slice(0, 8),
      items: settled.items,
      zones: zonesIn,
      source: 'ai',
      createdAt: now,
      updatedAt: now,
    },
    fixes,
  };
}
