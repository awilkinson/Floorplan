import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { bounds, pointInPolygon, walls } from '../model/geometry';
import type { Room } from '../model/types';
import { activeLayout, catalogEntry, useStore } from '../state/store';
import { useView } from './viewState';
import { sizeOf } from '../interaction/snap';
import { CATALOG_MAP } from '../catalog/catalog';

export const controlsRef: MutableRefObject<CameraControlsImpl | null> = { current: null };
export const cameraRef: MutableRefObject<THREE.Camera | null> = { current: null };

const EYE = 1.6;
const SEATED = 1.12;

/** Camera presets: overview, top, eye-level views from each wall, seats. */
export function presetFor(room: Room, key: string): { pos: THREE.Vector3; target: THREE.Vector3 } | null {
  const b = bounds(room.outline);
  const c = new THREE.Vector3(b.cx, 0.8, b.cy);
  const diag = Math.hypot(b.w, b.h);
  const ws = walls(room);
  if (key === 'overview') {
    // from the corner opposite the fireplace / focal wall, high and pulled back
    const focal = ws.find((w) => room.fixtures.some((f) => f.wall === w.index && CATALOG_MAP[f.ref]?.generator === 'fireplace')) ?? ws[0];
    const away = new THREE.Vector3(focal.normal.x, 0, focal.normal.y);
    const side = new THREE.Vector3(focal.dir.x, 0, focal.dir.y);
    const dir = away.multiplyScalar(0.8).add(side.multiplyScalar(0.62)).normalize();
    const pos = c.clone().add(dir.multiplyScalar(diag * 0.95)).setY(diag * 0.95);
    return { pos, target: c.clone().setY(0.5) };
  }
  if (key === 'top') return { pos: new THREE.Vector3(b.cx, diag * 1.55, b.cy + 0.001), target: new THREE.Vector3(b.cx, 0, b.cy) };
  if (key.startsWith('wall:')) {
    const w = ws[parseInt(key.slice(5), 10)];
    if (!w) return null;
    const mid = new THREE.Vector3((w.a.x + w.b.x) / 2, EYE, (w.a.y + w.b.y) / 2);
    const pos = mid.clone().add(new THREE.Vector3(w.normal.x, 0, w.normal.y).multiplyScalar(0.45));
    const target = mid.clone().add(new THREE.Vector3(w.normal.x, 0, w.normal.y).multiplyScalar(3)).setY(1.2);
    return { pos, target };
  }
  if (key.startsWith('facing:')) {
    // stand across the room looking at a wall
    const w = ws[parseInt(key.slice(7), 10)];
    if (!w) return null;
    const mid = new THREE.Vector3((w.a.x + w.b.x) / 2, EYE, (w.a.y + w.b.y) / 2);
    const n = new THREE.Vector3(w.normal.x, 0, w.normal.y);
    let depth = 3;
    for (let t = 0.5; t < 20; t += 0.25) {
      const p = mid.clone().add(n.clone().multiplyScalar(t));
      if (!pointInPolygon({ x: p.x, y: p.z }, room.outline)) break;
      depth = t;
    }
    const pos = mid.clone().add(n.clone().multiplyScalar(Math.max(1, depth - 0.5)));
    return { pos, target: mid.clone().setY(1.25) };
  }
  if (key.startsWith('door:')) {
    const o = room.openings.find((x) => x.id === key.slice(5));
    if (!o) return null;
    const w = ws[o.wall];
    const m = o.offset + o.width / 2;
    const p = new THREE.Vector3(w.a.x + w.dir.x * m, EYE, w.a.y + w.dir.y * m);
    const n = new THREE.Vector3(w.normal.x, 0, w.normal.y);
    return { pos: p.clone().add(n.clone().multiplyScalar(0.25)), target: p.clone().add(n.multiplyScalar(4)).setY(1.1) };
  }
  return null;
}

type Pose = { pos: THREE.Vector3; target: THREE.Vector3 };

