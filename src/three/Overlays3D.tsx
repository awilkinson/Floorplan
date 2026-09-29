import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Layout, Room } from '../model/types';
import { useStore } from '../state/store';
import { useView } from './viewState';
import { analyzeCached } from '../design/checks';

const Y = 0.014;

function cssVar(name: string, fallback: string) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function Overlays3D({ room, layout }: { room: Room; layout: Layout | null }) {
  const guides = useView((s) => s.guides);
  const overlays = useStore((s) => s.overlays);
  const custom = useStore((s) => s.custom);
  const analysis = useMemo(() => (layout ? analyzeCached(room, layout, custom) : null), [room, layout, custom]);
  if (import.meta.env.DEV && analysis) (window as unknown as { __analysis: unknown }).__analysis = analysis;
  const accent = cssVar('--accent', '#3B5BDB');
  const warn = cssVar('--warn', '#C2410C');
  return (
    <group name="overlays">
      {guides.map((g, i) => (
        <Line key={i} points={[new THREE.Vector3(g.a.x, Y, g.a.y), new THREE.Vector3(g.b.x, Y, g.b.y)]} color={accent} lineWidth={1.2} dashed={g.kind === 'align'} dashSize={0.08} gapSize={0.06} depthTest={false} renderOrder={20} />
      ))}
      {overlays.hifi &&
        analysis?.hifi &&
        (() => {
          const { left, right, seat } = analysis.hifi;
          const pts = [left, right, seat, left].map((p) => new THREE.Vector3(p.x, Y, p.y));
          return <Line points={pts} color={analysis.hifi.ok ? accent : warn} lineWidth={1.6} dashed dashSize={0.1} gapSize={0.07} depthTest={false} renderOrder={20} />;
        })()}
      {overlays.circulation &&
        analysis?.paths.map((p, i) => (
          <Line key={`p${i}`} points={p.points.map((q) => new THREE.Vector3(q.x, Y, q.y))} color={p.tight ? warn : accent} lineWidth={2} dashed dashSize={0.12} gapSize={0.1} depthTest={false} renderOrder={20} transparent opacity={0.8} />
        ))}
      {overlays.clearances &&
        analysis?.conflicts.map((c, i) => (
          <mesh key={`c${i}`} position={[c.x, Y, c.y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
            <circleGeometry args={[Math.max(0.12, c.r), 32]} />
            <meshBasicMaterial color={warn} transparent opacity={0.28} depthTest={false} />
          </mesh>
        ))}
    </group>
  );
}
