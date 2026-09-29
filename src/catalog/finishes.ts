// The finish library: every surface a piece can be made of. Colors are sRGB hex.

export type FinishFamily =
  | 'fabric'
  | 'leather'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'glass'
  | 'lacquer'
  | 'woven'
  | 'ceramic'
  | 'shade'
  | 'speaker'
  | 'plastic'
  | 'rug'
  | 'foliage'
  | 'special';

export type TextureKind =
  | 'none'
  | 'boucle'
  | 'weave'
  | 'linen'
  | 'velvet'
  | 'leather'
  | 'wood'
  | 'wood-dark'
  | 'burl'
  | 'travertine'
  | 'marble'
  | 'terrazzo'
  | 'cane'
  | 'rattan'
  | 'papercord'
  | 'paper'
  | 'brushed';

export interface Finish {
  id: string;
  name: string;
  family: FinishFamily;
  color: string;
  roughness: number;
  metalness?: number;
  texture?: TextureKind;
  /** Texture repeat size in meters. */
  texScale?: number;
  /** Fabric sheen (velvet, mohair). */
  sheen?: number;
  sheenColor?: string;
  /** Glass: 0..1 opacity. */
  opacity?: number;
  /** Lamp shades glow when lit. */
  translucent?: boolean;
  clearcoat?: number;
  /** Colors for patterned finishes (rugs). */
  palette?: string[];
  pattern?: string;
}

const F = (f: Finish) => f;

