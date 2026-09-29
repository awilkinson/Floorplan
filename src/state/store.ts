import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { CatalogEntry, Item, Layout, Room, Units, ViewMode } from '../model/types';
import { CATALOG_MAP } from '../catalog/catalog';

export type CameraMode = 'orbit' | 'walk';

export interface SceneSettings {
  time: 'day' | 'evening';
  /** 0 = morning, 1 = late afternoon. */
  sun: number;
  quality: 'high' | 'balanced';
}

export interface Overlays {
  circulation: boolean;
  clearances: boolean;
  hifi: boolean;
  zones: boolean;
  dims: boolean;
  labels: boolean;
  grid: boolean;
  underlay: boolean;
}

export interface Proposal {
  id: string;
  layout: Layout;
  status: 'streaming' | 'ready' | 'error';
  fixes?: string[];
  shopping?: string[];
  error?: string;
}

export interface Toast {
  id: string;
  text: string;
  tone?: 'info' | 'good' | 'warn' | 'error';
  action?: { label: string; run: () => void };
}

interface HistEntry {
  label: string;
  roomId: string;
  room?: Room;
  layout?: Layout;
}

export interface CameraRequest {
  kind: 'preset' | 'sit' | 'focus' | 'fit';
  value: string;
  nonce: number;
}

export interface State {
  ready: boolean;
  rooms: Record<string, Room>;
  layouts: Record<string, Layout>;
  custom: Record<string, CatalogEntry>;
  activeRoomId: string | null;
  selection: string[];
  hover: string | null;
  view: ViewMode;
  units: Units;
  mode: 'layout' | 'room';
  camera: CameraMode;
  cameraRequest: CameraRequest | null;
  scene: SceneSettings;
  overlays: Overlays;
  rightTab: 'designer' | 'inspect' | 'checks';
  libraryOpen: boolean;
  proposals: Proposal[];
  preview: string | null;
  toasts: Toast[];
  past: HistEntry[];
  future: HistEntry[];
  dragging: boolean;
  /** Snapshot of an item before a drag, so the drag is one undo step. */
  storage: 'cloud' | 'local' | 'loading';
}

const initial: State = {
  ready: false,
  rooms: {},
  layouts: {},
  custom: {},
  activeRoomId: null,
  selection: [],
  hover: null,
  view: 'split',
  units: 'imperial',
  mode: 'layout',
  camera: 'orbit',
  cameraRequest: null,
  scene: { time: 'day', sun: 0.35, quality: 'high' },
  overlays: { circulation: false, clearances: true, hifi: false, zones: true, dims: true, labels: true, grid: false, underlay: true },
  rightTab: 'designer',
  libraryOpen: true,
  proposals: [],
  preview: null,
  toasts: [],
  past: [],
  future: [],
  dragging: false,
  storage: 'loading',
};

export const useStore = create<State>(() => initial);

const set = useStore.setState;
const get = useStore.getState;

// ---------------------------------------------------------------------------
// Selectors

export function activeRoom(s: State = get()): Room | null {
  return s.activeRoomId ? s.rooms[s.activeRoomId] ?? null : null;
}

export function activeLayout(s: State = get()): Layout | null {
  const room = activeRoom(s);
  if (!room) return null;
  const id = room.activeLayoutId ?? room.layoutOrder[0];
  return (id && s.layouts[id]) || null;
}

/** What the canvas shows: a previewed proposal, or the active layout. */
export function displayedLayout(s: State = get()): Layout | null {
  if (s.preview) {
    const p = s.proposals.find((x) => x.id === s.preview);
    if (p) return p.layout;
  }
  return activeLayout(s);
}

export function catalogEntry(ref: string, s: State = get()): CatalogEntry | undefined {
  return s.custom[ref] ?? CATALOG_MAP[ref];
}

export function fullCatalog(s: State = get()): Record<string, CatalogEntry> {
  return { ...CATALOG_MAP, ...s.custom };
}

