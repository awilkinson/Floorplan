import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CATALOG_MAP } from '../catalog/catalog';
import type { LightSpec } from '../catalog/parts';
import { bounds, walls } from '../model/geometry';
import type { Layout, Room } from '../model/types';
import { useStore } from '../state/store';
import { lightsFor } from './furniture';
import { surfaceElevation } from './Items';

interface Props {
  room: Room;
  layout: Layout | null;
  evening: boolean;
  quality: 'high' | 'balanced';
}

/** The wall with the most glass: daylight comes from there. */
function glazedWall(room: Room) {
  let best = -1;
  let area = 0;
  for (const w of walls(room)) {
    const a = room.openings
      .filter((o) => o.wall === w.index && (o.kind === 'french-door' || o.kind === 'window' || o.kind === 'sliding-door' || (o.glazed && o.kind !== 'niche')))
      .reduce((s, o) => s + o.width * (o.height + (o.transom ?? 0) - o.sill), 0);
    if (a > area) {
      area = a;
      best = w.index;
    }
  }
  return best >= 0 ? walls(room)[best] : walls(room)[0];
}

export function Lights({ room, layout, evening, quality }: Props) {
  const sun = useStore((s) => s.scene.sun);
  const custom = useStore((s) => s.custom);
  const b = bounds(room.outline);
  const center = new THREE.Vector3(b.cx, 0, b.cy);
  const gw = glazedWall(room);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const { scene, invalidate } = useThree();

  // Sun: comes in through the glazed wall, sweeping from one side to the other.
  const sunPos = useMemo(() => {
    const out = new THREE.Vector3(-gw.normal.x, 0, -gw.normal.y);
    const along = new THREE.Vector3(gw.dir.x, 0, gw.dir.y);
    const sweep = (sun - 0.5) * 1.6;
    const dir = out.clone().multiplyScalar(Math.cos(sweep)).add(along.clone().multiplyScalar(Math.sin(sweep))).normalize();
    const elev = 0.62 - Math.abs(sun - 0.5) * 0.35;
    const dist = 16;
    return center.clone().add(dir.multiplyScalar(dist * Math.cos(elev))).add(new THREE.Vector3(0, dist * Math.sin(elev), 0));
  }, [gw, sun, center.x, center.z]);

  useEffect(() => {
    const l = sunRef.current;
    if (!l) return;
    l.target.position.copy(center);
    scene.add(l.target);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    const half = Math.max(b.w, b.h) * 0.8 + 1;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 40;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
    return () => {
      scene.remove(l.target);
    };
  }, [b.w, b.h, center.x, center.z, scene, invalidate, evening]);

  const catalog = useMemo(() => ({ ...CATALOG_MAP, ...custom }), [custom]);
  const lamps = useMemo(() => {
    if (!evening) return [];
    const all = [...room.fixtures, ...(layout?.items ?? [])];
    const out: (LightSpec & { world: THREE.Vector3 })[] = [];
    for (const it of all) {
      const entry = catalog[it.ref];
      if (!entry) continue;
      const specs = lightsFor(it, entry, { ceiling: room.ceilingHeight, evening, catalog });
      const elev = surfaceElevation(it, entry, all, catalog);
      for (const s of specs) {
        const c = Math.cos(-it.rotation);
        const sn = Math.sin(-it.rotation);
        const lx = s.p[0] * c + s.p[2] * sn;
        const lz = -s.p[0] * sn + s.p[2] * c;
        out.push({ ...s, world: new THREE.Vector3(it.x + lx, elev + s.p[1], it.y + lz) });
      }
    }
    // keep the brightest few so shaders stay light
    return out.sort((a, b2) => b2.intensity - a.intensity).slice(0, quality === 'high' ? 12 : 7);
  }, [evening, room, layout, catalog, quality]);

  const pots = useMemo(() => {
    if (!evening) return [];
    const nx = Math.max(2, Math.round(b.w / 2.4));
    const ny = Math.max(2, Math.round(b.h / 2.4));
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push(new THREE.Vector3(b.minX + (b.w * (i + 0.5)) / nx, room.ceilingHeight - 0.05, b.minY + (b.h * (j + 0.5)) / ny));
    return out;
  }, [evening, b.w, b.h, b.minX, b.minY, room.ceilingHeight]);

  // Fire flicker in the evening.
  const fireRefs = useRef<THREE.PointLight[]>([]);
  useFrame(({ clock }) => {
    if (!evening || !fireRefs.current.length) return;
    const t = clock.getElapsedTime();
    for (const l of fireRefs.current) {
      if (!l) continue;
      l.intensity = (l.userData.base as number) * (0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.05 + Math.sin(t * 2.1) * 0.04);
    }
    invalidate();
  });

  const windows = useMemo(() => {
    const ws = walls(room);
    const out: { pos: THREE.Vector3; look: THREE.Vector3; w: number; h: number }[] = [];
    for (const o of room.openings) {
      if (!(o.kind === 'french-door' || o.kind === 'window' || o.kind === 'sliding-door')) continue;
      const w = ws[o.wall];
      if (!w) continue;
      const mid = o.offset + o.width / 2;
      const top = o.height + (o.transom ?? 0);
      const px = w.a.x + w.dir.x * mid + w.normal.x * 0.05;
      const pz = w.a.y + w.dir.y * mid + w.normal.y * 0.05;
      const pos = new THREE.Vector3(px, (o.sill + top) / 2, pz);
      out.push({ pos, look: pos.clone().add(new THREE.Vector3(w.normal.x, -0.15, w.normal.y)), w: o.width, h: top - o.sill });
    }
    return out;
  }, [room]);

  const shadowSize = quality === 'high' ? 4096 : 2048;
  return (
    <>
      <hemisphereLight args={[evening ? '#8c96b4' : '#e9eef4', evening ? '#2a211c' : '#5a4536', evening ? 0.06 : 0.55]} />
      {!evening && (
        <directionalLight
          ref={sunRef}
          position={sunPos}
          intensity={2.6}
          color="#fff3e2"
          castShadow
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.025}
          shadow-radius={4}
        />
      )}
      {windows.map((w, i) => (
        <WindowLight key={i} {...w} intensity={evening ? 0.35 : 3.2} color={evening ? '#6f7fa8' : '#eef4ff'} />
      ))}
      {evening &&
        lamps.map((l, i) =>
          l.kind === 'fire' ? (
            <pointLight
              key={`f${i}`}
              ref={(el) => {
                if (el) {
                  el.userData.base = l.intensity * 3.2;
                  fireRefs.current[i] = el;
                }
              }}
              position={l.world}
              color={l.color}
              intensity={l.intensity * 3.2}
              distance={l.distance ?? 4}
              decay={1.6}
            />
          ) : (
            <pointLight key={`l${i}`} position={l.world} color={l.color} intensity={l.intensity * (l.kind === 'picture' ? 1.2 : 2.6)} distance={l.distance ?? 4.5} decay={1.7} />
          ),
        )}
      {evening &&
        pots.map((p, i) => (
          <spotLight key={`p${i}`} position={p} angle={1.05} penumbra={0.9} intensity={4.2} distance={6} decay={1.5} color="#ffdcb0" target-position={[p.x, 0, p.z]} />
        ))}
      {evening && <PotTargets pots={pots} />}
    </>
  );
}

function PotTargets({ pots }: { pots: THREE.Vector3[] }) {
  // spotLight targets must be in the scene graph to update their matrices
  const { scene } = useThree();
  useEffect(() => {
    const targets: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.SpotLight).isSpotLight) {
        const s = o as THREE.SpotLight;
        s.target.position.set(s.position.x, 0, s.position.z);
        scene.add(s.target);
        targets.push(s.target);
      }
    });
    return () => targets.forEach((t) => scene.remove(t));
  }, [pots, scene]);
  return null;
}

function WindowLight({ pos, look, w, h, intensity, color }: { pos: THREE.Vector3; look: THREE.Vector3; w: number; h: number; intensity: number; color: string }) {
  const ref = useRef<THREE.RectAreaLight>(null);
  useEffect(() => {
    ref.current?.lookAt(look);
  }, [look]);
  return <rectAreaLight ref={ref} position={pos} width={w} height={h} intensity={intensity} color={color} />;
}
