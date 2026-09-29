import { nanoid } from 'nanoid';
import { CATALOG_MAP } from '../catalog/catalog';
import { FINISH_MAP } from '../catalog/finishes';
import { normalizeOutline, walls, rotationFacingInto } from '../model/geometry';
import type { AssetRef, CatalogEntry, FloorKind, Item, Layout, Opening, OpeningKind, Room, RoomKind } from '../model/types';
import { bearingToRotation, inch } from '../model/units';
import { getAI } from './client';
import { roomScanPrompt } from './prompts';
import { resolveRef, settle } from './solver';

export interface ScanRaw {
  name?: string;
  kind?: string;
  outline?: [number, number][];
  ceiling?: number;
  ceilingStyle?: string;
  floor?: string;
  wallColor?: string;
  walls?: { treatment?: string }[];
  outlook?: string;
  openings?: { kind?: string; wall?: number; offset?: number; width?: number; height?: number; transom?: number; sill?: number; swing?: string; hinge?: string; arched?: boolean; glazed?: boolean; label?: string }[];
  fixtures?: { type?: string; wall?: number; offset?: number; width?: number; depth?: number; height?: number; label?: string }[];
  furniture?: { ref?: string; name?: string; x?: number; y?: number; facing?: number; w?: number; d?: number; h?: number; finish?: Record<string, string> }[];
  confidence?: string;
  assumptions?: string[];
  questions?: string[];
}

export interface ScanInput {
  name: string;
  kind: RoomKind;
  photos: Blob[];
  plans: Blob[];
  measurements?: string;
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
}

export async function scanRoom(input: ScanInput, custom: Record<string, CatalogEntry>): Promise<ScanRaw> {
  const ai = await getAI();
  if (ai.kind === 'none') throw { code: 'unavailable', message: '' };
  const lim = await ai.imageLimit();
  const max = lim?.maxCount ?? 8;
  const images = [...input.plans, ...input.photos].slice(0, max);
  const prompt = roomScanPrompt({ name: input.name, kind: input.kind, photos: Math.min(input.photos.length, max - Math.min(input.plans.length, max)), plans: Math.min(input.plans.length, max), measurements: input.measurements }, custom);
  let chars = 0;
  return ai.json<ScanRaw>(prompt, {
    tier: 'complex',
    images,
    cache: false,
    signal: input.signal,
    onText: ({ text }) => {
      chars = text.length;
      if (input.onProgress) {
        const stage = text.includes('"furniture"') ? 'Placing the furniture you have…' : text.includes('"fixtures"') ? 'Adding the built-ins…' : text.includes('"openings"') ? 'Finding the doors and windows…' : 'Measuring the walls…';
        input.onProgress(`${stage} ${chars > 400 ? '' : ''}`);
      }
    },
  });
}

const KINDS: OpeningKind[] = ['door', 'double-door', 'french-door', 'sliding-door', 'pocket-door', 'window', 'opening', 'archway', 'niche'];
const FLOORS: FloorKind[] = ['wood-dark', 'wood-mid', 'wood-light', 'herringbone', 'stone', 'concrete', 'carpet', 'tile'];

