import { memo, useMemo, type ReactNode } from 'react';
import type { CatalogEntry, Item, Layout, Opening, Room, Units, Vec2, Zone } from '../model/types';
import { bounds, itemAxes, offsetPolygon, rayToWalls, rectCorners, walls, type Wall } from '../model/geometry';
import { formatLength, formatSize } from '../model/units';
import { symbolFor } from './symbols';
import type { Analysis } from '../design/checks';
import type { Guide } from '../interaction/snap';

// The drawing. Units are meters; y grows down (plan south).

export interface PlanOptions {
  dims: boolean;
  labels: boolean;
  grid: boolean;
  overlays: { circulation: boolean; clearances: boolean; hifi: boolean; zones: boolean };
  /** Screen mode keeps strokes a constant pixel width; export uses world units. */
  exportMpp?: number;
  underlay?: { url: string; x: number; y: number; scale: number; w: number; h: number; opacity: number; rotation: number } | null;
  /** Numbered schedule tags keyed by item id (exported drawings). */
  tags?: Record<string, number>;
  /** Screen scale, so annotation stays legible when zoomed out. */
  pxPerM?: number;
}

export interface PlanProps {
  room: Room;
  layout: Layout | null;
  catalog: Record<string, CatalogEntry>;
  units: Units;
  options: PlanOptions;
  analysis?: Analysis | null;
  selection?: string[];
  hover?: string | null;
  guides?: Guide[];
  camera?: { x: number; y: number; heading: number; fov: number } | null;
  mode?: 'layout' | 'room';
  /** For screen mode: interaction layer rendered on top. */
  children?: ReactNode;
  palette?: Partial<Palette>;
}

export interface Palette {
  ink: string;
  ink2: string;
  poche: string;
  fill: string;
  paper: string;
  faint: string;
  dim: string;
  accent: string;
  warn: string;
  bad: string;
  good: string;
}

const DEFAULT: Palette = {
  ink: '#1B1C20',
  ink2: '#55565B',
  poche: '#1F2024',
  fill: '#FFFFFF',
  paper: '#FFFFFF',
  faint: '#D7D4CC',
  dim: '#2F4FD8',
  accent: '#2F4FD8',
  warn: '#B45309',
  bad: '#B42318',
  good: '#2E7D4F',
};

