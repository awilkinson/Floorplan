import { CATALOG_MAP, isFlat, isSeat } from '../catalog/catalog';
import { bounds, itemAxes, obbOf, obbOverlap, pointInPolygon, rectCorners, walls, type OBB } from '../model/geometry';
import type { CatalogEntry, Item, Layout, Room, Vec2 } from '../model/types';
import { formatLength } from '../model/units';

// Design checks: the rules a good space planner applies without thinking.

export type Status = 'good' | 'warn' | 'bad' | 'info';

export interface Check {
  id: string;
  group: 'Flow' | 'Seating' | 'Hi-fi' | 'Baby' | 'Christmas' | 'Light' | 'Fit';
  status: Status;
  label: string;
  detail?: string;
  items?: string[];
}

export interface PathResult {
  from: string;
  to: string;
  points: Vec2[];
  minWidth: number;
  tight: boolean;
  blocked: boolean;
}

export interface HifiResult {
  left: Vec2;
  right: Vec2;
  seat: Vec2;
  seatId: string;
  spacing: number;
  distance: number;
  angle: number;
  ok: boolean;
  notes: string[];
}

export interface Analysis {
  score: number;
  checks: Check[];
  conflicts: { x: number; y: number; r: number; label: string }[];
  paths: PathResult[];
  hifi?: HifiResult;
  playZone?: { x: number; y: number; r: number };
  treeSpot?: { x: number; y: number; r: number };
}

interface Solid {
  item: Item;
  entry: CatalogEntry;
  obb: OBB;
  /** Round pieces collide as circles. */
  circle?: number;
  h: number;
  kind: 'solid' | 'seat' | 'table' | 'lamp' | 'plant' | 'fixture' | 'speaker' | 'tree';
}

function entryOf(ref: string, custom: Record<string, CatalogEntry>) {
  return custom[ref] ?? CATALOG_MAP[ref];
}

function solidsOf(room: Room, layout: Layout, custom: Record<string, CatalogEntry>): Solid[] {
  const out: Solid[] = [];
  for (const it of [...room.fixtures, ...layout.items]) {
    const e = entryOf(it.ref, custom);
    if (!e || it.hidden) continue;
    if (isFlat(e) || e.mount === 'wall' || e.mount === 'surface') continue;
    if (e.generator === 'curtain' || e.generator === 'pictureLight') continue;
    let w = it.w ?? e.w;
    let d = it.d ?? e.d;
    const h = it.h ?? e.h;
    let kind: Solid['kind'] = 'solid';
    if (it.fixed) kind = 'fixture';
    else if (e.category === 'floor-lamp') {
      kind = 'lamp';
      // collide on the base, the shade overhangs
      const base = e.params.style === 'arc' ? 0.34 : 0.3;
      if (e.params.style === 'arc') {
        const { v } = itemAxes(it.rotation);
        out.push({ item: { ...it, x: it.x - v.x * (d / 2 - 0.2), y: it.y - v.y * (d / 2 - 0.2) }, entry: e, obb: obbOf(it.x - v.x * (d / 2 - 0.2), it.y - v.y * (d / 2 - 0.2), 0.32, 0.42, it.rotation), h, kind });
        continue;
      }
      w = Math.min(w, base);
      d = Math.min(d, base);
    } else if (e.category === 'plant') {
      kind = 'plant';
      const pr = (e.params.potR as number) ?? Math.min(0.28, Math.min(w, d) * 0.3);
      w = d = pr * 2;
    } else if (e.category === 'seasonal') kind = 'tree';
    else if (isSeat(e)) kind = 'seat';
    else if (e.category.endsWith('table') || e.category === 'desk' || e.category === 'console') kind = 'table';
    else if (e.tags?.includes('speaker')) kind = 'speaker';
    const round =
      kind === 'plant' ||
      kind === 'tree' ||
      kind === 'lamp' ||
      e.params.shape === 'round' ||
      e.params.style === 'round' ||
      e.params.style === 'pouf' ||
      e.params.kind === 'basket' ||
      (e.generator === 'loungeChair' && (e.params.style === 'swivel' || e.params.style === 'barrel' || e.params.style === 'egg'));
    out.push({ item: it, entry: e, obb: obbOf(it.x, it.y, w, d, it.rotation), circle: round && Math.abs(w - d) < 0.05 ? Math.min(w, d) / 2 : undefined, h, kind });
  }
  return out;
}