/** Walk mode keeps the orbit target a hair in front of the eye. */
function firstPerson(c: CameraControlsImpl, p: Pose, smooth: boolean) {
  const dir = p.target.clone().sub(p.pos);
  if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
  const t = p.pos.clone().add(dir.normalize().multiplyScalar(0.01));
  c.setLookAt(p.pos.x, p.pos.y, p.pos.z, t.x, t.y, t.z, smooth);
}

function sitPreset(itemId: string): { pos: THREE.Vector3; target: THREE.Vector3 } | null {
  const layout = activeLayout();
  const it = layout?.items.find((x) => x.id === itemId);
  if (!it) return null;
  const e = catalogEntry(it.ref);
  const { d } = sizeOf(it, e);
  const fx = -Math.sin(it.rotation);
  const fz = Math.cos(it.rotation);
  const pos = new THREE.Vector3(it.x - fx * d * 0.12, SEATED, it.y - fz * d * 0.12);
  return { pos, target: pos.clone().add(new THREE.Vector3(fx * 3, -0.25, fz * 3)) };
}

export function Controls({ room }: { room: Room }) {
  const ref = useRef<CameraControlsImpl | null>(null);
  const cameraMode = useStore((s) => s.camera);
  const req = useStore((s) => s.cameraRequest);
  const { camera, invalidate } = useThree();
  const keys = useRef(new Set<string>());
  const lastView = useRef('');

  useEffect(() => {
    controlsRef.current = ref.current;
    cameraRef.current = camera;
  });

  // Initial framing
  useEffect(() => {
    const p = presetFor(room, 'overview');
    if (p && ref.current) ref.current.setLookAt(p.pos.x, p.pos.y, p.pos.z, p.target.x, p.target.y, p.target.z, false);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // A pose to apply once a mode switch has set up the controls.
  const pendingPose = useRef<Pose | null>(null);

  // Camera requests from the UI
  useEffect(() => {
    if (!req || !ref.current) return;
    let p: Pose | null = null;
    if (req.kind === 'sit') p = sitPreset(req.value);
    else if (req.kind === 'fit') p = presetFor(room, 'overview');
    else p = presetFor(room, req.value);
    if (!p) return;
    const eyeLevel = p.pos.y < 2.2;
    const mode = useStore.getState().camera;
    if (eyeLevel !== (mode === 'walk')) {
      pendingPose.current = p;
      useStore.setState({ camera: eyeLevel ? 'walk' : 'orbit' });
      return;
    }
    if (eyeLevel) firstPerson(ref.current, p, true);
    else ref.current.setLookAt(p.pos.x, p.pos.y, p.pos.z, p.target.x, p.target.y, p.target.z, true);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  // Mode switches
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const A = CameraControlsImpl.ACTION;
    if (cameraMode === 'walk') {
      c.minDistance = c.maxDistance = 0.01;
      c.azimuthRotateSpeed = -0.35;
      c.polarRotateSpeed = -0.35;
      c.minPolarAngle = 0.35;
      c.maxPolarAngle = Math.PI - 0.35;
      c.mouseButtons.left = A.ROTATE;
      c.mouseButtons.right = A.NONE;
      c.mouseButtons.wheel = A.NONE;
      c.touches.one = A.TOUCH_ROTATE;
      c.touches.two = A.NONE;
      c.dollyToCursor = false;
      // Walk from the requested spot, or drop to eye height if we're above the room.
      const pose = pendingPose.current;
      pendingPose.current = null;
      const pos = c.getPosition(new THREE.Vector3());
      if (pose) firstPerson(c, pose, true);
      else if (pos.y > 2.2 || !pointInPolygon({ x: pos.x, y: pos.z }, room.outline)) {
        const p = presetFor(room, 'facing:' + (walls(room).length - 1)) ?? presetFor(room, 'wall:0');
        if (p) firstPerson(c, p, true);
      } else firstPerson(c, { pos, target: c.getTarget(new THREE.Vector3()) }, false);
    } else {
      c.minDistance = 1.2;
      c.maxDistance = 60;
      c.azimuthRotateSpeed = 1;
      c.polarRotateSpeed = 1;
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI / 2 - 0.04;
      c.mouseButtons.left = A.ROTATE;
      c.mouseButtons.right = A.TRUCK;
      c.mouseButtons.wheel = A.DOLLY;
      c.touches.one = A.TOUCH_ROTATE;
      c.touches.two = A.TOUCH_DOLLY_TRUCK;
      c.dollyToCursor = true;
      const pose = pendingPose.current;
      pendingPose.current = null;
      const pos = c.getPosition(new THREE.Vector3());
      const p = pose ?? (pos.y < 2.2 ? presetFor(room, 'overview') : null);
      if (p) c.setLookAt(p.pos.x, p.pos.y, p.pos.z, p.target.x, p.target.y, p.target.z, true);
    }
    invalidate();
  }, [cameraMode, room, invalidate]);

  // Walk keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k) && useStore.getState().camera === 'walk') {
        keys.current.add(k);
        e.preventDefault();
        invalidate();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [invalidate]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    const k = keys.current;
    if (cameraMode === 'walk' && k.size) {
      const speed = 2.2 * Math.min(dt, 0.05);
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const s = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
      const before = c.getPosition(new THREE.Vector3());
      if (f) c.forward(f * speed, false);
      if (s) c.truck(s * speed, 0, false);
      if (turn) c.rotate(turn * speed * 0.9, 0, false);
      const after = c.getPosition(new THREE.Vector3());
      if (!insideWithMargin(room, after.x, after.z, 0.25)) {
        const t = c.getTarget(new THREE.Vector3());
        c.setLookAt(before.x, before.y, before.z, t.x - (after.x - before.x), t.y, t.z - (after.z - before.z), false);
      }
      invalidate();
    }
    updateView(camera as THREE.PerspectiveCamera, room, lastView);
  });

  return <CameraControls ref={ref} makeDefault smoothTime={0.28} draggingSmoothTime={0.08} />;
}

