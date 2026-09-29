import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CATALOG_MAP } from '../catalog/catalog';
import type { CatalogEntry, Item, Layout, Room } from '../model/types';
import { beginGesture, endGesture, select, setHover, updateItem, useStore, editItems, catalogEntry } from '../state/store';
import { buildItemGroup, type BuildEnv } from './furniture';
import { useView, setGuides } from './viewState';
import { snapAngle, snapItem, sizeOf } from '../interaction/snap';
import { rectCorners } from '../model/geometry';
import { controlsRef } from './Controls';

interface DragState {
  ids: string[];
  pointerId: number;
  start: THREE.Vector3;
  orig: Record<string, { x: number; y: number }>;
  plane: THREE.Plane;
  moved: boolean;
  kind: 'move' | 'rotate';
  center?: { x: number; y: number };
  startAngle?: number;
  origRot?: number;
}

let drag: DragState | null = null;

/** Height a surface-mounted piece sits at: the top of whatever it stands on. */
export function surfaceElevation(item: Item, entry: CatalogEntry | undefined, all: Item[], catalog: Record<string, CatalogEntry>): number {
  if (!entry) return 0;
  if (entry.mount === 'wall') return item.elevation ?? 1.45;
  if (item.elevation != null) return item.elevation;
  if (entry.mount !== 'surface') return 0;
  let top = 0;
  for (const o of all) {
    if (o.id === item.id) continue;
    const oe = catalog[o.ref];
    if (!oe || oe.mount === 'surface' || oe.category === 'rug') continue;
    const { w, d, h } = sizeOf(o, oe);
    const local = new THREE.Vector2(item.x - o.x, item.y - o.y).rotateAround(new THREE.Vector2(0, 0), -o.rotation);
    if (Math.abs(local.x) < w / 2 && Math.abs(local.y) < d / 2) top = Math.max(top, h);
  }
  return top;
}

export function Items({ room, layout, evening }: { room: Room; layout: Layout | null; evening: boolean }) {
  const custom = useStore((s) => s.custom);
  const selection = useStore((s) => s.selection);
  const hover = useStore((s) => s.hover);
  const mode = useStore((s) => s.mode);
  const preview = useStore((s) => s.preview);
  const hiddenWalls = useView((s) => s.hiddenWalls);
  const catalog = useMemo(() => ({ ...CATALOG_MAP, ...custom }), [custom]);
  const env: BuildEnv = useMemo(() => ({ ceiling: room.ceilingHeight, evening, catalog }), [room.ceilingHeight, evening, catalog]);
  const items = layout?.items ?? [];
  const all = useMemo(() => [...room.fixtures, ...items], [room.fixtures, items]);
  return (
    <group name="items">
      {all.map((it) => {
        const entry = catalog[it.ref];
        if (!entry) return null;
        const isFixture = !!it.fixed;
        const wallHidden = it.wall != null && hiddenWalls.includes(it.wall) && (isFixture || entry.mount === 'wall');
        const interactive = !preview && (mode === 'room' ? isFixture : !isFixture);
        return (
          <ItemNode
            key={it.id}
            item={it}
            entry={entry}
            env={env}
            elevation={surfaceElevation(it, entry, all, catalog)}
            hidden={wallHidden || !!it.hidden}
            selected={selection.includes(it.id)}
            hovered={hover === it.id}
            interactive={interactive}
            room={room}
          />
        );
      })}
    </group>
  );
}

interface NodeProps {
  item: Item;
  entry: CatalogEntry;
  env: BuildEnv;
  elevation: number;
  hidden: boolean;
  selected: boolean;
  hovered: boolean;
  interactive: boolean;
  room: Room;
}