/** Overlap between two solids, honouring round footprints. */
function overlapOf(a: Solid, b: Solid): { depth: number } | null {
  if (a.circle && b.circle) {
    const d = Math.hypot(a.obb.c.x - b.obb.c.x, a.obb.c.y - b.obb.c.y);
    const depth = a.circle + b.circle - d;
    return depth > 0 ? { depth } : null;
  }
  if (a.circle || b.circle) {
    const c = a.circle ? a : b;
    const o = a.circle ? b : a;
    const q = closestInOBB(c.obb.c, o.obb);
    const d = Math.hypot(q.x - c.obb.c.x, q.y - c.obb.c.y);
    const inside = inOBB(c.obb.c, o.obb, 0);
    const depth = inside ? c.circle! + 0.01 : c.circle! - d;
    return depth > 0 ? { depth } : null;
  }
  const ov = obbOverlap(a.obb, b.obb);
  return ov ? { depth: ov.depth } : null;
}

function closestInOBB(p: Vec2, o: OBB): Vec2 {
  const dx = p.x - o.c.x;
  const dy = p.y - o.c.y;
  const c = Math.cos(-o.rotation);
  const s = Math.sin(-o.rotation);
  const lx = Math.max(-o.hw, Math.min(o.hw, dx * c - dy * s));
  const ly = Math.max(-o.hd, Math.min(o.hd, dx * s + dy * c));
  const c2 = Math.cos(o.rotation);
  const s2 = Math.sin(o.rotation);
  return { x: o.c.x + lx * c2 - ly * s2, y: o.c.y + lx * s2 + ly * c2 };
}

function inSolid(p: Vec2, s: Solid, margin: number) {
  if (s.circle) return Math.hypot(p.x - s.obb.c.x, p.y - s.obb.c.y) <= s.circle + margin;
  return inOBB(p, s.obb, margin);
}

function allowedOverlap(a: Solid, b: Solid, depth: number) {
  const pair = (x: Solid['kind'], y: Solid['kind']) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x);
  // dining chairs tuck under tables
  if (pair('seat', 'table')) {
    const seat = a.kind === 'seat' ? a : b;
    if (seat.entry.category === 'dining-chair' || seat.entry.category === 'office-chair') return depth < 0.3;
  }
  // plants and lamps tuck beside things
  if ((a.kind === 'plant' || b.kind === 'plant') && depth < 0.1) return true;
  if ((a.kind === 'lamp' || b.kind === 'lamp') && depth < 0.06) return true;
  // bench or console behind a sofa can touch
  return depth < 0.015;
}

