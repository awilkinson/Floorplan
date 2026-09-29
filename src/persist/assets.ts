import { nanoid } from 'nanoid';
import type { AssetRef } from '../model/types';

// Photos, plans and product images. In claude.ai they go to the artifact's
// asset store (shared with everyone the page is shared with); elsewhere they
// stay in this browser's IndexedDB.

interface AssetsNS {
  upload(blob: Blob, options?: { type?: string }): Promise<{ id: string; url: string; sizeBytes: number; contentType: string }>;
  delete(ref: string): Promise<{ deleted: boolean }>;
}

let assetsP: Promise<AssetsNS | null> | null = null;
const localUrls = new Map<string, string>();

export function cloudAssets(): Promise<AssetsNS | null> {
  if (!assetsP) {
    assetsP = (async () => {
      try {
        if (typeof window.claude?.use !== 'function') return null;
        return ((await window.claude.use('assets')) as AssetsNS | null) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return assetsP;
}

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('floorplan-assets', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbPut(id: string, blob: Blob) {
  const db = await idb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(id: string): Promise<Blob | null> {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('blobs', 'readonly');
    const r = tx.objectStore('blobs').get(id);
    r.onsuccess = () => res((r.result as Blob) ?? null);
    r.onerror = () => res(null);
  });
}

export async function uploadImage(blob: Blob, kind: AssetRef['kind'], meta: { width?: number; height?: number; caption?: string } = {}): Promise<AssetRef> {
  const cloud = await cloudAssets();
  if (cloud) {
    const type = blob.type && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type) ? blob.type : 'image/jpeg';
    const r = await cloud.upload(blob, { type });
    return { id: r.id, url: r.url, kind, ...meta };
  }
  const id = `local-${nanoid(12)}`;
  try {
    await idbPut(id, blob);
  } catch {
    /* fall back to memory only */
  }
  const url = URL.createObjectURL(blob);
  localUrls.set(id, url);
  return { id, url, kind, ...meta };
}

/** Display URL for a stored asset reference. */
export function assetUrl(ref: AssetRef | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.id.startsWith('local-')) return localUrls.get(ref.id) ?? ref.url;
  if (/^[0-9a-f]{32}$/.test(ref.id)) return `/_blob/${ref.id}`;
  return ref.url;
}

/** Make every local asset reference displayable after a reload. */
export async function hydrateLocal(refs: AssetRef[]) {
  for (const r of refs) {
    if (!r.id.startsWith('local-') || localUrls.has(r.id)) continue;
    try {
      const b = await idbGet(r.id);
      if (b) localUrls.set(r.id, URL.createObjectURL(b));
    } catch {
      /* ignore */
    }
  }
}

/** Strip session-only URLs before a reference is saved. */
export function persistableRef(ref: AssetRef): AssetRef {
  const { url, ...rest } = ref;
  void url;
  return rest;
}