function f(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function strokeProps(px: number, mpp?: number) {
  return mpp ? { strokeWidth: px * mpp } : { strokeWidth: px, vectorEffect: 'non-scaling-stroke' as const };
}

function pts(p: Vec2[]) {
  return p.map((q) => `${f(q.x)},${f(q.y)}`).join(' ');
}

function openingPoint(w: Wall, t: number, off = 0): Vec2 {
  return { x: w.a.x + w.dir.x * t + w.normal.x * off, y: w.a.y + w.dir.y * t + w.normal.y * off };
}

export const PlanSvg = memo(function PlanSvg(props: PlanProps) {
  const { room, layout, catalog, units, options, analysis, selection = [], hover, guides = [], camera, mode = 'layout', children } = props;
  const P = { ...DEFAULT, ...props.palette };
  const mpp = options.exportMpp;
  const sp = (px: number) => strokeProps(px, mpp);
  const T = room.wallThickness;
  const ws = useMemo(() => walls(room), [room]);
  const outer = useMemo(() => offsetPolygon(room.outline, T), [room.outline, T]);
  const b = bounds(room.outline);
  // Annotation keeps a readable size on screen when zoomed out, like CAD text.
  const k = options.pxPerM ? Math.round(Math.min(2.6, Math.max(1, 9.5 / (0.105 * options.pxPerM))) * 10) / 10 : 1;
  const textSize = 0.105 * k;
  const fixtures = room.fixtures;
  const items = layout?.items ?? [];

  const byHeight = useMemo(() => {
    const all = [...items];
    return all
      .map((it) => ({ it, e: catalog[it.ref] }))
      .filter((x) => x.e && !x.it.hidden)
      .sort((a, c) => order(a.e!) - order(c.e!));
  }, [items, catalog]);

  return (
    <g>
      <defs>
        <pattern id="fp-hatch" patternUnits="userSpaceOnUse" width={0.07} height={0.07} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={0.07} stroke={P.faint} strokeWidth={0.012} />
        </pattern>
        <pattern id="fp-grid" patternUnits="userSpaceOnUse" width={units === 'metric' ? 0.5 : 0.3048} height={units === 'metric' ? 0.5 : 0.3048}>
          <path d={`M ${units === 'metric' ? 0.5 : 0.3048} 0 L 0 0 0 ${units === 'metric' ? 0.5 : 0.3048}`} fill="none" stroke={P.faint} strokeWidth={0.004} />
        </pattern>
      </defs>

      {/* floor */}
      <polygon points={pts(room.outline)} fill={P.fill} />
      {options.grid && <polygon points={pts(room.outline)} fill="url(#fp-grid)" />}
      {options.underlay && (
        <image
          href={options.underlay.url}
          x={options.underlay.x}
          y={options.underlay.y}
          width={options.underlay.w * options.underlay.scale}
          height={options.underlay.h * options.underlay.scale}
          opacity={options.underlay.opacity}
          preserveAspectRatio="none"
          transform={options.underlay.rotation ? `rotate(${(options.underlay.rotation * 180) / Math.PI} ${options.underlay.x} ${options.underlay.y})` : undefined}
        />
      )}

      {/* zones suggested by the designer */}
      {options.overlays.zones && layout?.zones?.map((z, i) => <ZoneMark key={i} z={z} P={P} sp={sp} />)}

      {/* furniture, low to high */}
      {byHeight.map(({ it, e }) => (
        <PlanItem key={it.id} item={it} entry={e!} ceiling={room.ceilingHeight} P={P} mpp={mpp} dim={mode === 'room'} />
      ))}

      {/* built-ins */}
      {fixtures.map((it) => {
        const e = catalog[it.ref];
        if (!e) return null;
        return <PlanFixture key={it.id} item={it} entry={e} P={P} mpp={mpp} ceiling={room.ceilingHeight} active={mode === 'room'} />;
      })}

      {/* walls */}
      <path d={`M${pts(outer).replace(/ /g, ' L')} Z M${pts(room.outline).replace(/ /g, ' L')} Z`} fill={P.poche} fillRule="evenodd" stroke={P.poche} {...sp(0.8)} />
      {room.openings.map((o) => (
        <OpeningMark key={o.id} o={o} w={ws[o.wall]} T={T} P={P} sp={sp} />
      ))}

      {/* overlays */}
      {analysis && options.overlays.circulation && analysis.paths.map((p, i) => <polyline key={`c${i}`} points={pts(p.points)} fill="none" stroke={p.tight ? P.warn : P.dim} {...sp(1.6)} strokeDasharray={mpp ? `${0.12} ${0.08}` : '7 5'} strokeLinecap="round" opacity={0.85} />)}
      {analysis && options.overlays.clearances && analysis.conflicts.map((c, i) => <circle key={`x${i}`} cx={c.x} cy={c.y} r={Math.max(0.12, c.r)} fill={P.bad} fillOpacity={0.12} stroke={P.bad} {...sp(1.2)} />)}
      {analysis?.hifi && options.overlays.hifi && <HifiMark h={analysis.hifi} P={P} sp={sp} units={units} textSize={textSize} />}
      {analysis?.playZone && options.overlays.zones && (
        <g>
          <circle cx={analysis.playZone.x} cy={analysis.playZone.y} r={analysis.playZone.r} fill={P.good} fillOpacity={0.06} stroke={P.good} {...sp(1)} strokeDasharray={mpp ? '0.08 0.05' : '5 4'} />
          <text x={analysis.playZone.x} y={analysis.playZone.y} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.9} fill={P.good} style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em' }}>
            PLAY FLOOR {formatLength(analysis.playZone.r * 2, units, { compact: true })}
          </text>
        </g>
      )}
      {analysis?.treeSpot && options.overlays.zones && (
        <g>
          <circle cx={analysis.treeSpot.x} cy={analysis.treeSpot.y} r={analysis.treeSpot.r} fill="none" stroke={P.good} {...sp(1)} strokeDasharray={mpp ? '0.05 0.05' : '3 4'} />
          <text x={analysis.treeSpot.x} y={analysis.treeSpot.y - analysis.treeSpot.r * 0.55} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.85} fill={P.good} style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em' }}>
            TREE HERE
          </text>
        </g>
      )}

      {/* snapping guides */}
      {guides.map((g, i) => (
        <line key={`g${i}`} x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke={P.accent} {...sp(g.kind === 'wall' ? 2 : 1)} strokeDasharray={g.kind === 'align' ? '4 3' : undefined} opacity={0.9} />
      ))}

      {/* selection & hover */}
      {[...items, ...fixtures].map((it) => {
        const sel = selection.includes(it.id);
        const hov = hover === it.id;
        if (!sel && !hov) return null;
        const e = catalog[it.ref];
        if (!e) return null;
        const w = it.w ?? e.w;
        const d = it.d ?? e.d;
        const c = rectCorners(it.x, it.y, w + 0.03, d + 0.03, it.rotation);
        return <polygon key={`s${it.id}`} points={pts(c)} fill={sel ? P.accent : 'none'} fillOpacity={0.06} stroke={P.accent} {...sp(sel ? 2 : 1.2)} opacity={sel ? 1 : 0.6} />;
      })}

      {/* schedule tags */}
      {options.tags &&
        byHeight.map(({ it }) => {
          const n = options.tags![it.id];
          if (!n) return null;
          return (
            <g key={`t${it.id}`}>
              <circle cx={it.x} cy={it.y} r={0.1} fill={P.paper} stroke={P.ink} {...sp(0.8)} />
              <text x={it.x} y={it.y + 0.004} textAnchor="middle" dominantBaseline="middle" fontSize={0.1} fill={P.ink} style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                {n}
              </text>
            </g>
          );
        })}

      {/* labels: along each piece's long side, skipping any that would collide */}
      {options.labels &&
        placeLabels(byHeight, textSize * 0.82, selection, hover).map((l) => (
          <text key={`l${l.id}`} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.82} fill={P.ink2} transform={l.ang ? `rotate(${f(l.ang)} ${f(l.x)} ${f(l.y)})` : undefined} style={{ fontFamily: 'var(--font-ui, sans-serif)', letterSpacing: '0.07em', fontWeight: 600, paintOrder: 'stroke' }} stroke={P.fill} strokeWidth={textSize * 0.16} strokeLinejoin="round">
            {l.text}
          </text>
        ))}

      {/* dimensions */}
      {options.dims && <Dimensions room={room} ws={ws} T={T} P={P} sp={sp} units={units} textSize={textSize} k={k} />}
      {options.dims && selection.length === 1 && <LiveDims room={room} items={[...items, ...fixtures]} id={selection[0]} catalog={catalog} P={P} sp={sp} units={units} textSize={textSize} />}

      {/* 3D camera */}
      {camera && !mpp && <CameraMark cam={camera} P={P} sp={sp} inside={isInside(room, camera)} b={b} />}
      {children}
    </g>
  );
});

