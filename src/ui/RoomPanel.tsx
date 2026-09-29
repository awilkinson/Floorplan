import { useState } from 'react';
import { DoorOpen, Plus, Trash2, Scaling, ImagePlus, X } from 'lucide-react';
import { activeRoom, editRoom, editItems, useStore, toast } from '../state/store';
import type { Opening, OpeningKind, Room } from '../model/types';
import { bounds, walls } from '../model/geometry';
import { formatLength, inch, parseLength } from '../model/units';
import { Button, Field, IconButton, LengthInput, Segmented, cx } from './primitives';
import { nanoid } from 'nanoid';
import { uploadImage } from '../persist/assets';
import { fileToImages } from '../ai/files';
import { RoomPhotos } from './Photos';

const WALL_COLORS: { name: string; hex: string }[] = [
  { name: 'Warm white', hex: '#F1EEE7' },
  { name: 'Chalk', hex: '#F4F2EC' },
  { name: 'Bone', hex: '#E9E3D6' },
  { name: 'Greige', hex: '#D9D2C4' },
  { name: 'Mushroom', hex: '#C9BFB0' },
  { name: 'Sage', hex: '#B8BFAE' },
  { name: 'Slate', hex: '#8E979D' },
  { name: 'Ink', hex: '#2E3440' },
  { name: 'Oxblood', hex: '#5E2A28' },
];

const FLOORS: { id: Room['finishes']['floor']; name: string; color: string }[] = [
  { id: 'wood-dark', name: 'Dark oak', color: '#3B291E' },
  { id: 'wood-mid', name: 'Natural oak', color: '#7A5A3C' },
  { id: 'wood-light', name: 'Pale oak', color: '#B79770' },
  { id: 'stone', name: 'Limestone', color: '#CFC8BB' },
  { id: 'concrete', name: 'Concrete', color: '#A8A49C' },
  { id: 'carpet', name: 'Wool carpet', color: '#C9C0B0' },
];

const OPENING_KINDS: { id: OpeningKind; name: string }[] = [
  { id: 'door', name: 'Door' },
  { id: 'double-door', name: 'Double door' },
  { id: 'french-door', name: 'French doors' },
  { id: 'sliding-door', name: 'Sliding door' },
  { id: 'window', name: 'Window' },
  { id: 'opening', name: 'Cased opening' },
  { id: 'archway', name: 'Archway' },
];

export function scaleRoom(room: Room, k: number): Room {
  return {
    ...room,
    outline: room.outline.map((p) => ({ x: p.x * k, y: p.y * k })),
    openings: room.openings.map((o) => ({ ...o, offset: o.offset * k, width: o.width * k })),
    fixtures: room.fixtures.map((f) => ({ ...f, x: f.x * k, y: f.y * k, w: f.w != null ? f.w * k : f.w })),
    survey: { ...(room.survey ?? { method: 'manual' }), confidence: 'high', note: 'Calibrated from a measured wall.' },
  };
}

