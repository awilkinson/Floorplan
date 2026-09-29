import * as THREE from 'three';
import { CATALOG_MAP } from '../catalog/catalog';
import { GENERATORS } from '../catalog/generators';
import { hashString, type Built, type LightSpec, type Part } from '../catalog/parts';
import type { CatalogEntry, Item } from '../model/types';
import { geometryFor, mergeTransformed } from './geometry';
import { imageMaterial, resolveMaterial, rugMaterial } from './materials';
import { buildCustom } from './organic';

// Build a THREE.Group for an item from its catalog entry's generator. Parts
// are merged per material so a piece is a handful of draw calls; identical
// pieces share geometry.

export interface BuildEnv {
  ceiling: number;
  evening: boolean;
  catalog: Record<string, CatalogEntry>;
}

export function entryFor(ref: string, catalog: Record<string, CatalogEntry>): CatalogEntry | undefined {
  return catalog[ref] ?? CATALOG_MAP[ref];
}

export function buildParts(item: Item, entry: CatalogEntry, ceiling: number): Built {
  const gen = GENERATORS[entry.generator];
  const w = item.w ?? entry.w;
  const d = item.d ?? entry.d;
  const h = item.h ?? entry.h;
  const params = { ...entry.params, ...(item.params ?? {}) };
  const finishes = { ...entry.finishes, ...(item.finishes ?? {}) };
  if (!gen) return { parts: [{ geo: { t: 'box', w, h, d, r: 0.02 }, mat: 'upholstery', p: [0, h / 2, 0] }] };
  const seed = hashString(item.id);
  try {
    return gen({ w, d, h, params, seed, ceiling, finish: (s) => finishes[s] });
  } catch (err) {
    console.warn('generator failed', entry.id, err);
    return { parts: [{ geo: { t: 'box', w, h, d, r: 0.02 }, mat: 'upholstery', p: [0, h / 2, 0] }] };
  }
}

function signature(item: Item, entry: CatalogEntry, env: BuildEnv) {
  const seeded = entry.generator === 'plant' || entry.generator === 'christmasTree' || entry.generator === 'shelvingRun' || entry.generator === 'fireplace';
  return JSON.stringify([
    entry.id,
    entry.custom ? [entry.params, entry.finishes, entry.generator] : null,
    item.w ?? entry.w,
    item.d ?? entry.d,
    item.h ?? entry.h,
    item.params ?? null,
    item.finishes ?? null,
    seeded ? item.id : null,
    env.evening,
    entry.generator === 'shelvingRun' || entry.generator === 'fireplace' || entry.generator === 'column' ? env.ceiling : 0,
    entry.image?.url ?? null,
  ]);
}

const groupCache = new Map<string, { group: THREE.Group; lights: LightSpec[] }>();

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3(1, 1, 1);
const tmpP = new THREE.Vector3();

function partMatrix(p: Part) {
  tmpE.set(p.r?.[0] ?? 0, p.r?.[1] ?? 0, p.r?.[2] ?? 0);
  tmpQ.setFromEuler(tmpE);
  tmpP.set(p.p[0], p.p[1], p.p[2]);
  return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS.set(1, 1, 1));
}

export function buildItemGroup(item: Item, entry: CatalogEntry, env: BuildEnv): { group: THREE.Group; lights: LightSpec[] } {
  const sig = signature(item, entry, env);
  const hit = groupCache.get(sig);
  if (hit) return { group: hit.group.clone(), lights: hit.lights };

  const built = buildParts(item, entry, env.ceiling);
  const finishes = { ...entry.finishes, ...(item.finishes ?? {}) };
  const byMat = new Map<string, { list: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; color?: THREE.Color }[]; colored: boolean; shadow: boolean }>();
  const group = new THREE.Group();
  const w = item.w ?? entry.w;
  const d = item.d ?? entry.d;

  for (const p of built.parts) {
    const m = partMatrix(p);
    if (p.geo.t === 'custom') {
      const parts = buildCustom(p.geo.key, p.geo.params ?? {});
      for (const op of parts) {
        const mat = resolveMaterial(op.mat, finishes, { evening: env.evening });
        const mesh = new THREE.Mesh(op.geo, mat);
        mesh.applyMatrix4(m);
        mesh.castShadow = op.mat !== '$treeLight' && op.mat !== '$sheer';
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      continue;
    }
    // Rugs and asset images need per-item materials.
    if (p.mat === 'rug') {
      const url = entry.image?.url;
      const mat = rugMaterial(finishes.rug ?? 'rug-oatmeal', w, d, hashString(item.id) % 97, (entry.params.shape as string) ?? 'rect', url);
      const mesh = new THREE.Mesh(geometryFor(p.geo), mat);
      mesh.applyMatrix4(m);
      mesh.receiveShadow = true;
      mesh.renderOrder = -1;
      group.add(mesh);
      continue;
    }
    if (p.mat.startsWith('$art:asset') && entry.image?.url) {
      const mesh = new THREE.Mesh(geometryFor(p.geo), imageMaterial(entry.image.url));
      mesh.applyMatrix4(m);
      group.add(mesh);
      continue;
    }
    const geo = geometryFor(p.geo);
    const key = p.mat;
    let bucket = byMat.get(key);
    if (!bucket) {
      bucket = { list: [], colored: key === '$books', shadow: !p.noShadow };
      byMat.set(key, bucket);
    }
    if (p.inst) {
      for (const ins of p.inst) {
        tmpE.set(ins.r?.[0] ?? 0, ins.r?.[1] ?? 0, ins.r?.[2] ?? 0);
        tmpQ.setFromEuler(tmpE);
        const im = new THREE.Matrix4().compose(new THREE.Vector3(...ins.p), tmpQ.clone(), new THREE.Vector3(...(ins.s ?? [1, 1, 1])));
        bucket.list.push({ geo, matrix: m.clone().multiply(im), color: ins.c ? new THREE.Color(ins.c) : undefined });
      }
    } else {
      bucket.list.push({ geo, matrix: m, color: p.color ? new THREE.Color(p.color) : undefined });
    }
    if (p.noShadow) bucket.shadow = bucket.shadow && false;
  }

  for (const [key, bucket] of byMat) {
    const merged = mergeTransformed(bucket.list, bucket.colored);
    if (!merged) continue;
    const mat = resolveMaterial(key, finishes, { evening: env.evening });
    const mesh = new THREE.Mesh(merged, mat);
    const transparent = (mat as THREE.MeshStandardMaterial).transparent;
    mesh.castShadow = bucket.shadow && !transparent && key !== '$bulb' && key !== '$flame';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const lights = built.lights ?? [];
  groupCache.set(sig, { group, lights });
  if (groupCache.size > 600) {
    const first = groupCache.keys().next().value as string;
    groupCache.delete(first);
  }
  return { group: group.clone(), lights };
}

export function clearItemCache() {
  groupCache.clear();
}

const lightCache = new Map<string, LightSpec[]>();

/** Light sources of a piece (lamps, fire, tree), without building meshes. */
export function lightsFor(item: Item, entry: CatalogEntry, env: BuildEnv): LightSpec[] {
  const sig = signature(item, entry, env);
  const hit = groupCache.get(sig);
  if (hit) return hit.lights;
  const lc = lightCache.get(sig);
  if (lc) return lc;
  const lights = buildParts(item, entry, env.ceiling).lights ?? [];
  lightCache.set(sig, lights);
  return lights;
}
