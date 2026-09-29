import { nanoid } from 'nanoid';
import { FINISH_MAP, FINISHES, SLOT_FAMILIES, type Finish } from '../catalog/finishes';
import { GENERATORS } from '../catalog/generators';
import type { AssetRef, CatalogEntry, Category } from '../model/types';
import { inch } from '../model/units';
import { getAI } from './client';
import { productPrompt } from './prompts';

interface RawProduct {
  name?: string;
  brand?: string;
  designer?: string;
  category?: string;
  generator?: string;
  params?: Record<string, unknown>;
  w?: number;
  d?: number;
  h?: number;
  finishes?: Record<string, string>;
  colors?: Record<string, string>;
  styles?: string[];
  price?: string;
  description?: string;
  confidence?: string;
  imageUse?: 'none' | 'rug' | 'art';
  dimensionsSource?: string;
}

const CATEGORIES: Category[] = ['sofa', 'sectional', 'lounge-chair', 'ottoman', 'dining-chair', 'coffee-table', 'side-table', 'dining-table', 'desk', 'console', 'storage', 'bed', 'rug', 'floor-lamp', 'table-lamp', 'plant', 'hifi', 'music', 'baby', 'bench', 'art', 'media', 'office-chair', 'decor'];

const DEFAULT_GEN: Partial<Record<Category, string>> = {
  sofa: 'sofa',
  sectional: 'sectional',
  'lounge-chair': 'loungeChair',
  ottoman: 'ottoman',
  'dining-chair': 'diningChair',
  'coffee-table': 'table',
  'side-table': 'table',
  'dining-table': 'table',
  desk: 'table',
  console: 'table',
  storage: 'storage',
  bed: 'bed',
  rug: 'rug',
  'floor-lamp': 'floorLamp',
  'table-lamp': 'tableLamp',
  plant: 'plant',
  hifi: 'speaker',
  bench: 'bench',
  art: 'art',
  media: 'tv',
  'office-chair': 'officeChair',
};

/** A finish made up on the spot for a color the library doesn't have. */
function customFinish(slot: string, hex: string): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const fam = SLOT_FAMILIES[slot]?.[0] ?? 'fabric';
  const id = `c-${fam}-${hex.slice(1).toLowerCase()}`;
  if (!FINISH_MAP[id]) {
    const base = FINISHES.find((f) => f.family === fam && f.texture) ?? FINISHES.find((f) => f.family === fam);
    const f: Finish = { ...(base ?? { family: fam, roughness: 0.8 }), id, name: `Custom ${hex.toUpperCase()}`, family: fam, color: hex } as Finish;
    FINISHES.push(f);
    FINISH_MAP[id] = f;
  }
  return id;
}

export interface ImportResult {
  entry: CatalogEntry;
  confidence: string;
  dimensionsSource?: string;
}

export async function importProduct(input: { url?: string; notes?: string; images: Blob[]; image?: AssetRef; signal?: AbortSignal }): Promise<ImportResult> {
  const ai = await getAI();
  if (ai.kind === 'none') throw { code: 'unavailable', message: '' };
  const raw = await ai.json<RawProduct>(productPrompt(input.url, input.notes, input.images.length), { tier: 'default', images: input.images.length ? input.images : undefined, signal: input.signal, cache: false });
  return { entry: toEntry(raw, input), confidence: raw.confidence ?? 'medium', dimensionsSource: raw.dimensionsSource };
}

export function toEntry(raw: RawProduct, input: { url?: string; image?: AssetRef }): CatalogEntry {
  const category = (CATEGORIES.includes(raw.category as Category) ? raw.category : 'decor') as Category;
  const generator = raw.generator && GENERATORS[raw.generator] ? raw.generator : DEFAULT_GEN[category] ?? 'table';
  const finishes: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.finishes ?? {})) if (FINISH_MAP[v]) finishes[k] = v;
  for (const [k, v] of Object.entries(raw.colors ?? {})) {
    const id = customFinish(k, v);
    if (id) finishes[k] = id;
  }
  // make sure every slot the generator uses has something
  const needs: Record<string, string[]> = {
    sofa: ['upholstery', 'pillows', 'legs'],
    sectional: ['upholstery', 'pillows', 'legs'],
    curvedSofa: ['upholstery', 'pillows'],
    quiltedModular: ['upholstery'],
    pleatedLounge: ['upholstery'],
    loungeChair: ['upholstery', 'legs'],
    ottoman: ['upholstery'],
    table: ['top', 'base'],
    storage: ['body', 'fronts', 'legs'],
    floorLamp: ['shade', 'frame', 'base'],
    tableLamp: ['shade', 'base'],
    rug: ['rug'],
    plant: ['pot'],
    speaker: ['cabinet'],
    bed: ['frame', 'upholstery', 'bedding', 'legs'],
    bench: ['frame', 'upholstery'],
    diningChair: ['upholstery', 'frame'],
  };
  const defaults: Record<string, string> = { upholstery: 'linen-natural', pillows: 'linen-white', legs: 'oak-natural', top: 'oak-natural', base: 'oak-natural', body: 'oak-natural', fronts: 'oak-natural', shade: 'shade-linen', frame: 'steel-black', rug: 'rug-oatmeal', pot: 'ceramic-white', cabinet: 'gloss-black', bedding: 'linen-white', seat: 'cane-natural' };
  for (const slot of needs[generator] ?? []) if (!finishes[slot]) finishes[slot] = defaults[slot] ?? 'linen-natural';
  const w = inch(clampIn(raw.w, 4, 400) ?? 36);
  const d = inch(clampIn(raw.d, 1, 400) ?? 30);
  const h = inch(clampIn(raw.h, 0.2, 140) ?? 30);
  const params = { ...(raw.params ?? {}) } as Record<string, unknown>;
  const useImage = raw.imageUse === 'rug' || category === 'rug' ? 'rug' : raw.imageUse === 'art' || category === 'art' ? 'art' : 'none';
  if (useImage === 'art' && input.image) params.image = 'asset';
  return {
    id: `c-${nanoid(8)}`,
    name: (raw.name || 'New piece').slice(0, 60),
    brand: raw.brand || undefined,
    designer: raw.designer || undefined,
    category,
    generator,
    params,
    w,
    d,
    h,
    finishes,
    styles: (raw.styles ?? []).filter((s) => typeof s === 'string').slice(0, 3),
    price: raw.price || undefined,
    url: input.url,
    description: raw.description,
    custom: true,
    resizable: true,
    image: useImage !== 'none' ? input.image : undefined,
    mount: category === 'art' || category === 'media' ? 'wall' : category === 'table-lamp' ? 'surface' : undefined,
    tags: useImage === 'rug' ? ['image-rug'] : undefined,
  };
}

function clampIn(v: unknown, lo: number, hi: number): number | undefined {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return undefined;
  return Math.max(lo, Math.min(hi, n));
}
