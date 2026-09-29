import * as THREE from 'three';
import { finish, FINISH_MAP, type Finish } from '../catalog/finishes';
import { artTexture, detailTextures, rugTexture, sheerTexture } from './textures';

// Materials are shared and cached by key. Texture repeats are expressed in
// meters because every generated geometry gets world-scaled box UVs.

const cache = new Map<string, THREE.Material>();

export interface MatOpts {
  /** When the room is in evening mode, lamp shades and bulbs glow. */
  evening?: boolean;
}

function applyDetail(m: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial, f: Finish) {
  if (!f.texture || f.texture === 'none') return;
  const t = detailTextures(f.texture);
  const s = 1 / (f.texScale ?? 0.2);
  const rep = (tex?: THREE.Texture) => {
    if (!tex) return undefined;
    const c = tex.clone();
    c.repeat.set(s, s);
    c.needsUpdate = true;
    return c;
  };
  if (t.map) m.map = rep(t.map)!;
  if (t.normal) {
    m.normalMap = rep(t.normal)!;
    const strength = f.family === 'fabric' ? 0.55 : f.family === 'wood' ? 0.25 : f.family === 'leather' ? 0.3 : f.family === 'woven' ? 0.8 : 0.35;
    m.normalScale = new THREE.Vector2(strength, strength);
  }
  if (t.rough) m.roughnessMap = rep(t.rough)!;
  if (t.alpha) {
    m.alphaMap = rep(t.alpha)!;
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
  }
}