function insideWithMargin(room: Room, x: number, y: number, m: number) {
  if (!pointInPolygon({ x, y }, room.outline)) return false;
  for (const w of walls(room)) {
    const rel = { x: x - w.a.x, y: y - w.a.y };
    const along = rel.x * w.dir.x + rel.y * w.dir.y;
    const perp = rel.x * w.normal.x + rel.y * w.normal.y;
    if (along > 0 && along < w.length && perp < m) return false;
  }
  return true;
}

/** Decide which walls to cut away and whether we're inside the room. */
function updateView(camera: THREE.PerspectiveCamera, room: Room, last: MutableRefObject<string>) {
  const p = camera.position;
  const inside = pointInPolygon({ x: p.x, y: p.z }, room.outline) && p.y < room.ceilingHeight - 0.05;
  const hidden: number[] = [];
  if (!inside) {
    for (const w of walls(room)) {
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      const v = { x: p.x - mid.x, y: p.z - mid.y };
      if (v.x * w.normal.x + v.y * w.normal.y < 0) hidden.push(w.index);
    }
  }
  const ceiling = p.y < room.ceilingHeight + 0.02;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const heading = Math.atan2(dir.z, dir.x);
  const key = `${inside}|${hidden.join(',')}|${ceiling}`;
  const camKey = `${p.x.toFixed(2)},${p.z.toFixed(2)},${heading.toFixed(2)}`;
  if (key !== last.current) {
    last.current = key;
    useView.setState({ hiddenWalls: hidden, inside, ceiling });
  }
  const cur = useView.getState().cam;
  const nextCam = { x: p.x, y: p.z, heading, fov: camera.fov };
  if (!cur || `${cur.x.toFixed(2)},${cur.y.toFixed(2)},${cur.heading.toFixed(2)}` !== camKey) useView.setState({ cam: nextCam });
}
