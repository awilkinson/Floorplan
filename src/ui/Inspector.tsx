import { useMemo, useState } from 'react';
import { Armchair, Copy, Lock, LockOpen, MessageSquareText, Replace, RotateCcw, RotateCw, Trash2, Undo, FlipHorizontal2 } from 'lucide-react';
import { activeLayout, activeRoom, catalogEntry, duplicateItems, removeItems, requestCamera, select, updateItem, useStore } from '../state/store';
import { finish, finishesForSlot, SLOT_FAMILIES } from '../catalog/finishes';
import { formatLength, formatSize, parseLength, rotationToBearing, bearingToRotation, compassName, normAngle } from '../model/units';
import { Button, IconButton, LengthInput, cx } from './primitives';
import { useThumb } from './thumbs';
import { CATEGORY_LABELS, STYLES } from '../catalog/catalog';
import { openAddPiece } from './dialogs';
import { askDesigner } from '../ai/designer';
import type { Item } from '../model/types';

const SLOT_LABELS: Record<string, string> = {
  upholstery: 'Upholstery',
  cushions: 'Cushions',
  pillows: 'Pillows',
  accent: 'Accent pillow',
  legs: 'Legs',
  frame: 'Frame',
  base: 'Base',
  top: 'Top',
  body: 'Body',
  fronts: 'Fronts',
  shade: 'Shade',
  pot: 'Planter',
  cabinet: 'Finish',
  seat: 'Seat',
  panel: 'Panels',
  shell: 'Shell',
  rug: 'Colorway',
  bedding: 'Bedding',
};

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const mode = useStore((s) => s.mode);
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => activeLayout(s));
  const units = useStore((s) => s.units);
  const pool = mode === 'room' ? room?.fixtures ?? [] : layout?.items ?? [];
  const items = pool.filter((x) => selection.includes(x.id));
  if (!items.length) return <div className="empty-note pad">Select a piece in the 3D view or on the plan to change its size, finish and position.</div>;
  if (items.length > 1) return <MultiInspector items={items} />;
  return <SingleInspector item={items[0]} units={units} />;
}

function MultiInspector({ items }: { items: Item[] }) {
  return (
    <div className="inspector">
      <div className="insp-head">
        <div className="insp-title">{items.length} pieces</div>
        <div className="insp-sub">Drag any of them to move the group.</div>
      </div>
      <div className="insp-actions">
        <Button icon={<Copy size={14} />} onClick={() => duplicateItems(items.map((i) => i.id))}>
          Duplicate
        </Button>
        <Button icon={<Trash2 size={14} />} variant="danger" onClick={() => removeItems(items.map((i) => i.id))}>
          Remove
        </Button>
        <Button variant="quiet" onClick={() => select([])}>
          Deselect
        </Button>
      </div>
    </div>
  );
}

