import type { AssetRef, CatalogEntry, Layout, Room } from '../model/types';
import { deletedLayouts, deletedRooms, init, toast, useStore } from '../state/store';
import { assetUrl, hydrateLocal, persistableRef } from './assets';

// Rooms, layouts and added pieces live in the artifact's shared database when
// the page runs in claude.ai; otherwise in this browser. Writes are debounced
// and only changed documents are sent.

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata?: { fromCache: boolean; hasPendingWrites: boolean };
}
interface QuerySnap {
  docs: DocSnap[];
  metadata?: { fromCache: boolean; hasPendingWrites: boolean };
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface CollRef {
  doc(id?: string): DocRef;
  get(): Promise<QuerySnap>;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string }) => void): () => void;
}
interface DB {
  collection(path: string): CollRef;
}

const LOCAL_KEY = 'fp:local-v1';

let db: DB | null = null;
let mode: 'cloud' | 'local' = 'local';
let writable = true;
const lastSaved = new Map<string, string>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const writing = new Map<string, Promise<void>>();

function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function roomDoc(r: Room): Room {
  return clean({ ...r, photos: r.photos.map(persistableRef), underlay: r.underlay ? { ...r.underlay, asset: persistableRef(r.underlay.asset) } : undefined });
}

function entryDoc(e: CatalogEntry): CatalogEntry {
  return clean({ ...e, image: e.image ? persistableRef(e.image) : undefined });
}

function withUrls<T extends Room | CatalogEntry>(x: T): T {
  if ('outline' in x) {
    const r = x as Room;
    return { ...r, photos: r.photos.map((p) => ({ ...p, url: assetUrl(p) })), underlay: r.underlay ? { ...r.underlay, asset: { ...r.underlay.asset, url: assetUrl(r.underlay.asset) } } : undefined } as T;
  }
  const e = x as CatalogEntry;
  return (e.image ? { ...e, image: { ...e.image, url: assetUrl(e.image) } } : e) as T;
}

function allRefs(rooms: Room[], custom: CatalogEntry[]): AssetRef[] {
  const out: AssetRef[] = [];
  for (const r of rooms) {
    out.push(...r.photos);
    if (r.underlay) out.push(r.underlay.asset);
  }
  for (const e of custom) if (e.image) out.push(e.image);
  return out;
}

function readLocal(): { rooms: Room[]; layouts: Layout[]; custom: CatalogEntry[] } | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalSnapshot() {
  const s = useStore.getState();
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ rooms: Object.values(s.rooms).map(roomDoc), layouts: Object.values(s.layouts), custom: Object.values(s.custom).map(entryDoc) }));
  } catch {
    /* quota or blocked storage: keep going in memory */
  }
}

async function getDb(): Promise<DB | null> {
  try {
    if (typeof window.claude?.use !== 'function') return null;
    return ((await window.claude.use('db')) as DB | null) ?? null;
  } catch {
    return null;
  }
}

async function loadCloud(d: DB) {
  const [rooms, layouts, catalog] = await Promise.all([d.collection('rooms').get(), d.collection('layouts').get(), d.collection('catalog').get()]);
  const r = rooms.docs.filter((x) => x.exists).map((x) => x.data() as unknown as Room);
  const l = layouts.docs.filter((x) => x.exists).map((x) => x.data() as unknown as Layout);
  const c = catalog.docs.filter((x) => x.exists).map((x) => x.data() as unknown as CatalogEntry);
  return { rooms: r, layouts: l, custom: c };
}

export interface BootResult {
  mode: 'cloud' | 'local';
  empty: boolean;
}

/** Load saved rooms. Calls `fallback` to create example content when nothing is stored locally. */
export async function boot(fallback: () => { rooms: Room[]; layouts: Layout[] }): Promise<BootResult> {
  db = await getDb();
  if (db) {
    mode = 'cloud';
    try {
      const data = await loadCloud(db);
      data.rooms.forEach((r) => data.layouts.filter((l) => l.roomId === r.id).forEach((l) => lastSaved.set(`layouts/${l.id}`, JSON.stringify(clean(l)))));
      data.rooms.forEach((r) => lastSaved.set(`rooms/${r.id}`, JSON.stringify(roomDoc(r))));
      data.custom.forEach((e) => lastSaved.set(`catalog/${e.id}`, JSON.stringify(entryDoc(e))));
      init(data.rooms.map(withUrls), data.layouts, data.custom.map(withUrls), 'cloud');
      subscribeCloud(db);
      startAutosave();
      return { mode, empty: data.rooms.length === 0 };
    } catch {
      toast('Couldn’t reach saved rooms right now — working locally for this visit.', 'warn');
    }
  }
  mode = 'local';
  const local = readLocal();
  if (local && local.rooms.length) {
    await hydrateLocal(allRefs(local.rooms, local.custom));
    init(local.rooms.map(withUrls), local.layouts, local.custom.map(withUrls), 'local');
  } else {
    const f = fallback();
    init(f.rooms, f.layouts, [], 'local');
  }
  startAutosave();
  return { mode, empty: false };
}

