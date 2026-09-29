import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Armchair, Box, Check, ChevronLeft, ChevronRight, Eye, Footprints, Grid3x3, Map as MapIcon, Maximize, Minus, Moon, Orbit, Plus, Route, Sun, Tag, Ruler, Waves, X, CircleDashed, AlertTriangle, Camera } from 'lucide-react';
import { Scene3D } from '../three/Scene';
import { PlanView } from '../plan/PlanView';
import { acceptProposal, activeRoom, displayedLayout, previewProposal, requestCamera, setScene, setUi, toggleOverlay, useStore, catalogEntry, addItem, activeLayout } from '../state/store';
import { bounds, polygonArea, walls } from '../model/geometry';
import { formatArea, formatLength } from '../model/units';
import { Button, IconButton, MenuItem, Popover, Segmented, cx } from './primitives';
import { cameraRef } from '../three/Controls';
import { placeNew } from '../interaction/place';
import { exportSnapshot } from '../export/exporters';

export function Stage() {
  const view = useStore((s) => s.view);
  const [split, setSplit] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('fp:split') ?? '0.52') || 0.52;
    } catch {
      return 0.52;
    }
  });
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // Side by side when the stage is wide; stacked when it is tall.
  const [orient, setOrient] = useState<'row' | 'col'>('row');
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setOrient(width < height * 1.2 ? 'col' : 'row');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('fp:split', String(split));
    } catch {
      /* ignore */
    }
  }, [split]);
  const tracks = `${split}fr 6px ${1 - split}fr`;
  const style = view !== 'split' ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' } : orient === 'row' ? { gridTemplateColumns: tracks, gridTemplateRows: '1fr' } : { gridTemplateRows: tracks, gridTemplateColumns: '1fr' };
  return (
    <main className={cx('stage', `stage-${orient}`, `view-${view}`)} ref={wrap} style={style}>
      {(view === '3d' || view === 'split') && (
        <section className="pane pane-3d" aria-label="3D view" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop3D(e)}>
          <Scene3D />
          <PreviewBanner />
          <Hint3D />
          <ViewToolbar />
        </section>
      )}
      {view === 'split' && (
        <div
          className="splitter"
          role="separator"
          aria-orientation={orient === 'row' ? 'vertical' : 'horizontal'}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as Element).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging.current || !wrap.current) return;
            const r = wrap.current.getBoundingClientRect();
            const t = orient === 'row' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
            setSplit(Math.max(0.25, Math.min(0.75, t)));
          }}
          onPointerUp={() => (dragging.current = false)}
          onDoubleClick={() => setSplit(0.52)}
        />
      )}
      {(view === 'plan' || view === 'split') && (
        <section className="pane pane-plan" aria-label="Plan" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropPlan(e)}>
          <PlanView />
          {view === 'plan' && <PreviewBanner />}
          <PlanToolbar />
          <TitleBlock />
        </section>
      )}
    </main>
  );
}

/** A one-time nudge on how to move around. */
function Hint3D() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem('fp:hint3d');
    } catch {
      return true;
    }
  });
  const camera = useStore((s) => s.camera);
  useEffect(() => {
    if (!show) return;
    const done = () => {
      setShow(false);
      try {
        localStorage.setItem('fp:hint3d', '1');
      } catch {
        /* ignore */
      }
    };
    const t = setTimeout(done, 14000);
    const el = document.querySelector('.pane-3d canvas');
    el?.addEventListener('pointerdown', done, { once: true });
    return () => {
      clearTimeout(t);
      el?.removeEventListener('pointerdown', done);
    };
  }, [show]);
  if (!show && camera !== 'walk') return null;
  return (
    <div className="hint-3d" aria-hidden="true">
      {camera === 'walk' ? 'W A S D to walk · drag to look around · Esc to stop' : 'Drag to look around · right-drag to pan · scroll to zoom · click a piece to move it'}
    </div>
  );
}

function drop3D(e: React.DragEvent) {
  const ref = e.dataTransfer.getData('text/x-fp-ref');
  if (!ref) return;
  e.preventDefault();
  const entry = catalogEntry(ref);
  const cam = cameraRef.current;
  const room = activeRoom();
  if (!entry || !cam || !room) return;
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, cam);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
  const s = useStore.getState();
  const p = placeNew(room, activeLayout(), entry, { x: hit.x, y: hit.z }, s.custom);
  addItem(entry.id, { x: p.x, y: p.y, rotation: p.rotation }, { wall: p.wall, elevation: p.elevation, fixed: s.mode === 'room' ? true : undefined });
}