// ---------------------------------------------------------------------------
// History

function pushHistory(entry: HistEntry) {
  set((s) => ({ past: [...s.past.slice(-80), entry], future: [] }));
}

export function undo() {
  const s = get();
  const e = s.past[s.past.length - 1];
  if (!e) return;
  const redoEntry: HistEntry = { label: e.label, roomId: e.roomId };
  const patch: Partial<State> = {};
  if (e.room) {
    redoEntry.room = s.rooms[e.room.id];
    patch.rooms = { ...s.rooms, [e.room.id]: e.room };
  }
  if (e.layout) {
    redoEntry.layout = s.layouts[e.layout.id];
    patch.layouts = { ...s.layouts, [e.layout.id]: e.layout };
  }
  set({ ...patch, past: s.past.slice(0, -1), future: [...s.future, redoEntry] });
  toast(`Undid ${e.label.toLowerCase()}`);
}

export function redo() {
  const s = get();
  const e = s.future[s.future.length - 1];
  if (!e) return;
  const back: HistEntry = { label: e.label, roomId: e.roomId };
  const patch: Partial<State> = {};
  if (e.room) {
    back.room = s.rooms[e.room.id];
    patch.rooms = { ...s.rooms, [e.room.id]: e.room };
  }
  if (e.layout) {
    back.layout = s.layouts[e.layout.id];
    patch.layouts = { ...s.layouts, [e.layout.id]: e.layout };
  }
  set({ ...patch, future: s.future.slice(0, -1), past: [...s.past, back] });
}

// ---------------------------------------------------------------------------
// Mutations

export function init(rooms: Room[], layouts: Layout[], custom: CatalogEntry[], storage: State['storage']) {
  const r = Object.fromEntries(rooms.map((x) => [x.id, x]));
  const l = Object.fromEntries(layouts.map((x) => [x.id, x]));
  const c = Object.fromEntries(custom.map((x) => [x.id, x]));
  let activeRoomId: string | null = null;
  try {
    const saved = localStorage.getItem('fp:lastRoom');
    if (saved && r[saved]) activeRoomId = saved;
  } catch {
    /* storage unavailable */
  }
  if (!activeRoomId) activeRoomId = rooms[0]?.id ?? null;
  set({ ready: true, rooms: r, layouts: l, custom: c, activeRoomId, storage });
}

export function setActiveRoom(id: string) {
  set({ activeRoomId: id, selection: [], preview: null, proposals: [], mode: 'layout' });
  try {
    localStorage.setItem('fp:lastRoom', id);
  } catch {
    /* ignore */
  }
  requestCamera('fit', 'overview');
}

export function setActiveLayout(layoutId: string) {
  const room = activeRoom();
  if (!room) return;
  set((s) => ({ rooms: { ...s.rooms, [room.id]: { ...room, activeLayoutId: layoutId, updatedAt: Date.now() } }, selection: [], preview: null }));
}

/** Apply an edit to the active layout's items. */
export function editItems(label: string, fn: (items: Item[]) => Item[], opts: { transient?: boolean; layoutId?: string } = {}) {
  const s = get();
  const layout = opts.layoutId ? s.layouts[opts.layoutId] : activeLayout(s);
  if (!layout) return;
  if (!opts.transient) pushHistory({ label, roomId: layout.roomId, layout });
  const next: Layout = { ...layout, items: fn(layout.items), updatedAt: Date.now() };
  set({ layouts: { ...s.layouts, [layout.id]: next } });
}

/** Edit the room shell (walls, openings, fixtures, finishes). */
export function editRoom(label: string, fn: (room: Room) => Room, opts: { transient?: boolean } = {}) {
  const s = get();
  const room = activeRoom(s);
  if (!room) return;
  if (!opts.transient) pushHistory({ label, roomId: room.id, room });
  set({ rooms: { ...s.rooms, [room.id]: { ...fn(room), updatedAt: Date.now() } } });
}

