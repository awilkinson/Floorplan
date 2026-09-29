import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { walls as wallList, bounds, pointInPolygon, type Wall } from '../model/geometry';
import type { Opening, Room } from '../model/types';
import { boxUV, roundedBox } from './geometry';
import { finishMaterial, roomMaterials } from './materials';
import { bookRow, objects } from '../catalog/gen/decor';
import { geometryFor, mergeTransformed } from './geometry';
import { fixedMaterial } from './materials';
import { makeFbm, makeRng } from './noise';

export interface WallBuild {
  index: number;
  full: THREE.Group;
  stub: THREE.Group;
  /** Inward normal in plan. */
  normal: { x: number; y: number };
  mid: { x: number; y: number };
}

export interface RoomBuild {
  root: THREE.Group;
  walls: WallBuild[];
  ceiling: THREE.Group;
  floorGeometry: THREE.BufferGeometry;
  outside: THREE.Group;
  windows: { center: THREE.Vector3; normal: THREE.Vector3; w: number; h: number }[];
  pots: THREE.Vector3[];
  bounds: ReturnType<typeof bounds>;
}

const up = new THREE.Vector3(0, 1, 0);

/** Matrix mapping a wall's local frame (x along wall, y up, z into room) to world. */
function wallMatrix(w: Wall) {
  const x = new THREE.Vector3(w.dir.x, 0, w.dir.y);
  const z = new THREE.Vector3(w.normal.x, 0, w.normal.y);
  const m = new THREE.Matrix4().makeBasis(x, up, z);
  m.setPosition(w.a.x, 0, w.a.y);
  return m;
}

function archPoints(x0: number, x1: number, spring: number, rise: number, seg = 18): [number, number][] {
  const w = x1 - x0;
  const R = (w * w) / 4 / (2 * rise) + rise / 2;
  const cx = (x0 + x1) / 2;
  const cy = spring + rise - R;
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const x = x0 + (w * i) / seg;
    const y = cy + Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx)));
    pts.push([x, y]);
  }
  return pts;
}

/** Opening outline in wall-local (u, v), counter-clockwise from bottom-left. */
function openingOutline(o: Opening, extraTop = 0): [number, number][] {
  const x0 = o.offset;
  const x1 = o.offset + o.width;
  const top = o.height + (o.transom ?? 0) + extraTop;
  const bottom = o.sill;
  if (o.archRise && o.archRise > 0.01) {
    const arch = archPoints(x0, x1, top, o.archRise).reverse(); // right -> left along the top
    return [[x0, bottom], [x1, bottom], ...arch, [x0, bottom]].slice(0, -1) as [number, number][];
  }
  return [
    [x0, bottom],
    [x1, bottom],
    [x1, top],
    [x0, top],
  ];
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  boxUV(g);
  return g;
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const f = list.filter(Boolean);
  if (!f.length) return null;
  for (const g of f) {
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  }
  const nonIdx = f.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(nonIdx, false);
}

/** A strip of molding following a 2D polyline in wall-local (u, v) at depth z. */
function moldingAlong(pts: [number, number][], width: number, depth: number, z: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-4) continue;
    const g = new THREE.BoxGeometry(len + width * 0.02, width, depth).toNonIndexed();
    g.rotateZ(Math.atan2(by - ay, bx - ax));
    g.translate((ax + bx) / 2, (ay + by) / 2, z + depth / 2);
    boxUV(g);
    out.push(g);
  }
  return out;
}

function rectFrame(x0: number, y0: number, x1: number, y1: number, width: number, depth: number, z = 0): THREE.BufferGeometry[] {
  return moldingAlong(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
    width,
    depth,
    z,
  );
}