function dropPlan(e: React.DragEvent) {
  const ref = e.dataTransfer.getData('text/x-fp-ref');
  if (!ref) return;
  e.preventDefault();
  const svg = (e.currentTarget as HTMLElement).querySelector('svg');
  const entry = catalogEntry(ref);
  const room = activeRoom();
  if (!svg || !entry || !room) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = svg.getScreenCTM();
  if (!m) return;
  const loc = pt.matrixTransform(m.inverse());
  const s = useStore.getState();
  const p = placeNew(room, activeLayout(), entry, { x: loc.x, y: loc.y }, s.custom);
  addItem(entry.id, { x: p.x, y: p.y, rotation: p.rotation }, { wall: p.wall, elevation: p.elevation, fixed: s.mode === 'room' ? true : undefined });
}

function PreviewBanner() {
  const preview = useStore((s) => s.preview);
  const proposals = useStore((s) => s.proposals);
  const p = proposals.find((x) => x.id === preview);
  if (!p) return null;
  const idx = proposals.indexOf(p);
  const ready = proposals.filter((x) => x.status === 'ready');
  const go = (d: number) => {
    const list = ready.length ? ready : proposals;
    const i = list.indexOf(p);
    const next = list[(i + d + list.length) % list.length];
    if (next) previewProposal(next.id);
  };
  return (
    <div className="preview-banner" role="status">
      <span className="pb-kicker">Idea {idx + 1} of {proposals.length}</span>
      <span className="pb-name">{p.layout.name}</span>
      {p.layout.direction && <span className="pb-dir">{p.layout.direction}</span>}
      <span className="pb-spacer" />
      {proposals.length > 1 && (
        <>
          <IconButton label="Previous idea" icon={<ChevronLeft size={16} />} onClick={() => go(-1)} />
          <IconButton label="Next idea" icon={<ChevronRight size={16} />} onClick={() => go(1)} />
        </>
      )}
      <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => acceptProposal(p.id)} disabled={p.status !== 'ready'}>
        Save as layout
      </Button>
      <IconButton label="Close preview" icon={<X size={16} />} onClick={() => previewProposal(null)} />
    </div>
  );
}

function ViewToolbar() {
  const camera = useStore((s) => s.camera);
  const scene = useStore((s) => s.scene);
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => displayedLayout(s));
  const selection = useStore((s) => s.selection);
  const sel = layout?.items.find((x) => x.id === selection[0]);
  const selEntry = sel ? catalogEntry(sel.ref) : undefined;
  const seat = selEntry && ['sofa', 'sectional', 'lounge-chair', 'dining-chair', 'bench', 'office-chair'].includes(selEntry.category);
  const ws = room ? walls(room) : [];
  const wallName = (i: number) => {
    const w = ws[i];
    if (!w) return `Wall ${i + 1}`;
    const n = w.normal;
    const facing = Math.abs(n.x) > Math.abs(n.y) ? (n.x > 0 ? 'west' : 'east') : n.y > 0 ? 'north' : 'south';
    const has = room!.fixtures.find((f) => f.wall === i && catalogEntry(f.ref)?.generator === 'fireplace') ? 'fireplace' : room!.openings.some((o) => o.wall === i && o.kind === 'french-door') ? 'terrace doors' : null;
    return has ? `the ${has}` : `the ${facing} wall`;
  };
  return (
    <div className="float-bar float-bl" role="toolbar" aria-label="3D view controls">
      <Segmented
        size="sm"
        value={camera}
        onChange={(v) => setUi({ camera: v })}
        options={[
          { value: 'orbit', label: <><Orbit size={13} /> Orbit</>, title: 'Orbit the room (drag), pan (right-drag), zoom (scroll)' },
          { value: 'walk', label: <><Footprints size={13} /> Walk</>, title: 'Walk at eye level: drag to look, W A S D to move' },
        ]}
      />
      <Popover
        side="top"
        width={250}
        trigger={({ toggle }) => (
          <Button size="sm" variant="quiet" icon={<Eye size={14} />} onClick={toggle}>
            Views
          </Button>
        )}
      >
        {(close) => (
          <div className="menu">
            <MenuItem icon={<Box size={14} />} onClick={() => (close(), requestCamera('preset', 'overview'))}>
              Overview
            </MenuItem>
            <MenuItem icon={<MapIcon size={14} />} onClick={() => (close(), requestCamera('preset', 'top'))}>
              From above
            </MenuItem>
            <div className="menu-sep" />
            <div className="menu-label">Stand and look at…</div>
            {ws.map((w) => (
              <MenuItem key={w.index} icon={<Eye size={14} />} onClick={() => (close(), requestCamera('preset', `facing:${w.index}`))}>
                {wallName(w.index).replace(/^the /, '').replace(/^./, (c) => c.toUpperCase())}
              </MenuItem>
            ))}
            {room && room.openings.filter((o) => o.kind === 'door').length > 0 && (
              <>
                <div className="menu-sep" />
                <div className="menu-label">Walk in through…</div>
                {room.openings
                  .filter((o) => o.kind === 'door' || o.kind === 'opening' || o.kind === 'archway')
                  .map((o) => (
                    <MenuItem key={o.id} icon={<Footprints size={14} />} onClick={() => (close(), requestCamera('preset', `door:${o.id}`))}>
                      {o.label ?? 'Door'}
                    </MenuItem>
                  ))}
              </>
            )}
          </div>
        )}
      </Popover>
      {seat && sel && (
        <Button size="sm" variant="quiet" icon={<Armchair size={14} />} onClick={() => requestCamera('sit', sel.id)} title="See the room from this seat">
          Sit here
        </Button>
      )}
      <span className="fb-sep" />
      <Segmented
        size="sm"
        value={scene.time}
        onChange={(v) => setScene({ time: v })}
        options={[
          { value: 'day', label: <Sun size={13} />, title: 'Daylight' },
          { value: 'evening', label: <Moon size={13} />, title: 'Evening: lamps, fire and pot lights' },
        ]}
      />
      {scene.time === 'day' && <input className="sun-slider" type="range" min={0} max={1} step={0.01} value={scene.sun} onChange={(e) => setScene({ sun: parseFloat(e.target.value) })} aria-label="Sun position" title="Sun position" />}
      <IconButton label="Save a snapshot" icon={<Camera size={15} />} onClick={() => exportSnapshot()} />
      <Popover
        side="top"
        align="end"
        width={220}
        trigger={({ toggle }) => <IconButton label="Rendering quality" icon={<Waves size={15} />} onClick={toggle} />}
      >
        <div className="menu menu-pad">
          <div className="menu-label">Quality</div>
          <Segmented size="sm" value={scene.quality} onChange={(v) => setScene({ quality: v })} options={[{ value: 'high', label: 'High' }, { value: 'balanced', label: 'Faster' }]} />
          <p className="menu-note">High adds floor reflections, softer shadows and more lights in the evening.</p>
        </div>
      </Popover>
    </div>
  );
}

