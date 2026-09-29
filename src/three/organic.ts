import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from './noise';
import { shade } from './textures';

// Procedural organic meshes: plants, the Christmas tree, curtains.

export interface OrganicPart {
  geo: THREE.BufferGeometry;
  mat: string;
}

const cache = new Map<string, OrganicPart[]>();

export function buildCustom(key: string, params: Record<string, any>): OrganicPart[] {
  const ck = key + ':' + JSON.stringify(params);
  const hit = cache.get(ck);
  if (hit) return hit;
  let out: OrganicPart[] = [];
  if (key === 'plant') out = plant(params);
  else if (key === 'xmas') out = xmasTree(params);
  else if (key === 'curtain') out = curtain(params);
  cache.set(ck, out);
  return out;
}

// ---------------------------------------------------------------------------
// Leaves

type Outline = (t: number) => number; // half-width at t (0 base .. 1 tip), as a fraction of W

const OUTLINES: Record<string, Outline> = {
  lance: (t) => Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - t * 0.2),
  fiddle: (t) => (0.55 + 0.45 * Math.sin(Math.PI * t * 1.05)) * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (t < 0.45 ? 0.8 + t * 0.4 : 1),
  oval: (t) => Math.sin(Math.PI * t),
  paddle: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.6),
  blade: (t) => (1 - t) * 0.9 + 0.1,
  heart: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)) * (1.1 - t * 0.3),
  narrow: (t) => Math.sin(Math.PI * t),
};

function leafTemplate(outline: Outline, segL = 6, segW = 2, fold = 0.25, curl = 0.2): THREE.BufferGeometry {
  // leaf lies along +y, width along x, faces +z
  const pos: number[] = [];
  const idx: number[] = [];
  const cols = segW * 2 + 1;
  for (let i = 0; i <= segL; i++) {
    const t = i / segL;
    const hw = outline(t) * 0.5;
    for (let j = 0; j < cols; j++) {
      const s = (j / (cols - 1)) * 2 - 1; // -1..1
      const x = s * hw;
      const z = -Math.abs(s) * hw * fold + t * t * curl;
      pos.push(x, t, z);
    }
  }
  for (let i = 0; i < segL; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ni = g.toNonIndexed();
  ni.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ni.getAttribute('position').count * 2), 2));
  return ni;
}

function colored(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function placeLeaf(tpl: THREE.BufferGeometry, L: number, W: number, base: THREE.Vector3, dir: THREE.Vector3, roll: number, color: THREE.Color) {
  const g = tpl.clone();
  g.scale(W, L, W);
  // orient +y to dir
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll);
  g.applyQuaternion(qr);
  g.applyQuaternion(q);
  g.translate(base.x, base.y, base.z);
  return colored(g, color);
}

function stemGeo(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  const ni = g.toNonIndexed();
  g.dispose();
  ni.deleteAttribute('uv');
  ni.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ni.getAttribute('position').count * 2), 2));
  return ni;
}

function curvedStem(from: THREE.Vector3, ctrl: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number, seg = 5) {
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const g = new THREE.TubeGeometry(curve, seg, (r0 + r1) / 2, 5, false);
  const ni = g.toNonIndexed();
  g.dispose();
  return ni;
}