function isInside(room: Room, c: { x: number; y: number }) {
  const b = bounds(room.outline);
  return c.x > b.minX && c.x < b.maxX && c.y > b.minY && c.y < b.maxY;
}

function shortLabel(s: string) {
  const t = s.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return t.length > 22 ? t.slice(0, 21) + '…' : t;
}

function order(e: CatalogEntry) {
  if (e.category === 'rug') return 0;
  if (e.category === 'baby' && e.params.kind === 'mat') return 1;
  if (e.mount === 'wall') return 9;
  if (e.category === 'plant' || e.category === 'floor-lamp') return 6;
  if (e.mount === 'surface') return 8;
  return 3;
}

// ---------------------------------------------------------------------------

const PlanItem = memo(function PlanItem({ item, entry, ceiling, P, mpp, dim }: { item: Item; entry: CatalogEntry; ceiling: number; P: Palette; mpp?: number; dim?: boolean }) {
  const sym = useMemo(() => symbolFor(item, entry, ceiling), [item.ref, item.w, item.d, item.h, JSON.stringify(item.params ?? null), entry, ceiling, item.id]);
  const sp = (px: number) => strokeProps(px, mpp);
  const deg = (item.rotation * 180) / Math.PI;
  const isRug = entry.category === 'rug' || (entry.category === 'baby' && entry.params.kind === 'mat');
  const wall = entry.mount === 'wall';
  return (
    <g transform={`translate(${f(item.x)} ${f(item.y)}) rotate(${f(deg)})`} opacity={dim ? 0.35 : 1}>
      {sym.shapes.map((s, i) => {
        const dash = s.style === 'dash' || isRug;
        const w = s.style === 'cushion' ? 0.55 : s.style === 'thin' ? 0.6 : isRug ? 0.8 : 1.05;
        return (
          <path
            key={i}
            d={s.d}
            fill={isRug ? 'none' : s.style === 'fill-dark' ? P.poche : P.fill}
            stroke={s.style === 'cushion' ? P.ink2 : P.ink}
            {...sp(w)}
            strokeDasharray={dash ? (mpp ? '0.1 0.05' : '6 4') : wall ? (mpp ? '0.04 0.03' : '3 2') : undefined}
            strokeLinejoin="round"
          />
        );
      })}
      {isRug && <RugHint w={sym.w} d={sym.d} P={P} sp={sp} />}
      {sym.strokes.map((d, i) => (
        <path key={`st${i}`} d={d} fill="none" stroke={P.ink} {...sp(0.55)} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
});

function RugHint({ w, d, P, sp }: { w: number; d: number; P: Palette; sp: (px: number) => object }) {
  // a fringe of short ticks at both ends, like a drafted rug
  const ticks: ReactNode[] = [];
  const n = Math.max(6, Math.round(w / 0.12));
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    ticks.push(<line key={`a${i}`} x1={x} y1={-d / 2} x2={x} y2={-d / 2 - 0.04} stroke={P.ink2} {...sp(0.45)} />);
    ticks.push(<line key={`b${i}`} x1={x} y1={d / 2} x2={x} y2={d / 2 + 0.04} stroke={P.ink2} {...sp(0.45)} />);
  }
  return <g opacity={0.8}>{ticks}</g>;
}

const PlanFixture = memo(function PlanFixture({ item, entry, P, mpp, ceiling, active }: { item: Item; entry: CatalogEntry; P: Palette; mpp?: number; ceiling: number; active: boolean }) {
  const sp = (px: number) => strokeProps(px, mpp);
  const w = item.w ?? entry.w;
  const d = item.d ?? entry.d;
  const deg = (item.rotation * 180) / Math.PI;
  const gen = entry.generator;
  if (gen === 'curtain') {
    const n = Math.max(6, Math.round(w / 0.07));
    const path = Array.from({ length: n + 1 }, (_, i) => `${i ? 'L' : 'M'}${f(-w / 2 + (w * i) / n)} ${i % 2 ? 0.03 : -0.03}`).join('');
    return (
      <g transform={`translate(${f(item.x)} ${f(item.y)}) rotate(${f(deg)})`}>
        <path d={path} fill="none" stroke={P.ink2} {...sp(0.7)} />
      </g>
    );
  }
  if (entry.mount === 'wall' || gen === 'pictureLight') {
    return (
      <g transform={`translate(${f(item.x)} ${f(item.y)}) rotate(${f(deg)})`}>
        <rect x={-w / 2} y={-Math.max(d, 0.02) / 2} width={w} height={Math.max(d, 0.02)} fill={P.fill} stroke={P.ink2} {...sp(0.7)} />
      </g>
    );
  }
  const sym = symbolFor(item, entry, ceiling);
  void sym;
  const shelving = gen === 'shelvingRun';
  const fire = gen === 'fireplace';
  const params = { ...entry.params, ...(item.params ?? {}) } as Record<string, number | string | undefined>;
  const upperD = (params.upperD as number) ?? 0.3;
  const curved = params.curvedEnd as string | undefined;
  const curveLen = (params.curveLen as number) ?? d * 0.9;
  let outline = `M${-w / 2} ${-d / 2}L${w / 2} ${-d / 2}L${w / 2} ${d / 2}L${-w / 2} ${d / 2}Z`;
  if (shelving && curved && curved !== 'none') {
    const s = curved === 'left' ? -1 : 1;
    const cx = s * (w / 2 - curveLen);
    const arc: string[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2);
      arc.push(`${f(cx + s * Math.sin(a) * curveLen)} ${f(-d / 2 + Math.cos(a) * d)}`);
    }
    if (s > 0) outline = `M${-w / 2} ${-d / 2}L${f(cx + curveLen)} ${-d / 2}L${arc.reverse().join('L')}L${-w / 2} ${d / 2}Z`;
    else outline = `M${w / 2} ${-d / 2}L${f(cx - curveLen)} ${-d / 2}L${arc.reverse().join('L')}L${w / 2} ${d / 2}Z`;
  }
  return (
    <g transform={`translate(${f(item.x)} ${f(item.y)}) rotate(${f(deg)})`} opacity={active ? 1 : 0.95}>
      <path d={outline} fill="url(#fp-hatch)" stroke={P.ink} {...sp(1.1)} />
      {shelving && <line x1={-w / 2 + (curved === 'left' ? curveLen : 0)} x2={w / 2 - (curved === 'right' ? curveLen : 0)} y1={-d / 2 + upperD} y2={-d / 2 + upperD} stroke={P.ink2} {...sp(0.6)} strokeDasharray={mpp ? '0.06 0.04' : '4 3'} />}
      {fire && (
        <>
          <rect x={-((params.fireboxW as number) ?? w * 0.5) / 2} y={-d / 2 + 0.03} width={(params.fireboxW as number) ?? w * 0.5} height={d - 0.06} fill={P.poche} stroke="none" />
          <rect x={-(((params.fireboxW as number) ?? w * 0.5) + 0.5) / 2} y={d / 2} width={((params.fireboxW as number) ?? w * 0.5) + 0.5} height={(params.hearthD as number) ?? 0.45} fill="none" stroke={P.ink} {...sp(0.8)} strokeDasharray={mpp ? '0.05 0.04' : '4 3'} />
        </>
      )}
      <text x={0} y={shelving ? -d / 2 + upperD / 2 + 0.01 : 0} textAnchor="middle" dominantBaseline="middle" fontSize={0.075} fill={P.ink2} style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }} transform={Math.abs(deg % 360) > 90 && Math.abs(deg % 360) < 270 ? 'rotate(180)' : undefined}>
        {fire ? 'FIREPLACE' : shelving ? 'BUILT-IN SHELVES' : (item.label ?? entry.name).toUpperCase()}
      </text>
    </g>
  );
});