function PlanToolbar() {
  const o = useStore((s) => s.overlays);
  const room = useStore((s) => activeRoom(s));
  return (
    <div className="float-bar float-vl" role="toolbar" aria-label="Plan controls">
      <IconButton label="Zoom in" icon={<Plus size={15} />} onClick={() => window.dispatchEvent(new CustomEvent('fp:plan-zoom', { detail: 1.25 }))} />
      <IconButton label="Zoom out" icon={<Minus size={15} />} onClick={() => window.dispatchEvent(new CustomEvent('fp:plan-zoom', { detail: 0.8 }))} />
      <IconButton label="Fit the room (F or double-click)" icon={<Maximize size={15} />} onClick={() => window.dispatchEvent(new Event('fp:plan-fit'))} />
      <span className="fb-sep" />
      <IconButton label="Dimensions" icon={<Ruler size={15} />} active={o.dims} onClick={() => toggleOverlay('dims')} />
      <IconButton label="Labels" icon={<Tag size={15} />} active={o.labels} onClick={() => toggleOverlay('labels')} />
      <IconButton label="Grid" icon={<Grid3x3 size={15} />} active={o.grid} onClick={() => toggleOverlay('grid')} />
      <span className="fb-sep" />
      <IconButton label="Walkways" icon={<Route size={15} />} active={o.circulation} onClick={() => toggleOverlay('circulation')} />
      <IconButton label="Conflicts" icon={<AlertTriangle size={15} />} active={o.clearances} onClick={() => toggleOverlay('clearances')} />
      <IconButton label="Listening triangle" icon={<Waves size={15} />} active={o.hifi} onClick={() => toggleOverlay('hifi')} />
      <IconButton label="Zones" icon={<CircleDashed size={15} />} active={o.zones} onClick={() => toggleOverlay('zones')} />
      {room?.underlay && (
        <>
          <span className="fb-sep" />
          <IconButton label="Floor plan underlay" icon={<MapIcon size={15} />} active={o.underlay} onClick={() => toggleOverlay('underlay')} />
        </>
      )}
    </div>
  );
}

function TitleBlock() {
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => displayedLayout(s));
  const units = useStore((s) => s.units);
  if (!room) return null;
  const b = bounds(room.outline);
  const idx = Math.max(0, room.layoutOrder.indexOf(layout?.id ?? '')) + 1;
  return (
    <div className="title-block" aria-label="Drawing title">
      <div className="tbk-main">
        <span className="tbk-room">{room.name}</span>
        <span className="tbk-layout">{layout?.name ?? '—'}</span>
      </div>
      <div className="tbk-meta">
        <span>
          {formatLength(b.w, units, { compact: true })} × {formatLength(b.h, units, { compact: true })}
        </span>
        <span>{formatArea(polygonArea(room.outline), units)}</span>
        <span>Clg {formatLength(room.ceilingHeight, units, { compact: true })}</span>
        <span className="tbk-sheet">A-10{idx}</span>
      </div>
      {(room.survey?.method === 'photos' || (room.survey?.method === 'manual' && room.survey.confidence !== 'high')) && <div className={cx('tbk-note')}>Dimensions estimated {room.survey.method === 'photos' ? 'from photos' : 'from a description'}</div>}
    </div>
  );
}