export const FINISHES: Finish[] = [
  // Fabrics
  F({ id: 'boucle-ivory', name: 'Ivory bouclé', family: 'fabric', color: '#EEE8DC', roughness: 0.95, texture: 'boucle', texScale: 0.08 }),
  F({ id: 'boucle-oat', name: 'Oat bouclé', family: 'fabric', color: '#D9CDB8', roughness: 0.95, texture: 'boucle', texScale: 0.08 }),
  F({ id: 'boucle-stone', name: 'Stone bouclé', family: 'fabric', color: '#B9B1A4', roughness: 0.95, texture: 'boucle', texScale: 0.08 }),
  F({ id: 'linen-white', name: 'White linen', family: 'fabric', color: '#F1EEE7', roughness: 0.9, texture: 'linen', texScale: 0.05 }),
  F({ id: 'linen-natural', name: 'Natural linen', family: 'fabric', color: '#D6C9B1', roughness: 0.9, texture: 'linen', texScale: 0.05 }),
  F({ id: 'linen-flax', name: 'Flax linen', family: 'fabric', color: '#BFAE8E', roughness: 0.9, texture: 'linen', texScale: 0.05 }),
  F({ id: 'cream-canvas', name: 'Cream canvas', family: 'fabric', color: '#ECE4D4', roughness: 0.92, texture: 'weave', texScale: 0.04 }),
  F({ id: 'wool-camel', name: 'Camel wool', family: 'fabric', color: '#B58A5A', roughness: 0.92, texture: 'weave', texScale: 0.04 }),
  F({ id: 'wool-charcoal', name: 'Charcoal wool', family: 'fabric', color: '#48484A', roughness: 0.94, texture: 'weave', texScale: 0.04 }),
  F({ id: 'wool-sand', name: 'Sand wool', family: 'fabric', color: '#CDBB9C', roughness: 0.93, texture: 'weave', texScale: 0.04 }),
  F({ id: 'wool-olive', name: 'Olive wool', family: 'fabric', color: '#6F6A45', roughness: 0.93, texture: 'weave', texScale: 0.04 }),
  F({ id: 'wool-ink', name: 'Ink wool', family: 'fabric', color: '#27324A', roughness: 0.93, texture: 'weave', texScale: 0.04 }),
  F({ id: 'mohair-sand', name: 'Sand mohair', family: 'fabric', color: '#C8B08C', roughness: 0.85, texture: 'velvet', texScale: 0.05, sheen: 0.6, sheenColor: '#F5E6CC' }),
  F({ id: 'velvet-moss', name: 'Moss velvet', family: 'fabric', color: '#5B6340', roughness: 0.8, texture: 'velvet', texScale: 0.05, sheen: 0.9, sheenColor: '#A9B27A' }),
  F({ id: 'velvet-rust', name: 'Rust velvet', family: 'fabric', color: '#9A4E2C', roughness: 0.8, texture: 'velvet', texScale: 0.05, sheen: 0.9, sheenColor: '#E0936A' }),
  F({ id: 'velvet-ink', name: 'Ink velvet', family: 'fabric', color: '#1F2A44', roughness: 0.8, texture: 'velvet', texScale: 0.05, sheen: 0.9, sheenColor: '#5E73A8' }),
  F({ id: 'velvet-blush', name: 'Blush velvet', family: 'fabric', color: '#D2A89A', roughness: 0.8, texture: 'velvet', texScale: 0.05, sheen: 0.8, sheenColor: '#F4D2C6' }),
  F({ id: 'chenille-oyster', name: 'Oyster chenille', family: 'fabric', color: '#D8D2C5', roughness: 0.93, texture: 'boucle', texScale: 0.06 }),
  F({ id: 'terry-ochre', name: 'Ochre terry', family: 'fabric', color: '#C18C35', roughness: 0.95, texture: 'boucle', texScale: 0.06 }),
  F({ id: 'cotton-sky', name: 'Sky cotton', family: 'fabric', color: '#9FB6C8', roughness: 0.9, texture: 'weave', texScale: 0.04 }),
  F({ id: 'cotton-white', name: 'White cotton', family: 'fabric', color: '#F4F3EF', roughness: 0.9, texture: 'weave', texScale: 0.04 }),
  F({ id: 'stripe-ticking', name: 'Ticking stripe', family: 'fabric', color: '#E7E1D6', roughness: 0.9, texture: 'weave', texScale: 0.04 }),

  // Leather
  F({ id: 'leather-tobacco', name: 'Tobacco leather', family: 'leather', color: '#5A3A26', roughness: 0.55, texture: 'leather', texScale: 0.12, clearcoat: 0.15 }),
  F({ id: 'leather-cognac', name: 'Cognac leather', family: 'leather', color: '#9A5A2E', roughness: 0.5, texture: 'leather', texScale: 0.12, clearcoat: 0.2 }),
  F({ id: 'leather-chocolate', name: 'Chocolate leather', family: 'leather', color: '#3A261C', roughness: 0.55, texture: 'leather', texScale: 0.12, clearcoat: 0.15 }),
  F({ id: 'leather-black', name: 'Black leather', family: 'leather', color: '#1C1B1B', roughness: 0.45, texture: 'leather', texScale: 0.12, clearcoat: 0.25 }),
  F({ id: 'leather-cream', name: 'Cream leather', family: 'leather', color: '#E6DCC8', roughness: 0.5, texture: 'leather', texScale: 0.12, clearcoat: 0.15 }),
  F({ id: 'suede-sand', name: 'Sand suede', family: 'leather', color: '#B89A74', roughness: 0.95, texture: 'velvet', texScale: 0.08, sheen: 0.4, sheenColor: '#E3CCA8' }),

  // Wood
  F({ id: 'oak-white', name: 'White oak', family: 'wood', color: '#CDB38E', roughness: 0.62, texture: 'wood', texScale: 0.9 }),
  F({ id: 'oak-natural', name: 'Natural oak', family: 'wood', color: '#B88E5E', roughness: 0.6, texture: 'wood', texScale: 0.9 }),
  F({ id: 'oak-smoked', name: 'Smoked oak', family: 'wood', color: '#6B4E36', roughness: 0.6, texture: 'wood', texScale: 0.9 }),
  F({ id: 'walnut', name: 'Walnut', family: 'wood', color: '#6A4430', roughness: 0.55, texture: 'wood', texScale: 0.9 }),
  F({ id: 'teak', name: 'Teak', family: 'wood', color: '#9C6A3E', roughness: 0.58, texture: 'wood', texScale: 0.9 }),
  F({ id: 'ash-black', name: 'Black-stained ash', family: 'wood', color: '#2A2624', roughness: 0.6, texture: 'wood', texScale: 0.9 }),
  F({ id: 'cherry', name: 'Cherry', family: 'wood', color: '#8E4F33', roughness: 0.55, texture: 'wood', texScale: 0.9 }),
  F({ id: 'maple', name: 'Maple', family: 'wood', color: '#D9C29A', roughness: 0.6, texture: 'wood', texScale: 0.9 }),
  F({ id: 'burl', name: 'Walnut burl', family: 'wood', color: '#7A5237', roughness: 0.35, texture: 'burl', texScale: 0.6, clearcoat: 0.4 }),
  F({ id: 'elm-reclaimed', name: 'Reclaimed elm', family: 'wood', color: '#8A6C4F', roughness: 0.75, texture: 'wood', texScale: 0.9 }),

  // Stone
  F({ id: 'travertine', name: 'Travertine', family: 'stone', color: '#D8C7AA', roughness: 0.7, texture: 'travertine', texScale: 1.2 }),
  F({ id: 'travertine-honed', name: 'Honed noce travertine', family: 'stone', color: '#B69A78', roughness: 0.7, texture: 'travertine', texScale: 1.2 }),
  F({ id: 'marble-calacatta', name: 'Calacatta marble', family: 'stone', color: '#EFEDE8', roughness: 0.25, texture: 'marble', texScale: 1.4, clearcoat: 0.4 }),
  F({ id: 'marble-nero', name: 'Nero Marquina', family: 'stone', color: '#1E1D1D', roughness: 0.25, texture: 'marble', texScale: 1.4, clearcoat: 0.4 }),
  F({ id: 'marble-verde', name: 'Verde Alpi', family: 'stone', color: '#2F4638', roughness: 0.25, texture: 'marble', texScale: 1.4, clearcoat: 0.4 }),
  F({ id: 'marble-rosso', name: 'Rosso Levanto', family: 'stone', color: '#6E3530', roughness: 0.25, texture: 'marble', texScale: 1.4, clearcoat: 0.4 }),
  F({ id: 'limestone', name: 'Limestone', family: 'stone', color: '#E3DDD1', roughness: 0.8, texture: 'travertine', texScale: 1.6 }),
  F({ id: 'terrazzo', name: 'Terrazzo', family: 'stone', color: '#E8E3DA', roughness: 0.5, texture: 'terrazzo', texScale: 0.6 }),
  F({ id: 'stone-white', name: 'White stone', family: 'stone', color: '#EDEBE6', roughness: 0.55, texture: 'travertine', texScale: 2 }),
  F({ id: 'soapstone', name: 'Soapstone', family: 'stone', color: '#3C3F3E', roughness: 0.6, texture: 'marble', texScale: 1.4 }),

  // Metal
  F({ id: 'brass', name: 'Aged brass', family: 'metal', color: '#B8914E', roughness: 0.35, metalness: 1, texture: 'brushed', texScale: 0.2 }),
  F({ id: 'bronze', name: 'Dark bronze', family: 'metal', color: '#4A3A2C', roughness: 0.4, metalness: 1 }),
  F({ id: 'chrome', name: 'Polished chrome', family: 'metal', color: '#D8DADC', roughness: 0.08, metalness: 1 }),
  F({ id: 'nickel', name: 'Brushed nickel', family: 'metal', color: '#B9B7B1', roughness: 0.3, metalness: 1, texture: 'brushed', texScale: 0.2 }),
  F({ id: 'steel-black', name: 'Blackened steel', family: 'metal', color: '#1E1E1F', roughness: 0.45, metalness: 0.7 }),
  F({ id: 'steel-olive', name: 'Olive steel', family: 'metal', color: '#5E6045', roughness: 0.55, metalness: 0.3 }),
  F({ id: 'powder-white', name: 'White powder coat', family: 'metal', color: '#EDEDEA', roughness: 0.5, metalness: 0.1 }),
  F({ id: 'aluminum', name: 'Polished aluminum', family: 'metal', color: '#C9CBCC', roughness: 0.2, metalness: 1 }),
  F({ id: 'usm-red', name: 'Ruby red', family: 'metal', color: '#9E2A26', roughness: 0.35, metalness: 0.4 }),
  F({ id: 'usm-white', name: 'Pure white', family: 'metal', color: '#EFEFEC', roughness: 0.35, metalness: 0.2 }),
  F({ id: 'usm-graphite', name: 'Graphite black', family: 'metal', color: '#252628', roughness: 0.35, metalness: 0.4 }),

  // Glass
  F({ id: 'glass-clear', name: 'Clear glass', family: 'glass', color: '#DDEAEA', roughness: 0.02, opacity: 0.25 }),
  F({ id: 'glass-smoked', name: 'Smoked glass', family: 'glass', color: '#3A3B3C', roughness: 0.03, opacity: 0.6 }),
  F({ id: 'glass-bronze', name: 'Bronze glass', family: 'glass', color: '#6C5238', roughness: 0.03, opacity: 0.55 }),

  // Lacquer / paint
  F({ id: 'lacquer-white', name: 'White lacquer', family: 'lacquer', color: '#F2F1EC', roughness: 0.28, clearcoat: 0.6 }),
  F({ id: 'lacquer-black', name: 'Black lacquer', family: 'lacquer', color: '#141414', roughness: 0.2, clearcoat: 0.8 }),
  F({ id: 'lacquer-oxblood', name: 'Oxblood lacquer', family: 'lacquer', color: '#5A1F1E', roughness: 0.22, clearcoat: 0.8 }),
  F({ id: 'lacquer-sage', name: 'Sage lacquer', family: 'lacquer', color: '#8E9A83', roughness: 0.3, clearcoat: 0.5 }),
  F({ id: 'paint-white', name: 'Painted white', family: 'lacquer', color: '#F3F1EC', roughness: 0.55 }),
  F({ id: 'paint-cream', name: 'Painted cream', family: 'lacquer', color: '#E9E1D0', roughness: 0.55 }),

  // Woven
  F({ id: 'cane-natural', name: 'Natural cane', family: 'woven', color: '#D2B27C', roughness: 0.7, texture: 'cane', texScale: 0.09 }),
  F({ id: 'rattan', name: 'Rattan', family: 'woven', color: '#C29A62', roughness: 0.7, texture: 'rattan', texScale: 0.12 }),
  F({ id: 'woven-leather', name: 'Woven leather', family: 'woven', color: '#9A6B45', roughness: 0.55, texture: 'rattan', texScale: 0.14 }),
  F({ id: 'papercord', name: 'Paper cord', family: 'woven', color: '#D8C49F', roughness: 0.85, texture: 'papercord', texScale: 0.06 }),
  F({ id: 'jute', name: 'Jute', family: 'woven', color: '#B69B6F', roughness: 0.95, texture: 'rattan', texScale: 0.1 }),

  // Ceramic
  F({ id: 'ceramic-white', name: 'White ceramic', family: 'ceramic', color: '#F1EFEA', roughness: 0.35 }),
  F({ id: 'ceramic-cream', name: 'Cream stoneware', family: 'ceramic', color: '#E3D8C4', roughness: 0.6 }),
  F({ id: 'ceramic-terracotta', name: 'Terracotta', family: 'ceramic', color: '#B0643F', roughness: 0.85 }),
  F({ id: 'ceramic-black', name: 'Black stoneware', family: 'ceramic', color: '#262422', roughness: 0.7 }),
  F({ id: 'ceramic-sage', name: 'Sage glaze', family: 'ceramic', color: '#9DA88F', roughness: 0.4 }),
  F({ id: 'concrete', name: 'Concrete', family: 'ceramic', color: '#A9A59E', roughness: 0.9, texture: 'travertine', texScale: 1.5 }),

  // Lamp shades
  F({ id: 'shade-linen', name: 'Linen shade', family: 'shade', color: '#E8DDCB', roughness: 0.95, texture: 'linen', texScale: 0.05, translucent: true }),
  F({ id: 'shade-paper', name: 'Washi paper', family: 'shade', color: '#F3EEE2', roughness: 0.95, texture: 'paper', texScale: 0.3, translucent: true }),
  F({ id: 'shade-white', name: 'White shade', family: 'shade', color: '#F5F4F0', roughness: 0.9, translucent: true }),
  F({ id: 'shade-opal', name: 'Opal glass', family: 'shade', color: '#F7F5EF', roughness: 0.15, translucent: true }),

  // Speaker cabinets
  F({ id: 'gloss-black', name: 'Gloss black', family: 'speaker', color: '#0E0E0F', roughness: 0.12, clearcoat: 1 }),
  F({ id: 'gloss-white', name: 'Satin white', family: 'speaker', color: '#EDEDEA', roughness: 0.2, clearcoat: 0.8 }),
  F({ id: 'rosenut', name: 'Rosenut', family: 'speaker', color: '#6E3B28', roughness: 0.25, texture: 'wood', texScale: 0.8, clearcoat: 0.8 }),

  // Plastics
  F({ id: 'plastic-white', name: 'White', family: 'plastic', color: '#F2F2EF', roughness: 0.4 }),
  F({ id: 'plastic-black', name: 'Black', family: 'plastic', color: '#1E1E1E', roughness: 0.4 }),
  F({ id: 'plastic-pink', name: 'Blush', family: 'plastic', color: '#E4B7B5', roughness: 0.5 }),
  F({ id: 'plastic-sage', name: 'Sage', family: 'plastic', color: '#AEB9A3', roughness: 0.5 }),

  // Rug colorways (pattern + palette)
  F({ id: 'rug-abstract-lake', name: 'Lake abstract', family: 'rug', color: '#E7DFC9', roughness: 1, pattern: 'abstract', palette: ['#EAE2CC', '#C9A54A', '#5E6B7C', '#8D97A3', '#2F3A4A'] }),
  F({ id: 'rug-beni', name: 'Beni Ourain', family: 'rug', color: '#EEE9DF', roughness: 1, pattern: 'beni', palette: ['#EFEAE0', '#2B2927'] }),
  F({ id: 'rug-oatmeal', name: 'Oatmeal wool', family: 'rug', color: '#D8CDB8', roughness: 1, pattern: 'solid', palette: ['#D8CDB8', '#CFC3AC'] }),
  F({ id: 'rug-ivory', name: 'Ivory wool', family: 'rug', color: '#EDE7DA', roughness: 1, pattern: 'solid', palette: ['#EDE7DA', '#E4DDCC'] }),
  F({ id: 'rug-charcoal', name: 'Charcoal wool', family: 'rug', color: '#4A4846', roughness: 1, pattern: 'solid', palette: ['#4A4846', '#403E3C'] }),
  F({ id: 'rug-oushak', name: 'Faded Oushak', family: 'rug', color: '#D6B79A', roughness: 1, pattern: 'persian', palette: ['#D9BFA2', '#B77E62', '#8C9A8E', '#E8D8C0', '#6E5747'] }),
  F({ id: 'rug-persian-red', name: 'Vintage Heriz', family: 'rug', color: '#8E3A2F', roughness: 1, pattern: 'persian', palette: ['#8E3A2F', '#2C3550', '#D7C1A0', '#B98B52', '#4F2A24'] }),
  F({ id: 'rug-jute', name: 'Jute herringbone', family: 'rug', color: '#B89C6C', roughness: 1, pattern: 'jute', palette: ['#BFA273', '#A88D61'] }),
  F({ id: 'rug-border', name: 'Bordered wool', family: 'rug', color: '#DCD2BF', roughness: 1, pattern: 'border', palette: ['#DCD2BF', '#6B5846'] }),
  F({ id: 'rug-stripe', name: 'Striped flatweave', family: 'rug', color: '#E7E0D2', roughness: 1, pattern: 'stripes', palette: ['#E7E0D2', '#3F4652', '#B98A4A'] }),
  F({ id: 'rug-checker', name: 'Checkerboard', family: 'rug', color: '#E2D6BE', roughness: 1, pattern: 'checker', palette: ['#E2D6BE', '#8B7B61'] }),
  F({ id: 'rug-organic-moss', name: 'Moss organic', family: 'rug', color: '#8E8F6A', roughness: 1, pattern: 'organic', palette: ['#8E8F6A', '#C9C3A6', '#5F6148'] }),
  F({ id: 'rug-play', name: 'Play mat', family: 'rug', color: '#EDE6DA', roughness: 0.9, pattern: 'play', palette: ['#EDE6DA', '#D9CFBF'] }),

  // Plant / special
  F({ id: 'foliage', name: 'Foliage', family: 'foliage', color: '#3E5A2E', roughness: 0.6 }),
  F({ id: 'foliage-olive', name: 'Olive foliage', family: 'foliage', color: '#7D8A63', roughness: 0.7 }),
  F({ id: 'foliage-fir', name: 'Fir', family: 'foliage', color: '#233C2A', roughness: 0.8 }),
];