export function buildRoom(room: Room, opts: { evening: boolean }): RoomBuild {
  const root = new THREE.Group();
  root.name = 'room';
  const H = room.ceilingHeight;
  const T = room.wallThickness;
  const mats = roomMaterials(room.finishes.wallColor, room.finishes.trimColor);
  const ws = wallList(room);
  const bb = bounds(room.outline);
  const result: WallBuild[] = [];
  const windows: RoomBuild['windows'] = [];

  // ---------------------------------------------------------------- Floor
  const floorShape = new THREE.Shape(room.outline.map((p) => new THREE.Vector2(p.x, -p.y)));
  const floorGeometry = new THREE.ShapeGeometry(floorShape);
  floorGeometry.rotateX(-Math.PI / 2);
  {
    const pos = floorGeometry.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i);
      uv[i * 2 + 1] = -pos.getZ(i);
    }
    floorGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  // ---------------------------------------------------------------- Walls
  for (const w of ws) {
    const full = new THREE.Group();
    const stub = new THREE.Group();
    full.name = `wall-${w.index}`;
    const M = wallMatrix(w);
    const ops = room.openings.filter((o) => o.wall === w.index).sort((a, b) => a.offset - b.offset);
    const L = w.length;
    const ext = T; // extend past the end corner to close the outside corner
    const treatment = room.walls[w.index]?.treatment ?? 'plain';

    // Wall outline with notches for floor-level openings, holes for windows.
    const outline: [number, number][] = [[0, 0]];
    const holes: [number, number][][] = [];
    for (const o of ops) {
      if (o.sill <= 0.001) {
        const pts = openingOutline(o);
        // pts: bottom-left, bottom-right, (arch right->left | top-right, top-left)
        const bl = pts[0];
        const br = pts[1];
        const upper = pts.slice(2);
        outline.push([bl[0], 0], [bl[0], upper[upper.length - 1][1]]);
        for (let i = upper.length - 1; i >= 0; i--) outline.push(upper[i]);
        outline.push([br[0], 0]);
        // (upper is right->left; walking left->right we reversed it)
      } else holes.push(openingOutline(o));
    }
    outline.push([L + ext, 0], [L + ext, H], [0, H]);
    // The traversal goes left->right along the bottom (notching floor-level openings), then back along the top.
    const clean: [number, number][] = [];
    for (const p of outline) {
      const last = clean[clean.length - 1];
      if (!last || Math.abs(last[0] - p[0]) > 1e-5 || Math.abs(last[1] - p[1]) > 1e-5) clean.push(p);
    }
    const shape = new THREE.Shape(clean.map(([u, v]) => new THREE.Vector2(u, v)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 12 });
    wallGeo.translate(0, 0, -T);
    boxUV(wallGeo);
    const wallMesh = new THREE.Mesh(wallGeo, mats.wall);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    wallMesh.applyMatrix4(M);
    full.add(wallMesh);

    // Section cap on top of the wall (reads as poché from above).
    const cap = new THREE.Mesh(box(L + ext, 0.006, T, (L + ext) / 2, H + 0.003, -T / 2), mats.cut);
    cap.applyMatrix4(M);
    full.add(cap);

    // Trim: baseboard, crown, paneling, casings.
    const trim: THREE.BufferGeometry[] = [];
    const bbH = room.finishes.baseboard;
    const doorRanges = ops.filter((o) => o.sill <= 0.001).map((o) => [o.offset - 0.09, o.offset + o.width + 0.09] as [number, number]);
    const nicheRanges = ops.filter((o) => o.kind === 'niche').map((o) => [o.offset - 0.09, o.offset + o.width + 0.09] as [number, number]);
    const blocked = [...doorRanges];
    const segs = freeSegments(0, L, blocked);
    for (const [s0, s1] of segs) {
      trim.push(box(s1 - s0, bbH, 0.018, (s0 + s1) / 2, bbH / 2, 0.009));
      trim.push(box(s1 - s0, 0.02, 0.026, (s0 + s1) / 2, bbH + 0.005, 0.013));
      trim.push(box(s1 - s0, 0.012, 0.024, (s0 + s1) / 2, 0.006, 0.012));
    }
    if (room.finishes.crown) {
      const prof = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.012, 0),
        new THREE.Vector2(0.03, 0.03),
        new THREE.Vector2(0.075, 0.07),
        new THREE.Vector2(0.11, 0.1),
        new THREE.Vector2(0.13, 0.13),
        new THREE.Vector2(0.14, 0.15),
        new THREE.Vector2(0, 0.15),
      ]);
      const cg = new THREE.ExtrudeGeometry(prof, { depth: L + 0.3, bevelEnabled: false });
      // profile x -> into room (z), profile y -> up; extrude along wall (x)
      cg.rotateY(-Math.PI / 2);
      cg.translate(L + 0.15, H - 0.15, 0);
      // after rotateY(-90): (px, py, e) -> (-e, py, px)
      boxUV(cg);
      trim.push(cg);
    }
    // Picture-frame paneling in the free stretches of paneled walls.
    if (treatment === 'paneled' || treatment === 'wainscot') {
      const fixtures = room.fixtures.filter((f) => f.wall === w.index && f.fixed);
      const fixRanges: [number, number][] = fixtures.map((f) => {
        const rel = (f.x - w.a.x) * w.dir.x + (f.y - w.a.y) * w.dir.y;
        const half = (f.w ?? 0.5) / 2;
        const isFlat = (f.d ?? 0) < 0.06;
        return isFlat ? [rel - half - 0.01, rel - half - 0.01] : [rel - half - 0.02, rel + half + 0.02];
      });
      const blocked2 = [...doorRanges, ...nicheRanges, ...fixRanges.filter(([a, b]) => b > a)];
      for (const [s0, s1] of freeSegments(0, L, blocked2)) {
        const span = s1 - s0;
        if (span < 0.22) continue;
        const gap = 0.1;
        const n = Math.max(1, Math.round((span - gap) / 0.72));
        const pw = (span - gap * (n + 1)) / n;
        const tiers: [number, number][] =
          treatment === 'wainscot'
            ? [[bbH + 0.1, 0.86]]
            : [
                [bbH + 0.12, 0.8],
                [0.96, H - 0.62],
                [H - 0.5, H - 0.26],
              ];
        for (let i = 0; i < n; i++) {
          const x0 = s0 + gap + i * (pw + gap);
          for (const [y0, y1] of tiers) if (y1 - y0 > 0.12 && pw > 0.08) trim.push(...rectFrame(x0, y0, x0 + pw, y1, 0.032, 0.014));
        }
        if (treatment === 'paneled') trim.push(box(span, 0.05, 0.022, (s0 + s1) / 2, 0.88, 0.011));
      }
    }
    // Opening casings, doors, windows, niches.
    for (const o of ops) buildOpening(o, trim, full, M, room, windows, w, opts.evening);
    const trimGeo = merge(trim);
    if (trimGeo) {
      const tm = new THREE.Mesh(trimGeo, mats.trim);
      tm.castShadow = true;
      tm.receiveShadow = true;
      tm.applyMatrix4(M);
      full.add(tm);
    }

    // Low stub shown when the wall is cut away for the dollhouse view.
    const stubH = 0.09;
    const stubShape: THREE.BufferGeometry[] = [];
    for (const [s0, s1] of freeSegments(0, L + ext, doorRanges.map(([a, b]) => [a + 0.09, b - 0.09]))) stubShape.push(box(s1 - s0, stubH, T, (s0 + s1) / 2, stubH / 2, -T / 2));
    const sg = merge(stubShape);
    if (sg) {
      const sm = new THREE.Mesh(sg, mats.cut);
      sm.applyMatrix4(M);
      sm.receiveShadow = true;
      stub.add(sm);
    }
    stub.visible = false;
    root.add(full, stub);
    const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    result.push({ index: w.index, full, stub, normal: w.normal, mid });
  }

  // ---------------------------------------------------------------- Ceiling
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  const ceilGeo = new THREE.ShapeGeometry(floorShape);
  ceilGeo.rotateX(-Math.PI / 2);
  ceilGeo.translate(0, H, 0);
  const ceilMesh = new THREE.Mesh(ceilGeo, mats.ceiling);
  ceilMesh.receiveShadow = true;
  ceiling.add(ceilMesh);
  const pots: THREE.Vector3[] = [];
  const cs = room.finishes.ceiling;
  if (cs.style === 'coffered' || cs.style === 'beamed') {
    const [nx, ny] = cs.grid ?? [4, 4];
    const bw = cs.beamWidth ?? 0.22;
    const bd = cs.beamDepth ?? 0.22;
    const beams: THREE.BufferGeometry[] = [];
    const frieze = 0.18;
    const x0 = bb.minX + frieze,
      x1 = bb.maxX - frieze,
      y0 = bb.minY + frieze,
      y1 = bb.maxY - frieze;
    // perimeter frieze
    beams.push(box(bb.w, bd, frieze * 2, bb.cx, H - bd / 2, bb.minY + frieze));
    beams.push(box(bb.w, bd, frieze * 2, bb.cx, H - bd / 2, bb.maxY - frieze));
    beams.push(box(frieze * 2, bd, bb.h, bb.minX + frieze, H - bd / 2, bb.cy));
    beams.push(box(frieze * 2, bd, bb.h, bb.maxX - frieze, H - bd / 2, bb.cy));
    for (let i = 1; i < nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      beams.push(box(bw, bd, y1 - y0, x, H - bd / 2, (y0 + y1) / 2));
    }
    if (cs.style === 'coffered')
      for (let j = 1; j < ny; j++) {
        const y = y0 + ((y1 - y0) * j) / ny;
        beams.push(box(x1 - x0, bd, bw, (x0 + x1) / 2, H - bd / 2, y));
      }
    // small molding inside each coffer
    const cw = (x1 - x0) / nx;
    const chh = (y1 - y0) / (cs.style === 'coffered' ? ny : 1);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < (cs.style === 'coffered' ? ny : 1); j++) {
        const cx0 = x0 + cw * i + bw / 2;
        const cx1 = x0 + cw * (i + 1) - bw / 2;
        const cy0 = y0 + chh * j + bw / 2;
        const cy1 = y0 + chh * (j + 1) - bw / 2;
        const inset = 0.05;
        const mx = (cx0 + cx1) / 2;
        const my = (cy0 + cy1) / 2;
        if (!pointInPolygon({ x: mx, y: my }, room.outline)) continue;
        beams.push(box(cx1 - cx0 - inset * 2, 0.035, 0.04, mx, H - 0.03, cy0 + inset));
        beams.push(box(cx1 - cx0 - inset * 2, 0.035, 0.04, mx, H - 0.03, cy1 - inset));
        beams.push(box(0.04, 0.035, cy1 - cy0 - inset * 2, cx0 + inset, H - 0.03, my));
        beams.push(box(0.04, 0.035, cy1 - cy0 - inset * 2, cx1 - inset, H - 0.03, my));
        if (cs.potLights !== false) pots.push(new THREE.Vector3(mx, H - 0.005, my));
      }
    const bg = merge(beams);
    if (bg) {
      const bm = new THREE.Mesh(bg, mats.trim);
      bm.castShadow = true;
      bm.receiveShadow = true;
      ceiling.add(bm);
    }
  } else if (cs.potLights !== false) {
    const nx = Math.max(2, Math.round(bb.w / 1.6));
    const ny = Math.max(2, Math.round(bb.h / 1.6));
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const p = { x: bb.minX + (bb.w * (i + 0.5)) / nx, y: bb.minY + (bb.h * (j + 0.5)) / ny };
        if (pointInPolygon(p, room.outline)) pots.push(new THREE.Vector3(p.x, H - 0.005, p.y));
      }
  }
  if (pots.length) {
    const trims: THREE.BufferGeometry[] = [];
    const lens: THREE.BufferGeometry[] = [];
    for (const p of pots) {
      const t = new THREE.CylinderGeometry(0.065, 0.065, 0.008, 24).toNonIndexed();
      t.translate(p.x, p.y - 0.004, p.z);
      trims.push(t);
      const l = new THREE.CylinderGeometry(0.045, 0.045, 0.004, 24).toNonIndexed();
      l.translate(p.x, p.y - 0.009, p.z);
      lens.push(l);
    }
    const tg = merge(trims);
    const lg = merge(lens);
    if (tg) ceiling.add(new THREE.Mesh(tg, mats.potTrim));
    if (lg) {
      const pm = mats.potLight;
      pm.emissiveIntensity = opts.evening ? 3 : 0.35;
      ceiling.add(new THREE.Mesh(lg, pm));
    }
  }
  root.add(ceiling);

  // ---------------------------------------------------------------- Outside
  const outside = buildOutside(room, ws, opts.evening);
  root.add(outside);

  return { root, walls: result, ceiling, floorGeometry, outside, windows, pots, bounds: bb };
}