export function analyzeLayout(room: Room, layout: Layout, custom: Record<string, CatalogEntry> = {}, opts: { light?: boolean } = {}): Analysis {
  const checks: Check[] = [];
  const conflicts: Analysis['conflicts'] = [];
  const solids = solidsOf(room, layout, custom);
  const furniture = solids.filter((s) => s.kind !== 'fixture');
  const units = 'imperial' as const;
  const fmt = (m: number) => formatLength(m, units, { precision: 1 });

  // ---------------------------------------------------------------- Fit: collisions & walls
  const colliding: string[] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      if (a.kind === 'fixture' && b.kind === 'fixture') continue;
      const ov = overlapOf(a, b);
      if (!ov) continue;
      if (allowedOverlap(a, b, ov.depth)) continue;
      const cx = (a.obb.c.x + b.obb.c.x) / 2;
      const cy = (a.obb.c.y + b.obb.c.y) / 2;
      conflicts.push({ x: cx, y: cy, r: Math.min(0.35, 0.12 + ov.depth), label: `${short(a.entry)} overlaps ${short(b.entry)}` });
      colliding.push(a.item.id, b.item.id);
    }
  }
  for (const s of furniture) {
    const corners = rectCorners(s.obb.c.x, s.obb.c.y, s.obb.hw * 2 - 0.02, s.obb.hd * 2 - 0.02, s.obb.rotation);
    if (corners.some((c) => !pointInPolygon(c, room.outline))) {
      conflicts.push({ x: s.obb.c.x, y: s.obb.c.y, r: 0.25, label: `${short(s.entry)} goes through a wall` });
      colliding.push(s.item.id);
    }
  }
  checks.push(
    colliding.length
      ? { id: 'fit', group: 'Fit', status: 'bad', label: `${new Set(colliding).size} pieces overlap or hit a wall`, detail: conflicts.slice(0, 3).map((c) => c.label).join('; '), items: [...new Set(colliding)] }
      : { id: 'fit', group: 'Fit', status: 'good', label: 'Everything fits without overlaps' },
  );

  // ---------------------------------------------------------------- Door swings & approaches
  const ws = walls(room);
  const blockedDoors: string[] = [];
  for (const o of room.openings) {
    if (o.kind === 'niche' || o.kind === 'window') continue;
    const w = ws[o.wall];
    if (!w) continue;
    const hingeT = o.hinge === 'end' ? o.offset + o.width : o.offset;
    const hinge = { x: w.a.x + w.dir.x * hingeT, y: w.a.y + w.dir.y * hingeT };
    const mid = o.offset + o.width / 2;
    const swingsIn = o.swing === 'in' && o.kind === 'door';
    const approachDepth = swingsIn ? o.width : o.swing === 'out' ? 0.5 : 0.75;
    // sample the swing / approach zone
    const zone: Vec2[] = [];
    for (let a = 0; a <= 1; a += 0.2)
      for (let r = 0.15; r <= approachDepth; r += 0.15) {
        if (o.swing === 'in' && o.kind === 'door') {
          const sgn = o.hinge === 'end' ? -1 : 1;
          const ang = a * (Math.PI / 2);
          zone.push({ x: hinge.x + (w.dir.x * sgn * Math.cos(ang) + w.normal.x * Math.sin(ang)) * r, y: hinge.y + (w.dir.y * sgn * Math.cos(ang) + w.normal.y * Math.sin(ang)) * r });
        } else {
          // the useful part of a glass door's approach is its middle
          const t = o.offset + o.width * (0.2 + a * 0.6);
          zone.push({ x: w.a.x + w.dir.x * t + w.normal.x * r, y: w.a.y + w.dir.y * t + w.normal.y * r });
        }
      }
    for (const s of furniture) {
      if (s.kind === 'lamp' && o.kind === 'french-door' && o.swing === 'out') continue;
      const hits = zone.filter((p) => inSolid(p, s, 0.02)).length;
      if (hits > 0) {
        blockedDoors.push(s.item.id);
        const c = { x: w.a.x + w.dir.x * mid + w.normal.x * 0.4, y: w.a.y + w.dir.y * mid + w.normal.y * 0.4 };
        conflicts.push({ x: c.x, y: c.y, r: 0.3, label: `${short(s.entry)} is in the way of the ${o.label?.toLowerCase() ?? 'door'}` });
      }
    }
  }
  checks.push(
    blockedDoors.length
      ? { id: 'doors', group: 'Flow', status: 'bad', label: 'A door or its approach is blocked', detail: 'Keep door swings clear and about 30″ in front of glass doors.', items: blockedDoors }
      : { id: 'doors', group: 'Flow', status: 'good', label: 'Door swings and approaches are clear' },
  );

  // ---------------------------------------------------------------- Circulation
  const paths: PathResult[] = [];
  const grid = opts.light ? null : buildGrid(room, solids);
  if (grid) {
    const entries = entryPoints(room);
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].group === entries[j].group) continue;
        const p = findPath(grid, entries[i].p, entries[j].p);
        if (!p) {
          paths.push({ from: entries[i].name, to: entries[j].name, points: [entries[i].p, entries[j].p], minWidth: 0, tight: true, blocked: true });
          continue;
        }
        paths.push({ from: entries[i].name, to: entries[j].name, points: p.points, minWidth: p.minWidth, tight: p.minWidth < 0.86, blocked: false });
      }
    const blocked = paths.filter((p) => p.blocked);
    const tight = paths.filter((p) => !p.blocked && p.tight);
    if (blocked.length) checks.push({ id: 'flow', group: 'Flow', status: 'bad', label: `No clear path from ${blocked[0].from} to ${blocked[0].to}` });
    else if (tight.length) {
      const t = tight.sort((a, b) => a.minWidth - b.minWidth)[0];
      checks.push({ id: 'flow', group: 'Flow', status: 'warn', label: `Walkway pinches to ${fmt(t.minWidth)}`, detail: `Between ${t.from} and ${t.to}. Aim for 36″ on main routes.` });
    } else if (paths.length) {
      const min = Math.min(...paths.map((p) => p.minWidth));
      checks.push({ id: 'flow', group: 'Flow', status: 'good', label: `Walkways stay at least ${fmt(Math.min(min, 1.5))} wide` });
    }
  }

  // ---------------------------------------------------------------- Seating group
  const seats = furniture.filter((s) => s.kind === 'seat' && s.entry.category !== 'dining-chair' && s.entry.category !== 'office-chair' && s.entry.category !== 'bench');
  const sofas = seats.filter((s) => s.entry.category === 'sofa' || s.entry.category === 'sectional');
  const main = sofas.sort((a, b) => b.obb.hw - a.obb.hw)[0] ?? seats[0];
  if (main) {
    const { v } = itemAxes(main.item.rotation);
    const front = { x: main.obb.c.x + v.x * main.obb.hd, y: main.obb.c.y + v.y * main.obb.hd };
    const coffee = furniture
      .filter((s) => s.entry.category === 'coffee-table' || s.entry.category === 'ottoman')
      .map((s) => ({ s, d: Math.hypot(s.obb.c.x - front.x, s.obb.c.y - front.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (coffee && coffee.d < 1.6) {
      const gap = gapBetween(main.obb, coffee.s.obb);
      const ratio = (coffee.s.obb.hw * 2) / (main.obb.hw * 2);
      if (gap < 0.3) checks.push({ id: 'coffee', group: 'Seating', status: 'warn', label: `Coffee table is only ${fmt(gap)} from the ${short(main.entry).toLowerCase()}`, detail: 'Leave 14–18″ for knees.' });
      else if (gap > 0.62) checks.push({ id: 'coffee', group: 'Seating', status: 'warn', label: `Coffee table is ${fmt(gap)} away — a stretch to reach`, detail: 'Pull it within 14–18″.' });
      else checks.push({ id: 'coffee', group: 'Seating', status: 'good', label: `Coffee table sits ${fmt(gap)} from the seat` });
      if (ratio < 0.4 && main.entry.category === 'sofa') checks.push({ id: 'coffee-size', group: 'Seating', status: 'info', label: 'Coffee table reads small for the sofa', detail: 'About two-thirds of the sofa length looks balanced.' });
    } else if (seats.length >= 2) checks.push({ id: 'coffee', group: 'Seating', status: 'info', label: 'No coffee table within reach of the main seat' });
    // conversation distance
    const others = seats.filter((s) => s !== main);
    const far = others.filter((s) => Math.hypot(s.obb.c.x - main.obb.c.x, s.obb.c.y - main.obb.c.y) < 4.2 && Math.hypot(s.obb.c.x - main.obb.c.x, s.obb.c.y - main.obb.c.y) > 3.3);
    if (far.length) checks.push({ id: 'talk', group: 'Seating', status: 'warn', label: 'Seats are more than 10′ apart', detail: 'Conversation groups work best inside a 10′ circle.', items: far.map((f) => f.item.id) });
    else if (others.length) checks.push({ id: 'talk', group: 'Seating', status: 'good', label: 'Seating sits within an easy 10′ conversation circle' });
    // rug under front legs
    const rugs = layout.items.map((it) => ({ it, e: entryOf(it.ref, custom) })).filter((x) => x.e?.category === 'rug');
    if (rugs.length) {
      const r = rugs.sort((a, b) => (b.it.w ?? b.e!.w) * (b.it.d ?? b.e!.d) - (a.it.w ?? a.e!.w) * (a.it.d ?? a.e!.d))[0];
      const rugObb = obbOf(r.it.x, r.it.y, r.it.w ?? r.e!.w, r.it.d ?? r.e!.d, r.it.rotation);
      const group = [main, ...others.filter((s) => Math.hypot(s.obb.c.x - main.obb.c.x, s.obb.c.y - main.obb.c.y) < 3.3)];
      const offRug = group.filter((s) => {
        const { v: fv } = itemAxes(s.item.rotation);
        const frontPt = { x: s.obb.c.x + fv.x * (s.obb.hd - 0.08), y: s.obb.c.y + fv.y * (s.obb.hd - 0.08) };
        return !inOBB(frontPt, rugObb, 0);
      });
      if (offRug.length) checks.push({ id: 'rug', group: 'Seating', status: 'warn', label: `${offRug.length === 1 ? short(offRug[0].entry) + ' floats' : offRug.length + ' seats float'} off the rug`, detail: 'Anchor at least the front legs of each seat on the rug.', items: offRug.map((s) => s.item.id) });
      else checks.push({ id: 'rug', group: 'Seating', status: 'good', label: 'The rug anchors the seating group' });
    }
  }

  // ---------------------------------------------------------------- Hi-fi
  let hifi: HifiResult | undefined;
  const speakers = furniture.filter((s) => s.entry.tags?.includes('speaker'));
  if (speakers.length >= 2) {
    const pair = pickPair(speakers);
    const [L, R] = pair;
    const mid = { x: (L.obb.c.x + R.obb.c.x) / 2, y: (L.obb.c.y + R.obb.c.y) / 2 };
    const spacing = Math.hypot(L.obb.c.x - R.obb.c.x, L.obb.c.y - R.obb.c.y);
    // listening seat: the seat nearest the ideal equilateral point
    const axis = { x: -(R.obb.c.y - L.obb.c.y) / spacing, y: (R.obb.c.x - L.obb.c.x) / spacing };
    const center = bounds(room.outline);
    const toRoom = { x: center.cx - mid.x, y: center.cy - mid.y };
    if (axis.x * toRoom.x + axis.y * toRoom.y < 0) {
      axis.x *= -1;
      axis.y *= -1;
    }
    const ideal = { x: mid.x + axis.x * spacing * 0.87, y: mid.y + axis.y * spacing * 0.87 };
    const cand = seats
      .map((s) => {
        const ear = earPoint(s, ideal);
        return { s, ear, d: Math.hypot(ear.x - ideal.x, ear.y - ideal.y) };
      })
      .sort((a, b) => a.d - b.d)[0];
    if (cand) {
      const P = cand.ear;
      const dl = Math.hypot(P.x - L.obb.c.x, P.y - L.obb.c.y);
      const dr = Math.hypot(P.x - R.obb.c.x, P.y - R.obb.c.y);
      const a1 = Math.atan2(L.obb.c.y - P.y, L.obb.c.x - P.x);
      const a2 = Math.atan2(R.obb.c.y - P.y, R.obb.c.x - P.x);
      let angle = Math.abs(a1 - a2);
      if (angle > Math.PI) angle = Math.PI * 2 - angle;
      const deg = (angle * 180) / Math.PI;
      const notes: string[] = [];
      let ok = true;
      if (deg < 42 || deg > 78) {
        ok = false;
        notes.push(deg < 42 ? `Speakers subtend only ${Math.round(deg)}° — move the seat closer or the speakers apart (aim for ~60°).` : `Speakers are ${Math.round(deg)}° apart from the seat — too wide; pull them in (aim for ~60°).`);
      }
      if (Math.abs(dl - dr) > 0.25) {
        ok = false;
        notes.push(`Seat is off-center by ${fmt(Math.abs(dl - dr))}; centre it between the speakers.`);
      }
      for (const s of pair) {
        const { v } = itemAxes(s.item.rotation);
        const to = { x: P.x - s.obb.c.x, y: P.y - s.obb.c.y };
        const tl = Math.hypot(to.x, to.y) || 1;
        const cos = (v.x * to.x + v.y * to.y) / tl;
        if (cos < Math.cos((30 * Math.PI) / 180)) notes.push(`Toe the ${short(s.entry)} in toward the seat.`);
        let wallDist = Infinity;
        for (const w of ws) {
          const rel = { x: s.obb.c.x - w.a.x, y: s.obb.c.y - w.a.y };
          const along = rel.x * w.dir.x + rel.y * w.dir.y;
          if (along < 0 || along > w.length) continue;
          wallDist = Math.min(wallDist, rel.x * w.normal.x + rel.y * w.normal.y - s.obb.hd);
        }
        if (wallDist < 0.3) notes.push(`${short(s.entry)} is ${fmt(Math.max(0, wallDist))} from a wall — 2–3′ out tightens the bass.`);
      }
      hifi = { left: L.obb.c, right: R.obb.c, seat: P, seatId: cand.s.item.id, spacing, distance: (dl + dr) / 2, angle: deg, ok: ok && notes.length === 0, notes };
      checks.push({
        id: 'hifi',
        group: 'Hi-fi',
        status: hifi.ok ? 'good' : cand.d > 1.5 ? 'bad' : 'warn',
        label: hifi.ok ? `Listening triangle: ${fmt(spacing)} apart, ${fmt(hifi.distance)} to the seat (${Math.round(deg)}°)` : `Listening triangle is off (${Math.round(deg)}°, ${fmt(spacing)} apart)`,
        detail: notes.join(' '),
        items: [L.item.id, R.item.id, cand.s.item.id],
      });
    }
  }

  // ---------------------------------------------------------------- Baby
  const goals = room.goals.map((g) => g.toLowerCase()).join(' ');
  let playZone: Analysis['playZone'];
  let treeSpot: Analysis['treeSpot'];
  if (goals.includes('baby') || layout.items.some((it) => entryOf(it.ref, custom)?.tags?.includes('baby'))) {
    const glass = furniture.filter((s) => s.entry.tags?.includes('glass'));
    if (glass.length) checks.push({ id: 'glass', group: 'Baby', status: 'warn', label: `${short(glass[0].entry)} has a glass top`, detail: 'Softer, rounded stone or wood is kinder at crawling height.', items: glass.map((g) => g.item.id) });
    const fireplace = room.fixtures.find((f) => entryOf(f.ref, custom)?.generator === 'fireplace');
    const gate = layout.items.some((it) => it.ref === 'hearth-gate');
    if (fireplace && !gate) checks.push({ id: 'hearth', group: 'Baby', status: 'info', label: 'Consider a hearth gate for the fireplace' });
    if (grid) {
      const best = largestOpen(grid, room, fireplace);
      if (best) {
        playZone = best;
        checks.push({ id: 'play', group: 'Baby', status: best.r >= 0.9 ? 'good' : 'warn', label: best.r >= 0.9 ? `Open play floor: a ${fmt(best.r * 2)} circle` : `Largest open floor is only ${fmt(best.r * 2)} across`, detail: best.r >= 0.9 ? undefined : 'Babies need about 6′ of open, soft floor to roll and crawl.' });
      }
    }
  }

  // ---------------------------------------------------------------- Christmas
  const tree = furniture.find((s) => s.kind === 'tree');
  const fire = room.fixtures.find((f) => entryOf(f.ref, custom)?.generator === 'fireplace');
  if (tree) {
    if (fire) {
      const fe = entryOf(fire.ref, custom)!;
      const fo = obbOf(fire.x, fire.y, fire.w ?? fe.w, (fire.d ?? fe.d) + 0.9, fire.rotation);
      const gap = gapBetween(tree.obb, fo);
      checks.push(gap < 0.05 ? { id: 'tree', group: 'Christmas', status: 'bad', label: 'The tree is within 3′ of the fireplace', items: [tree.item.id] } : { id: 'tree', group: 'Christmas', status: 'good', label: 'The tree is a safe distance from the fire' });
    }
  } else if (goals.includes('christmas') && grid) {
    const spot = treeCandidate(grid, room, fire, solids, custom);
    if (spot) {
      treeSpot = spot;
      checks.push({ id: 'tree-spot', group: 'Christmas', status: 'info', label: 'There’s room for a 7½′ tree', detail: 'The dashed circle marks the best spot: by the glass, clear of paths and the fire.' });
    }
  }

  // ---------------------------------------------------------------- Light
  const lamps = [...room.fixtures, ...layout.items].filter((it) => {
    const e = entryOf(it.ref, custom);
    return e && (e.category === 'floor-lamp' || e.category === 'table-lamp');
  });
  if (main && main.kind === 'seat') {
    const near = lamps.filter((l) => Math.hypot(l.x - main.obb.c.x, l.y - main.obb.c.y) < 2.2);
    checks.push(near.length ? { id: 'lamp', group: 'Light', status: 'good', label: `${near.length} lamp${near.length > 1 ? 's light' : ' lights'} the main seating` } : { id: 'lamp', group: 'Light', status: 'warn', label: 'No lamp near the main seating for evenings' });
  }
  const reading = seats.filter((s) => s.entry.category === 'lounge-chair' && lamps.some((l) => Math.hypot(l.x - s.obb.c.x, l.y - s.obb.c.y) < 0.95));
  if (reading.length) checks.push({ id: 'reading', group: 'Light', status: 'good', label: `${reading.length === 1 ? 'A reading chair has' : reading.length + ' reading chairs have'} a lamp at the shoulder` });

  // ---------------------------------------------------------------- Score
  const weights: Record<Status, number> = { good: 0, info: 0, warn: 6, bad: 16 };
  const penalty = checks.reduce((s, c) => s + weights[c.status], 0);
  const score = Math.max(20, Math.min(100, 100 - penalty));
  return { score, checks, conflicts, paths, hifi, playZone, treeSpot };
}

function short(e: CatalogEntry) {
  return e.name.replace(/^Your /, '').replace(/\s*\(.*?\)\s*/g, '').trim();
}

function inOBB(p: Vec2, o: OBB, margin: number) {
  const dx = p.x - o.c.x;
  const dy = p.y - o.c.y;
  const c = Math.cos(-o.rotation);
  const s = Math.sin(-o.rotation);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= o.hw + margin && Math.abs(ly) <= o.hd + margin;
}

function gapBetween(a: OBB, b: OBB) {
  if (obbOverlap(a, b)) return 0;
  const ca = rectCorners(a.c.x, a.c.y, a.hw * 2, a.hd * 2, a.rotation);
  const cb = rectCorners(b.c.x, b.c.y, b.hw * 2, b.hd * 2, b.rotation);
  let best = Infinity;
  const segDist = (p: Vec2, q0: Vec2, q1: Vec2) => {
    const vx = q1.x - q0.x,
      vy = q1.y - q0.y;
    const t = Math.max(0, Math.min(1, ((p.x - q0.x) * vx + (p.y - q0.y) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(p.x - (q0.x + vx * t), p.y - (q0.y + vy * t));
  };
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      best = Math.min(best, segDist(ca[i], cb[j], cb[(j + 1) % 4]), segDist(cb[j], ca[i], ca[(i + 1) % 4]));
    }
  return best;
}

function earPoint(s: Solid, _toward: Vec2): Vec2 {
  const { v } = itemAxes(s.item.rotation);
  // a seated head sits a little behind the seat center
  return { x: s.obb.c.x - v.x * s.obb.hd * 0.25, y: s.obb.c.y - v.y * s.obb.hd * 0.25 };
}

function pickPair(sp: Solid[]): [Solid, Solid] {
  let best: [Solid, Solid] = [sp[0], sp[1]];
  let score = -Infinity;
  for (let i = 0; i < sp.length; i++)
    for (let j = i + 1; j < sp.length; j++) {
      const a = sp[i],
        b = sp[j];
      const same = a.item.ref === b.item.ref ? 2 : 0;
      const d = Math.hypot(a.obb.c.x - b.obb.c.x, a.obb.c.y - b.obb.c.y);
      const s = same + (d > 1.2 && d < 5 ? 1 : 0) - Math.abs(d - 2.6) * 0.1;
      if (s > score) {
        score = s;
        best = [a, b];
      }
    }
  return best;
}

// ---------------------------------------------------------------------------
// Occupancy grid, clearance and paths

interface Grid {
  x0: number;
  y0: number;
  cell: number;
  nx: number;
  ny: number;
  /** distance (m) from each free cell to the nearest obstacle; 0 = blocked */
  clear: Float32Array;
}

function buildGrid(room: Room, solids: Solid[]): Grid {
  const b = bounds(room.outline);
  const cell = 0.06;
  // pad by two cells so the walls themselves count as obstacles
  const x0 = b.minX - cell * 2;
  const y0 = b.minY - cell * 2;
  const nx = Math.ceil(b.w / cell) + 5;
  const ny = Math.ceil(b.h / cell) + 5;
  const blocked = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const p = { x: x0 + i * cell, y: y0 + j * cell };
      if (!pointInPolygon(p, room.outline)) {
        blocked[j * nx + i] = 1;
        continue;
      }
      for (const s of solids) {
        if (s.kind === 'lamp' && s.h > 1.8 && s.obb.hw < 0.2) {
          if (inOBB(p, s.obb, 0)) blocked[j * nx + i] = 1;
          continue;
        }
        if (inSolid(p, s, 0)) {
          blocked[j * nx + i] = 1;
          break;
        }
      }
    }
  // chamfer distance transform
  const INF = 1e9;
  const d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = blocked[k] ? 0 : INF;
  const a = 1,
    dg = Math.SQRT2;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!d[k]) continue;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + a);
      if (j > 0) v = Math.min(v, d[k - nx] + a);
      if (i > 0 && j > 0) v = Math.min(v, d[k - nx - 1] + dg);
      if (i < nx - 1 && j > 0) v = Math.min(v, d[k - nx + 1] + dg);
      d[k] = v;
    }
  for (let j = ny - 1; j >= 0; j--)
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i;
      if (!d[k]) continue;
      let v = d[k];
      if (i < nx - 1) v = Math.min(v, d[k + 1] + a);
      if (j < ny - 1) v = Math.min(v, d[k + nx] + a);
      if (i < nx - 1 && j < ny - 1) v = Math.min(v, d[k + nx + 1] + dg);
      if (i > 0 && j < ny - 1) v = Math.min(v, d[k + nx - 1] + dg);
      d[k] = v;
    }
  for (let k = 0; k < d.length; k++) d[k] = d[k] >= INF ? 0 : d[k] * cell;
  return { x0, y0, cell, nx, ny, clear: d };
}