// ---------------------------------------------------------------------------

function OpeningMark({ o, w, T, P, sp }: { o: Opening; w: Wall; T: number; P: Palette; sp: (px: number) => object }) {
  if (!w) return null;
  const a0 = openingPoint(w, o.offset, 0.004);
  const a1 = openingPoint(w, o.offset + o.width, 0.004);
  const b0 = openingPoint(w, o.offset, -T - 0.004);
  const b1 = openingPoint(w, o.offset + o.width, -T - 0.004);
  const cut = <polygon points={pts([a0, a1, b1, b0])} fill={P.fill} stroke="none" />;
  const jambs = (
    <>
      <line x1={a0.x} y1={a0.y} x2={b0.x} y2={b0.y} stroke={P.poche} {...sp(1.4)} />
      <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke={P.poche} {...sp(1.4)} />
    </>
  );
  const leaf = (hingeT: number, len: number, towardT: number, inward: boolean) => {
    const off = inward ? 0 : -T;
    const h = openingPoint(w, hingeT, off);
    const n = inward ? w.normal : { x: -w.normal.x, y: -w.normal.y };
    const tip = { x: h.x + n.x * len, y: h.y + n.y * len };
    const closed = openingPoint(w, towardT, off);
    const sweep = arcSweep(h, tip, closed);
    return (
      <>
        <line x1={h.x} y1={h.y} x2={tip.x} y2={tip.y} stroke={P.ink} {...sp(1.3)} />
        <path d={`M${f(tip.x)} ${f(tip.y)} A${f(len)} ${f(len)} 0 0 ${sweep} ${f(closed.x)} ${f(closed.y)}`} fill="none" stroke={P.ink2} {...sp(0.6)} />
      </>
    );
  };
  if (o.kind === 'door' || o.kind === 'double-door' || o.kind === 'french-door') {
    const inward = o.swing !== 'out';
    if (o.kind === 'door') {
      const hingeAtEnd = o.hinge === 'end';
      const hingeT = hingeAtEnd ? o.offset + o.width : o.offset;
      const other = hingeAtEnd ? o.offset : o.offset + o.width;
      return (
        <g>
          {cut}
          {jambs}
          {leaf(hingeT, o.width, other, inward)}
        </g>
      );
    }
    const half = o.width / 2;
    return (
      <g>
        {cut}
        {jambs}
        {leaf(o.offset, half, o.offset + half, inward)}
        {leaf(o.offset + o.width, half, o.offset + half, inward)}
        {o.transom ? <line x1={openingPoint(w, o.offset, -T / 2).x} y1={openingPoint(w, o.offset, -T / 2).y} x2={openingPoint(w, o.offset + o.width, -T / 2).x} y2={openingPoint(w, o.offset + o.width, -T / 2).y} stroke={P.ink2} {...sp(0.5)} /> : null}
      </g>
    );
  }
  if (o.kind === 'window' || o.kind === 'sliding-door') {
    const l1a = openingPoint(w, o.offset, -T * 0.35);
    const l1b = openingPoint(w, o.offset + o.width, -T * 0.35);
    const l2a = openingPoint(w, o.offset, -T * 0.65);
    const l2b = openingPoint(w, o.offset + o.width, -T * 0.65);
    return (
      <g>
        {cut}
        {jambs}
        <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} stroke={P.ink} {...sp(0.7)} />
        <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} stroke={P.ink} {...sp(0.7)} />
        <line x1={l1a.x} y1={l1a.y} x2={l1b.x} y2={l1b.y} stroke={P.ink} {...sp(0.55)} />
        <line x1={l2a.x} y1={l2a.y} x2={l2b.x} y2={l2b.y} stroke={P.ink} {...sp(0.55)} />
      </g>
    );
  }
  if (o.kind === 'niche') {
    const depth = o.depth ?? 0.4;
    const c0 = openingPoint(w, o.offset, -depth);
    const c1 = openingPoint(w, o.offset + o.width, -depth);
    const e0 = openingPoint(w, o.offset, -Math.max(depth, T) - 0.004);
    const e1 = openingPoint(w, o.offset + o.width, -Math.max(depth, T) - 0.004);
    const shelf0 = openingPoint(w, o.offset + 0.03, -depth * 0.5);
    const shelf1 = openingPoint(w, o.offset + o.width - 0.03, -depth * 0.5);
    return (
      <g>
        <polygon points={pts([a0, a1, e1, e0])} fill={P.poche} />
        <polygon points={pts([openingPoint(w, o.offset, 0), openingPoint(w, o.offset + o.width, 0), c1, c0])} fill="url(#fp-hatch)" stroke={P.ink} {...sp(1)} />
        <line x1={shelf0.x} y1={shelf0.y} x2={shelf1.x} y2={shelf1.y} stroke={P.ink2} {...sp(0.5)} strokeDasharray="4 3" />
      </g>
    );
  }
  // openings and archways: dashed head lines
  return (
    <g>
      {cut}
      {jambs}
      <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} stroke={P.ink2} {...sp(0.6)} strokeDasharray="5 4" />
      <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} stroke={P.ink2} {...sp(0.6)} strokeDasharray="5 4" />
    </g>
  );
}

