import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Geo } from '../catalog/parts';

// Geo specs -> BufferGeometry in the part's local frame, with UVs in meters
// (box-projected, grain along the longest dimension) so textures keep a real scale.

const cache = new Map<string, THREE.BufferGeometry>();

export function geometryFor(geo: Geo): THREE.BufferGeometry {
  if (geo.t === 'custom') throw new Error('custom geometry is built by organic.ts');
  const key = JSON.stringify(geo);
  let g = cache.get(key);
  if (g) return g;
  g = build(geo);
  cache.set(key, g);
  return g;
}

function build(geo: Exclude<Geo, { t: 'custom' }>): THREE.BufferGeometry {
  switch (geo.t) {
    case 'box':
      return finish(roundedBox(geo.w, geo.h, geo.d, geo.r ?? 0, 0));
    case 'cushion':
      return finish(roundedBox(geo.w, geo.h, geo.d, geo.r ?? 0.04, geo.bulge ?? 0.02));
    case 'cyl': {
      const g = new THREE.CylinderGeometry(Math.max(geo.rt, 0.0005), Math.max(geo.rb, 0.0005), geo.h, geo.seg ?? 24, 1, geo.open ?? false);
      return finish(g);
    }
    case 'sphere': {
      const seg = geo.seg ?? 24;
      const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.6)));
      g.scale(geo.rx, geo.ry, geo.rz);
      return finish(g);
    }
    case 'torus': {
      const g = new THREE.TorusGeometry(geo.r, geo.tube, 16, geo.seg ?? 48, geo.arc ?? Math.PI * 2);
      g.rotateX(Math.PI / 2);
      return finish(g);
    }
    case 'lathe': {
      const pts = geo.pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
      return finish(new THREE.LatheGeometry(pts, geo.seg ?? 32));
    }
    case 'profile': {
      const bevel = Math.min(geo.bevel ?? 0, geo.width / 3);
      const pts = inset(geo.pts, bevel).map(([z, y]) => new THREE.Vector2(-z, y));
      const shape = new THREE.Shape(pts);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.001, geo.width - bevel * 2),
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 4,
        curveSegments: 12,
      });
      g.rotateY(Math.PI / 2);
      g.translate(-geo.width / 2 + bevel, 0, 0);
      return finish(g);
    }
    case 'plate': {
      const bevel = geo.bevel ?? 0;
      const pts = inset(geo.pts, bevel).map(([x, z]) => new THREE.Vector2(x, -z));
      const shape = new THREE.Shape(pts);
      for (const hole of geo.holes ?? []) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.001, geo.h - bevel * 2),
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        curveSegments: 12,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, bevel, 0);
      return finish(g);
    }
    case 'tube': {
      const v = geo.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      let curve: THREE.Curve<THREE.Vector3>;
      if (geo.smooth !== false && v.length > 2) curve = new THREE.CatmullRomCurve3(v, geo.closed ?? false, 'centripetal', 0.5);
      else {
        const path = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1]));
        if (geo.closed) path.add(new THREE.LineCurve3(v[v.length - 1], v[0]));
        curve = path;
      }
      const segs = Math.max(8, Math.round(v.length * 10));
      return finish(new THREE.TubeGeometry(curve, geo.seg ?? segs, geo.r, 10, geo.closed ?? false));
    }
    case 'panel': {
      const g = new THREE.PlaneGeometry(geo.w, geo.h);
      return clean(g);
    }
    case 'floor': {
      const h = geo.h ?? 0.012;
      let pts: [number, number][];
      if (geo.shape === 'round') {
        pts = [];
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          pts.push([(Math.cos(a) * geo.w) / 2, (Math.sin(a) * geo.d) / 2]);
        }
      } else if (geo.shape === 'organic') {
        pts = [];
        for (let i = 0; i < 90; i++) {
          const a = (i / 90) * Math.PI * 2;
          const f = 1 + 0.08 * Math.sin(2 * a + 0.7) + 0.05 * Math.sin(3 * a + 2.1) + 0.03 * Math.sin(5 * a);
          pts.push([(Math.cos(a) * geo.w * f) / 2 / 1.1, (Math.sin(a) * geo.d * f) / 2 / 1.1]);
        }
      } else {
        const r = Math.min(geo.r ?? 0.02, geo.w / 2, geo.d / 2);
        pts = [];
        const seg = 4;
        const corners: [number, number, number][] = [
          [geo.w / 2 - r, -geo.d / 2 + r, -Math.PI / 2],
          [geo.w / 2 - r, geo.d / 2 - r, 0],
          [-geo.w / 2 + r, geo.d / 2 - r, Math.PI / 2],
          [-geo.w / 2 + r, -geo.d / 2 + r, Math.PI],
        ];
        for (const [cx, cz, a0] of corners)
          for (let i = 0; i <= seg; i++) {
            const a = a0 + (i / seg) * (Math.PI / 2);
            pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
          }
      }
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 8 });
      g.rotateX(-Math.PI / 2);
      // UVs span the footprint 0..1 so a rug texture maps once across it.
      const pos = g.getAttribute('position');
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = pos.getX(i) / geo.w + 0.5;
        uv[i * 2 + 1] = 0.5 - pos.getZ(i) / geo.d;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return clean(g);
    }
  }
}