function SingleInspector({ item, units }: { item: Item; units: 'imperial' | 'metric' }) {
  const entry = catalogEntry(item.ref);
  const thumb = useThumb(entry, item.finishes);
  const fmt = useMemo(() => (v: number) => formatLength(v, units, { precision: 2, inchesBelow: 9 }), [units]);
  const parse = (s: string) => parseLength(s, units);
  if (!entry) return <div className="empty-note pad">This piece is missing from the library.</div>;
  const finishes = { ...entry.finishes, ...(item.finishes ?? {}) };
  const slots = Object.keys(entry.finishes).filter((s) => SLOT_FAMILIES[s]);
  const w = item.w ?? entry.w;
  const d = item.d ?? entry.d;
  const h = item.h ?? entry.h;
  const bearing = rotationToBearing(item.rotation);
  const seat = ['sofa', 'sectional', 'lounge-chair', 'dining-chair', 'bench', 'office-chair'].includes(entry.category);
  const resizable = entry.resizable !== false;
  const styleNames = entry.styles.map((s) => STYLES.find((x) => x.id === s)?.name).filter(Boolean);
  const changed = item.w != null || item.d != null || item.h != null;

  return (
    <div className="inspector">
      <div className="insp-hero">
        <div className="insp-thumb">{thumb ? <img src={thumb} alt="" /> : <span className="lib-thumb-ph" />}</div>
        <div className="insp-head">
          <div className="insp-kicker">
            {CATEGORY_LABELS[entry.category]}
            {entry.owned && <span className="badge-own">Yours</span>}
            {item.fixed && <span className="badge-own badge-fixed">Built-in</span>}
          </div>
          <div className="insp-title">{item.label ?? entry.name}</div>
          {(entry.brand || entry.designer) && <div className="insp-sub">{[entry.brand, entry.designer].filter(Boolean).join(' · ')}</div>}
          <div className="insp-sub mono">
            {formatSize(w, d, units, h)}
            {entry.price && <span className="insp-price"> · {entry.price}</span>}
          </div>
          {styleNames.length > 0 && <div className="insp-styles">{styleNames.join(' · ')}</div>}
        </div>
      </div>

      {entry.description && <p className="insp-desc">{entry.description}</p>}

      <section className="insp-section">
        <div className="insp-label-row">
          <span className="insp-label">Size</span>
          {changed && (
            <button type="button" className="link-btn" onClick={() => updateItem(item.id, { w: undefined, d: undefined, h: undefined }, { label: 'Reset size' })}>
              <Undo size={12} /> Catalog size
            </button>
          )}
        </div>
        <div className="size-grid">
          <label>
            <span>W</span>
            <LengthInput id={`w-${item.id}`} value={w} format={fmt} parse={parse} disabled={!resizable} onCommit={(v) => updateItem(item.id, { w: v }, { label: 'Resize' })} />
          </label>
          <label>
            <span>D</span>
            <LengthInput id={`d-${item.id}`} value={d} format={fmt} parse={parse} disabled={!resizable} onCommit={(v) => updateItem(item.id, { d: v }, { label: 'Resize' })} />
          </label>
          <label>
            <span>H</span>
            <LengthInput id={`h-${item.id}`} value={h} format={fmt} parse={parse} disabled={!resizable} onCommit={(v) => updateItem(item.id, { h: v }, { label: 'Resize' })} />
          </label>
        </div>
        {entry.mount === 'wall' && (
          <div className="size-grid one">
            <label>
              <span>Hung at</span>
              <LengthInput id={`e-${item.id}`} value={item.elevation ?? 1.45} format={fmt} parse={parse} onCommit={(v) => updateItem(item.id, { elevation: v }, { label: 'Move up or down' })} />
            </label>
          </div>
        )}
      </section>

      {entry.mount !== 'wall' && (
        <section className="insp-section">
          <div className="insp-label-row">
            <span className="insp-label">Facing</span>
            <span className="insp-value mono">
              {bearing}° · {compassName(bearing)}
            </span>
          </div>
          <div className="rot-row">
            <IconButton label="Rotate left 15°" icon={<RotateCcw size={15} />} onClick={() => updateItem(item.id, { rotation: normAngle(item.rotation - Math.PI / 12), wall: undefined }, { label: 'Rotate' })} />
            <IconButton label="Rotate right 15°" icon={<RotateCw size={15} />} onClick={() => updateItem(item.id, { rotation: normAngle(item.rotation + Math.PI / 12), wall: undefined }, { label: 'Rotate' })} />
            <IconButton label="Turn around" icon={<FlipHorizontal2 size={15} />} onClick={() => updateItem(item.id, { rotation: normAngle(item.rotation + Math.PI), wall: undefined }, { label: 'Turn around' })} />
            <div className="compass">
              {[0, 90, 180, 270].map((b) => (
                <button key={b} type="button" className={cx('compass-btn', bearing === b && 'is-on')} onClick={() => updateItem(item.id, { rotation: bearingToRotation(b), wall: undefined }, { label: 'Rotate' })} title={`Face ${compassName(b)}`}>
                  {['N', 'E', 'S', 'W'][b / 90]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {slots.length > 0 && (
        <section className="insp-section">
          <span className="insp-label">Finishes</span>
          {slots.map((slot) => (
            <FinishPicker key={slot} slot={slot} value={finishes[slot]} onPick={(id) => updateItem(item.id, { finishes: { ...(item.finishes ?? {}), [slot]: id } }, { label: `Change ${SLOT_LABELS[slot]?.toLowerCase() ?? slot}` })} />
          ))}
        </section>
      )}

      <div className="insp-actions">
        {seat && !item.fixed && (
          <Button icon={<Armchair size={14} />} onClick={() => requestCamera('sit', item.id)}>
            Sit here
          </Button>
        )}
        {!item.fixed && (
          <Button icon={<Replace size={14} />} onClick={() => askDesigner(`Suggest three alternatives to the ${entry.name.replace(/^Your /, '').toLowerCase()} (${item.id}) that would suit this room, and swap in the best one.`, { focusIds: [item.id] })}>
            Suggest a swap
          </Button>
        )}
        {!item.fixed && (
          <Button icon={<MessageSquareText size={14} />} variant="quiet" onClick={() => openAddPiece({ replaceId: item.id })}>
            Replace from a link or photo
          </Button>
        )}
      </div>
      <div className="insp-actions">
        <IconButton label="Duplicate (⌘D)" icon={<Copy size={15} />} onClick={() => duplicateItems([item.id])} />
        <IconButton label={item.locked ? 'Unlock' : 'Lock in place'} icon={item.locked ? <Lock size={15} /> : <LockOpen size={15} />} active={item.locked} onClick={() => updateItem(item.id, { locked: !item.locked }, { label: item.locked ? 'Unlock' : 'Lock' })} />
        <span className="grow" />
        <Button icon={<Trash2 size={14} />} variant="danger" size="sm" onClick={() => removeItems([item.id])}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function FinishPicker({ slot, value, onPick }: { slot: string; value?: string; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const full = finishesForSlot(slot);
  const LIMIT = 14;
  // keep the current finish visible when collapsed
  const list = all || full.length <= LIMIT + 2 ? full : [...full.slice(0, LIMIT), ...(full.slice(LIMIT).some((f) => f.id === value) ? full.filter((f) => f.id === value) : [])];
  const cur = finish(value);
  return (
    <div className="finish-row">
      <div className="finish-head">
        <span className="finish-slot">{SLOT_LABELS[slot] ?? slot}</span>
        <span className="finish-name">{cur.name}</span>
      </div>
      <div className="swatches" role="listbox" aria-label={SLOT_LABELS[slot] ?? slot}>
        {list.map((f) => (
          <button
            key={f.id}
            type="button"
            role="option"
            aria-selected={f.id === value}
            className={cx('swatch', f.id === value && 'is-on', f.family === 'metal' && 'is-metal', f.family === 'glass' && 'is-glass')}
            style={{ background: f.palette ? `linear-gradient(135deg, ${f.palette.slice(0, 3).join(', ')})` : f.color }}
            title={f.name}
            onClick={() => onPick(f.id)}
          />
        ))}
        {full.length > LIMIT + 2 && (
          <button type="button" className="swatch-more" onClick={() => setAll(!all)}>
            {all ? 'Fewer' : `+${full.length - list.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