/** SVG arc sweep flag for an arc from `a` to `b` around center `c` taking the short way. */
function arcSweep(c: Vec2, a: Vec2, b: Vec2) {
  const cr = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
  return cr > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------

interface PlacedLabel {
  id: string;
  x: number;
  y: number;
  ang: number;
  text: string;
  box: [number, number, number, number];
}

function placeLabels(list: { it: Item; e: CatalogEntry | undefined }[], size: number, selection: string[], hover: string | null | undefined): PlacedLabel[] {
  const cands = list
    .filter(({ e }) => e && e.category !== 'rug' && e.mount !== 'wall' && e.mount !== 'surface')
    .map(({ it, e }) => {
      const w = it.w ?? e!.w;
      const d = it.d ?? e!.d;
      const text = shortLabel((it.label ?? e!.name).replace(/^Your /, '')).toUpperCase();
      const tw = text.length * size * 0.66 + size * 0.2;
      const long = Math.max(w, d);
      const short = Math.min(w, d);
      let ang = ((it.rotation + (w >= d ? 0 : Math.PI / 2)) * 180) / Math.PI;
      ang = ((ang % 180) + 180) % 180;
      if (ang > 90) ang -= 180;
      if (Math.abs(ang) < 1) ang = 0;
      const forced = selection.includes(it.id) || hover === it.id;
      const fits = tw < long * 1.02 && size * 1.15 < short;
      const rad = (ang * Math.PI) / 180;
      const hw = (Math.abs(Math.cos(rad)) * tw + Math.abs(Math.sin(rad)) * size) / 2;
      const hh = (Math.abs(Math.sin(rad)) * tw + Math.abs(Math.cos(rad)) * size) / 2;
      return { id: it.id, x: it.x, y: it.y, ang, text, box: [it.x - hw, it.y - hh, it.x + hw, it.y + hh] as [number, number, number, number], fits, forced, area: w * d };
    })
    .filter((c) => c.fits || c.forced)
    .sort((a, b) => Number(b.forced) - Number(a.forced) || b.area - a.area);
  const out: PlacedLabel[] = [];
  for (const c of cands) {
    const hit = out.some((o) => c.box[0] < o.box[2] && c.box[2] > o.box[0] && c.box[1] < o.box[3] && c.box[3] > o.box[1]);
    if (!hit || c.forced) out.push(c);
  }
  return out;
}

function DimLine({ a, b, off, text, P, sp, textSize, color, outward }: { a: Vec2; b: Vec2; off: Vec2; text: string; P: Palette; sp: (px: number) => object; textSize: number; color?: string; outward?: boolean }) {
  const a2 = { x: a.x + off.x, y: a.y + off.y };
  const b2 = { x: b.x + off.x, y: b.y + off.y };
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.05) return null;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  let ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
  const on = Math.hypot(off.x, off.y) || 1;
  const n = { x: off.x / on, y: off.y / on };
  const tick = 0.05;
  const col = color ?? P.dim;
  const tickPath = (p: Vec2) => `M${f(p.x - (dir.x + n.x) * tick)} ${f(p.y - (dir.y + n.y) * tick)}L${f(p.x + (dir.x + n.x) * tick)} ${f(p.y + (dir.y + n.y) * tick)}`;
  const tpos = { x: mid.x + n.x * textSize * (outward === false ? -0.7 : 0.7), y: mid.y + n.y * textSize * (outward === false ? -0.7 : 0.7) };
  return (
    <g>
      <line x1={a.x + n.x * 0.04} y1={a.y + n.y * 0.04} x2={a2.x + n.x * 0.05} y2={a2.y + n.y * 0.05} stroke={col} {...sp(0.5)} opacity={0.7} />
      <line x1={b.x + n.x * 0.04} y1={b.y + n.y * 0.04} x2={b2.x + n.x * 0.05} y2={b2.y + n.y * 0.05} stroke={col} {...sp(0.5)} opacity={0.7} />
      <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} stroke={col} {...sp(0.7)} />
      <path d={tickPath(a2) + tickPath(b2)} stroke={col} {...sp(1.2)} fill="none" />
      <text x={tpos.x} y={tpos.y} textAnchor="middle" dominantBaseline="middle" fontSize={textSize} fill={col} transform={`rotate(${f(ang)} ${f(tpos.x)} ${f(tpos.y)})`} style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 500 }} stroke={P.paper} strokeWidth={textSize * 0.2} paintOrder="stroke">
        {text}
      </text>
    </g>
  );
}