/** Shrink a polygon toward its centroid by d (for bevel compensation). */
function inset(pts: [number, number][], d: number): [number, number][] {
  if (d <= 0) return pts;
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % n];
    area += ax * by - bx * ay;
  }
  const s = area >= 0 ? 1 : -1;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const e1 = norm2(p1[0] - p0[0], p1[1] - p0[1]);
    const e2 = norm2(p2[0] - p1[0], p2[1] - p1[1]);
    // inward normals for counter-clockwise polygons are (-dy, dx)
    const n1 = [-e1[1] * s, e1[0] * s];
    const n2 = [-e2[1] * s, e2[0] * s];
    let bx = n1[0] + n2[0];
    let by = n1[1] + n2[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    const cos = bx * n1[0] + by * n1[1] || 1;
    const k = Math.min(d / Math.max(cos, 0.3), d * 3);
    out.push([p1[0] + bx * k, p1[1] + by * k]);
  }
  return out;
}

function norm2(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Evenly tessellated rounded box, optionally domed like a cushion. */
export function roundedBox(w: number, h: number, d: number, r: number, bulge: number): THREE.BufferGeometry {
  r = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  if (r <= 0.0005 && bulge <= 0) return new THREE.BoxGeometry(w, h, d);
  const segFor = (len: number) => Math.max(2, Math.min(18, Math.round(len / 0.05) + (r > 0 ? 4 : 0)));
  const g = new THREE.BoxGeometry(w, h, d, segFor(w), segFor(h), segFor(d));
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 1e-5);
  g.dispose();
  const pos = merged.getAttribute('position') as THREE.BufferAttribute;
  const hw = w / 2,
    hh = h / 2,
    hd = d / 2;
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (r > 0) {
      inner.set(clamp(v.x, -hw + r, hw - r), clamp(v.y, -hh + r, hh - r), clamp(v.z, -hd + r, hd - r));
      const dir = v.clone().sub(inner);
      const l = dir.length();
      if (l > 1e-9) v.copy(inner).addScaledVector(dir, r / l);
    }
    if (bulge > 0) {
      const nx = clamp(v.x / hw, -1, 1);
      const ny = clamp(v.y / hh, -1, 1);
      const nz = clamp(v.z / hd, -1, 1);
      const dome = (1 - nx * nx) * (1 - nz * nz);
      v.y += Math.sign(v.y) * bulge * dome * Math.min(1, Math.abs(ny) * 1.4);
      const side = (1 - ny * ny) * (1 - nz * nz);
      v.x += Math.sign(v.x) * bulge * 0.35 * side * Math.min(1, Math.abs(nx) * 1.4);
      const front = (1 - ny * ny) * (1 - nx * nx);
      v.z += Math.sign(v.z) * bulge * 0.35 * front * Math.min(1, Math.abs(nz) * 1.4);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  merged.computeVertexNormals();
  return merged;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Keep only position/normal/uv, non-indexed, so everything merges cleanly. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Box-projected UVs in meters; wood grain runs along the longest dimension. */
export function boxUV(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)),
      ay = Math.abs(nor.getY(i)),
      az = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) {
      if (size.x >= size.z) [u, v] = [x, z];
      else [u, v] = [z, x];
    } else if (ax >= az) {
      if (size.z >= size.y) [u, v] = [z, y];
      else [u, v] = [y, z];
    } else {
      if (size.x >= size.y) [u, v] = [x, y];
      else [u, v] = [y, x];
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function finish(g: THREE.BufferGeometry) {
  const c = clean(g);
  boxUV(c);
  return c;
}

/** Merge transformed copies of geometries into one; optional per-copy vertex colors. */
export function mergeTransformed(list: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; color?: THREE.Color }[], withColor = false): THREE.BufferGeometry | null {
  if (!list.length) return null;
  const geos: THREE.BufferGeometry[] = [];
  for (const { geo, matrix, color } of list) {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    if (withColor) {
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      const c = color ?? new THREE.Color('#ffffff');
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (merged) {
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
  }
  return merged;
}