export function finishMaterial(id: string, opts: MatOpts = {}): THREE.Material {
  const f = FINISH_MAP[id] ?? finish(id);
  const key = `f:${f.id}:${opts.evening && f.translucent ? 'lit' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  if (f.family === 'glass') {
    m = new THREE.MeshPhysicalMaterial({
      color: f.color,
      roughness: f.roughness,
      metalness: 0,
      transparent: true,
      opacity: f.opacity ?? 0.3,
      envMapIntensity: 1.2,
      clearcoat: 1,
      depthWrite: false,
    });
  } else if (f.family === 'shade') {
    m = new THREE.MeshStandardMaterial({
      color: f.color,
      roughness: f.roughness,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(opts.evening ? '#FFC98A' : '#000000'),
      emissiveIntensity: opts.evening ? 1.3 : 0,
      transparent: false,
    });
    applyDetail(m, f);
  } else if (f.sheen || f.clearcoat) {
    m = new THREE.MeshPhysicalMaterial({
      color: f.color,
      roughness: f.roughness,
      metalness: f.metalness ?? 0,
      sheen: f.sheen ?? 0,
      sheenColor: new THREE.Color(f.sheenColor ?? '#ffffff'),
      sheenRoughness: 0.5,
      clearcoat: f.clearcoat ?? 0,
      clearcoatRoughness: 0.25,
    });
    applyDetail(m, f);
  } else {
    m = new THREE.MeshStandardMaterial({ color: f.color, roughness: f.roughness, metalness: f.metalness ?? 0 });
    applyDetail(m, f);
  }
  m.name = f.id;
  cache.set(key, m);
  return m;
}

/** Fixed materials referenced by generators with a leading '$'. */
const FIXED: Record<string, () => THREE.Material> = {
  $black: () => new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.55 }),
  $chrome: () => new THREE.MeshStandardMaterial({ color: '#dcdfe2', roughness: 0.1, metalness: 1 }),
  $nickel: () => new THREE.MeshStandardMaterial({ color: '#bdbab3', roughness: 0.28, metalness: 1 }),
  $brassDecor: () => new THREE.MeshStandardMaterial({ color: '#b8914e', roughness: 0.32, metalness: 1 }),
  $bulb: () => new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 2.2, roughness: 0.4 }),
  $ledStrip: () => new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 1.2 }),
  $driverSilver: () => new THREE.MeshStandardMaterial({ color: '#c8cacb', roughness: 0.42, metalness: 0.25, side: THREE.DoubleSide }),
  $soil: () => new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 1 }),
  $stem: () => new THREE.MeshStandardMaterial({ color: '#5a4a35', roughness: 0.9 }),
  $foliage: () => new THREE.MeshStandardMaterial({ color: '#3e5a2e', roughness: 0.55, side: THREE.DoubleSide }),
  $fir: () => new THREE.MeshStandardMaterial({ color: '#21392a', roughness: 0.85, side: THREE.DoubleSide }),
  $foliageV: () => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }),
  $bark: () => new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.95 }),
  $stemGreen: () => new THREE.MeshStandardMaterial({ color: '#4a6a36', roughness: 0.7 }),
  $books: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, vertexColors: true }),
  $ceramicBlack: () => new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.7 }),
  $ceramicWhite: () => new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.35 }),
  $ceramicClay: () => new THREE.MeshStandardMaterial({ color: '#b98a67', roughness: 0.8 }),
  $stoneDecor: () => new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.7 }),
  $woven: () => finishMaterial('rattan'),
  $feltGrey: () => new THREE.MeshStandardMaterial({ color: '#a8a39a', roughness: 1 }),
  $toeKick: () => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 }),
  $reveal: () => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 }),
  $firebox: () => new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.95 }),
  $fireGlass: () => new THREE.MeshPhysicalMaterial({ color: '#111', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }),
  $flame: () => new THREE.MeshBasicMaterial({ color: '#ffae5a', transparent: true, opacity: 0.85, depthWrite: false }),
  $ember: () => new THREE.MeshStandardMaterial({ color: '#3a2a22', emissive: new THREE.Color('#ff6a20'), emissiveIntensity: 0.9, roughness: 1 }),
  $hearth: () => new THREE.MeshStandardMaterial({ color: '#2d2b2a', roughness: 0.6 }),
  $keysWhite: () => new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 }),
  $keysBlack: () => new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 }),
  $mattress: () => new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.95 }),
  $linenWhite: () => finishMaterial('linen-white'),
  $playMat: () => new THREE.MeshStandardMaterial({ color: '#e9e0d2', roughness: 0.9 }),
  $stripes: () => new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 }),
  $toyRed: () => new THREE.MeshStandardMaterial({ color: '#d4553f', roughness: 0.5 }),
  $toyYellow: () => new THREE.MeshStandardMaterial({ color: '#e7b53f', roughness: 0.5 }),
  $toyBlue: () => new THREE.MeshStandardMaterial({ color: '#4d79b5', roughness: 0.5 }),
  $toyGreen: () => new THREE.MeshStandardMaterial({ color: '#6aa56a', roughness: 0.5 }),
  $plasticWhite: () => new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.4 }),
  $skirt: () => new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 1 }),
  $wrapA: () => new THREE.MeshStandardMaterial({ color: '#8c2f2a', roughness: 0.5 }),
  $wrapB: () => new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.5 }),
  $wrapC: () => new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.5 }),
  $sunburst: () => new THREE.MeshPhysicalMaterial({ color: '#8a4a1e', roughness: 0.25, clearcoat: 1 }),
  $rosewood: () => new THREE.MeshStandardMaterial({ color: '#3a2218', roughness: 0.5 }),
  $canvasEdge: () => new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.95 }),
  $paper: () => new THREE.MeshStandardMaterial({ color: '#f6f3ec', roughness: 0.95 }),
  $glassArt: () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, transparent: true, opacity: 0.06, depthWrite: false }),
  $oakFrame: () => finishMaterial('oak-white'),
  $mirror: () => new THREE.MeshStandardMaterial({ color: '#dfe6e8', roughness: 0.02, metalness: 1 }),
  $screen: () => new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.15, metalness: 0.2 }),
  $scale: () => new THREE.MeshStandardMaterial({ color: '#c9c6c0', roughness: 0.8 }),
  $sheer: () =>
    new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 0.9, transparent: true, opacity: 0.72, side: THREE.DoubleSide, map: sheerTexture(), depthWrite: false }),
  $drape: () => new THREE.MeshStandardMaterial({ color: '#d9cfbf', roughness: 0.95, side: THREE.DoubleSide }),
  $treeLight: () => new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: new THREE.Color('#ffc36b'), emissiveIntensity: 2.5 }),
  $ornGold: () => new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.25, metalness: 1 }),
  $ornRed: () => new THREE.MeshPhysicalMaterial({ color: '#8f1f1f', roughness: 0.2, clearcoat: 1 }),
  $ornWhite: () => new THREE.MeshPhysicalMaterial({ color: '#f1ede4', roughness: 0.3, clearcoat: 0.6 }),
};

export function fixedMaterial(key: string, opts: MatOpts = {}): THREE.Material {
  const lit = opts.evening && (key === '$bulb' || key === '$ledStrip' || key === '$treeLight');
  const k = `x:${key}:${lit ? 'lit' : ''}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let m: THREE.Material;
  if (key.startsWith('$art:')) {
    m = new THREE.MeshStandardMaterial({ map: artTexture(key.slice(5)), roughness: 0.85 });
  } else {
    const f = FIXED[key];
    m = f ? f() : new THREE.MeshStandardMaterial({ color: '#999' });
    if ((key === '$bulb' || key === '$ledStrip') && m instanceof THREE.MeshStandardMaterial) {
      m.emissiveIntensity = opts.evening ? (key === '$bulb' ? 3.5 : 1.8) : 0.25;
    }
  }
  m.name = key;
  cache.set(k, m);
  return m;
}

