import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_MAP } from '../catalog/catalog';
import type { Item, Vec2 } from '../model/types';
import { bounds, itemAxes, toLocal } from '../model/geometry';
import { activeRoom, beginGesture, displayedLayout, editItems, endGesture, select, setHover, updateItem, useStore } from '../state/store';
import { useView, setGuides } from '../three/viewState';
import { snapAngle, snapItem, sizeOf } from '../interaction/snap';
import { analyzeCached } from '../design/checks';
import { PlanSvg, type Palette } from './PlanSvg';
import { usePalette } from './palette';
import { RoomEditLayer } from './RoomEditLayer';

interface ViewBox {
  cx: number;
  cy: number;
  s: number;
}

type Drag =
  | { kind: 'pan'; start: Vec2; orig: ViewBox; moved: boolean }
  | { kind: 'move'; ids: string[]; start: Vec2; orig: Record<string, Vec2>; moved: boolean }
  | { kind: 'rotate'; id: string; center: Vec2; startAngle: number; origRot: number; moved: boolean }
  | { kind: 'resize'; id: string; edge: 'l' | 'r' | 'f' | 'b'; orig: Item; moved: boolean };

export function PlanView() {
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => displayedLayout(s));
  const custom = useStore((s) => s.custom);
  const units = useStore((s) => s.units);
  const overlays = useStore((s) => s.overlays);
  const selection = useStore((s) => s.selection);
  const hover = useStore((s) => s.hover);
  const mode = useStore((s) => s.mode);
  const preview = useStore((s) => s.preview);
  const guides = useView((s) => s.guides);
  const cam = useView((s) => s.cam);
  const palette = usePalette();
  const catalog = useMemo(() => ({ ...CATALOG_MAP, ...custom }), [custom]);
  const deferredLayout = useDeferredValue(layout);
  const analysis = useMemo(() => (room && deferredLayout ? analyzeCached(room, deferredLayout, custom) : null), [room, deferredLayout, custom]);

  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>({ cx: 3.8, cy: 3.5, s: 90 });
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!room) return;
    const b = bounds(room.outline);
    const margin = 1.75;
    // leave room for the tool palette (left) and the title block (bottom right)
    const left = 60;
    const bottom = size.w < 600 ? 16 : size.h < 560 ? 48 : 100;
    const w = Math.max(100, size.w - left - 16);
    const h = Math.max(100, size.h - bottom - 16);
    const s = Math.max(20, Math.min(w / (b.w + margin * 2), h / (b.h + margin * 2)));
    setVb({ cx: b.cx - (left - 16) / 2 / s, cy: b.cy + (bottom - 16) / 2 / s, s });
  }, [room?.id, size.w, size.h]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, size.w > 0 && size.h > 0 ? Math.round(size.w / 40) : 0, Math.round(size.h / 40)]);

  useEffect(() => {
    const onFit = () => fit();
    const onZoom = (e: Event) => {
      const k = (e as CustomEvent<number>).detail || 1;
      setVb((v) => ({ ...v, s: Math.max(12, Math.min(900, v.s * k)) }));
    };
    window.addEventListener('fp:plan-fit', onFit);
    window.addEventListener('fp:plan-zoom', onZoom);
    return () => {
      window.removeEventListener('fp:plan-fit', onFit);
      window.removeEventListener('fp:plan-zoom', onZoom);
    };
  }, [fit]);

  const toPlan = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const r = wrap.current!.getBoundingClientRect();
      return { x: vb.cx + (clientX - r.left - size.w / 2) / vb.s, y: vb.cy + (clientY - r.top - size.h / 2) / vb.s };
    },
    [vb, size],
  );

  // wheel: pinch / ctrl / mouse wheel zooms, trackpad scroll pans
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const mouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY) && e.deltaX === 0);
      if (e.ctrlKey || e.metaKey || mouseWheel) {
        const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018));
        setVb((v) => {
          const r = el.getBoundingClientRect();
          const px = e.clientX - r.left - el.clientWidth / 2;
          const py = e.clientY - r.top - el.clientHeight / 2;
          const s = Math.max(12, Math.min(900, v.s * k));
          const wx = v.cx + px / v.s;
          const wy = v.cy + py / v.s;
          return { s, cx: wx - px / s, cy: wy - py / s };
        });
      } else {
        setVb((v) => ({ ...v, cx: v.cx + e.deltaX / v.s, cy: v.cy + e.deltaY / v.s }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const items = layout?.items ?? [];
  const pool = mode === 'room' ? room?.fixtures ?? [] : items;

  const hitTest = useCallback(
    (p: Vec2): Item | null => {
      // topmost first: small things over big things, rugs last
      const cands = pool
        .map((it) => {
          const e = catalog[it.ref];
          if (!e || it.hidden) return null;
          const { w, d } = sizeOf(it, e);
          const l = toLocal(p, it.x, it.y, it.rotation);
          const pad = 0.03;
          if (Math.abs(l.x) <= w / 2 + pad && Math.abs(l.y) <= d / 2 + pad) return { it, area: w * d * (e.category === 'rug' ? 100 : 1) };
          return null;
        })
        .filter(Boolean) as { it: Item; area: number }[];
      cands.sort((a, b) => a.area - b.area);
      return cands[0]?.it ?? null;
    },
    [pool, catalog],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toPlan(e.clientX, e.clientY);
    const target = e.target as SVGElement;
    const handle = target.getAttribute?.('data-handle');
    if (handle && selection.length === 1) {
      const it = pool.find((x) => x.id === selection[0]);
      if (it) {
        if (handle === 'rot') {
          drag.current = { kind: 'rotate', id: it.id, center: { x: it.x, y: it.y }, startAngle: Math.atan2(p.y - it.y, p.x - it.x), origRot: it.rotation, moved: false };
        } else drag.current = { kind: 'resize', id: it.id, edge: handle as 'l' | 'r' | 'f' | 'b', orig: { ...it }, moved: false };
        return;
      }
    }
    if (e.button === 1 || preview) {
      drag.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, orig: vb, moved: false };
      return;
    }
    const hit = hitTest(p);
    if (hit) {
      const additive = e.shiftKey || e.metaKey;
      const already = selection.includes(hit.id);
      if (!already || additive) select([hit.id], additive);
      if (hit.locked) return;
      const ids = already && !additive ? selection : [hit.id];
      const orig: Record<string, Vec2> = {};
      for (const it of pool) if (ids.includes(it.id)) orig[it.id] = { x: it.x, y: it.y };
      drag.current = { kind: 'move', ids, start: p, orig, moved: false };
    } else {
      drag.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, orig: vb, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const p = toPlan(e.clientX, e.clientY);
    if (!d) {
      const h = hitTest(p);
      setHover(h?.id ?? null);
      return;
    }
    if (d.kind === 'pan') {
      const dx = e.clientX - d.start.x;
      const dy = e.clientY - d.start.y;
      if (Math.hypot(dx, dy) > 3) d.moved = true;
      setVb({ ...d.orig, cx: d.orig.cx - dx / d.orig.s, cy: d.orig.cy - dy / d.orig.s });
      return;
    }
    if (d.kind === 'move') {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) * vb.s < 3) return;
        const name = catalog[pool.find((x) => x.id === d.ids[0])?.ref ?? '']?.name.replace(/^Your /, '') ?? 'piece';
        beginGesture(d.ids.length > 1 ? `Move ${d.ids.length} pieces` : `Move ${name}`);
        d.moved = true;
      }
      if (d.ids.length === 1) {
        const it = pool.find((x) => x.id === d.ids[0]);
        if (!it || !room) return;
        const o = d.orig[it.id];
        const s = snapItem(room, it, o.x + dx, o.y + dy, it.rotation, pool, { free: e.altKey });
        setGuides(s.guides);
        updateItem(it.id, { x: s.x, y: s.y, rotation: s.rotation, wall: s.wall }, { transient: true });
      } else {
        editItems('Move', (list) => list.map((it) => (d.orig[it.id] ? { ...it, x: d.orig[it.id].x + dx, y: d.orig[it.id].y + dy } : it)), { transient: true });
      }
      return;
    }
    if (d.kind === 'rotate') {
      const a = Math.atan2(p.y - d.center.y, p.x - d.center.x);
      if (!d.moved) {
        beginGesture('Rotate');
        d.moved = true;
      }
      updateItem(d.id, { rotation: snapAngle(d.origRot + (a - d.startAngle), e.shiftKey), wall: undefined }, { transient: true });
      return;
    }
    if (d.kind === 'resize') {
      const it = d.orig;
      const e0 = catalog[it.ref];
      if (!e0) return;
      const { w, d: dep } = sizeOf(it, e0);
      const l = toLocal(p, it.x, it.y, it.rotation);
      const { u, v } = itemAxes(it.rotation);
      if (!d.moved) {
        beginGesture('Resize');
        d.moved = true;
      }
      const snap = (m: number) => (units === 'metric' ? Math.round(m * 100) / 100 : Math.round(m / 0.0127) * 0.0127);
      if (d.edge === 'r' || d.edge === 'l') {
        const sgn = d.edge === 'r' ? 1 : -1;
        const nw = Math.max(0.2, snap(Math.abs(l.x - -sgn * (w / 2))));
        const shift = (nw - w) / 2;
        updateItem(it.id, { w: nw, x: it.x + u.x * shift * sgn, y: it.y + u.y * shift * sgn }, { transient: true });
      } else {
        const sgn = d.edge === 'f' ? 1 : -1;
        const nd = Math.max(0.2, snap(Math.abs(l.y - -sgn * (dep / 2))));
        const shift = (nd - dep) / 2;
        updateItem(it.id, { d: nd, x: it.x + v.x * shift * sgn, y: it.y + v.y * shift * sgn }, { transient: true });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setGuides([]);
    if (!d) return;
    if (d.kind === 'pan' && !d.moved) select([]);
    if ((d.kind === 'move' || d.kind === 'rotate' || d.kind === 'resize') && d.moved) endGesture();
  };

  if (!room) return <div ref={wrap} className="plan-wrap" />;
  const viewBox = `${vb.cx - size.w / 2 / vb.s} ${vb.cy - size.h / 2 / vb.s} ${size.w / vb.s} ${size.h / vb.s}`;
  const sel = selection.length === 1 ? pool.find((x) => x.id === selection[0]) : undefined;
  const selEntry = sel ? catalog[sel.ref] : undefined;
  return (
    <div
      ref={wrap}
      className="plan-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => !drag.current && setHover(null)}
      onDoubleClick={(e) => {
        if (!hitTest(toPlan(e.clientX, e.clientY))) fit();
      }}
      style={{ cursor: drag.current?.kind === 'pan' ? 'grabbing' : hover ? 'pointer' : 'default' }}
    >
      <svg width={size.w} height={size.h} viewBox={viewBox} className="plan-svg" role="img" aria-label={`Plan of ${room.name}`}>
        <PlanSvg
          room={room}
          layout={layout}
          catalog={catalog}
          units={units}
          options={{ dims: overlays.dims, labels: overlays.labels, grid: overlays.grid, overlays: { circulation: overlays.circulation, clearances: overlays.clearances, hifi: overlays.hifi, zones: overlays.zones }, underlay: underlayOf(room, overlays.underlay), pxPerM: vb.s }}
          analysis={analysis}
          selection={selection}
          hover={hover}
          guides={guides}
          camera={cam}
          mode={mode}
          palette={palette as Partial<Palette>}
        >
          {sel && selEntry && !sel.locked && <Handles item={sel} w={sizeOf(sel, selEntry).w} d={sizeOf(sel, selEntry).d} s={vb.s} accent={palette.accent} paper={palette.paper} resizable={selEntry.resizable !== false && selEntry.mount !== 'wall'} rotatable={selEntry.mount !== 'wall'} />}
          {mode === 'room' && <RoomEditLayer room={room} s={vb.s} toPlan={toPlan} />}
        </PlanSvg>
      </svg>
    </div>
  );
}

function underlayOf(room: NonNullable<ReturnType<typeof activeRoom>>, show: boolean) {
  const u = room.underlay;
  if (!u || !show || !u.visible || !u.asset.url) return null;
  return { url: u.asset.url, x: u.x, y: u.y, scale: u.scale, w: u.asset.width ?? 1000, h: u.asset.height ?? 1000, opacity: u.opacity, rotation: u.rotation };
}

function Handles({ item, w, d, s, accent, paper, resizable, rotatable }: { item: Item; w: number; d: number; s: number; accent: string; paper: string; resizable: boolean; rotatable: boolean }) {
  const { u, v } = itemAxes(item.rotation);
  const r = 5 / s;
  const at = (lx: number, ly: number) => ({ x: item.x + u.x * lx + v.x * ly, y: item.y + u.y * lx + v.y * ly });
  const rot = at(0, d / 2 + 22 / s);
  const front = at(0, d / 2);
  const edges: { k: string; p: Vec2; cursor: string }[] = resizable
    ? [
        { k: 'r', p: at(w / 2, 0), cursor: 'ew-resize' },
        { k: 'l', p: at(-w / 2, 0), cursor: 'ew-resize' },
        { k: 'f', p: at(0, d / 2), cursor: 'ns-resize' },
        { k: 'b', p: at(0, -d / 2), cursor: 'ns-resize' },
      ]
    : [];
  return (
    <g>
      {rotatable && (
        <>
          <line x1={front.x} y1={front.y} x2={rot.x} y2={rot.y} stroke={accent} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <circle cx={rot.x} cy={rot.y} r={r * 1.35} fill={accent} stroke={paper} strokeWidth={1.5} vectorEffect="non-scaling-stroke" data-handle="rot" style={{ cursor: 'crosshair' }} />
        </>
      )}
      {edges.map((e) => (
        <rect key={e.k} x={e.p.x - r} y={e.p.y - r} width={r * 2} height={r * 2} rx={r * 0.3} fill={paper} stroke={accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" data-handle={e.k} style={{ cursor: e.cursor }} transform={`rotate(${(item.rotation * 180) / Math.PI} ${e.p.x} ${e.p.y})`} />
      ))}
    </g>
  );
}