function Dimensions({ room, ws, T, P, sp, units, textSize, k = 1 }: { room: Room; ws: Wall[]; T: number; P: Palette; sp: (px: number) => object; units: Units; textSize: number; k?: number }) {
  return (
    <g>
      {ws.map((w) => {
        const out = { x: -w.normal.x, y: -w.normal.y };
        const off1 = { x: out.x * (T + 0.42 * k), y: out.y * (T + 0.42 * k) };
        const off2 = { x: out.x * (T + 0.2 * k), y: out.y * (T + 0.2 * k) };
        const ops = room.openings.filter((o) => o.wall === w.index).sort((a, b) => a.offset - b.offset);
        const stops = [0, ...ops.flatMap((o) => [o.offset, o.offset + o.width]), w.length];
        const chain: ReactNode[] = [];
        if (ops.length) {
          for (let i = 0; i < stops.length - 1; i++) {
            const s0 = stops[i];
            const s1 = stops[i + 1];
            if (s1 - s0 < 0.12) continue;
            chain.push(<DimLine key={i} a={openingPoint(w, s0)} b={openingPoint(w, s1)} off={off2} text={formatLength(s1 - s0, units, { precision: 2 })} P={P} sp={sp} textSize={textSize * 0.8} />);
          }
        }
        return (
          <g key={w.index}>
            <DimLine a={w.a} b={w.b} off={off1} text={formatLength(w.length, units, { precision: 2 })} P={P} sp={sp} textSize={textSize} />
            {chain}
          </g>
        );
      })}
    </g>
  );
}