function entryPoints(room: Room): { name: string; group: string; p: Vec2 }[] {
  const ws = walls(room);
  const out: { name: string; group: string; p: Vec2 }[] = [];
  const french = room.openings.filter((o) => o.kind === 'french-door' || o.kind === 'sliding-door');
  // treat a run of glass doors on one wall as one destination: use the middle one
  const byWall = new Map<number, typeof french>();
  for (const o of french) byWall.set(o.wall, [...(byWall.get(o.wall) ?? []), o]);
  for (const [wall, list] of byWall) {
    const sorted = list.sort((a, b) => a.offset - b.offset);
    const o = sorted[Math.floor(sorted.length / 2)];
    const w = ws[wall];
    const m = o.offset + o.width / 2;
    out.push({ name: 'the terrace doors', group: `w${wall}`, p: { x: w.a.x + w.dir.x * m + w.normal.x * 0.35, y: w.a.y + w.dir.y * m + w.normal.y * 0.35 } });
  }
  for (const o of room.openings) {
    if (o.kind !== 'door' && o.kind !== 'double-door' && o.kind !== 'opening' && o.kind !== 'archway' && o.kind !== 'pocket-door') continue;
    const w = ws[o.wall];
    const m = o.offset + o.width / 2;
    out.push({ name: `the ${(o.label ?? 'door').toLowerCase()}`, group: o.id, p: { x: w.a.x + w.dir.x * m + w.normal.x * 0.35, y: w.a.y + w.dir.y * m + w.normal.y * 0.35 } });
  }
  return out;
}