function freeSegments(a: number, b: number, blocked: [number, number][]): [number, number][] {
  const sorted = [...blocked].filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a;
  for (const [x, y] of sorted) {
    if (x > cur + 0.005) out.push([cur, Math.min(x, b)]);
    cur = Math.max(cur, y);
  }
  if (cur < b - 0.005) out.push([cur, b]);
  return out.filter(([x, y]) => y - x > 0.01);
}

// ---------------------------------------------------------------------------
// Doors, windows, niches

function buildOpening(o: Opening, trim: THREE.BufferGeometry[], group: THREE.Group, M: THREE.Matrix4, room: Room, windows: RoomBuild['windows'], w: Wall, evening: boolean) {
  const mats = roomMaterials(room.finishes.wallColor, room.finishes.trimColor);
  const T = room.wallThickness;
  const x0 = o.offset;
  const x1 = o.offset + o.width;
  const topDoor = o.height;
  const top = o.height + (o.transom ?? 0);
  const casing = 0.085;
  const cd = 0.02;

  // Interior casing around the opening (follows the arch).
  if (o.kind !== 'opening') {
    const outline = openingOutline(o);
    const bottom = o.sill;
    if (o.archRise && o.archRise > 0.01) {
      const arch = archPoints(x0 - casing / 2, x1 + casing / 2, top, o.archRise + casing * 0.3);
      trim.push(...moldingAlong([[x0 - casing / 2, bottom], [x0 - casing / 2, top]], casing, cd, 0));
      trim.push(...moldingAlong([[x1 + casing / 2, bottom], [x1 + casing / 2, top]], casing, cd, 0));
      trim.push(...moldingAlong(arch, casing, cd, 0));
    } else {
      trim.push(...moldingAlong([[x0 - casing / 2, bottom], [x0 - casing / 2, top + casing / 2], [x1 + casing / 2, top + casing / 2], [x1 + casing / 2, bottom]], casing, cd, 0));
    }
    void outline;
    if (o.kind === 'window') {
      trim.push(box(o.width + casing * 2, 0.03, 0.06, (x0 + x1) / 2, o.sill - 0.015, 0.02));
    }
  }

  const frameMat = o.frame === 'oak' ? mats.frameOak : o.frame === 'black' ? mats.frameBlack : o.frame === 'bronze' ? finishMaterial('bronze') : mats.frameWhite;
  const frames: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];
  const hardware: THREE.BufferGeometry[] = [];
  const zMid = -T / 2;

  const leaf = (lx0: number, lx1: number, ly0: number, ly1: number, lites: [number, number], z: number, handleSide?: 'left' | 'right') => {
    const stile = 0.065;
    const rail = 0.07;
    const bottomRail = 0.16;
    const th = 0.045;
    const lw = lx1 - lx0;
    const lh = ly1 - ly0;
    frames.push(box(stile, lh, th, lx0 + stile / 2, ly0 + lh / 2, z));
    frames.push(box(stile, lh, th, lx1 - stile / 2, ly0 + lh / 2, z));
    frames.push(box(lw, rail, th, (lx0 + lx1) / 2, ly1 - rail / 2, z));
    frames.push(box(lw, bottomRail, th, (lx0 + lx1) / 2, ly0 + bottomRail / 2, z));
    const gx0 = lx0 + stile;
    const gx1 = lx1 - stile;
    const gy0 = ly0 + bottomRail;
    const gy1 = ly1 - rail;
    glass.push(box(gx1 - gx0, gy1 - gy0, 0.006, (gx0 + gx1) / 2, (gy0 + gy1) / 2, z));
    const [nx, ny] = lites;
    for (let i = 1; i < nx; i++) frames.push(box(0.022, gy1 - gy0, th * 0.7, gx0 + ((gx1 - gx0) * i) / nx, (gy0 + gy1) / 2, z));
    for (let j = 1; j < ny; j++) frames.push(box(gx1 - gx0, 0.022, th * 0.7, (gx0 + gx1) / 2, gy0 + ((gy1 - gy0) * j) / ny, z));
    if (handleSide) {
      const hx = handleSide === 'left' ? lx0 + 0.06 : lx1 - 0.06;
      for (const hz of [z + th / 2 + 0.03, z - th / 2 - 0.03]) {
        hardware.push(box(0.012, 0.012, 0.06, hx, 1.0, (hz + z) / 2));
        hardware.push(box(0.12, 0.016, 0.016, hx + (handleSide === 'left' ? 0.05 : -0.05), 1.0, hz));
      }
    }
  };

  if (o.kind === 'door' || o.kind === 'double-door' || o.kind === 'french-door') {
    // jamb lining on the reveal
    frames.push(box(0.02, topDoor, T, x0 + 0.01, topDoor / 2, zMid));
    frames.push(box(0.02, topDoor, T, x1 - 0.01, topDoor / 2, zMid));
    frames.push(box(o.width, 0.03, T, (x0 + x1) / 2, topDoor + 0.015, zMid));
    const lites = o.lites ?? [1, 1];
    const zLeaf = o.swing === 'out' ? -T + 0.03 : -0.03;
    if (o.kind === 'door') {
      if (o.glazed !== false) leaf(x0 + 0.02, x1 - 0.02, 0.01, topDoor, lites, zLeaf, o.hinge === 'end' ? 'left' : 'right');
      else frames.push(box(o.width - 0.04, topDoor - 0.01, 0.045, (x0 + x1) / 2, topDoor / 2, zLeaf));
    } else {
      const mid = (x0 + x1) / 2;
      leaf(x0 + 0.02, mid, 0.01, topDoor, lites, zLeaf, 'right');
      leaf(mid, x1 - 0.02, 0.01, topDoor, lites, zLeaf, 'left');
    }
    if (o.transom && o.transom > 0.02) {
      const ty0 = topDoor + 0.03;
      const ty1 = top;
      frames.push(box(0.06, ty1 - ty0, 0.07, x0 + 0.03, (ty0 + ty1) / 2, zLeaf));
      frames.push(box(0.06, ty1 - ty0, 0.07, x1 - 0.03, (ty0 + ty1) / 2, zLeaf));
      frames.push(box(o.width, 0.05, 0.07, (x0 + x1) / 2, ty1 - 0.025, zLeaf));
      frames.push(box(o.width, 0.05, 0.07, (x0 + x1) / 2, ty0, zLeaf));
      const panes = Math.max(2, Math.round(o.width / 0.6));
      for (let i = 1; i < panes; i++) frames.push(box(0.03, ty1 - ty0, 0.05, x0 + (o.width * i) / panes, (ty0 + ty1) / 2, zLeaf));
      glass.push(box(o.width - 0.08, ty1 - ty0 - 0.06, 0.006, (x0 + x1) / 2, (ty0 + ty1) / 2, zLeaf));
    }
    if (o.kind === 'french-door' || o.glazed) {
      const c = new THREE.Vector3((x0 + x1) / 2, (o.sill + top) / 2, 0).applyMatrix4(M);
      if (o.kind === 'french-door') windows.push({ center: c, normal: new THREE.Vector3(w.normal.x, 0, w.normal.y), w: o.width, h: top - o.sill });
    }
  } else if (o.kind === 'window') {
    frames.push(box(o.width, 0.05, T, (x0 + x1) / 2, o.sill + 0.025, zMid));
    frames.push(box(o.width, 0.05, T * 0.6, (x0 + x1) / 2, top - 0.025, zMid));
    frames.push(box(0.05, top - o.sill, T * 0.6, x0 + 0.025, (o.sill + top) / 2, zMid));
    frames.push(box(0.05, top - o.sill, T * 0.6, x1 - 0.025, (o.sill + top) / 2, zMid));
    const [nx, ny] = o.lites ?? [2, 1];
    for (let i = 1; i < nx; i++) frames.push(box(0.03, top - o.sill, 0.05, x0 + (o.width * i) / nx, (o.sill + top) / 2, zMid));
    for (let j = 1; j < ny; j++) frames.push(box(o.width, 0.03, 0.05, (x0 + x1) / 2, o.sill + ((top - o.sill) * j) / ny, zMid));
    glass.push(box(o.width - 0.06, top - o.sill - 0.06, 0.006, (x0 + x1) / 2, (o.sill + top) / 2, zMid));
    const c = new THREE.Vector3((x0 + x1) / 2, (o.sill + top) / 2, 0).applyMatrix4(M);
    windows.push({ center: c, normal: new THREE.Vector3(w.normal.x, 0, w.normal.y), w: o.width, h: top - o.sill });
  } else if (o.kind === 'niche') {
    buildNiche(o, group, M, room, evening);
  }

  const add = (list: THREE.BufferGeometry[], mat: THREE.Material, shadow = true) => {
    const g = merge(list);
    if (!g) return;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.applyMatrix4(M);
    group.add(m);
  };
  add(frames, frameMat);
  add(hardware, mats.hardware);
  add(glass, mats.glass, false);
}