/** Record the pre-drag state once; the drag itself is transient. */
export function beginGesture(label: string) {
  const s = get();
  if (s.mode === 'room') {
    const room = activeRoom(s);
    if (room) pushHistory({ label, roomId: room.id, room });
  } else {
    const layout = activeLayout(s);
    if (layout) pushHistory({ label, roomId: layout.roomId, layout });
  }
  set({ dragging: true });
}

export function endGesture() {
  set({ dragging: false });
}

export function updateItem(id: string, patch: Partial<Item>, opts: { transient?: boolean; label?: string } = {}) {
  const s = get();
  if (s.mode === 'room') {
    editRoom(opts.label ?? 'Edit built-in', (r) => ({ ...r, fixtures: r.fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)) }), opts);
    return;
  }
  editItems(opts.label ?? 'Edit piece', (items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)), opts);
}

export function addItem(ref: string, at: { x: number; y: number; rotation?: number }, extra: Partial<Item> = {}): string {
  const id = `${ref.replace(/^own-/, '')}-${nanoid(5)}`;
  const s = get();
  if (s.mode === 'room') {
    editRoom('Add built-in', (r) => ({ ...r, fixtures: [...r.fixtures, { id, ref, x: at.x, y: at.y, rotation: at.rotation ?? 0, fixed: true, ...extra }] }));
  } else {
    editItems('Add piece', (items) => [...items, { id, ref, x: at.x, y: at.y, rotation: at.rotation ?? 0, ...extra }]);
  }
  set({ selection: [id], rightTab: 'inspect' });
  return id;
}

export function removeItems(ids: string[]) {
  if (!ids.length) return;
  const s = get();
  if (s.mode === 'room') editRoom('Remove built-in', (r) => ({ ...r, fixtures: r.fixtures.filter((f) => !ids.includes(f.id)) }));
  else editItems(ids.length > 1 ? `Remove ${ids.length} pieces` : 'Remove piece', (items) => items.filter((it) => !ids.includes(it.id)));
  set({ selection: [] });
}

export function duplicateItems(ids: string[]) {
  const layout = activeLayout();
  if (!layout || !ids.length) return;
  const copies: Item[] = [];
  for (const it of layout.items) if (ids.includes(it.id)) copies.push({ ...it, id: `${it.ref.replace(/^own-/, '')}-${nanoid(5)}`, x: it.x + 0.3, y: it.y + 0.3, locked: false });
  editItems('Duplicate', (items) => [...items, ...copies]);
  set({ selection: copies.map((c) => c.id) });
}

export function select(ids: string[], additive = false) {
  set((s) => {
    const selection = additive ? Array.from(new Set([...s.selection.filter((x) => !ids.includes(x)), ...ids.filter((x) => !s.selection.includes(x))])) : ids;
    return { selection, rightTab: selection.length ? 'inspect' : s.rightTab === 'inspect' ? 'designer' : s.rightTab };
  });
}

export function setHover(id: string | null) {
  if (get().hover !== id) set({ hover: id });
}