function findPath(g: Grid, a: Vec2, b: Vec2): { points: Vec2[]; minWidth: number } | null {
  const toCell = (p: Vec2) => [Math.round((p.x - g.x0) / g.cell), Math.round((p.y - g.y0) / g.cell)] as const;
  const [ai, aj] = toCell(a);
  const [bi, bj] = toCell(b);
  const minClear = 0.26; // a person turned sideways
  const N = g.nx * g.ny;
  const idx = (i: number, j: number) => j * g.nx + i;
  const start = idx(Math.max(0, Math.min(g.nx - 1, ai)), Math.max(0, Math.min(g.ny - 1, aj)));
  const goal = idx(Math.max(0, Math.min(g.nx - 1, bi)), Math.max(0, Math.min(g.ny - 1, bj)));
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const open: number[] = [start];
  const inOpen = new Uint8Array(N);
  gScore[start] = 0;
  inOpen[start] = 1;
  const h = (k: number) => Math.hypot((k % g.nx) - bi, Math.floor(k / g.nx) - bj);
  const fScore = new Float32Array(N).fill(Infinity);
  fScore[start] = h(start);
  let iter = 0;
  while (open.length && iter++ < 60000) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bestI]]) bestI = i;
    const cur = open[bestI];
    open.splice(bestI, 1);
    inOpen[cur] = 0;
    if (cur === goal) break;
    const ci = cur % g.nx;
    const cj = Math.floor(cur / g.nx);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.ny) continue;
        const nk = idx(ni, nj);
        const c = g.clear[nk];
        const nearEnds = Math.hypot(ni - ai, nj - aj) < 6 || Math.hypot(ni - bi, nj - bj) < 6;
        if (c < minClear && !(nearEnds && c > 0.05)) continue;
        const step = di && dj ? Math.SQRT2 : 1;
        const penalty = 1 + 0.6 / Math.max(0.1, c);
        const t = gScore[cur] + step * penalty;
        if (t < gScore[nk]) {
          came[nk] = cur;
          gScore[nk] = t;
          fScore[nk] = t + h(nk);
          if (!inOpen[nk]) {
            open.push(nk);
            inOpen[nk] = 1;
          }
        }
      }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const pts: Vec2[] = [];
  let k = goal;
  let minW = Infinity;
  let n = 0;
  while (k !== -1 && n++ < N) {
    const i = k % g.nx;
    const j = Math.floor(k / g.nx);
    const nearEnds = Math.hypot(i - ai, j - aj) < 7 || Math.hypot(i - bi, j - bj) < 7;
    if (!nearEnds) minW = Math.min(minW, g.clear[k] * 2);
    pts.push({ x: g.x0 + i * g.cell, y: g.y0 + j * g.cell });
    if (k === start) break;
    k = came[k];
  }
  pts.reverse();
  return { points: simplify(pts), minWidth: minW === Infinity ? 1.5 : minW };
}