function subscribeCloud(d: DB) {
  const apply = (kind: 'rooms' | 'layouts' | 'catalog', snap: QuerySnap) => {
    if (snap.metadata?.hasPendingWrites) return;
    const s = useStore.getState();
    const patch: Partial<ReturnType<typeof useStore.getState>> = {};
    if (kind === 'rooms') {
      const rooms = { ...s.rooms };
      let changed = false;
      for (const doc of snap.docs) {
        if (!doc.exists) continue;
        const r = doc.data() as unknown as Room;
        const key = `rooms/${r.id}`;
        const json = JSON.stringify(roomDoc(r));
        if (pendingTimers.has(key) || lastSaved.get(key) === json) continue;
        const cur = rooms[r.id];
        if (cur && cur.updatedAt >= r.updatedAt) continue;
        rooms[r.id] = withUrls(r);
        lastSaved.set(key, json);
        changed = true;
      }
      if (changed) patch.rooms = rooms;
    } else if (kind === 'layouts') {
      const layouts = { ...s.layouts };
      let changed = false;
      for (const doc of snap.docs) {
        if (!doc.exists) continue;
        const l = doc.data() as unknown as Layout;
        const key = `layouts/${l.id}`;
        const json = JSON.stringify(clean(l));
        if (pendingTimers.has(key) || lastSaved.get(key) === json) continue;
        const cur = layouts[l.id];
        if (cur && cur.updatedAt >= l.updatedAt) continue;
        if (s.dragging) continue;
        layouts[l.id] = l;
        lastSaved.set(key, json);
        changed = true;
      }
      if (changed) patch.layouts = layouts;
    } else {
      const custom = { ...s.custom };
      let changed = false;
      for (const doc of snap.docs) {
        if (!doc.exists) continue;
        const e = doc.data() as unknown as CatalogEntry;
        if (!custom[e.id]) {
          custom[e.id] = withUrls(e);
          changed = true;
        }
      }
      if (changed) patch.custom = custom;
    }
    if (Object.keys(patch).length) useStore.setState(patch);
  };
  for (const kind of ['rooms', 'layouts', 'catalog'] as const) {
    d.collection(kind).onSnapshot(
      (snap) => apply(kind, snap),
      () => {
        /* the store keeps working; writes will surface errors */
      },
    );
  }
}

function schedule(key: string, write: () => Promise<void>) {
  const t = pendingTimers.get(key);
  if (t) clearTimeout(t);
  pendingTimers.set(
    key,
    setTimeout(async () => {
      pendingTimers.delete(key);
      const prev = writing.get(key) ?? Promise.resolve();
      const next = prev.then(write).catch((e: { code?: string }) => {
        if (e?.code === 'invalid_argument' && writable) {
          writable = false;
          toast('You can look around, but changes won’t be saved — ask the owner for edit access.', 'warn');
        } else if (e?.code === 'quota_exceeded') toast('The room store is full. Delete an old layout to keep saving.', 'error');
      });
      writing.set(key, next);
      await next;
    }, 700),
  );
}

let started = false;
function startAutosave() {
  if (started) return;
  started = true;
  let prev = useStore.getState();
  useStore.subscribe((s) => {
    if (s.rooms === prev.rooms && s.layouts === prev.layouts && s.custom === prev.custom) {
      prev = s;
      return;
    }
    const was = prev;
    prev = s;
    if (s.dragging) return; // save when the gesture ends
    if (mode === 'local') {
      scheduleLocal();
      return;
    }
    if (!db || !writable) return;
    const d = db;
    for (const r of Object.values(s.rooms)) {
      if (was.rooms[r.id] === r && !was.dragging) continue;
      const doc = roomDoc(r);
      const json = JSON.stringify(doc);
      const key = `rooms/${r.id}`;
      if (lastSaved.get(key) === json) continue;
      schedule(key, async () => {
        await d.collection('rooms').doc(r.id).set(doc as unknown as Record<string, unknown>);
        lastSaved.set(key, json);
      });
    }
    for (const l of Object.values(s.layouts)) {
      if (was.layouts[l.id] === l && !was.dragging) continue;
      const doc = clean(l);
      const json = JSON.stringify(doc);
      const key = `layouts/${l.id}`;
      if (lastSaved.get(key) === json) continue;
      schedule(key, async () => {
        await d.collection('layouts').doc(l.id).set(doc as unknown as Record<string, unknown>);
        lastSaved.set(key, json);
      });
    }
    for (const e of Object.values(s.custom)) {
      if (was.custom[e.id] === e) continue;
      const doc = entryDoc(e);
      const json = JSON.stringify(doc);
      const key = `catalog/${e.id}`;
      if (lastSaved.get(key) === json) continue;
      schedule(key, async () => {
        await d.collection('catalog').doc(e.id).set(doc as unknown as Record<string, unknown>);
        lastSaved.set(key, json);
      });
    }
    while (deletedLayouts.length) {
      const id = deletedLayouts.shift()!;
      schedule(`layouts/${id}`, () => d.collection('layouts').doc(id).delete());
    }
    while (deletedRooms.length) {
      const id = deletedRooms.shift()!;
      schedule(`rooms/${id}`, () => d.collection('rooms').doc(id).delete());
    }
  });
}

let localTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleLocal() {
  if (localTimer) clearTimeout(localTimer);
  localTimer = setTimeout(writeLocalSnapshot, 500);
}

export function storageMode() {
  return mode;
}

export function isWritable() {
  return writable;
}
