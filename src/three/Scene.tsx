import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { MeshReflectorMaterial } from '@react-three/drei';
import { activeRoom, displayedLayout, select, useStore } from '../state/store';
import { buildRoom } from './room';
import { plankFloor } from './textures';
import { useView } from './viewState';
import { Items } from './Items';
import { Lights } from './Lights';
import { Controls } from './Controls';
import { Effects } from './Effects';
import { Overlays3D } from './Overlays3D';
import type { Room, RoomFinishes } from '../model/types';

RectAreaLightUniformsLib.init();

export function Scene3D() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 42, near: 0.05, far: 300, position: [12, 9, 14] }}
      onPointerMissed={(e) => {
        if (e.button === 0) select([]);
      }}
      style={{ touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}

function SceneContent() {
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => displayedLayout(s));
  const evening = useStore((s) => s.scene.time === 'evening');
  const quality = useStore((s) => s.scene.quality);
  if (!room) return null;
  return (
    <>
      <Env evening={evening} />
      <RoomShell room={room} evening={evening} quality={quality} />
      <Items room={room} layout={layout} evening={evening} />
      <Lights room={room} layout={layout} evening={evening} quality={quality} />
      <Overlays3D room={room} layout={layout} />
      <Controls room={room} />
      <Effects quality={quality} evening={evening} />
    </>
  );
}

function sceneBackground() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
    if (v) return v;
  } catch {
    /* ignore */
  }
  return '#E7E5E0';
}

function Env({ evening }: { evening: boolean }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = evening ? 0.08 : 0.55;
    const apply = () => {
      scene.background = new THREE.Color(sceneBackground());
      invalidate();
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', apply);
      obs.disconnect();
    };
  }, [evening, scene, invalidate]);
  return null;
}

const FLOOR_COLORS: Record<string, string> = {
  'wood-dark': '#3B291E',
  'wood-mid': '#7A5A3C',
  'wood-light': '#B79770',
  herringbone: '#8C6A48',
  stone: '#CFC8BB',
  concrete: '#A8A49C',
  carpet: '#C9C0B0',
  tile: '#E6E2DA',
};

function floorColor(f: RoomFinishes) {
  return f.floorColor ?? FLOOR_COLORS[f.floor] ?? '#7A5A3C';
}

function RoomShell({ room, evening, quality }: { room: Room; evening: boolean; quality: 'high' | 'balanced' }) {
  const invalidate = useThree((s) => s.invalidate);
  const build = useMemo(
    () => buildRoom(room, { evening }),
    // fixtures only matter for paneling layout; rebuild when they move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.outline, room.openings, room.walls, room.finishes, room.ceilingHeight, room.wallThickness, room.outlook, JSON.stringify(room.fixtures.map((f) => [f.x, f.y, f.w, f.wall])), evening],
  );
  const view = useView();
  useEffect(() => {
    for (const w of build.walls) {
      const hide = view.hiddenWalls.includes(w.index);
      w.full.visible = !hide;
      w.stub.visible = hide;
    }
    build.ceiling.visible = view.ceiling;
    build.outside.visible = view.inside;
    invalidate();
  }, [build, view.hiddenWalls, view.ceiling, view.inside, invalidate]);
  useEffect(() => () => build.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()), [build]);

  const fc = floorColor(room.finishes);
  const tex = useMemo(() => {
    const t = plankFloor(fc);
    const s = 1 / t.span;
    const rep = (x?: THREE.Texture) => {
      if (!x) return undefined;
      const c = x.clone();
      c.repeat.set(s, s);
      c.needsUpdate = true;
      return c;
    };
    return { map: rep(t.map), normal: rep(t.normal), rough: rep(t.rough) };
  }, [fc]);
  const wood = room.finishes.floor.startsWith('wood') || room.finishes.floor === 'herringbone';
  return (
    <>
      <primitive object={build.root} />
      <mesh geometry={build.floorGeometry} receiveShadow name="floor">
        {quality === 'high' && wood ? (
          <MeshReflectorMaterial
            map={tex.map}
            normalMap={tex.normal}
            normalScale={new THREE.Vector2(0.4, 0.4)}
            roughnessMap={tex.rough}
            roughness={0.62}
            metalness={0}
            color="#ffffff"
            blur={[380, 120]}
            resolution={1024}
            mixBlur={1.4}
            mixStrength={evening ? 1.2 : 2.2}
            mixContrast={1}
            depthScale={0.8}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial map={wood ? tex.map : null} normalMap={wood ? tex.normal : null} roughnessMap={wood ? tex.rough : null} roughness={wood ? 0.55 : 0.8} color={wood ? '#ffffff' : fc} />
        )}
      </mesh>
    </>
  );
}