export function RoomPanel() {
  const room = useStore((s) => activeRoom(s));
  const units = useStore((s) => s.units);
  const [calWall, setCalWall] = useState(0);
  if (!room) return null;
  const fmt = (v: number) => formatLength(v, units, { precision: 2 });
  const parse = (s: string) => parseLength(s, units, units === 'metric' ? 'm' : 'ft');
  const ws = walls(room);
  const b = bounds(room.outline);
  const rect = room.outline.length === 4 && ws.every((w) => Math.abs(w.dir.x) < 1e-3 || Math.abs(w.dir.y) < 1e-3);
  const setRect = (W: number, D: number) => {
    const kx = W / b.w;
    const ky = D / b.h;
    editRoom('Resize room', (r) => ({
      ...r,
      outline: r.outline.map((p) => ({ x: b.minX + (p.x - b.minX) * kx, y: b.minY + (p.y - b.minY) * ky })),
      openings: r.openings.map((o) => {
        const w = ws[o.wall];
        const k = Math.abs(w.dir.x) > 0.5 ? kx : ky;
        return { ...o, offset: o.offset * k };
      }),
      fixtures: r.fixtures.map((f) => ({ ...f, x: b.minX + (f.x - b.minX) * kx, y: b.minY + (f.y - b.minY) * ky })),
    }));
    editItems('Resize room', (items) => items.map((it) => ({ ...it, x: b.minX + (it.x - b.minX) * kx, y: b.minY + (it.y - b.minY) * ky })));
  };
  const addOpening = (kind: OpeningKind, wall: number) => {
    const w = ws[wall];
    const width = kind === 'french-door' ? inch(72) : kind === 'double-door' ? inch(60) : kind === 'window' ? inch(48) : kind === 'sliding-door' ? inch(96) : inch(36);
    const o: Opening = {
      id: nanoid(6),
      kind,
      wall,
      offset: Math.max(0.1, w.length / 2 - width / 2),
      width,
      height: kind === 'window' ? inch(84) : inch(84),
      sill: kind === 'window' ? inch(24) : 0,
      swing: kind === 'french-door' ? 'out' : 'in',
      hinge: 'start',
      glazed: kind === 'french-door' || kind === 'sliding-door' || kind === 'window',
      label: OPENING_KINDS.find((k) => k.id === kind)?.name,
    };
    editRoom('Add opening', (r) => ({ ...r, openings: [...r.openings, o] }));
  };
  const setOpening = (id: string, patch: Partial<Opening>) => editRoom('Edit opening', (r) => ({ ...r, openings: r.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  return (
    <div className="room-panel">
      <section className="insp-section">
        <Field label="Room name">
          <input className="text-input" id="room-name" value={room.name} onChange={(e) => editRoom('Rename room', (r) => ({ ...r, name: e.target.value }), { transient: true })} onKeyDown={(e) => e.stopPropagation()} />
        </Field>
        {room.survey?.note && <p className="room-survey">{room.survey.note}</p>}
      </section>

      <RoomPhotos room={room} />

      <section className="insp-section">
        <span className="insp-label">Size</span>
        {rect ? (
          <div className="size-grid">
            <label>
              <span>Width</span>
              <LengthInput id="room-w" value={b.w} format={fmt} parse={parse} onCommit={(v) => setRect(v, b.h)} width={92} />
            </label>
            <label>
              <span>Depth</span>
              <LengthInput id="room-d" value={b.h} format={fmt} parse={parse} onCommit={(v) => setRect(b.w, v)} width={92} />
            </label>
            <label>
              <span>Ceiling</span>
              <LengthInput id="room-h" value={room.ceilingHeight} format={fmt} parse={parse} onCommit={(v) => editRoom('Ceiling height', (r) => ({ ...r, ceilingHeight: v }))} width={92} />
            </label>
          </div>
        ) : (
          <div className="size-grid one">
            <label>
              <span>Ceiling</span>
              <LengthInput id="room-h" value={room.ceilingHeight} format={fmt} parse={parse} onCommit={(v) => editRoom('Ceiling height', (r) => ({ ...r, ceilingHeight: v }))} width={92} />
            </label>
          </div>
        )}
        <div className="calibrate">
          <Scaling size={14} />
          <span>Measured a wall?</span>
          <select className="select" value={calWall} onChange={(e) => setCalWall(parseInt(e.target.value, 10))} aria-label="Wall to calibrate">
            {ws.map((w) => (
              <option key={w.index} value={w.index}>
                Wall {w.index + 1} ({fmt(w.length)})
              </option>
            ))}
          </select>
          <LengthInput
            id="cal-len"
            value={ws[calWall]?.length ?? 1}
            format={fmt}
            parse={parse}
            width={86}
            onCommit={(v) => {
              const cur = ws[calWall]?.length;
              if (!cur) return;
              const k = v / cur;
              editRoom('Calibrate room', (r) => scaleRoom(r, k));
              editItems('Calibrate room', (items) => items.map((it) => ({ ...it, x: it.x * k, y: it.y * k })));
              toast(`Scaled the room by ${Math.round((k - 1) * 1000) / 10}% to match your measurement`, 'good');
            }}
          />
        </div>
        <p className="field-hint">Drag corners and walls on the plan to reshape. Everything scales from one measured wall.</p>
      </section>

      <section className="insp-section">
        <span className="insp-label">Floor</span>
        <div className="swatches big">
          {FLOORS.map((f) => (
            <button key={f.id} type="button" className={cx('swatch', room.finishes.floor === f.id && 'is-on')} style={{ background: f.color }} title={f.name} onClick={() => editRoom('Change floor', (r) => ({ ...r, finishes: { ...r.finishes, floor: f.id, floorColor: f.color } }))} />
          ))}
        </div>
        <span className="insp-label">Walls</span>
        <div className="swatches big">
          {WALL_COLORS.map((c) => (
            <button key={c.hex} type="button" className={cx('swatch', room.finishes.wallColor === c.hex && 'is-on')} style={{ background: c.hex }} title={c.name} onClick={() => editRoom('Change wall color', (r) => ({ ...r, finishes: { ...r.finishes, wallColor: c.hex } }))} />
          ))}
        </div>
        <span className="insp-label">Ceiling</span>
        <Segmented
          size="sm"
          value={room.finishes.ceiling.style}
          onChange={(v) => editRoom('Change ceiling', (r) => ({ ...r, finishes: { ...r.finishes, ceiling: { ...r.finishes.ceiling, style: v, grid: r.finishes.ceiling.grid ?? [4, 4], beamWidth: r.finishes.ceiling.beamWidth ?? inch(9), beamDepth: r.finishes.ceiling.beamDepth ?? inch(9) } } }))}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'coffered', label: 'Coffered' },
            { value: 'beamed', label: 'Beamed' },
          ]}
        />
        <span className="insp-label">Walls treatment</span>
        <div className="wall-list">
          {ws.map((w) => (
            <div key={w.index} className="wall-row">
              <span className="mono">Wall {w.index + 1}</span>
              <span className="mono muted">{fmt(w.length)}</span>
              <select className="select" value={room.walls[w.index]?.treatment ?? 'plain'} onChange={(e) => editRoom('Wall treatment', (r) => ({ ...r, walls: r.walls.map((x, i) => (i === w.index ? { ...x, treatment: e.target.value as 'plain' } : x)) }))} aria-label={`Wall ${w.index + 1} treatment`}>
                <option value="plain">Plain</option>
                <option value="paneled">Paneled</option>
                <option value="wainscot">Wainscot</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="insp-section">
        <div className="insp-label-row">
          <span className="insp-label">Doors and windows</span>
        </div>
        {room.openings.map((o) => (
          <div key={o.id} className="opening-row">
            <div className="opening-top">
              <DoorOpen size={14} />
              <select className="select" value={o.kind} onChange={(e) => setOpening(o.id, { kind: e.target.value as OpeningKind })} aria-label="Opening type">
                {[...OPENING_KINDS, { id: 'niche' as OpeningKind, name: 'Built-in niche' }].map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
              <span className="mono muted">W{o.wall + 1}</span>
              <IconButton label="Remove opening" icon={<Trash2 size={13} />} onClick={() => editRoom('Remove opening', (r) => ({ ...r, openings: r.openings.filter((x) => x.id !== o.id) }))} />
            </div>
            <div className="size-grid">
              <label>
                <span>Width</span>
                <LengthInput id={`ow-${o.id}`} value={o.width} format={fmt} parse={(s) => parseLength(s, units)} onCommit={(v) => setOpening(o.id, { width: v })} />
              </label>
              <label>
                <span>Height</span>
                <LengthInput id={`oh-${o.id}`} value={o.height} format={fmt} parse={(s) => parseLength(s, units)} onCommit={(v) => setOpening(o.id, { height: v })} />
              </label>
              <label>
                <span>{o.kind === 'window' ? 'Sill' : 'From corner'}</span>
                {o.kind === 'window' ? <LengthInput id={`os-${o.id}`} value={o.sill} format={fmt} parse={(s) => parseLength(s, units)} onCommit={(v) => setOpening(o.id, { sill: v })} /> : <LengthInput id={`oo-${o.id}`} value={o.offset} format={fmt} parse={(s) => parseLength(s, units)} onCommit={(v) => setOpening(o.id, { offset: v })} />}
              </label>
            </div>
            {(o.kind === 'door' || o.kind === 'double-door' || o.kind === 'french-door') && (
              <div className="opening-swing">
                <Segmented size="sm" value={o.swing ?? 'in'} onChange={(v) => setOpening(o.id, { swing: v })} options={[{ value: 'in', label: 'Swings in' }, { value: 'out', label: 'Swings out' }]} />
                {o.kind === 'door' && <Segmented size="sm" value={o.hinge ?? 'start'} onChange={(v) => setOpening(o.id, { hinge: v })} options={[{ value: 'start', label: 'Hinge A' }, { value: 'end', label: 'Hinge B' }]} />}
              </div>
            )}
          </div>
        ))}
        <AddOpening walls={ws.length} onAdd={addOpening} />
      </section>

      <UnderlaySection room={room} />

      <section className="insp-section">
        <span className="insp-label">What the room is for</span>
        <GoalsEditor room={room} />
        <Field label="Notes for the designer">
          <textarea className="text-input" rows={3} id="room-notes" value={room.notes} onChange={(e) => editRoom('Edit notes', (r) => ({ ...r, notes: e.target.value }), { transient: true })} onKeyDown={(e) => e.stopPropagation()} placeholder="Anything the designer should know — pieces to keep, the view, how you use the room" />
        </Field>
      </section>
    </div>
  );
}

function AddOpening({ walls: n, onAdd }: { walls: number; onAdd: (k: OpeningKind, wall: number) => void }) {
  const [kind, setKind] = useState<OpeningKind>('door');
  const [wall, setWall] = useState(0);
  return (
    <div className="add-opening">
      <select className="select" value={kind} onChange={(e) => setKind(e.target.value as OpeningKind)} aria-label="New opening type">
        {OPENING_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <select className="select" value={wall} onChange={(e) => setWall(parseInt(e.target.value, 10))} aria-label="On wall">
        {Array.from({ length: n }, (_, i) => (
          <option key={i} value={i}>
            Wall {i + 1}
          </option>
        ))}
      </select>
      <Button size="sm" icon={<Plus size={13} />} onClick={() => onAdd(kind, wall)}>
        Add
      </Button>
    </div>
  );
}

export const GOAL_SUGGESTIONS = ['Hi-fi listening', 'Baby play', 'Quiet reading and tea for two', 'Family lounging', 'Christmas', 'Entertaining', 'Dining', 'Working from home', 'TV and movies', 'Piano'];

export function GoalsEditor({ room }: { room: Room }) {
  const [text, setText] = useState('');
  const toggle = (g: string) =>
    editRoom('Edit goals', (r) => ({ ...r, goals: r.goals.includes(g) ? r.goals.filter((x) => x !== g) : [...r.goals, g] }));
  const extra = room.goals.filter((g) => !GOAL_SUGGESTIONS.includes(g));
  return (
    <div className="goals">
      <div className="chip-wrap">
        {[...GOAL_SUGGESTIONS, ...extra].map((g) => (
          <button key={g} type="button" className={cx('chip', room.goals.includes(g) && 'is-on')} onClick={() => toggle(g)} aria-pressed={room.goals.includes(g)}>
            {g}
          </button>
        ))}
      </div>
      <input
        className="text-input"
        id="goal-add"
        placeholder="Add your own and press Enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && text.trim()) {
            editRoom('Add goal', (r) => ({ ...r, goals: [...r.goals, text.trim()] }));
            setText('');
          }
        }}
      />
    </div>
  );
}

function UnderlaySection({ room }: { room: Room }) {
  const units = useStore((s) => s.units);
  const [busy, setBusy] = useState(false);
  const u = room.underlay;
  const pick = async (file: File) => {
    setBusy(true);
    try {
      const imgs = await fileToImages(file, 1);
      const img = imgs[0];
      if (!img) throw new Error('unreadable');
      const asset = await uploadImage(img.blob, 'plan', { width: img.width, height: img.height });
      const b = bounds(room.outline);
      const scale = (b.w * 1.25) / img.width;
      editRoom('Add floor plan', (r) => ({ ...r, underlay: { asset: { ...asset, width: img.width, height: img.height }, scale, x: b.minX - b.w * 0.125, y: b.minY - b.h * 0.125, rotation: 0, opacity: 0.45, visible: true } }));
      toast('Floor plan added under the drawing. Match its scale below.', 'good');
    } catch {
      toast('That file could not be read. Try a PNG, JPG or PDF.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="insp-section">
      <span className="insp-label">Floor plan underlay</span>
      {!u ? (
        <label className="upload-row">
          <ImagePlus size={15} />
          <span>{busy ? 'Reading…' : 'Add a drawing to trace over (PDF or image)'}</span>
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
      ) : (
        <div className="underlay-controls">
          <div className="size-grid">
            <label>
              <span>Image width</span>
              <LengthInput id="ul-w" value={(u.asset.width ?? 1000) * u.scale} format={(v) => formatLength(v, units, { precision: 2 })} parse={(s) => parseLength(s, units, units === 'metric' ? 'm' : 'ft')} onCommit={(v) => editRoom('Scale underlay', (r) => ({ ...r, underlay: r.underlay && { ...r.underlay, scale: v / (r.underlay.asset.width ?? 1000) } }))} />
            </label>
            <label>
              <span>Opacity</span>
              <input type="range" min={0.1} max={1} step={0.05} value={u.opacity} onChange={(e) => editRoom('Underlay opacity', (r) => ({ ...r, underlay: r.underlay && { ...r.underlay, opacity: parseFloat(e.target.value) } }), { transient: true })} />
            </label>
          </div>
          <div className="nudge">
            {(['←', '→', '↑', '↓'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="chip"
                onClick={() => {
                  const d = 0.05;
                  const dx = k === '←' ? -d : k === '→' ? d : 0;
                  const dy = k === '↑' ? -d : k === '↓' ? d : 0;
                  editRoom('Move underlay', (r) => ({ ...r, underlay: r.underlay && { ...r.underlay, x: r.underlay.x + dx, y: r.underlay.y + dy } }));
                }}
              >
                {k}
              </button>
            ))}
            <IconButton label="Remove underlay" icon={<X size={14} />} onClick={() => editRoom('Remove underlay', (r) => ({ ...r, underlay: undefined }))} />
          </div>
        </div>
      )}
    </section>
  );
}
