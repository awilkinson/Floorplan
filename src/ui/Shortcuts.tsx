import { useEffect } from 'react';
import { activeLayout, activeRoom, duplicateItems, editItems, editRoom, previewProposal, redo, removeItems, requestCamera, select, setScene, setUi, undo, useStore } from '../state/store';
import type { Item } from '../model/types';
import { normAngle } from '../model/units';
import { toggleShortcuts, useDialogs } from './dialogs';
import { Dialog } from './primitives';

let lastNudge = 0;

/** Move or turn the selection. Several pieces turn together around their middle. */
function transformSelection(label: string, fn: (it: Item, c: { x: number; y: number }) => Partial<Item>, coalesce = false) {
  const s = useStore.getState();
  const ids = new Set(s.selection);
  const pool = s.mode === 'room' ? activeRoom(s)?.fixtures ?? [] : activeLayout(s)?.items ?? [];
  const sel = pool.filter((it) => ids.has(it.id) && !it.locked);
  if (!sel.length) return;
  const c = { x: sel.reduce((a, it) => a + it.x, 0) / sel.length, y: sel.reduce((a, it) => a + it.y, 0) / sel.length };
  const transient = coalesce && Date.now() - lastNudge < 900;
  if (coalesce) lastNudge = Date.now();
  const apply = (list: Item[]) => list.map((it) => (ids.has(it.id) && !it.locked ? { ...it, ...fn(it, c) } : it));
  if (s.mode === 'room') editRoom(label, (r) => ({ ...r, fixtures: apply(r.fixtures) }), { transient });
  else editItems(label, apply, { transient });
}

function rotateBy(delta: number) {
  transformSelection('Rotate', (it, c) => {
    const n = useStore.getState().selection.length;
    if (n < 2) return { rotation: normAngle(it.rotation + delta), wall: undefined };
    const dx = it.x - c.x;
    const dy = it.y - c.y;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos, rotation: normAngle(it.rotation + delta), wall: undefined };
  });
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('.dialog-scrim')) return;
      const s = useStore.getState();
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key;
      const lower = k.toLowerCase();
      const walk = s.camera === 'walk';
      if (meta) {
        if (lower === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (lower === 'y') {
          e.preventDefault();
          redo();
        } else if (lower === 'd') {
          e.preventDefault();
          if (s.selection.length && s.mode === 'layout') duplicateItems(s.selection);
        } else if (lower === 'a' && !walk) {
          e.preventDefault();
          const pool = s.mode === 'room' ? activeRoom(s)?.fixtures ?? [] : activeLayout(s)?.items ?? [];
          select(pool.filter((i) => !i.hidden).map((i) => i.id));
        }
        return;
      }
      if (e.altKey) return;
      switch (k) {
        case 'Delete':
        case 'Backspace': {
          const pool = s.mode === 'room' ? activeRoom(s)?.fixtures ?? [] : activeLayout(s)?.items ?? [];
          const ids = pool.filter((i) => s.selection.includes(i.id) && !i.locked).map((i) => i.id);
          if (ids.length) {
            e.preventDefault();
            removeItems(ids);
          }
          return;
        }
        case 'Escape':
          if (walk) setUi({ camera: 'orbit' });
          else if (s.preview) previewProposal(null);
          else if (s.selection.length) select([]);
          else if (s.mode === 'room') setUi({ mode: 'layout' });
          return;
        case '1':
          setUi({ view: '3d' });
          return;
        case '2':
          setUi({ view: 'split' });
          return;
        case '3':
          setUi({ view: 'plan' });
          return;
        case '?':
          toggleShortcuts();
          return;
        case '/': {
          e.preventDefault();
          setUi({ rightTab: 'designer' });
          requestAnimationFrame(() => document.getElementById('designer-input')?.focus());
          return;
        }
      }
      if (lower === 'r' && s.selection.length) {
        e.preventDefault();
        rotateBy(((e.shiftKey ? -1 : 1) * Math.PI) / 12);
        return;
      }
      if (lower === 'v') {
        setUi({ camera: walk ? 'orbit' : 'walk' });
        return;
      }
      if (lower === 'l' && !walk) {
        setUi({ libraryOpen: !s.libraryOpen });
        return;
      }
      if (lower === 'n' && !walk) {
        setScene({ time: s.scene.time === 'day' ? 'evening' : 'day' });
        return;
      }
      if (lower === 'f' && !walk) {
        requestCamera('preset', 'overview');
        window.dispatchEvent(new Event('fp:plan-fit'));
        return;
      }
      if (k.startsWith('Arrow') && !walk && s.selection.length) {
        e.preventDefault();
        const step = s.units === 'metric' ? (e.shiftKey ? 0.1 : 0.01) : e.shiftKey ? 0.1524 : 0.0254;
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        transformSelection('Nudge', (it) => ({ x: it.x + dx, y: it.y + dy, wall: undefined }), true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const LIST: [string, string][] = [
  ['Click · Shift-click', 'Select · add to selection'],
  ['Drag', 'Move (snaps to walls and neighbors; hold Alt for free)'],
  ['R · Shift R', 'Turn 15° clockwise · counter-clockwise'],
  ['Arrow keys', 'Nudge 1″ (Shift: 6″)'],
  ['Delete', 'Remove'],
  ['⌘D', 'Duplicate'],
  ['⌘Z · ⇧⌘Z', 'Undo · redo'],
  ['⌘A', 'Select everything'],
  ['Esc', 'Deselect, close a preview, leave walk mode'],
  ['1 · 2 · 3', '3D · split · plan'],
  ['V', 'Walk at eye level (W A S D to move, drag to look)'],
  ['F', 'Fit the room'],
  ['N', 'Day or evening'],
  ['L', 'Show or hide the library'],
  ['/', 'Ask the designer'],
  ['?', 'This list'],
];

export function ShortcutsDialog() {
  const open = useDialogs((s) => s.shortcuts);
  return (
    <Dialog open={open} onClose={() => toggleShortcuts(false)} width={560} title={<div className="dh"><span className="dh-kicker">Keyboard</span><span className="dh-title">Shortcuts</span></div>}>
      <dl className="shortcuts">
        {LIST.map(([k, v]) => (
          <div key={k} className="sc-row">
            <dt>
              {k.split(' · ').map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="sc-dot"> · </span>}
                  <kbd>{part}</kbd>
                </span>
              ))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