export function rugMaterial(finishId: string, w: number, d: number, seed: number, shape: string, imageUrl?: string): THREE.Material {
  const f = finish(finishId, 'rug-oatmeal');
  const k = `rug:${f.id}:${w.toFixed(2)}:${d.toFixed(2)}:${seed}:${shape}:${imageUrl ?? ''}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let map: THREE.Texture | undefined;
  if (imageUrl) {
    map = new THREE.TextureLoader().load(imageUrl);
    map.colorSpace = THREE.SRGBColorSpace;
  }
  const t = rugTexture(f.pattern ?? 'solid', f.palette ?? [f.color], w, d, seed, shape);
  const nm = t.normal?.clone();
  if (nm) {
    nm.repeat.set(w / 0.08, d / 0.08);
    nm.needsUpdate = true;
  }
  const m = new THREE.MeshStandardMaterial({ map: map ?? t.map, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, color: '#ffffff' });
  cache.set(k, m);
  return m;
}

/** Material for an asset-backed image (custom art). */
export function imageMaterial(url: string): THREE.Material {
  const k = `img:${url}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  cache.set(k, m);
  return m;
}

export function resolveMaterial(mat: string, finishes: Record<string, string>, opts: MatOpts = {}): THREE.Material {
  if (mat.startsWith('$')) return fixedMaterial(mat, opts);
  const id = finishes[mat] ?? finishes.upholstery ?? finishes.frame ?? finishes.body ?? 'linen-natural';
  return finishMaterial(id, opts);
}

export function clearMaterialCache() {
  cache.forEach((m) => m.dispose());
  cache.clear();
}

// Architectural materials for the room shell.
export function roomMaterials(wallColor: string, trimColor: string) {
  const k = `room:${wallColor}:${trimColor}`;
  const hit = cache.get(k) as unknown as ReturnType<typeof make> | undefined;
  if (hit) return hit;
  const make = () => ({
    wall: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.5 }),
    ceiling: new THREE.MeshStandardMaterial({ color: new THREE.Color(wallColor).offsetHSL(0, 0, 0.01), roughness: 0.95, side: THREE.DoubleSide }),
    cut: new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#dfe9ec', roughness: 0.02, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 1.5 }),
    frameWhite: new THREE.MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.45 }),
    frameOak: finishMaterial('oak-white'),
    frameBlack: new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.5 }),
    hardware: new THREE.MeshStandardMaterial({ color: '#c8c6c0', roughness: 0.25, metalness: 1 }),
    potLight: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff2dc'), emissiveIntensity: 0.4 }),
    potTrim: new THREE.MeshStandardMaterial({ color: '#f5f5f3', roughness: 0.4 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#cfd6d8', roughness: 0.05, metalness: 1 }),
  });
  const v = make();
  cache.set(k, v as unknown as THREE.Material);
  return v;
}