function plant(p: Record<string, any>): OrganicPart[] {
  const species: string = p.species ?? 'fiddle';
  const H: number = p.h ?? 1.5;
  const R: number = (p.spread ?? 0.9) / 2;
  const r = makeRng(p.seed ?? 1);
  const leaves: THREE.BufferGeometry[] = [];
  const stems: THREE.BufferGeometry[] = [];
  const green = (base: string, j = 0.08) => shade(base, (r() - 0.5) * j, (r() - 0.5) * 0.1, (r() - 0.5) * 0.03);

  if (species === 'lily') {
    const tpl = leafTemplate(OUTLINES.lance, 7, 2, 0.35, 0.12);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const tilt = 0.25 + r() * 0.9;
      const petiole = H * (0.25 + r() * 0.35);
      const base = new THREE.Vector3(Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04);
      const top = new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * petiole, Math.cos(tilt) * petiole, Math.sin(a) * Math.sin(tilt) * petiole);
      stems.push(curvedStem(base, new THREE.Vector3(top.x * 0.3, top.y * 0.7, top.z * 0.3), top, 0.006, 0.004));
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt + 0.4), Math.cos(tilt + 0.4), Math.sin(a) * Math.sin(tilt + 0.4));
      const L = Math.min(R * 1.1, 0.3 + r() * 0.3);
      leaves.push(placeLeaf(tpl, L, L * 0.34, top, dir, a + Math.PI / 2 + (r() - 0.5), green('#2F4B26', 0.1)));
    }
    // a few white spathes
    const spathe = leafTemplate(OUTLINES.oval, 5, 1, 0.5, 0.05);
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const hgt = H * (0.7 + r() * 0.25);
      const top = new THREE.Vector3(Math.cos(a) * R * 0.3, hgt, Math.sin(a) * R * 0.3);
      stems.push(stemGeo(new THREE.Vector3(0, 0.02, 0), top, 0.004, 0.003));
      leaves.push(placeLeaf(spathe, 0.12, 0.07, top, new THREE.Vector3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3), a, new THREE.Color('#F2F0E6')));
    }
  } else if (species === 'fiddle' || species === 'ficus' || species === 'rubber') {
    const trunkH = H * 0.9;
    const lean = new THREE.Vector3((r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1);
    const trunkTop = new THREE.Vector3(lean.x, trunkH, lean.z);
    stems.push(curvedStem(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean.x * 0.2, trunkH * 0.5, lean.z * 0.2), trunkTop, 0.02, 0.012, 8));
    const tpl = leafTemplate(species === 'fiddle' ? OUTLINES.fiddle : OUTLINES.oval, 6, 2, 0.18, 0.08);
    const n = species === 'fiddle' ? 34 : 70;
    const start = species === 'fiddle' ? 0.35 : 0.45;
    for (let i = 0; i < n; i++) {
      const t = start + (1 - start) * (i / n) + (r() - 0.5) * 0.04;
      const a = i * 2.4 + r() * 0.5;
      const at = new THREE.Vector3(lean.x * t, trunkH * t, lean.z * t);
      const out = (species === 'fiddle' ? 0.08 : 0.1) + r() * R * 0.35;
      const base = at.clone().add(new THREE.Vector3(Math.cos(a) * out * 0.3, 0, Math.sin(a) * out * 0.3));
      stems.push(stemGeo(at, base, 0.005, 0.004));
      const up = 0.3 + r() * 0.6;
      const dir = new THREE.Vector3(Math.cos(a) * (1 - up * 0.5), up, Math.sin(a) * (1 - up * 0.5));
      const L = species === 'fiddle' ? 0.24 + r() * 0.12 : 0.1 + r() * 0.05;
      leaves.push(placeLeaf(tpl, L, L * (species === 'fiddle' ? 0.8 : 0.62), base, dir, a + Math.PI / 2, green(species === 'fiddle' ? '#2E4A22' : '#40602F')));
    }
  } else if (species === 'olive') {
    const trunkH = H * 0.55;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, trunkH * 0.4, -0.03), new THREE.Vector3(-0.03, trunkH, 0.04)];
    stems.push(curvedStem(pts[0], pts[1], pts[2], 0.035, 0.022, 8));
    const tpl = leafTemplate(OUTLINES.narrow, 3, 1, 0.1, 0.02);
    const canopyC = new THREE.Vector3(-0.03, trunkH + (H - trunkH) * 0.5, 0.04);
    for (let b = 0; b < 9; b++) {
      const a = (b / 9) * Math.PI * 2 + r();
      const end = canopyC.clone().add(new THREE.Vector3(Math.cos(a) * R * 0.75, (r() - 0.3) * (H - trunkH) * 0.6, Math.sin(a) * R * 0.75));
      stems.push(curvedStem(pts[2], pts[2].clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.1, 0)), end, 0.012, 0.005, 5));
      for (let i = 0; i < 70; i++) {
        const t = 0.3 + r() * 0.7;
        const at = pts[2].clone().lerp(end, t).add(new THREE.Vector3((r() - 0.5) * 0.18, (r() - 0.5) * 0.16, (r() - 0.5) * 0.18));
        const dir = new THREE.Vector3(r() - 0.5, r() * 0.6 - 0.1, r() - 0.5);
        leaves.push(placeLeaf(tpl, 0.06, 0.014, at, dir, r() * 6, green('#7F8C64', 0.12)));
      }
    }
  } else if (species === 'bird') {
    const tpl = leafTemplate(OUTLINES.paddle, 8, 2, 0.12, 0.1);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.4;
      const tilt = 0.1 + r() * 0.35;
      const len = H * (0.45 + r() * 0.3);
      const top = new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * len, Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len);
      stems.push(stemGeo(new THREE.Vector3(0, 0, 0), top, 0.012, 0.008));
      const L = H - len + 0.1;
      leaves.push(placeLeaf(tpl, Math.max(0.35, L), Math.max(0.35, L) * 0.36, top, new THREE.Vector3(Math.cos(a) * (tilt + 0.25), 1, Math.sin(a) * (tilt + 0.25)), a + Math.PI / 2, green('#355531')));
    }
  } else if (species === 'palm') {
    const tpl = leafTemplate(OUTLINES.narrow, 3, 1, 0.3, 0.02);
    for (let f = 0; f < 10; f++) {
      const a = (f / 10) * Math.PI * 2 + r() * 0.3;
      const tilt = 0.25 + r() * 0.6;
      const len = H * (0.7 + r() * 0.3);
      const tip = new THREE.Vector3(Math.cos(a) * R * (0.6 + tilt * 0.5), len * (0.9 - tilt * 0.35), Math.sin(a) * R * (0.6 + tilt * 0.5));
      const ctrl = new THREE.Vector3(Math.cos(a) * R * 0.2, len * 0.95, Math.sin(a) * R * 0.2);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), ctrl, tip);
      stems.push(curvedStem(new THREE.Vector3(0, 0, 0), ctrl, tip, 0.008, 0.003, 8));
      for (let k = 0; k < 34; k++) {
        const t = 0.3 + (k / 34) * 0.7;
        const at = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
        for (const sgn of [-1, 1]) {
          const dir = side.clone().multiplyScalar(sgn).add(new THREE.Vector3(0, -0.35, 0)).add(tan.clone().multiplyScalar(0.5));
          leaves.push(placeLeaf(tpl, 0.28 * (1 - t * 0.5), 0.025, at, dir, 0, green('#3B5A2C')));
        }
      }
    }
  } else if (species === 'monstera') {
    const tpl = leafTemplate(OUTLINES.heart, 7, 3, 0.12, 0.06);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + r() * 0.5;
      const tilt = 0.4 + r() * 0.7;
      const len = H * (0.45 + r() * 0.4);
      const top = new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * len, Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len);
      stems.push(curvedStem(new THREE.Vector3(0, 0, 0), new THREE.Vector3(top.x * 0.3, top.y * 0.9, top.z * 0.3), top, 0.008, 0.006));
      leaves.push(placeLeaf(tpl, 0.32 + r() * 0.12, 0.34, top, new THREE.Vector3(Math.cos(a) * 1.2, 0.35, Math.sin(a) * 1.2), a + Math.PI / 2, green('#2C4A26')));
    }
  } else if (species === 'snake') {
    const tpl = leafTemplate(OUTLINES.blade, 5, 1, 0.3, 0.03);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const at = new THREE.Vector3(Math.cos(a) * R * 0.25 * r(), 0, Math.sin(a) * R * 0.25 * r());
      leaves.push(placeLeaf(tpl, H * (0.55 + r() * 0.45), 0.06, at, new THREE.Vector3(Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12), r() * 6, green('#35512E', 0.12)));
    }
  }

  const out: OrganicPart[] = [];
  const lg = leaves.length ? mergeGeometries(leaves, false) : null;
  if (lg) out.push({ geo: lg, mat: '$foliageV' });
  const sg = stems.length ? mergeGeometries(stems.map(uvFix), false) : null;
  if (sg) out.push({ geo: sg, mat: species === 'olive' || species === 'fiddle' || species === 'ficus' ? '$bark' : '$stemGreen' });
  leaves.forEach((g) => g.dispose());
  stems.forEach((g) => g.dispose());
  return out;
}

