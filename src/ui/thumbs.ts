import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useEffect, useState } from 'react';
import type { CatalogEntry, Item } from '../model/types';
import { buildItemGroup } from '../three/furniture';

// Small studio renders of catalog pieces for the library, made lazily with one
// shared offscreen renderer.

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();
const queue: { key: string; entry: CatalogEntry; item?: Item }[] = [];
let busy = false;
let failed = false;

function setup() {
  if (renderer || failed) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(2, 4, 3);
    scene.add(key);
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9aa98', 0.6));
    camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  } catch {
    failed = true;
  }
}

function pump() {
  if (busy) return;
  busy = true;
  const step = () => {
    const job = queue.shift();
    if (!job) {
      busy = false;
      return;
    }
    if (!cache.has(job.key)) {
      const url = render(job.entry, job.item);
      if (url) {
        cache.set(job.key, url);
        listeners.get(job.key)?.forEach((l) => l(url));
      }
    }
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(step, { timeout: 150 });
    else setTimeout(step, 16);
  };
  step();
}

function render(entry: CatalogEntry, item?: Item): string | null {
  setup();
  if (!renderer || !scene || !camera) return null;
  const it: Item = item ?? { id: `thumb-${entry.id}`, ref: entry.id, x: 0, y: 0, rotation: 0 };
  const { group } = buildItemGroup(it, entry, { ceiling: Math.max(2.6, entry.h), evening: false, catalog: {} });
  const holder = new THREE.Group();
  holder.add(group);
  if (entry.mount === 'wall') group.position.y = entry.h / 2;
  scene.add(holder);
  const box = new THREE.Box3().setFromObject(holder);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const flat = entry.category === 'rug' || size.y < 0.05;
  const r = Math.max(size.x, size.y, size.z) * 0.5 || 0.5;
  const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.02;
  const dir = flat ? new THREE.Vector3(0.0, 1, 0.55).normalize() : entry.mount === 'wall' ? new THREE.Vector3(0.25, 0.1, 1).normalize() : new THREE.Vector3(0.75, 0.55, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  let url: string | null = null;
  try {
    url = renderer.domElement.toDataURL('image/webp', 0.86);
  } catch {
    url = null;
  }
  scene.remove(holder);
  return url;
}

export function thumbKey(entry: CatalogEntry, finishes?: Record<string, string>) {
  return `${entry.id}:${JSON.stringify(finishes ?? null)}:${entry.custom ? JSON.stringify([entry.params, entry.w, entry.d, entry.h, entry.finishes, entry.generator, entry.image?.url]) : ''}`;
}

export function useThumb(entry: CatalogEntry | undefined, finishes?: Record<string, string>, visible = true): string | null {
  const key = entry ? thumbKey(entry, finishes) : '';
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!entry || !visible) return;
    const hit = cache.get(key);
    if (hit) {
      setUrl(hit);
      return;
    }
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    const l = (u: string) => setUrl(u);
    set.add(l);
    if (!queue.some((q) => q.key === key)) queue.push({ key, entry, item: finishes ? { id: `thumb-${entry.id}`, ref: entry.id, x: 0, y: 0, rotation: 0, finishes } : undefined });
    pump();
    return () => {
      set!.delete(l);
    };
  }, [key, visible]);
  return url;
}
