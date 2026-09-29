import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, Search, X } from 'lucide-react';
import { CATALOG, CATEGORY_LABELS, STYLES } from '../catalog/catalog';
import type { Category, CatalogEntry } from '../model/types';
import { activeLayout, activeRoom, addItem, useStore } from '../state/store';
import { formatSize } from '../model/units';
import { placeNew } from '../interaction/place';
import { useThumb } from './thumbs';
import { cx } from './primitives';
import { openAddPiece } from './dialogs';

const ORDER: Category[] = [
  'sofa',
  'sectional',
  'lounge-chair',
  'ottoman',
  'coffee-table',
  'side-table',
  'rug',
  'floor-lamp',
  'table-lamp',
  'dining-table',
  'dining-chair',
  'bench',
  'console',
  'storage',
  'hifi',
  'music',
  'plant',
  'art',
  'media',
  'seasonal',
  'baby',
  'desk',
  'office-chair',
  'bed',
  'decor',
];

/** “Your sofa” reads as “Sofa” under the Yours heading. */
export function displayName(name: string) {
  const n = name.replace(/^Your /, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function addToRoom(entry: CatalogEntry, at?: { x: number; y: number }) {
  const room = activeRoom();
  if (!room) return;
  const s = useStore.getState();
  const p = placeNew(room, activeLayout(), entry, at, s.custom);
  addItem(entry.id, { x: p.x, y: p.y, rotation: p.rotation }, { wall: p.wall, elevation: p.elevation, fixed: s.mode === 'room' ? true : undefined });
}

export function Library() {
  const [q, setQ] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const mode = useStore((s) => s.mode);
  const custom = useStore((s) => s.custom);
  const all = useMemo(() => [...Object.values(custom), ...CATALOG], [custom]);
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const match = (e: CatalogEntry) => {
      if (mode === 'room') return e.category === 'builtin' && !e.id.startsWith('fixture-picture');
      if (e.category === 'builtin') return false;
      if (style && !e.styles.includes(style) && !e.owned && !e.custom) return false;
      if (!ql) return true;
      return [e.name, e.brand, e.designer, CATEGORY_LABELS[e.category], ...(e.styles ?? []), ...(e.tags ?? [])].filter(Boolean).join(' ').toLowerCase().includes(ql);
    };
    const list = all.filter(match);
    if (mode === 'room') return [{ key: 'builtin', label: 'Built-ins', items: list }];
    const yours = list.filter((e) => e.owned || e.custom);
    const rest = list.filter((e) => !e.owned && !e.custom);
    const out: { key: string; label: string; items: CatalogEntry[] }[] = [];
    if (yours.length) out.push({ key: 'yours', label: 'Yours', items: yours });
    for (const c of ORDER) {
      const items = rest.filter((e) => e.category === c);
      if (items.length) out.push({ key: c, label: CATEGORY_LABELS[c], items });
    }
    return out;
  }, [all, q, style, mode]);

  return (
    <aside className="library" aria-label="Furniture library">
      <div className="lib-head">
        <div className="panel-title-row">
          <span className="panel-title">{mode === 'room' ? 'Built-ins' : 'Library'}</span>
          <span className="panel-count">{groups.reduce((s, g) => s + g.items.length, 0)}</span>
        </div>
        <div className="search">
          <Search size={14} aria-hidden="true" />
          <input id="lib-search" placeholder={mode === 'room' ? 'Search built-ins' : 'Search pieces, brands, designers'} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          {q && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQ('')}>
              <X size={13} />
            </button>
          )}
        </div>
        {mode !== 'room' && (
          <>
            <button type="button" className="lib-add" onClick={() => openAddPiece()}>
              <span className="lib-add-icon">
                <Link2 size={15} />
              </span>
              <span>
                <strong>Add from a link or photo</strong>
                <small>Paste a product page or drop a screenshot</small>
              </span>
            </button>
            <div className="chip-row" role="group" aria-label="Filter by style">
              <button type="button" className={cx('chip', !style && 'is-on')} onClick={() => setStyle(null)}>
                All
              </button>
              {STYLES.map((s) => (
                <button key={s.id} type="button" className={cx('chip', style === s.id && 'is-on')} onClick={() => setStyle(style === s.id ? null : s.id)} title={s.blurb}>
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="lib-scroll">
        {groups.map((g) => (
          <section key={g.key} className="lib-group">
            <h4 className="lib-group-title">{g.label}</h4>
            <div className="lib-grid">
              {g.items.map((e) => (
                <LibCard key={e.id} entry={e} />
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <div className="empty-note">Nothing matches “{q}”. Try a brand, a designer or a word like “round”.</div>}
      </div>
    </aside>
  );
}

const LibCard = memo(function LibCard({ entry }: { entry: CatalogEntry }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const units = useStore((s) => s.units);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const thumb = useThumb(entry, undefined, visible);
  const meta = [entry.brand ?? entry.designer, formatSize(entry.w, entry.d, units)].filter(Boolean).join(' · ');
  return (
    <button
      ref={ref}
      type="button"
      className="lib-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-fp-ref', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => addToRoom(entry)}
      title={`${entry.name}${entry.designer ? ' — ' + entry.designer : ''}\nClick to add, or drag into the room`}
    >
      <span className="lib-thumb">{thumb ? <img src={thumb} alt="" draggable={false} /> : <span className="lib-thumb-ph" />}</span>
      <span className="lib-card-body">
        <span className="lib-name">{displayName(entry.name)}</span>
        <span className="lib-meta">{meta}</span>
        {entry.price && <span className="lib-price">{entry.price}</span>}
        {entry.owned && <span className="badge-own">Yours</span>}
        {entry.custom && !entry.owned && <span className="badge-own badge-new">Added</span>}
      </span>
      <span className="lib-plus" aria-hidden="true">
        <Plus size={14} />
      </span>
    </button>
  );
});
