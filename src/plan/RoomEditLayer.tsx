import { useRef } from 'react';
import type { Room, Vec2 } from '../model/types';
import { walls } from '../model/geometry';
import { beginGesture, editRoom, endGesture, useStore } from '../state/store';
import { formatLength } from '../model/units';

// Room shell editing on the plan: drag corners, slide walls, slide openings.

type Drag =
  | { kind: 'corner'; index: number; start: Vec2; orig: Vec2[] }
  | { kind: 'wall'; index: number; start: Vec2; orig: Vec2[] }
  | { kind: 'opening'; id: string; start: Vec2; origOffset: number; wall: number };

export function RoomEditLayer({ room, s, toPlan }: { room: Room; s: number; toPlan: (x: number, y: number) => Vec2 }) {
  const drag = useRef<Drag | null>(null);
  const units = useStore((st) => st.units);
  const ws = walls(room);
  const r = 6 / s;
  const snap = (v: number) => (units === 'metric' ? Math.round(v * 100) / 100 : Math.round(v / 0.0254) * 0.0254);

  const down = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = d;
    beginGesture(d.kind === 'opening' ? 'Move opening' : d.kind === 'corner' ? 'Move corner' : 'Move wall');
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const p = toPlan(e.clientX, e.clientY);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (d.kind === 'corner') {
      const pts = d.orig.map((q, i) => (i === d.index ? { x: snap(q.x + dx), y: snap(q.y + dy) } : q));
      editRoom('Move corner', (rm) => ({ ...rm, outline: pts }), { transient: true });
    } else if (d.kind === 'wall') {
      const w = walls({ outline: d.orig })[d.index];
      const off = dx * w.normal.x + dy * w.normal.y;
      const i0 = d.index;
      const i1 = (d.index + 1) % d.orig.length;
      const pts = d.orig.map((q, i) => (i === i0 || i === i1 ? { x: snap(q.x + w.normal.x * off), y: snap(q.y + w.normal.y * off) } : q));
      editRoom('Move wall', (rm) => ({ ...rm, outline: pts }), { transient: true });
    } else {
      const w = ws[d.wall];
      const along = dx * w.dir.x + dy * w.dir.y;
      const o = room.openings.find((x) => x.id === d.id);
      if (!o) return;
      const next = Math.max(0.05, Math.min(w.length - o.width - 0.05, snap(d.origOffset + along)));
      editRoom('Move opening', (rm) => ({ ...rm, openings: rm.openings.map((x) => (x.id === d.id ? { ...x, offset: next } : x)) }), { transient: true });
    }
  };
  const up = (e: React.PointerEvent) => {
    if (!drag.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
    endGesture();
  };

  return (
    <g onPointerMove={move} onPointerUp={up}>
      {ws.map((w) => {
        const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
        const out = { x: mid.x - w.normal.x * (room.wallThickness / 2), y: mid.y - w.normal.y * (room.wallThickness / 2) };
        return (
          <g key={`w${w.index}`}>
            <line
              x1={w.a.x - w.normal.x * room.wallThickness * 0.5}
              y1={w.a.y - w.normal.y * room.wallThickness * 0.5}
              x2={w.b.x - w.normal.x * room.wallThickness * 0.5}
              y2={w.b.y - w.normal.y * room.wallThickness * 0.5}
              stroke="transparent"
              strokeWidth={Math.max(room.wallThickness, 14 / s)}
              style={{ cursor: Math.abs(w.dir.x) > 0.7 ? 'ns-resize' : 'ew-resize' }}
              onPointerDown={(e) => down(e, { kind: 'wall', index: w.index, start: toPlan(e.clientX, e.clientY), orig: room.outline.map((q) => ({ ...q })) })}
            />
            <rect x={out.x - 14 / s} y={out.y - 5 / s} width={28 / s} height={10 / s} rx={5 / s} fill="var(--accent)" opacity={0.9} pointerEvents="none" transform={`rotate(${(w.angle * 180) / Math.PI} ${out.x} ${out.y})`} />
            <text x={mid.x + w.normal.x * (16 / s)} y={mid.y + w.normal.y * (16 / s)} fontSize={11 / s} textAnchor="middle" dominantBaseline="middle" fill="var(--accent)" style={{ fontFamily: 'var(--font-mono)' }} pointerEvents="none">
              {formatLength(w.length, units)}
            </text>
          </g>
        );
      })}
      {room.openings.map((o) => {
        const w = ws[o.wall];
        if (!w) return null;
        const c = { x: w.a.x + w.dir.x * (o.offset + o.width / 2) + w.normal.x * (10 / s), y: w.a.y + w.dir.y * (o.offset + o.width / 2) + w.normal.y * (10 / s) };
        return (
          <g key={o.id}>
            <circle cx={c.x} cy={c.y} r={r} fill="var(--paper)" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} onPointerDown={(e) => down(e, { kind: 'opening', id: o.id, start: toPlan(e.clientX, e.clientY), origOffset: o.offset, wall: o.wall })} />
          </g>
        );
      })}
      {room.outline.map((p, i) => (
        <rect
          key={`c${i}`}
          x={p.x - r}
          y={p.y - r}
          width={r * 2}
          height={r * 2}
          fill="var(--accent)"
          stroke="var(--paper)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'move' }}
          onPointerDown={(e) => down(e, { kind: 'corner', index: i, start: toPlan(e.clientX, e.clientY), orig: room.outline.map((q) => ({ ...q })) })}
        />
      ))}
    </g>
  );
}