function simplify(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i += 3) out.push(pts[i]);
  out.push(pts[pts.length - 1]);
  return out;
}

function largestOpen(g: Grid, room: Room, fireplace?: Item): { x: number; y: number; r: number } | null {
  let best = -1;
  let bk = -1;
  for (let k = 0; k < g.clear.length; k++) {
    if (g.clear[k] > best) {
      const x = g.x0 + (k % g.nx) * g.cell;
      const y = g.y0 + Math.floor(k / g.nx) * g.cell;
      if (fireplace && Math.hypot(x - fireplace.x, y - fireplace.y) < 1.6) continue;
      best = g.clear[k];
      bk = k;
    }
  }
  if (bk < 0) return null;
  void room;
  return { x: g.x0 + (bk % g.nx) * g.cell, y: g.y0 + Math.floor(bk / g.nx) * g.cell, r: Math.min(best, 1.4) };
}

function treeCandidate(g: Grid, room: Room, fire: Item | undefined, solids: Solid[], custom: Record<string, CatalogEntry>): { x: number; y: number; r: number } | null {
  // prefer spots near glazed openings, with clearance for a 56″ tree and away from the fire
  const ws = walls(room);
  const glass = room.openings.filter((o) => o.kind === 'french-door' || o.kind === 'window');
  const R = 0.72;
  let best: { x: number; y: number; r: number; s: number } | null = null;
  for (let k = 0; k < g.clear.length; k += 2) {
    if (g.clear[k] < R) continue;
    const x = g.x0 + (k % g.nx) * g.cell;
    const y = g.y0 + Math.floor(k / g.nx) * g.cell;
    if (fire && Math.hypot(x - fire.x, y - fire.y) < 2.0) continue;
    let near = 3;
    for (const o of glass) {
      const w = ws[o.wall];
      for (const t of [o.offset, o.offset + o.width]) {
        const p = { x: w.a.x + w.dir.x * t, y: w.a.y + w.dir.y * t };
        near = Math.min(near, Math.hypot(x - p.x, y - p.y));
      }
    }
    // corners feel natural for a tree
    const cornerBias = Math.min(...room.outline.map((c) => Math.hypot(x - c.x, y - c.y)));
    const s = -near * 1.2 - cornerBias * 0.4 - Math.abs(g.clear[k] - R) * 0.5;
    if (!best || s > best.s) best = { x, y, r: R, s };
  }
  void solids;
  void custom;
  return best ? { x: best.x, y: best.y, r: best.r } : null;
}

// The plan, the 3D overlays and the checks panel all ask for the same
// analysis; share results by object identity.
const recent: { room: Room; layout: Layout; custom: Record<string, CatalogEntry>; a: Analysis }[] = [];
export function analyzeCached(room: Room, layout: Layout, custom: Record<string, CatalogEntry> = {}): Analysis {
  const hit = recent.find((m) => m.room === room && m.layout === layout && m.custom === custom);
  if (hit) return hit.a;
  const a = analyzeLayout(room, layout, custom);
  recent.unshift({ room, layout, custom, a });
  if (recent.length > 8) recent.pop();
  return a;
}