function buildNiche(o: Opening, group: THREE.Group, M: THREE.Matrix4, room: Room, evening: boolean) {
  const n = o.niche ?? { baseHeight: 0.9, baseStyle: 'panel-doors', shelves: 3, lining: 'oak', mirrorBack: false, lit: true };
  const T = room.wallThickness;
  const depth = o.depth ?? 0.4;
  const x0 = o.offset;
  const x1 = o.offset + o.width;
  const topArch = o.height + (o.archRise ?? 0);
  const lining = finishMaterial(n.lining === 'walnut' ? 'walnut' : n.lining === 'white' ? 'paint-white' : 'oak-white');
  const mats = roomMaterials(room.finishes.wallColor, room.finishes.trimColor);
  const back = -T - depth + T; // niche goes behind the interior face: z in [-depth, 0]
  void back;
  const zBack = -depth;
  const lin: THREE.BufferGeometry[] = [];
  const white: THREE.BufferGeometry[] = [];
  // back panel and sides (lining)
  lin.push(box(o.width, topArch, 0.02, (x0 + x1) / 2, topArch / 2, zBack + 0.01));
  lin.push(box(0.02, topArch, depth, x0 + 0.01, topArch / 2, -depth / 2));
  lin.push(box(0.02, topArch, depth, x1 - 0.01, topArch / 2, -depth / 2));
  // arched soffit: a band of small boxes following the arch
  const arch = o.archRise ? archPoints(x0, x1, o.height, o.archRise, 20) : ([[x0, o.height], [x1, o.height]] as [number, number][]);
  for (let i = 0; i < arch.length - 1; i++) {
    const [ax, ay] = arch[i];
    const [bx, by] = arch[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const g = new THREE.BoxGeometry(len + 0.004, 0.02, depth).toNonIndexed();
    g.rotateZ(Math.atan2(by - ay, bx - ax));
    g.translate((ax + bx) / 2, (ay + by) / 2 + 0.01, -depth / 2);
    boxUV(g);
    lin.push(g);
  }
  // base cabinets flush with the wall face
  const bh = n.baseHeight;
  white.push(box(o.width - 0.04, bh - 0.04, depth - 0.02, (x0 + x1) / 2, (bh - 0.04) / 2, -depth / 2 - 0.01));
  const doors = Math.max(2, Math.round(o.width / 0.55));
  const dw = (o.width - 0.06) / doors;
  for (let i = 0; i < doors; i++) {
    const cx = x0 + 0.03 + dw * (i + 0.5);
    white.push(box(dw - 0.012, bh - 0.12, 0.018, cx, bh / 2 - 0.02, -0.012));
    if (n.baseStyle === 'panel-doors') white.push(...rectFrame(cx - dw / 2 + 0.07, 0.12, cx + dw / 2 - 0.07, bh - 0.16, 0.025, 0.012, -0.004));
  }
  // top of base
  lin.push(box(o.width - 0.04, 0.035, depth, (x0 + x1) / 2, bh + 0.0175 - 0.04, -depth / 2));
  // shelves
  const avail = o.height - bh;
  const rows = n.shelves;
  const gap = avail / (rows + 0.6);
  const shelfYs: number[] = [];
  for (let i = 1; i <= rows; i++) {
    const y = bh + gap * i;
    shelfYs.push(y);
    lin.push(box(o.width - 0.04, 0.03, depth - 0.03, (x0 + x1) / 2, y, -depth / 2 + 0.005));
  }
  const add = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
    const g = merge(list);
    if (!g) return;
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.applyMatrix4(M);
    group.add(m);
  };
  add(lin, lining);
  add(white, mats.trim);
  if (n.mirrorBack) {
    const mg = box(o.width - 0.08, gap - 0.05, 0.004, (x0 + x1) / 2, bh + (gap - 0.05) / 2, zBack + 0.022);
    const mm = new THREE.Mesh(mg, mats.mirror);
    mm.applyMatrix4(M);
    group.add(mm);
  }
  // books and objects on the niche shelves
  const decor: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; color?: THREE.Color; mat: string }[] = [];
  const levels = [bh - 0.02, ...shelfYs.slice(0, -1).map((y) => y + 0.015)];
  const r = makeRng(9);
  levels.forEach((y, i) => {
    const seed = 400 + i * 17;
    const parts = i === levels.length - 1 ? objects((x0 + x1) / 2, y, -depth / 2, seed, 'vase') : r() < 0.5 ? bookRow(x0 + 0.05, (x0 + x1) / 2, y, -depth + 0.03, gap - 0.05, seed, 0.85) : [...objects(x0 + o.width * 0.3, y, -depth / 2, seed, 'sculpture'), ...bookRow((x0 + x1) / 2, x1 - 0.05, y, -depth + 0.03, gap - 0.05, seed, 0.85)];
    for (const p of parts) {
      if (p.geo.t === 'custom') continue;
      const geo = geometryFor(p.geo);
      const pm = new THREE.Matrix4().compose(new THREE.Vector3(...p.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.r ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
      if (p.inst) {
        for (const ins of p.inst) {
          const im = new THREE.Matrix4().compose(new THREE.Vector3(...ins.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(ins.r ?? [0, 0, 0]))), new THREE.Vector3(...(ins.s ?? [1, 1, 1])));
          decor.push({ geo, matrix: pm.clone().multiply(im), color: ins.c ? new THREE.Color(ins.c) : undefined, mat: p.mat });
        }
      } else decor.push({ geo, matrix: pm, color: p.color ? new THREE.Color(p.color) : undefined, mat: p.mat });
    }
  });
  const byMat = new Map<string, typeof decor>();
  for (const d of decor) {
    const l = byMat.get(d.mat) ?? [];
    l.push(d);
    byMat.set(d.mat, l);
  }
  for (const [mk, list] of byMat) {
    const g = mergeTransformed(list, mk === '$books');
    if (!g) continue;
    const m = new THREE.Mesh(g, fixedMaterial(mk, { evening }));
    m.castShadow = true;
    m.receiveShadow = true;
    m.applyMatrix4(M);
    group.add(m);
  }
  if (n.lit) {
    const led = box(o.width * 0.5, 0.004, 0.02, (x0 + x1) / 2, topArch - 0.05, -depth / 2);
    const lm = new THREE.Mesh(led, fixedMaterial('$bulb', { evening }));
    lm.applyMatrix4(M);
    group.add(lm);
  }
  void roundedBox;
}