function uvFix(g: THREE.BufferGeometry) {
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  return g;
}

// ---------------------------------------------------------------------------
// Christmas tree

function xmasTree(p: Record<string, any>): OrganicPart[] {
  const H: number = p.h ?? 2.1;
  const R: number = p.r ?? 0.65;
  const r = makeRng(p.seed ?? 7);
  const boughs: THREE.BufferGeometry[] = [];
  const tiers = 9;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y0 = H * (0.02 + t * 0.86);
    const rr = R * (1 - t * 0.92) * (0.92 + r() * 0.1);
    const hh = H * 0.2 * (1 - t * 0.4);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.ConeGeometry(rr * (1 - k * 0.12), hh, 28, 3, true);
      const pos = g.getAttribute('position');
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v);
        if (y < -hh / 2 + 1e-4) {
          const x = pos.getX(v);
          const z = pos.getZ(v);
          const ang = Math.atan2(z, x);
          const jag = (Math.sin(ang * 14 + i) * 0.5 + 0.5) * 0.12 + r() * 0.08;
          pos.setXYZ(v, x * (1 - jag * 0.4), y + jag * hh * 0.5, z * (1 - jag * 0.4));
        }
      }
      g.computeVertexNormals();
      g.rotateY(r() * Math.PI + k * 0.4);
      g.translate(0, y0 + hh / 2 + k * hh * 0.1, 0);
      const ni = g.toNonIndexed();
      g.dispose();
      boughs.push(uvFix(ni));
    }
  }
  const trunk = uvFix(new THREE.CylinderGeometry(0.03, 0.05, H * 0.2, 8).translate(0, H * 0.1, 0).toNonIndexed());

  // lights on a spiral over the cone surface
  const lights: THREE.BufferGeometry[] = [];
  const bulb = new THREE.SphereGeometry(0.012, 6, 4);
  const nL = Math.round(140 * (H / 2.1));
  for (let i = 0; i < nL; i++) {
    const t = i / nL;
    const y = H * (0.08 + t * 0.84);
    const rr = R * (1 - (y / H) * 0.95) * (0.85 + r() * 0.1);
    const a = t * Math.PI * 2 * 11 + r() * 0.3;
    lights.push(uvFix(bulb.clone().translate(Math.cos(a) * rr, y, Math.sin(a) * rr).toNonIndexed()));
  }
  const orns: Record<string, THREE.BufferGeometry[]> = { $ornGold: [], $ornRed: [], $ornWhite: [] };
  const palette = p.ornaments === 'red' ? ['$ornRed', '$ornWhite'] : p.ornaments === 'white' ? ['$ornWhite', '$ornGold'] : ['$ornGold', '$ornWhite', '$ornRed'];
  for (let i = 0; i < 46; i++) {
    const y = H * (0.1 + r() * 0.75);
    const rr = R * (1 - (y / H) * 0.95) * 0.9;
    const a = r() * Math.PI * 2;
    const s = 0.025 + r() * 0.025;
    const g = new THREE.SphereGeometry(s, 12, 8).translate(Math.cos(a) * rr, y - 0.03, Math.sin(a) * rr);
    orns[palette[i % palette.length]].push(uvFix(g.toNonIndexed()));
  }
  const star = new THREE.OctahedronGeometry(0.07, 0);
  star.scale(1, 1.4, 0.4);
  star.translate(0, H + 0.02, 0);

  const out: OrganicPart[] = [
    { geo: mergeGeometries(boughs, false)!, mat: '$fir' },
    { geo: trunk, mat: '$bark' },
    { geo: mergeGeometries(lights, false)!, mat: '$treeLight' },
    { geo: uvFix(star.toNonIndexed()), mat: '$ornGold' },
  ];
  for (const [m, list] of Object.entries(orns)) if (list.length) out.push({ geo: mergeGeometries(list, false)!, mat: m });
  return out;
}

// ---------------------------------------------------------------------------
// Curtains: a pleated panel with a soft flare at the hem.

function curtain(p: Record<string, any>): OrganicPart[] {
  const W: number = p.w ?? 0.8;
  const H: number = p.h ?? 2.8;
  const folds: number = p.folds ?? 8;
  const sx = folds * 8;
  const sy = 16;
  const g = new THREE.PlaneGeometry(W, H, sx, sy);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (x + W / 2) / W;
    const v = (y + H / 2) / H; // 0 bottom .. 1 top
    const amp = 0.035 + (1 - v) * 0.02;
    pos.setXYZ(i, x * (1 + (1 - v) * 0.04), y + H / 2, Math.sin(u * Math.PI * 2 * folds) * amp);
  }
  g.computeVertexNormals();
  return [{ geo: uvFix(g.toNonIndexed()), mat: p.sheer === false ? '$drape' : '$sheer' }];
}