export function createLayout(name: string, from: 'blank' | 'current' | Layout = 'current', extra: Partial<Layout> = {}): string | null {
  const s = get();
  const room = activeRoom(s);
  if (!room) return null;
  const src = from === 'current' ? activeLayout(s) : from === 'blank' ? null : from;
  const id = `${room.id}~${nanoid(6)}`;
  const now = Date.now();
  const layout: Layout = {
    id,
    roomId: room.id,
    name,
    items: src ? src.items.map((it) => ({ ...it })) : [],
    source: src && src.source === 'ai' ? 'ai' : 'manual',
    direction: src?.direction,
    concept: src?.concept,
    moves: src?.moves,
    zones: src?.zones,
    occasion: src?.occasion,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
  pushHistory({ label: 'New layout', roomId: room.id, room });
  set({
    layouts: { ...s.layouts, [id]: layout },
    rooms: { ...s.rooms, [room.id]: { ...room, layoutOrder: [...room.layoutOrder, id], activeLayoutId: id, updatedAt: now } },
    selection: [],
    preview: null,
  });
  return id;
}

export function renameLayout(id: string, name: string) {
  const s = get();
  const l = s.layouts[id];
  if (!l) return;
  pushHistory({ label: 'Rename layout', roomId: l.roomId, layout: l });
  set({ layouts: { ...s.layouts, [id]: { ...l, name, updatedAt: Date.now() } } });
}

export function deleteLayout(id: string) {
  const s = get();
  const l = s.layouts[id];
  const room = l && s.rooms[l.roomId];
  if (!l || !room || room.layoutOrder.length <= 1) return;
  const order = room.layoutOrder.filter((x) => x !== id);
  const layouts = { ...s.layouts };
  delete layouts[id];
  set({
    layouts,
    rooms: { ...s.rooms, [room.id]: { ...room, layoutOrder: order, activeLayoutId: room.activeLayoutId === id ? order[order.length - 1] : room.activeLayoutId, updatedAt: Date.now() } },
    past: [],
    future: [],
  });
  deletedLayouts.push(id);
}

/** Layout ids removed this session, so persistence can delete their documents. */
export const deletedLayouts: string[] = [];
export const deletedRooms: string[] = [];

export function addRoom(room: Room, layouts: Layout[]) {
  set((s) => ({
    rooms: { ...s.rooms, [room.id]: room },
    layouts: { ...s.layouts, ...Object.fromEntries(layouts.map((l) => [l.id, l])) },
  }));
  setActiveRoom(room.id);
}

export function deleteRoom(id: string) {
  const s = get();
  const room = s.rooms[id];
  if (!room) return;
  const rooms = { ...s.rooms };
  delete rooms[id];
  const layouts = { ...s.layouts };
  for (const lid of room.layoutOrder) {
    delete layouts[lid];
    deletedLayouts.push(lid);
  }
  deletedRooms.push(id);
  set({ rooms, layouts, activeRoomId: Object.keys(rooms)[0] ?? null, selection: [], past: [], future: [] });
}

export function addCustomEntry(entry: CatalogEntry) {
  set((s) => ({ custom: { ...s.custom, [entry.id]: entry } }));
}

export function setProposals(fn: (p: Proposal[]) => Proposal[]) {
  set((s) => ({ proposals: fn(s.proposals) }));
}

export function previewProposal(id: string | null) {
  set({ preview: id, selection: [] });
}

export function acceptProposal(id: string): string | null {
  const s = get();
  const p = s.proposals.find((x) => x.id === id);
  if (!p) return null;
  const lid = createLayout(p.layout.name, p.layout, { source: 'ai' });
  set((st) => ({ preview: null, proposals: st.proposals.filter((x) => x.id !== id) }));
  if (lid) toast(`Saved “${p.layout.name}” as a layout`, 'good');
  return lid;
}

export function requestCamera(kind: CameraRequest['kind'], value: string) {
  set({ cameraRequest: { kind, value, nonce: Math.random() } });
}

export function setScene(patch: Partial<SceneSettings>) {
  set((s) => ({ scene: { ...s.scene, ...patch } }));
}

export function toggleOverlay(k: keyof Overlays, v?: boolean) {
  set((s) => ({ overlays: { ...s.overlays, [k]: v ?? !s.overlays[k] } }));
}

export function toast(text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) {
  const id = nanoid(6);
  set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone, action }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 7000 : 3600);
}

export function setUi(patch: Partial<Pick<State, 'view' | 'units' | 'mode' | 'camera' | 'rightTab' | 'libraryOpen'>>) {
  set(patch as Partial<State>);
  if (patch.units) {
    try {
      localStorage.setItem('fp:units', patch.units);
    } catch {
      /* ignore */
    }
  }
}