function LiveDims({ room, items, id, catalog, P, sp, units, textSize }: { room: Room; items: Item[]; id: string; catalog: Record<string, CatalogEntry>; P: Palette; sp: (px: number) => object; units: Units; textSize: number }) {
  const it = items.find((x) => x.id === id);
  if (!it) return null;
  const e = catalog[it.ref];
  if (!e) return null;
  const w = it.w ?? e.w;
  const d = it.d ?? e.d;
  const { u, v } = itemAxes(it.rotation);
  const sides = [
    { dir: v, start: { x: it.x + v.x * (d / 2), y: it.y + v.y * (d / 2) } },
    { dir: { x: -v.x, y: -v.y }, start: { x: it.x - v.x * (d / 2), y: it.y - v.y * (d / 2) } },
    { dir: u, start: { x: it.x + u.x * (w / 2), y: it.y + u.y * (w / 2) } },
    { dir: { x: -u.x, y: -u.y }, start: { x: it.x - u.x * (w / 2), y: it.y - u.y * (w / 2) } },
  ];
  const out: ReactNode[] = [];
  sides.forEach((s, i) => {
    const hit = rayToWalls(room, s.start, s.dir, 30);
    if (!hit || hit.dist < 0.03 || hit.dist > 8) return;
    const end = hit.point;
    const mid = { x: (s.start.x + end.x) / 2, y: (s.start.y + end.y) / 2 };
    out.push(
      <g key={i}>
        <line x1={s.start.x} y1={s.start.y} x2={end.x} y2={end.y} stroke={P.accent} {...sp(0.9)} strokeDasharray="3 2" />
        <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.9} fill={P.accent} stroke={P.paper} strokeWidth={0.025} paintOrder="stroke" style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 500 }}>
          {formatLength(hit.dist, units, { precision: 2 })}
        </text>
      </g>,
    );
  });
  // size tag
  out.push(
    <text key="size" x={it.x} y={it.y + Math.max(w, d) / 2 + 0.2} textAnchor="middle" fontSize={textSize * 0.85} fill={P.accent} stroke={P.paper} strokeWidth={0.025} paintOrder="stroke" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
      {formatSize(w, d, units)}
    </text>,
  );
  return <g>{out}</g>;
}