const ItemNode = memo(function ItemNode({ item, entry, env, elevation, hidden, selected, hovered, interactive, room }: NodeProps) {
  const built = useMemo(
    () => buildItemGroup(item, entry, env),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.ref, item.w, item.d, item.h, JSON.stringify(item.params ?? null), JSON.stringify(item.finishes ?? null), item.id, env, entry],
  );
  const { w, d } = sizeOf(item, entry);
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    const s = useStore.getState();
    const additive = e.shiftKey || e.metaKey;
    if (!s.selection.includes(item.id) || additive) select([item.id], additive);
    if (item.locked) return;
    const ids = s.selection.includes(item.id) && !additive ? s.selection : [item.id];
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(entry.mount === 'wall' ? elevation : 0));
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(plane, hit)) return;
    const layout = s.layouts[s.rooms[s.activeRoomId!]?.activeLayoutId ?? ''];
    const pool = s.mode === 'room' ? room.fixtures : layout?.items ?? [];
    const orig: DragState['orig'] = {};
    for (const it of pool) if (ids.includes(it.id)) orig[it.id] = { x: it.x, y: it.y };
    drag = { ids, pointerId: e.pointerId, start: hit.clone(), orig, plane, moved: false, kind: 'move' };
    if (controlsRef.current) controlsRef.current.enabled = false;
    (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    gl.domElement.style.cursor = 'grabbing';
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || drag.pointerId !== e.pointerId || !drag.ids.includes(item.id) || drag.kind !== 'move') return;
    if (drag.ids[0] !== item.id && !drag.orig[item.id]) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(drag.plane, hit)) return;
    const dx = hit.x - drag.start.x;
    const dz = hit.z - drag.start.z;
    if (!drag.moved) {
      if (Math.hypot(dx, dz) < 0.01) return;
      beginGesture(drag.ids.length > 1 ? `Move ${drag.ids.length} pieces` : `Move ${entry.name.replace(/^Your /, '')}`);
      drag.moved = true;
    }
    const s = useStore.getState();
    if (drag.ids.length === 1) {
      const id = drag.ids[0];
      const o = drag.orig[id];
      const layout = s.layouts[s.rooms[s.activeRoomId!]?.activeLayoutId ?? ''];
      const pool = s.mode === 'room' ? room.fixtures : layout?.items ?? [];
      const moving = pool.find((x) => x.id === id);
      if (!moving) return;
      const snapped = snapItem(room, moving, o.x + dx, o.y + dz, moving.rotation, pool, { free: e.altKey });
      setGuides(snapped.guides);
      updateItem(id, { x: snapped.x, y: snapped.y, rotation: snapped.rotation, wall: snapped.wall }, { transient: true });
    } else {
      const apply = (items: Item[]) => items.map((it) => (drag!.orig[it.id] ? { ...it, x: drag!.orig[it.id].x + dx, y: drag!.orig[it.id].y + dz } : it));
      editItems('Move', apply, { transient: true });
    }
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    (e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId);
    if (drag.moved) endGesture();
    drag = null;
    setGuides([]);
    if (controlsRef.current) controlsRef.current.enabled = true;
    gl.domElement.style.cursor = '';
  };

  return (
    <group ref={groupRef} position={[item.x, elevation, item.y]} rotation={[0, -item.rotation, 0]} visible={!hidden} name={item.id}>
      <primitive
        object={built.group}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (!interactive) return;
          e.stopPropagation();
          setHover(item.id);
          if (!drag) gl.domElement.style.cursor = item.locked ? 'default' : 'grab';
        }}
        onPointerOut={() => {
          if (useStore.getState().hover === item.id) setHover(null);
          if (!drag) gl.domElement.style.cursor = '';
        }}
      />
      {(selected || hovered) && interactive && <Footprint w={w} d={d} selected={selected} elevation={entry.mount === 'wall' ? -elevation : 0} />}
      {selected && interactive && !item.locked && entry.mount !== 'wall' && <RotateHandle item={item} d={d} w={w} />}
    </group>
  );
});

function accent() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3B5BDB';
  } catch {
    return '#3B5BDB';
  }
}

function Footprint({ w, d, selected, elevation }: { w: number; d: number; selected: boolean; elevation: number }) {
  const pts = useMemo(() => {
    const c = rectCorners(0, 0, w + 0.04, d + 0.04, 0);
    return [...c, c[0]].map((p) => new THREE.Vector3(p.x, elevation + 0.012, p.y));
  }, [w, d, elevation]);
  const col = accent();
  return <Line points={pts} color={col} lineWidth={selected ? 2.2 : 1.2} transparent opacity={selected ? 1 : 0.55} depthTest={false} renderOrder={10} />;
}

function RotateHandle({ item, d, w }: { item: Item; d: number; w: number }) {
  const { gl } = useThree();
  const r = Math.max(0.09, Math.min(w, d) * 0.12);
  const dist = d / 2 + 0.28;
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!e.ray.intersectPlane(plane, hit)) return;
    drag = {
      ids: [item.id],
      pointerId: e.pointerId,
      start: hit.clone(),
      orig: {},
      plane,
      moved: false,
      kind: 'rotate',
      center: { x: item.x, y: item.y },
      startAngle: Math.atan2(hit.z - item.y, hit.x - item.x),
      origRot: item.rotation,
    };
    if (controlsRef.current) controlsRef.current.enabled = false;
    (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || drag.kind !== 'rotate' || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(drag.plane, hit)) return;
    const a = Math.atan2(hit.z - drag.center!.y, hit.x - drag.center!.x);
    if (!drag.moved) {
      beginGesture(`Rotate ${catalogEntry(item.ref)?.name.replace(/^Your /, '') ?? 'piece'}`);
      drag.moved = true;
    }
    const next = snapAngle(drag.origRot! + (a - drag.startAngle!), e.shiftKey);
    updateItem(item.id, { rotation: next, wall: undefined }, { transient: true });
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || drag.kind !== 'rotate') return;
    (e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId);
    if (drag.moved) endGesture();
    drag = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
  };
  const col = accent();
  return (
    <group position={[0, 0.02, dist]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => (gl.domElement.style.cursor = 'crosshair')}
        onPointerOut={() => (gl.domElement.style.cursor = '')}
        renderOrder={11}
      >
        <circleGeometry args={[r, 32]} />
        <meshBasicMaterial color={col} transparent opacity={0.9} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} renderOrder={12}>
        <ringGeometry args={[r * 0.45, r * 0.6, 24, 1, 0.3, Math.PI * 1.5]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <Line points={[new THREE.Vector3(0, 0, -r), new THREE.Vector3(0, 0, -(dist - d / 2) + 0.02)]} color={col} lineWidth={1.4} depthTest={false} renderOrder={10} />
    </group>
  );
}