/** Build a Room and its as-is Layout from a scan. */
export function scanToRoom(raw: ScanRaw, meta: { name: string; kind: RoomKind; photos: AssetRef[]; plan?: AssetRef; method: 'photos' | 'plan' | 'photos+plan' }, catalog: Record<string, CatalogEntry>): { room: Room; layout: Layout } {
  const now = Date.now();
  const id = `room-${nanoid(6)}`;
  let pts = (raw.outline ?? [])
    .filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]))
    .map(([x, y]) => ({ x: inch(x), y: inch(y) }));
  if (pts.length < 3) pts = [{ x: 0, y: 0 }, { x: inch(180), y: 0 }, { x: inch(180), y: inch(156) }, { x: 0, y: inch(156) }];
  const n = pts.length;
  // Wall indices from Claude refer to its own edge order; keep them valid if we
  // reverse the winding or start the outline at a different corner.
  const reversed = normalizeOutline(pts) !== pts;
  let order = reversed ? pts.map((_, i) => n - 1 - i) : pts.map((_, i) => i);
  let start = 0;
  order.forEach((k, i) => {
    if (pts[k].x + pts[k].y < pts[order[start]].x + pts[order[start]].y) start = i;
  });
  order = [...order.slice(start), ...order.slice(0, start)];
  const edgeMap = new Map<number, { index: number; flip: boolean }>();
  order.forEach((k, j) => {
    if (reversed) edgeMap.set((k - 1 + n) % n, { index: j, flip: true });
    else edgeMap.set(k, { index: j, flip: false });
  });
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const outline = order.map((k) => ({ x: pts[k].x - minX, y: pts[k].y - minY }));
  const mapWall = (wall: number | undefined, offset: number, width: number, lengthOf: (i: number) => number) => {
    const m = edgeMap.get(wall ?? -1);
    if (!m) return null;
    const len = lengthOf(m.index);
    return { wall: m.index, offset: m.flip ? len - offset - width : offset };
  };
  const shell: Room = {
    id,
    name: raw.name?.trim() || meta.name,
    kind: meta.kind,
    outline,
    ceilingHeight: inch(clamp(raw.ceiling, 84, 240) ?? 108),
    wallThickness: inch(6),
    walls: outline.map((_, i) => ({ treatment: (['plain', 'paneled', 'wainscot'].includes(String(raw.walls?.[i]?.treatment)) ? raw.walls?.[i]?.treatment : 'plain') as 'plain' })),
    openings: [],
    fixtures: [],
    finishes: {
      floor: (FLOORS.includes(raw.floor as FloorKind) ? raw.floor : 'wood-mid') as FloorKind,
      wallColor: /^#[0-9a-f]{6}$/i.test(raw.wallColor ?? '') ? raw.wallColor! : '#F1EEE7',
      trimColor: '#F4F2EC',
      baseboard: inch(6),
      crown: true,
      ceiling: { style: (['flat', 'coffered', 'beamed'].includes(String(raw.ceilingStyle)) ? raw.ceilingStyle : 'flat') as 'flat', grid: [4, 3], beamWidth: inch(8), beamDepth: inch(8), potLights: true },
    },
    outlook: (['water', 'garden', 'city', 'none'].includes(String(raw.outlook)) ? raw.outlook : 'garden') as Room['outlook'],
    photos: meta.photos,
    underlay: undefined,
    goals: [],
    notes: [...(raw.assumptions ?? [])].join(' '),
    layoutOrder: [],
    createdAt: now,
    updatedAt: now,
    survey: {
      method: meta.method,
      confidence: (['low', 'medium', 'high'].includes(String(raw.confidence)) ? raw.confidence : 'medium') as 'medium',
      note: meta.method === 'photos' ? 'Estimated from photos. Measure one wall to calibrate everything.' : 'Read from the floor plan.',
    },
  };
  const ws = walls(shell);
  const openings: Opening[] = [];
  for (const o of raw.openings ?? []) {
    const kind = (KINDS.includes(o.kind as OpeningKind) ? o.kind : 'door') as OpeningKind;
    const width = inch(clamp(o.width, 12, 400) ?? 36);
    const mapped = mapWall(o.wall, inch(Number(o.offset ?? 0)), width, (i) => ws[i].length);
    if (!mapped) continue;
    const w = ws[mapped.wall];
    const offset = Math.max(0.02, Math.min(w.length - width - 0.02, mapped.offset));
    if (width >= w.length) continue;
    openings.push({
      id: nanoid(6),
      kind,
      wall: w.index,
      offset,
      width,
      height: inch(clamp(o.height, 20, 160) ?? (kind === 'window' ? 60 : 84)),
      sill: kind === 'window' ? inch(clamp(o.sill, 0, 80) ?? 24) : 0,
      transom: o.transom ? inch(clamp(o.transom, 4, 48) ?? 12) : undefined,
      swing: o.swing === 'out' ? 'out' : 'in',
      hinge: o.hinge === 'end' ? 'end' : 'start',
      archRise: o.arched ? Math.min(width / 2, inch(18)) : undefined,
      glazed: o.glazed ?? (kind === 'french-door' || kind === 'window' || kind === 'sliding-door'),
      lites: kind === 'french-door' ? [1, 1] : undefined,
      frame: 'white',
      label: o.label,
      depth: kind === 'niche' ? inch(16) : undefined,
      niche: kind === 'niche' ? { baseHeight: inch(34), baseStyle: 'panel-doors', shelves: 3, lining: 'oak', lit: true } : undefined,
    });
  }
  shell.openings = openings;
  const fixtures: Item[] = [];
  for (const f of raw.fixtures ?? []) {
    const fw = inch(clamp(f.width, 8, 600) ?? 72);
    const mapped = mapWall(f.wall, inch(Number(f.offset ?? 0)), fw, (i) => ws[i].length);
    if (!mapped) continue;
    const w = ws[mapped.wall];
    const ref = f.type === 'fireplace' ? 'builtin-fireplace' : f.type === 'cabinets' ? 'builtin-cabinets' : f.type === 'window-seat' ? 'builtin-window-seat' : f.type === 'column' ? 'builtin-column' : 'builtin-shelves';
    const e = CATALOG_MAP[ref];
    const width = inch(clamp(f.width, 8, 600) ?? 72);
    const depth = inch(clamp(f.depth, 4, 48) ?? e.d / 0.0254);
    const along = Math.max(0, Math.min(w.length - width, mapped.offset)) + width / 2;
    const rot = rotationFacingInto(w);
    fixtures.push({
      id: nanoid(6),
      ref,
      x: w.a.x + w.dir.x * along + w.normal.x * (depth / 2),
      y: w.a.y + w.dir.y * along + w.normal.y * (depth / 2),
      rotation: rot,
      w: width,
      d: depth,
      h: f.height ? inch(f.height) : undefined,
      fixed: true,
      wall: w.index,
      label: f.label,
      finishes: ref === 'builtin-shelves' ? { fronts: 'paint-white', top: 'oak-white', body: 'paint-white' } : undefined,
    });
  }
  shell.fixtures = fixtures;
  const items: Item[] = [];
  const used = new Set<string>();
  for (const it of raw.furniture ?? []) {
    const e = resolveRef(it.ref ?? '', catalog) ?? resolveRef(it.name ?? '', catalog);
    if (!e || !isFinite(Number(it.x)) || !isFinite(Number(it.y))) continue;
    let iid = e.id.replace(/^own-/, '');
    while (used.has(iid)) iid = `${iid}-${nanoid(3)}`;
    used.add(iid);
    const fin: Record<string, string> = {};
    for (const [k, v] of Object.entries(it.finish ?? {})) if (FINISH_MAP[v]) fin[k] = v;
    items.push({
      id: iid,
      ref: e.id,
      x: inch(Number(it.x)) - minX,
      y: inch(Number(it.y)) - minY,
      rotation: bearingToRotation(Number(it.facing ?? 180)),
      w: it.w ? inch(it.w) : undefined,
      d: it.d ? inch(it.d) : undefined,
      h: it.h ? inch(it.h) : undefined,
      finishes: Object.keys(fin).length ? fin : undefined,
      label: it.name ? `${it.name}` : undefined,
    });
  }
  const settled = settle(shell, items, catalog);
  const layoutId = `${id}~as-is`;
  shell.layoutOrder = [layoutId];
  shell.activeLayoutId = layoutId;
  const layout: Layout = { id: layoutId, roomId: id, name: 'As it is today', direction: 'Current', items: settled.items, source: 'as-is', createdAt: now, updatedAt: now, concept: raw.assumptions?.slice(0, 2).join(' ') };
  if (meta.plan) shell.underlay = { asset: meta.plan, scale: 0.01, x: 0, y: 0, rotation: 0, opacity: 0.4, visible: false };
  return { room: shell, layout };
}

function clamp(v: unknown, lo: number, hi: number): number | undefined {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return undefined;
  return Math.max(lo, Math.min(hi, n));
}

/** A clean rectangle when the owner just wants to type dimensions. */
export function blankRoom(name: string, kind: RoomKind, wIn: number, dIn: number, hIn: number): { room: Room; layout: Layout } {
  return scanToRoom({ name, outline: [[0, 0], [wIn, 0], [wIn, dIn], [0, dIn]], ceiling: hIn, confidence: 'high' }, { name, kind, photos: [], method: 'photos' }, CATALOG_MAP);
}