export const FINISH_MAP: Record<string, Finish> = Object.fromEntries(FINISHES.map((f) => [f.id, f]));

export function finish(id: string | undefined, fallback = 'linen-natural'): Finish {
  if (id && !FINISH_MAP[id]) {
    // custom colors made by the importer: c-<family>-<hex>
    const m = id.match(/^c-([a-z]+)-([0-9a-f]{6})$/);
    if (m) {
      const fam = m[1] as FinishFamily;
      const base = FINISHES.find((f) => f.family === fam && f.texture) ?? FINISHES.find((f) => f.family === fam);
      const f: Finish = { ...(base ?? { roughness: 0.8 }), id, name: `Custom #${m[2].toUpperCase()}`, family: fam, color: `#${m[2]}` } as Finish;
      FINISHES.push(f);
      FINISH_MAP[id] = f;
    }
  }
  return (id && FINISH_MAP[id]) || FINISH_MAP[fallback];
}

/** Which finish families each material slot accepts. */
export const SLOT_FAMILIES: Record<string, FinishFamily[]> = {
  upholstery: ['fabric', 'leather'],
  cushions: ['fabric', 'leather'],
  pillows: ['fabric', 'leather'],
  seat: ['fabric', 'leather', 'woven', 'wood'],
  frame: ['wood', 'metal', 'lacquer'],
  legs: ['wood', 'metal', 'lacquer'],
  base: ['wood', 'metal', 'stone', 'lacquer', 'ceramic'],
  top: ['wood', 'stone', 'glass', 'lacquer'],
  body: ['wood', 'lacquer', 'metal'],
  fronts: ['wood', 'lacquer', 'woven', 'metal'],
  shade: ['shade'],
  pot: ['ceramic', 'stone', 'woven', 'metal'],
  cabinet: ['speaker', 'wood', 'lacquer'],
  metal: ['metal'],
  rug: ['rug'],
  bedding: ['fabric'],
  panel: ['woven', 'wood', 'fabric', 'lacquer'],
  shell: ['wood', 'plastic', 'lacquer', 'fabric', 'leather'],
  accent: ['fabric', 'leather', 'metal', 'wood', 'lacquer', 'ceramic'],
  plastic: ['plastic'],
  finish: ['wood', 'lacquer'],
};

export function finishesForSlot(slot: string): Finish[] {
  const fams = SLOT_FAMILIES[slot] ?? ['fabric', 'wood', 'metal'];
  return FINISHES.filter((f) => fams.includes(f.family));
}