function HifiMark({ h, P, sp, units, textSize }: { h: NonNullable<Analysis['hifi']>; P: Palette; sp: (px: number) => object; units: Units; textSize: number }) {
  const col = h.ok ? P.dim : P.warn;
  return (
    <g>
      <polygon points={pts([h.left, h.right, h.seat])} fill={col} fillOpacity={0.05} stroke={col} {...sp(1.2)} strokeDasharray="6 4" />
      <circle cx={h.seat.x} cy={h.seat.y} r={0.09} fill="none" stroke={col} {...sp(1.4)} />
      <circle cx={h.seat.x} cy={h.seat.y} r={0.025} fill={col} />
      <text x={(h.left.x + h.right.x + h.seat.x) / 3} y={(h.left.y + h.right.y + h.seat.y) / 3} textAnchor="middle" dominantBaseline="middle" fontSize={textSize * 0.85} fill={col} style={{ fontFamily: 'var(--font-mono, monospace)' }} stroke={P.paper} strokeWidth={0.02} paintOrder="stroke">
        {Math.round(h.angle)}° · {formatLength(h.spacing, units, { compact: true })}
      </text>
    </g>
  );
}

function ZoneMark({ z, P, sp }: { z: Zone; P: Palette; sp: (px: number) => object }) {
  const col = z.kind === 'play' ? P.good : z.kind === 'tree' ? P.good : P.dim;
  const label = (z.label ?? z.kind).toUpperCase();
  if (z.r) {
    return (
      <g>
        <circle cx={z.x} cy={z.y} r={z.r} fill={col} fillOpacity={0.05} stroke={col} {...sp(1)} strokeDasharray="5 4" />
        <text x={z.x} y={z.y - z.r - 0.08} textAnchor="middle" fontSize={0.09} fill={col} style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>
          {label}
        </text>
      </g>
    );
  }
  const w = z.w ?? 1;
  const d = z.d ?? 1;
  return (
    <g>
      <rect x={z.x - w / 2} y={z.y - d / 2} width={w} height={d} rx={0.08} fill={col} fillOpacity={0.05} stroke={col} {...sp(1)} strokeDasharray="5 4" />
      <text x={z.x - w / 2 + 0.06} y={z.y - d / 2 + 0.14} fontSize={0.09} fill={col} style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>
        {label}
      </text>
    </g>
  );
}

function CameraMark({ cam, P, sp, inside, b }: { cam: { x: number; y: number; heading: number; fov: number }; P: Palette; sp: (px: number) => object; inside: boolean; b: ReturnType<typeof bounds> }) {
  // clamp outside cameras to the drawing edge so the marker stays visible
  const x = inside ? cam.x : Math.max(b.minX - 0.6, Math.min(b.maxX + 0.6, cam.x));
  const y = inside ? cam.y : Math.max(b.minY - 0.6, Math.min(b.maxY + 0.6, cam.y));
  const half = ((cam.fov * Math.PI) / 180) * 0.75;
  const len = inside ? 1.2 : 0.8;
  const a1 = { x: x + Math.cos(cam.heading - half) * len, y: y + Math.sin(cam.heading - half) * len };
  const a2 = { x: x + Math.cos(cam.heading + half) * len, y: y + Math.sin(cam.heading + half) * len };
  return (
    <g pointerEvents="none">
      <path d={`M${f(x)} ${f(y)}L${f(a1.x)} ${f(a1.y)}A${len} ${len} 0 0 1 ${f(a2.x)} ${f(a2.y)}Z`} fill={P.accent} fillOpacity={0.1} stroke={P.accent} {...sp(0.8)} strokeOpacity={0.6} />
      <circle cx={x} cy={y} r={0.08} fill={P.accent} stroke={P.paper} {...sp(1.5)} />
    </g>
  );
}