// ---------------------------------------------------------------------------
// The view: a terrace under a glass roof, the water and distant hills.

let skyTex: THREE.Texture | null = null;
function skyTexture() {
  if (skyTex) return skyTex;
  const W = 2048;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#B9CBD8');
  g.addColorStop(0.45, '#DCE4E6');
  g.addColorStop(0.62, '#E9ECE8');
  g.addColorStop(0.63, '#8FA2AC');
  g.addColorStop(1, '#5D7380');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const f = makeFbm(12, 8, 5);
  // far hills
  for (const [base, amp, col, k] of [
    [0.6, 0.12, '#9AA9AF', 1],
    [0.625, 0.07, '#7F8F90', 2],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.63);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H * (base - amp * f((x / W) * 8 * k, k * 3)));
    ctx.lineTo(W, H * 0.63);
    ctx.fill();
  }
  // water glints
  const r = makeRng(5);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`;
    const y = H * (0.64 + r() * 0.36);
    ctx.fillRect(r() * W, y, 6 + r() * 20, 1);
  }
  skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  return skyTex;
}

function buildOutside(room: Room, ws: Wall[], evening: boolean) {
  const out = new THREE.Group();
  out.name = 'outside';
  if (room.outlook === 'none') return out;
  // Find the wall with the most glazing: the terrace side.
  let best: Wall | null = null;
  let bestW = 0;
  for (const w of ws) {
    const glazed = room.openings.filter((o) => o.wall === w.index && (o.kind === 'french-door' || o.kind === 'window' || o.kind === 'sliding-door')).reduce((s, o) => s + o.width, 0);
    if (glazed > bestW) {
      bestW = glazed;
      best = w;
    }
  }
  const b = bounds(room.outline);
  const cx = b.cx;
  const cz = b.cy;
  // backdrop cylinder
  const R = 40;
  const cyl = new THREE.CylinderGeometry(R, R, 26, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, color: evening ? new THREE.Color('#3b4252') : new THREE.Color('#ffffff') });
  const mesh = new THREE.Mesh(cyl, mat);
  mesh.position.set(cx, 6, cz);
  if (best) mesh.rotation.y = -Math.atan2(best.normal.y, best.normal.x) + Math.PI / 2;
  out.add(mesh);
  // ground outside
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.02, cz);
  out.add(ground);
  if (best && room.outlook !== 'city') {
    // terrace slab and glass roof beams beyond the glazed wall
    const n = best.normal;
    const dirOut = new THREE.Vector3(-n.x, 0, -n.y);
    const along = new THREE.Vector3(best.dir.x, 0, best.dir.y);
    const mid = new THREE.Vector3((best.a.x + best.b.x) / 2, 0, (best.a.y + best.b.y) / 2);
    const depth = 4.2;
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(best.length + 2, 0.05, depth), new THREE.MeshStandardMaterial({ color: '#b9ada0', roughness: 0.85 }));
    terrace.position.copy(mid.clone().add(dirOut.clone().multiplyScalar(depth / 2 + room.wallThickness))).setY(-0.02);
    terrace.rotation.y = -Math.atan2(along.z, along.x);
    terrace.receiveShadow = true;
    out.add(terrace);
    const beamMat = new THREE.MeshStandardMaterial({ color: '#2b2d2f', roughness: 0.5, metalness: 0.4 });
    const beams: THREE.BufferGeometry[] = [];
    const count = Math.round(best.length / 1.2);
    for (let i = 0; i <= count; i++) {
      const t = -1 + ((best.length + 2) * i) / count;
      const g = new THREE.BoxGeometry(0.06, 0.12, depth).toNonIndexed();
      g.translate(t - best.length / 2, room.ceilingHeight + 0.2, 0);
      beams.push(g);
    }
    const bg = mergeGeometries(beams, false);
    if (bg) {
      const bm = new THREE.Mesh(bg, beamMat);
      bm.position.copy(mid.clone().add(dirOut.clone().multiplyScalar(depth / 2 + room.wallThickness)));
      bm.rotation.y = -Math.atan2(along.z, along.x);
      out.add(bm);
    }
    // posts and a low parapet at the terrace edge
    const edge = mid.clone().add(dirOut.clone().multiplyScalar(depth + room.wallThickness));
    const par = new THREE.Mesh(new THREE.BoxGeometry(best.length + 2, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: '#a79c8d', roughness: 0.9 }));
    par.position.copy(edge).setY(0.45);
    par.rotation.y = -Math.atan2(along.z, along.x);
    out.add(par);
  }
  return out;
}
