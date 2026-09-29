import type { CatalogEntry, Category } from '../model/types';

const I = (n: number) => n * 0.0254;

type Opts = Partial<Omit<CatalogEntry, 'id' | 'name' | 'category' | 'generator' | 'w' | 'd' | 'h' | 'params' | 'finishes' | 'styles'>>;

function e(
  id: string,
  name: string,
  category: Category,
  generator: string,
  size: [number, number, number],
  params: Record<string, unknown>,
  finishes: Record<string, string>,
  styles: string[],
  opts: Opts = {},
): CatalogEntry {
  return { id, name, category, generator, w: I(size[0]), d: I(size[1]), h: I(size[2]), params, finishes, styles, resizable: true, ...opts };
}

export const STYLES: { id: string; name: string; blurb: string }[] = [
  { id: 'warm-minimal', name: 'Warm minimal', blurb: 'White oak, bouclé, travertine, low and calm' },
  { id: 'quiet-luxury', name: 'Italian quiet luxury', blurb: 'Deep modular seating, stone, bronze, tone-on-tone' },
  { id: 'collected', name: 'Collected', blurb: 'Vintage icons, craft, pattern, personality' },
  { id: 'mid-century', name: 'Mid-century', blurb: 'Eames, Saarinen, Wegner, teak and chrome' },
  { id: 'scandi', name: 'Scandinavian', blurb: 'Light woods, paper cord, honest joinery' },
  { id: 'classic', name: 'Classic', blurb: 'Roll arms, wingbacks, Oushaks, symmetry' },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  sofa: 'Sofas',
  sectional: 'Sectionals',
  'lounge-chair': 'Lounge chairs',
  ottoman: 'Ottomans & poufs',
  'dining-chair': 'Dining chairs',
  'coffee-table': 'Coffee tables',
  'side-table': 'Side tables',
  'dining-table': 'Dining tables',
  desk: 'Desks',
  console: 'Consoles',
  storage: 'Storage',
  bed: 'Beds',
  rug: 'Rugs',
  'floor-lamp': 'Floor lamps',
  'table-lamp': 'Table lamps',
  plant: 'Plants',
  hifi: 'Hi-fi',
  music: 'Music',
  baby: 'Baby & kids',
  seasonal: 'Seasonal',
  bench: 'Benches',
  art: 'Art & mirrors',
  media: 'Media',
  'office-chair': 'Desk chairs',
  decor: 'Objects',
  builtin: 'Built-ins',
};

export const CATALOG: CatalogEntry[] = [
  // ---------------------------------------------------------------- Yours
  e('own-sofa', 'Your sofa', 'sofa', 'sofa', [110, 40, 28], { arms: 'track', armW: 0.14, back: 'loose', base: 'plinth', seats: 3, twoTone: true, pillows: 2 }, { upholstery: 'leather-chocolate', cushions: 'linen-white', pillows: 'boucle-ivory', legs: 'ash-black' }, ['warm-minimal', 'quiet-luxury'], { owned: true, description: 'Dark leather shell with white loose cushions, from your photos.' }),
  e('own-lounge', 'Your lounge chair', 'lounge-chair', 'loungeChair', [33, 34, 28], { style: 'boxy', base: 'metal', legH: 0.15 }, { upholstery: 'boucle-ivory', legs: 'steel-black' }, ['warm-minimal'], { owned: true, description: 'Ivory bouclé on slim black legs.' }),
  e('own-coffee', 'Your coffee table', 'coffee-table', 'table', [50, 30, 15], { shape: 'rect', base: 'plinth', plinthInset: 0.1, styling: 'full' }, { top: 'stone-white', base: 'stone-white' }, ['warm-minimal'], { owned: true }),
  e('own-bench', 'Your woven bench', 'bench', 'bench', [60, 17, 17], { top: 'woven', legs: 'square' }, { frame: 'oak-natural', seat: 'woven-leather' }, ['warm-minimal', 'collected'], { owned: true }),
  e('own-side', 'Your olive side table', 'side-table', 'table', [17, 17, 20], { shape: 'square', base: 'drum' }, { top: 'steel-olive', base: 'steel-olive' }, ['collected'], { owned: true }),
  e('own-drum-lamp', 'Your drum floor lamp', 'floor-lamp', 'floorLamp', [22, 22, 66], { style: 'drum', shadeR: 0.28, shadeH: 0.36 }, { shade: 'shade-linen', frame: 'steel-black', base: 'steel-black' }, ['warm-minimal'], { owned: true }),
  e('own-flint', 'Your reading lamp', 'floor-lamp', 'floorLamp', [12, 18, 61], { style: 'captain-flint' }, { frame: 'powder-white', base: 'marble-calacatta' }, ['warm-minimal'], { owned: true, brand: 'Flos', designer: 'Michael Anastassiades', description: 'Captain Flint–style white reading lamp.' }),
  e('own-desk-lamp', 'Your white drum lamp', 'floor-lamp', 'floorLamp', [16, 16, 58], { style: 'drum', shadeR: 0.2, shadeH: 0.24 }, { shade: 'shade-white', frame: 'steel-black', base: 'steel-black' }, ['warm-minimal'], { owned: true }),
  e('own-lily', 'Your peace lily', 'plant', 'plant', [40, 40, 56], { species: 'lily', pot: 'cylinder', potR: 0.3, potH: 0.5 }, { pot: 'ceramic-white' }, ['warm-minimal'], { owned: true }),
  e('own-guitar', 'Your guitar', 'music', 'guitar', [17, 18, 42], {}, {}, ['collected'], { owned: true, description: 'Sunburst acoustic on an A-frame stand.', resizable: false }),
  e('own-bw802', 'Your B&W 802 D4', 'hifi', 'speaker', [16, 22, 48], { style: 'bw800' }, { cabinet: 'gloss-black' }, ['quiet-luxury'], { owned: true, brand: 'Bowers & Wilkins', tags: ['speaker'], resizable: false }),
  e('own-round-table', 'Your round table', 'dining-table', 'table', [58, 58, 29], { shape: 'round', base: 'column', colR: 0.2, topT: 0.04 }, { top: 'stone-white', base: 'paint-cream' }, ['warm-minimal'], { owned: true, description: 'White stone top on a drum pedestal; currently the desk.' }),
  e('own-dining-chair', 'Your dining chair', 'dining-chair', 'diningChair', [20, 22, 32], { style: 'upholstered' }, { upholstery: 'cream-canvas', frame: 'oak-natural' }, ['warm-minimal', 'scandi'], { owned: true }),
  e('own-play-table', 'Your white play table', 'baby', 'baby', [72, 40, 26], { kind: 'play-table' }, { top: 'lacquer-white', base: 'lacquer-white' }, ['warm-minimal'], { owned: true, tags: ['baby'] }),
  e('own-bouncer-pink', 'Your Babybjörn bouncer', 'baby', 'baby', [18, 31, 22], { kind: 'bouncer' }, { upholstery: 'velvet-blush' }, ['warm-minimal'], { owned: true, brand: 'BabyBjörn', tags: ['baby'], resizable: false }),
  e('own-bouncer', 'Your toucan bouncer', 'baby', 'baby', [19, 27, 20], { kind: 'bouncer' }, { upholstery: 'cotton-sky' }, ['playful'], { owned: true, tags: ['baby'], resizable: false }),
  e('own-rug', 'Your abstract rug', 'rug', 'rug', [144, 168, 0.5], {}, { rug: 'rug-abstract-lake' }, ['warm-minimal', 'collected'], { owned: true, description: 'Cream and ochre ground with slate-blue watercolor shapes.' }),
  e('own-play-gym', 'Play gym', 'baby', 'baby', [34, 30, 18], { kind: 'play-gym' }, {}, ['playful'], { owned: true, tags: ['baby'] }),

  // ---------------------------------------------------------------- Sofas
  e('minotti-connery', 'Connery sofa', 'sofa', 'sofa', [118, 41, 28], { arms: 'thin', armW: 0.09, back: 'loose', base: 'floating', seatH: 0.4, seats: 3 }, { upholstery: 'boucle-oat', pillows: 'mohair-sand', legs: 'bronze' }, ['quiet-luxury', 'warm-minimal'], { brand: 'Minotti', designer: 'Rodolfo Dordoni', price: '$18k–25k' }),
  e('bb-camaleonda', 'Camaleonda (3 modules)', 'sofa', 'quiltedModular', [113, 38, 27], { module: 0.96, arms: false }, { upholstery: 'boucle-oat' }, ['collected', 'quiet-luxury'], { brand: 'B&B Italia', designer: 'Mario Bellini, 1970', price: '$20k–28k' }),
  e('divani-extrasoft', 'Extrasoft', 'sofa', 'sofa', [118, 40, 25], { arms: 'none', back: 'pillows', base: 'floating', seatH: 0.37, seats: 3, pillows: 0 }, { upholstery: 'linen-natural', legs: 'bronze' }, ['warm-minimal', 'quiet-luxury'], { brand: 'Living Divani', designer: 'Piero Lissoni', price: '$12k–18k' }),
  e('cassina-maralunga', 'Maralunga 3-seat', 'sofa', 'sofa', [93, 38, 28], { arms: 'round', armW: 0.2, back: 'loose', base: 'metal', legH: 0.1 }, { upholstery: 'wool-sand', pillows: 'velvet-moss', legs: 'steel-black' }, ['quiet-luxury', 'mid-century'], { brand: 'Cassina', designer: 'Vico Magistretti, 1973', price: '$11k–14k' }),
  e('vitra-soft-modular', 'Soft Modular Sofa', 'sofa', 'sofa', [98, 37, 28], { arms: 'block', armW: 0.22, armH: 0.55, back: 'tight', base: 'floating', seats: 2, pillows: 2 }, { upholstery: 'wool-sand', pillows: 'wool-camel', legs: 'steel-black' }, ['warm-minimal', 'scandi'], { brand: 'Vitra', designer: 'Jasper Morrison', price: '$8k–10k' }),
  e('knoll-florence', 'Florence Knoll Sofa', 'sofa', 'sofa', [90, 32, 31], { arms: 'track', armW: 0.1, back: 'loose', base: 'metal', legH: 0.16, seats: 3, pillows: 0, round: 0.015 }, { upholstery: 'wool-charcoal', legs: 'chrome' }, ['mid-century', 'classic'], { brand: 'Knoll', designer: 'Florence Knoll, 1954', price: '$7k–9k' }),
  e('hay-mags', 'Mags Soft 3-seater', 'sofa', 'sofa', [90, 39, 26], { arms: 'block', armW: 0.2, armH: 0.5, back: 'tight', base: 'floating', seats: 3, pillows: 1 }, { upholstery: 'wool-olive', pillows: 'linen-flax', legs: 'steel-black' }, ['scandi', 'warm-minimal'], { brand: 'Hay', designer: 'Hee Welling', price: '$4k–5k' }),
  e('ligne-togo-sofa', 'Togo 3-seat', 'sofa', 'pleatedLounge', [68.5, 40, 28], { rolls: 4, arms: false }, { upholstery: 'velvet-rust' }, ['collected', 'mid-century'], { brand: 'Ligne Roset', designer: 'Michel Ducaroy, 1973', price: '$6k–8k' }),
  e('rh-cloud', 'Cloud track-arm sofa (8′)', 'sofa', 'sofa', [96, 44, 29], { arms: 'track', armW: 0.25, back: 'loose', base: 'skirt', seats: 2, plump: 0.035, round: 0.07 }, { upholstery: 'linen-white', pillows: 'linen-flax', legs: 'oak-natural' }, ['warm-minimal'], { brand: 'RH', price: '$5k–7k' }),
  e('kagan-serpentine', 'Serpentine sofa', 'sofa', 'curvedSofa', [113, 44, 30], { seatDepth: 0.95, seats: 3 }, { upholstery: 'mohair-sand', pillows: 'velvet-ink' }, ['collected', 'mid-century'], { brand: 'Vladimir Kagan', designer: 'Vladimir Kagan, 1950', price: '$20k+' }),
  e('curved-crescent', 'Crescent curved sofa', 'sofa', 'curvedSofa', [110, 46, 29], { seatDepth: 0.98, seats: 3 }, { upholstery: 'boucle-ivory', pillows: 'terry-ochre' }, ['warm-minimal', 'quiet-luxury'], { price: '$6k–12k' }),
  e('english-rollarm', 'English roll-arm sofa', 'sofa', 'sofa', [86, 38, 33], { arms: 'round', armW: 0.18, armH: 0.62, back: 'loose', base: 'bun', legH: 0.09, seats: 2, pillows: 2 }, { upholstery: 'linen-natural', pillows: 'stripe-ticking', legs: 'walnut' }, ['classic', 'collected'], { price: '$6k–10k' }),
  e('getama-ge290', 'GE 290 sofa', 'sofa', 'sofa', [70, 30, 29], { arms: 'wood', armW: 0.07, back: 'loose', base: 'legs', legH: 0.16, seats: 3, pillows: 0 }, { upholstery: 'wool-camel', frame: 'oak-natural', legs: 'oak-natural' }, ['mid-century', 'scandi'], { brand: 'Getama', designer: 'Hans Wegner, 1953', price: '$6k–8k' }),
  e('tacchini-julep', 'Julep sofa', 'sofa', 'sofa', [87, 41, 28], { arms: 'round', armW: 0.26, armH: 0.56, back: 'tight', base: 'floating', seats: 2, round: 0.1, pillows: 0 }, { upholstery: 'velvet-blush', legs: 'steel-black' }, ['collected'], { brand: 'Tacchini', designer: 'Jonas Wagell', price: '$9k–12k' }),
  e('sectional-low', 'Low modular sectional', 'sectional', 'sectional', [130, 100, 27], { kind: 'L', side: 'left', seatDepth: 1.02, base: 'floating' }, { upholstery: 'boucle-oat', pillows: 'linen-flax', accent: 'terry-ochre', legs: 'steel-black' }, ['warm-minimal', 'quiet-luxury'], { price: '$8k–15k' }),
  e('sectional-chaise', 'Chaise sectional', 'sectional', 'sectional', [112, 70, 30], { kind: 'chaise', side: 'right', seatDepth: 0.98, base: 'legs' }, { upholstery: 'wool-sand', pillows: 'linen-white', accent: 'velvet-moss', legs: 'oak-natural' }, ['scandi', 'warm-minimal'], { price: '$5k–9k' }),
  e('daybed-barcelona', 'Barcelona Daybed', 'bench', 'daybed', [77, 39, 15.5], { legH: 0.22, legStyle: 'square' }, { frame: 'walnut', upholstery: 'leather-cream' }, ['mid-century', 'classic'], { brand: 'Knoll', designer: 'Mies van der Rohe, 1930', price: '$10k+' }),

  // ---------------------------------------------------------------- Lounge chairs
  e('eames-lounge', 'Eames Lounge Chair', 'lounge-chair', 'loungeChair', [33, 33, 32.5], { style: 'eames' }, { shell: 'walnut', upholstery: 'leather-black' }, ['mid-century', 'classic'], { brand: 'Herman Miller', designer: 'Charles & Ray Eames, 1956', price: '$7k–9k', tags: ['listening-seat'] }),
  e('eames-ottoman', 'Eames Ottoman', 'ottoman', 'ottoman', [26, 21, 17], { style: 'eames' }, { shell: 'walnut', upholstery: 'leather-black' }, ['mid-century', 'classic'], { brand: 'Herman Miller', price: '$2.5k' }),
  e('jeanneret-easy', 'Easy Armchair (Chandigarh)', 'lounge-chair', 'loungeChair', [26, 30, 29], { style: 'jeanneret' }, { frame: 'teak', panel: 'cane-natural', upholstery: 'linen-natural' }, ['collected', 'warm-minimal'], { designer: 'Pierre Jeanneret, 1955', price: '$3k–8k' }),
  e('wegner-ch25', 'CH25 Lounge Chair', 'lounge-chair', 'loungeChair', [27.5, 28.7, 28.7], { style: 'papercord' }, { frame: 'oak-natural', seat: 'papercord' }, ['scandi', 'mid-century'], { brand: 'Carl Hansen & Søn', designer: 'Hans Wegner, 1950', price: '$4k–5k' }),
  e('pp19-papabear', 'PP19 Papa Bear Chair', 'lounge-chair', 'loungeChair', [35.5, 37.4, 39], { style: 'wing', woodArms: true }, { upholstery: 'wool-camel', legs: 'oak-natural' }, ['mid-century', 'classic'], { brand: 'PP Møbler', designer: 'Hans Wegner, 1951', price: '$12k+', tags: ['listening-seat', 'reading'] }),
  e('mogensen-spanish', 'Spanish Chair', 'lounge-chair', 'loungeChair', [32.5, 23.6, 26.4], { style: 'spanish' }, { frame: 'oak-natural', upholstery: 'leather-cognac' }, ['scandi', 'collected'], { brand: 'Fredericia', designer: 'Børge Mogensen, 1958', price: '$5k–6k' }),
  e('barcelona-chair', 'Barcelona Chair', 'lounge-chair', 'loungeChair', [29.5, 30, 30], { style: 'barcelona' }, { upholstery: 'leather-cream' }, ['mid-century', 'classic'], { brand: 'Knoll', designer: 'Mies van der Rohe, 1929', price: '$7k–9k' }),
  e('cassina-lc2', 'LC2 Petit Modèle', 'lounge-chair', 'loungeChair', [30, 27.5, 26.4], { style: 'lc2' }, { upholstery: 'leather-black' }, ['mid-century'], { brand: 'Cassina', designer: 'Le Corbusier, Jeanneret, Perriand, 1928', price: '$6k–7k' }),
  e('knoll-womb', 'Womb Chair', 'lounge-chair', 'loungeChair', [40, 34, 35.5], { style: 'womb' }, { upholstery: 'boucle-stone', cushions: 'boucle-stone' }, ['mid-century'], { brand: 'Knoll', designer: 'Eero Saarinen, 1948', price: '$6k–8k', tags: ['reading'] }),
  e('fh-egg', 'Egg Chair', 'lounge-chair', 'loungeChair', [34, 31, 42], { style: 'egg' }, { upholstery: 'velvet-rust', cushions: 'velvet-rust' }, ['mid-century', 'collected'], { brand: 'Fritz Hansen', designer: 'Arne Jacobsen, 1958', price: '$10k+', tags: ['reading'] }),
  e('ligne-togo', 'Togo Fireside Chair', 'lounge-chair', 'pleatedLounge', [34, 40, 28], { rolls: 3, arms: true }, { upholstery: 'boucle-oat' }, ['collected', 'mid-century'], { brand: 'Ligne Roset', designer: 'Michel Ducaroy, 1973', price: '$3k–4k' }),
  e('gubi-pacha', 'Pacha Lounge Chair', 'lounge-chair', 'loungeChair', [32, 38, 25], { style: 'pacha' }, { upholstery: 'boucle-ivory' }, ['collected', 'warm-minimal'], { brand: 'Gubi', designer: 'Pierre Paulin, 1975', price: '$3.5k–5k' }),
  e('bertoia-diamond', 'Diamond Lounge Chair', 'lounge-chair', 'loungeChair', [33.75, 27.5, 30.5], { style: 'wire' }, { upholstery: 'wool-charcoal' }, ['mid-century'], { brand: 'Knoll', designer: 'Harry Bertoia, 1952', price: '$2k–3k' }),
  e('club-boucle', 'Bouclé club chair', 'lounge-chair', 'loungeChair', [33, 34, 29], { style: 'club', base: 'plinth', legH: 0.05 }, { upholstery: 'boucle-oat', legs: 'oak-smoked' }, ['warm-minimal', 'quiet-luxury'], { price: '$2k–5k', tags: ['reading'] }),
  e('swivel-barrel', 'Swivel barrel chair', 'lounge-chair', 'loungeChair', [31, 31, 29], { style: 'swivel' }, { upholstery: 'boucle-ivory', legs: 'bronze' }, ['warm-minimal', 'quiet-luxury'], { price: '$1.5k–4k' }),
  e('slipper-velvet', 'Velvet slipper chair', 'lounge-chair', 'loungeChair', [26, 30, 32], { style: 'slipper', legStyle: 'tapered' }, { upholstery: 'velvet-moss', legs: 'walnut' }, ['classic', 'collected'], { price: '$1.5k–3k' }),
  e('barrel-tub', 'Upholstered barrel chair', 'lounge-chair', 'loungeChair', [30, 30, 30], { style: 'barrel' }, { upholstery: 'wool-camel', legs: 'oak-smoked' }, ['collected', 'classic'], { price: '$2k–4k' }),
  e('wegner-j16', 'J16 Rocking Chair', 'lounge-chair', 'loungeChair', [25, 34, 42], { style: 'rocker' }, { frame: 'oak-natural', seat: 'papercord' }, ['scandi'], { brand: 'Fredericia', designer: 'Hans Wegner, 1944', price: '$2k–3k', tags: ['baby', 'reading'] }),
  e('nursing-glider', 'Nursing glider', 'lounge-chair', 'loungeChair', [31, 35, 39], { style: 'glider' }, { upholstery: 'boucle-oat', legs: 'oak-natural' }, ['warm-minimal'], { price: '$1k–2k', tags: ['baby', 'reading'] }),

  // ---------------------------------------------------------------- Ottomans & poufs
  e('pouf-leather', 'Leather pouf', 'ottoman', 'ottoman', [20, 20, 14], { style: 'pouf' }, { upholstery: 'leather-cognac' }, ['collected'], { price: '$300–600' }),
  e('ottoman-round', 'Round bouclé ottoman', 'ottoman', 'ottoman', [30, 30, 16], { style: 'round' }, { upholstery: 'boucle-ivory' }, ['warm-minimal'], { price: '$800–1.5k', tags: ['baby-safe'] }),
  e('ottoman-box', 'Upholstered ottoman', 'ottoman', 'ottoman', [40, 26, 17], { style: 'box', legH: 0.05 }, { upholstery: 'linen-flax', legs: 'oak-natural' }, ['classic', 'warm-minimal'], { price: '$900–2k', tags: ['baby-safe'] }),

  // ---------------------------------------------------------------- Coffee tables
  e('noguchi-coffee', 'Noguchi Coffee Table', 'coffee-table', 'table', [50, 36, 15.75], { shape: 'noguchi', base: 'noguchi', topT: 0.019 }, { top: 'glass-clear', base: 'walnut' }, ['mid-century'], { brand: 'Herman Miller', designer: 'Isamu Noguchi, 1947', price: '$2k–2.5k', tags: ['glass'] }),
  e('saarinen-coffee', 'Saarinen Round Coffee Table', 'coffee-table', 'table', [42, 42, 15.25], { shape: 'round', base: 'tulip', topT: 0.02, styling: 'books-bowl' }, { top: 'marble-calacatta', base: 'powder-white' }, ['mid-century', 'warm-minimal'], { brand: 'Knoll', designer: 'Eero Saarinen, 1957', price: '$3k–5k' }),
  e('platner-coffee', 'Platner Coffee Table', 'coffee-table', 'table', [42, 42, 15], { shape: 'round', base: 'platner', topT: 0.02, styling: 'books' }, { top: 'marble-nero', base: 'nickel' }, ['mid-century', 'quiet-luxury'], { brand: 'Knoll', designer: 'Warren Platner, 1966', price: '$5k–7k' }),
  e('travertine-plinth', 'Travertine plinth table', 'coffee-table', 'table', [54, 30, 13], { shape: 'rect', base: 'plinth', plinthInset: 0.07, styling: 'books-bowl' }, { top: 'travertine', base: 'travertine' }, ['warm-minimal', 'quiet-luxury'], { price: '$3k–6k', tags: ['baby-safe'] }),
  e('travertine-drum', 'Round travertine drum', 'coffee-table', 'table', [40, 40, 14], { shape: 'round', base: 'drum', styling: 'books' }, { top: 'travertine-honed', base: 'travertine-honed' }, ['warm-minimal', 'quiet-luxury'], { price: '$2.5k–5k', tags: ['baby-safe'] }),
  e('oak-slab', 'Live-edge slab table', 'coffee-table', 'table', [60, 26, 15], { shape: 'blob', base: 'splay', topT: 0.06, styling: 'books' }, { top: 'oak-natural', base: 'oak-natural' }, ['collected'], { designer: 'Nakashima-inspired', price: '$4k–10k' }),
  e('burl-oval', 'Burl oval coffee table', 'coffee-table', 'table', [54, 32, 16], { shape: 'oval', base: 'plinth', plinthInset: 0.12, styling: 'full' }, { top: 'burl', base: 'burl' }, ['collected', 'quiet-luxury'], { price: '$3k–8k', tags: ['baby-safe'] }),
  e('lacquer-square', 'Lacquered square table', 'coffee-table', 'table', [40, 40, 14], { shape: 'rect', base: 'drum', styling: 'books-bowl' }, { top: 'lacquer-oxblood', base: 'lacquer-oxblood' }, ['collected'], { price: '$2k–4k' }),
  e('marble-cylinders', 'Marble cylinders table', 'coffee-table', 'table', [56, 32, 14], { shape: 'racetrack', base: 'cylinders', cylinders: 2, styling: 'books-bowl' }, { top: 'marble-calacatta', base: 'marble-calacatta' }, ['quiet-luxury'], { designer: 'Mangiarotti-inspired', price: '$6k–12k' }),
  e('oak-round-coffee', 'Round oak coffee table', 'coffee-table', 'table', [36, 36, 16], { shape: 'round', base: 'tapered', styling: 'books' }, { top: 'oak-white', base: 'oak-white' }, ['scandi'], { price: '$1k–2k', tags: ['baby-safe'] }),
  e('smoked-waterfall', 'Smoked glass waterfall table', 'coffee-table', 'table', [48, 24, 15], { shape: 'rect', base: 'waterfall', topT: 0.015 }, { top: 'glass-smoked', base: 'glass-smoked' }, ['quiet-luxury', 'collected'], { price: '$1.5k–3k', tags: ['glass'] }),
  e('pebble-coffee', 'Pebble coffee table', 'coffee-table', 'table', [52, 34, 13], { shape: 'blob', base: 'drum', styling: 'books-bowl' }, { top: 'travertine', base: 'travertine' }, ['warm-minimal', 'collected'], { price: '$3k–6k', tags: ['baby-safe'] }),

  // ---------------------------------------------------------------- Side tables
  e('gray-e1027', 'E1027 Adjustable Table', 'side-table', 'table', [20, 20, 24], { shape: 'round', base: 'e1027', topT: 0.01 }, { top: 'glass-clear', base: 'chrome' }, ['mid-century'], { brand: 'ClassiCon', designer: 'Eileen Gray, 1927', price: '$1k–1.5k', tags: ['glass'] }),
  e('platner-side', 'Platner Side Table', 'side-table', 'table', [16, 16, 20.5], { shape: 'round', base: 'platner', topT: 0.02 }, { top: 'marble-calacatta', base: 'nickel' }, ['mid-century', 'quiet-luxury'], { brand: 'Knoll', price: '$2.5k' }),
  e('saarinen-side', 'Saarinen Side Table', 'side-table', 'table', [16, 16, 20.5], { shape: 'round', base: 'tulip', topT: 0.02 }, { top: 'marble-calacatta', base: 'powder-white' }, ['mid-century', 'warm-minimal'], { brand: 'Knoll', price: '$1.5k' }),
  e('audo-plinth', 'Plinth cube', 'side-table', 'table', [15.75, 15.75, 19.7], { shape: 'square', base: 'drum' }, { top: 'travertine', base: 'travertine' }, ['warm-minimal'], { brand: 'Audo', designer: 'Norm Architects', price: '$1k–1.5k', tags: ['baby-safe'] }),
  e('oak-drum-side', 'Oak drum side table', 'side-table', 'table', [18, 18, 20], { shape: 'round', base: 'drum' }, { top: 'oak-smoked', base: 'oak-smoked' }, ['warm-minimal', 'scandi'], { price: '$500–1k', tags: ['baby-safe'] }),
  e('garden-stool', 'Ceramic garden stool', 'side-table', 'table', [14, 14, 18], { shape: 'round', base: 'drum' }, { top: 'ceramic-sage', base: 'ceramic-sage' }, ['collected', 'classic'], { price: '$300–600' }),
  e('tea-table', 'Round tea table', 'side-table', 'table', [22, 22, 21], { shape: 'round', base: 'tapered', topT: 0.025 }, { top: 'walnut', base: 'walnut' }, ['collected', 'mid-century'], { price: '$600–1.2k', tags: ['tea'] }),

  // ---------------------------------------------------------------- Dining
  e('saarinen-dining', 'Saarinen Dining Table 54″', 'dining-table', 'table', [54, 54, 28.25], { shape: 'round', base: 'tulip' }, { top: 'marble-calacatta', base: 'powder-white' }, ['mid-century', 'warm-minimal'], { brand: 'Knoll', designer: 'Eero Saarinen, 1957', price: '$5k–8k' }),
  e('saarinen-oval', 'Saarinen Oval Dining Table', 'dining-table', 'table', [96, 54, 28.25], { shape: 'oval', base: 'tulip' }, { top: 'marble-calacatta', base: 'powder-white' }, ['mid-century', 'warm-minimal'], { brand: 'Knoll', price: '$9k–14k' }),
  e('eros-dining', 'Eros dining table', 'dining-table', 'table', [51, 51, 29], { shape: 'round', base: 'conic' }, { top: 'marble-calacatta', base: 'marble-calacatta' }, ['quiet-luxury'], { brand: 'Agapecasa', designer: 'Angelo Mangiarotti, 1971', price: '$6k–10k' }),
  e('wegner-ch327', 'CH327 Dining Table', 'dining-table', 'table', [75, 37.4, 28.3], { shape: 'rect', base: 'tapered', inset: 0.05 }, { top: 'oak-natural', base: 'oak-natural' }, ['scandi', 'mid-century'], { brand: 'Carl Hansen & Søn', designer: 'Hans Wegner, 1962', price: '$4k–5k' }),
  e('oak-trestle', 'Oak trestle table', 'dining-table', 'table', [96, 40, 30], { shape: 'rect', base: 'trestle', topT: 0.045 }, { top: 'oak-natural', base: 'oak-natural' }, ['collected', 'classic'], { price: '$4k–8k' }),
  e('round-pedestal', 'Round pedestal table', 'dining-table', 'table', [48, 48, 30], { shape: 'round', base: 'pedestal' }, { top: 'oak-white', base: 'oak-white' }, ['scandi', 'warm-minimal'], { price: '$2k–4k' }),
  e('game-table', 'Walnut game table', 'dining-table', 'table', [36, 36, 29], { shape: 'square', base: 'tapered', inset: 0.03 }, { top: 'walnut', base: 'walnut' }, ['collected', 'mid-century'], { price: '$2k–4k' }),

  e('wegner-wishbone', 'CH24 Wishbone Chair', 'dining-chair', 'diningChair', [21.7, 20, 30], { style: 'wishbone' }, { frame: 'oak-natural', seat: 'papercord' }, ['scandi', 'mid-century'], { brand: 'Carl Hansen & Søn', designer: 'Hans Wegner, 1949', price: '$800–1.1k' }),
  e('jeanneret-office', 'Office Cane Chair', 'dining-chair', 'diningChair', [20, 22, 32], { style: 'cane' }, { frame: 'teak', seat: 'cane-natural' }, ['collected', 'warm-minimal'], { designer: 'Pierre Jeanneret, 1955', price: '$2k–6k' }),
  e('eames-shell', 'Eames Shell Chair', 'dining-chair', 'diningChair', [18.5, 21, 31.5], { style: 'shell' }, { shell: 'plastic-white', frame: 'maple' }, ['mid-century'], { brand: 'Herman Miller', designer: 'Charles & Ray Eames, 1950', price: '$500' }),
  e('cassina-cab', 'Cab Chair', 'dining-chair', 'diningChair', [17.75, 18.5, 32], { style: 'cab' }, { upholstery: 'leather-cognac', frame: 'leather-cognac' }, ['quiet-luxury', 'collected'], { brand: 'Cassina', designer: 'Mario Bellini, 1977', price: '$2k' }),
  e('thonet-14', 'No. 14 Bentwood Chair', 'dining-chair', 'diningChair', [17, 20, 33.5], { style: 'bentwood' }, { seat: 'cane-natural', frame: 'ash-black' }, ['classic', 'collected'], { brand: 'Thonet', price: '$500–800' }),
  e('stokke-tripp', 'Tripp Trapp high chair', 'baby', 'baby', [18.5, 19.5, 31], { kind: 'high-chair' }, { frame: 'oak-natural' }, ['scandi', 'warm-minimal'], { brand: 'Stokke', price: '$300', tags: ['baby'] }),

  // ---------------------------------------------------------------- Storage & consoles
  e('usm-haller', 'USM Haller credenza', 'storage', 'usm', [60, 15, 29], { cols: 2, rows: 2 }, { body: 'usm-white' }, ['mid-century', 'collected'], { brand: 'USM', designer: 'Fritz Haller, 1963', price: '$4k–6k' }),
  e('oak-credenza', 'Oak credenza', 'storage', 'storage', [80, 18, 27], { kind: 'credenza', doors: 4, legs: 'legs', legH: 0.15, handle: 'none' }, { body: 'oak-white', fronts: 'oak-white', legs: 'oak-white' }, ['scandi', 'warm-minimal'], { price: '$3k–5k' }),
  e('hifi-console', 'Low hi-fi console', 'hifi', 'storage', [84, 20, 22], { kind: 'media', doors: 3, open: true, legs: 'plinth', handle: 'none' }, { body: 'walnut', fronts: 'walnut', legs: 'walnut' }, ['warm-minimal', 'collected'], { price: '$3k–8k', tags: ['hifi'] }),
  e('record-cabinet', 'Record cabinet', 'hifi', 'storage', [48, 16, 30], { kind: 'record', shelves: 2, cols: 2, legs: 'legs', legH: 0.14 }, { body: 'oak-smoked', legs: 'oak-smoked' }, ['collected', 'mid-century'], { price: '$1.5k–4k', tags: ['hifi'] }),
  e('console-slim', 'Slim console table', 'console', 'table', [60, 14, 30], { shape: 'rect', base: 'panel', styling: 'books-bowl' }, { top: 'oak-white', base: 'oak-white' }, ['warm-minimal', 'scandi'], { price: '$1k–3k' }),
  e('bookcase-oak', 'Freestanding bookcase', 'storage', 'storage', [36, 14, 84], { kind: 'bookcase', legs: 'plinth' }, { body: 'oak-white' }, ['scandi', 'warm-minimal'], { price: '$1.5k–3k' }),
  e('toy-shelf', 'Low toy shelf', 'baby', 'storage', [48, 14, 24], { kind: 'toy-shelf', shelves: 2, cols: 3, legs: 'none' }, { body: 'maple' }, ['scandi', 'warm-minimal'], { price: '$400–900', tags: ['baby', 'baby-safe'] }),
  e('dresser', 'Six-drawer dresser', 'storage', 'storage', [60, 20, 32], { kind: 'dresser', drawers: 3, cols: 2, legs: 'legs', legH: 0.12, handle: 'bar' }, { body: 'walnut', fronts: 'walnut', legs: 'walnut' }, ['mid-century'], { price: '$3k–6k' }),
  e('nightstand', 'Nightstand', 'storage', 'storage', [22, 16, 24], { kind: 'nightstand', doors: 0, drawers: 2, legs: 'legs', legH: 0.12, handle: 'knob' }, { body: 'oak-white', fronts: 'oak-white', legs: 'oak-white' }, ['scandi', 'warm-minimal'], { price: '$600–1.5k' }),
  e('sideboard-lacquer', 'Lacquered sideboard', 'storage', 'storage', [72, 20, 30], { kind: 'sideboard', doors: 3, legs: 'metal', legH: 0.12, handle: 'none' }, { body: 'lacquer-black', fronts: 'lacquer-black', legs: 'brass' }, ['quiet-luxury'], { price: '$4k–9k' }),

  // ---------------------------------------------------------------- Beds, desks
  e('bed-queen', 'Upholstered bed (queen)', 'bed', 'bed', [66, 87, 42], { headboard: 'upholstered' }, { frame: 'linen-natural', upholstery: 'linen-natural', bedding: 'linen-white', legs: 'oak-natural' }, ['warm-minimal'], { price: '$2k–5k' }),
  e('bed-king-channel', 'Channel bed (king)', 'bed', 'bed', [82, 88, 48], { headboard: 'channel', legH: 0.08 }, { frame: 'boucle-oat', upholstery: 'boucle-oat', bedding: 'linen-flax', legs: 'oak-smoked' }, ['quiet-luxury'], { price: '$4k–9k' }),
  e('bed-oak', 'Oak platform bed (queen)', 'bed', 'bed', [64, 84, 36], { headboard: 'wood', legH: 0.1 }, { frame: 'oak-natural', upholstery: 'oak-natural', bedding: 'cotton-white', legs: 'oak-natural' }, ['scandi'], { price: '$2k–4k' }),
  e('desk-oak', 'Oak writing desk', 'desk', 'table', [60, 28, 29.5], { shape: 'rect', base: 'tapered', drawer: true }, { top: 'oak-white', base: 'oak-white' }, ['scandi', 'warm-minimal'], { price: '$2k–4k' }),
  e('desk-chair', 'Aluminum Group chair', 'office-chair', 'officeChair', [23, 23, 35], {}, { upholstery: 'leather-black' }, ['mid-century'], { brand: 'Herman Miller', designer: 'Charles & Ray Eames, 1958', price: '$2.5k–4k' }),

  // ---------------------------------------------------------------- Lighting
  e('flos-arco', 'Arco', 'floor-lamp', 'floorLamp', [16.5, 80, 95], { style: 'arc' }, { base: 'marble-calacatta' }, ['mid-century', 'collected'], { brand: 'Flos', designer: 'Achille & Pier Giacomo Castiglioni, 1962', price: '$3.5k–4k' }),
  e('akari-uf3', 'Akari UF3-Q', 'floor-lamp', 'floorLamp', [18, 18, 58], { style: 'akari' }, { shade: 'shade-paper' }, ['warm-minimal', 'collected', 'scandi'], { brand: 'Vitra', designer: 'Isamu Noguchi, 1951', price: '$1k–1.5k' }),
  e('flos-flint', 'Captain Flint', 'floor-lamp', 'floorLamp', [12, 18, 61], { style: 'captain-flint' }, { frame: 'steel-black', base: 'marble-nero' }, ['warm-minimal', 'quiet-luxury'], { brand: 'Flos', designer: 'Michael Anastassiades', price: '$2k', tags: ['reading'] }),
  e('flos-ic', 'IC Lights F1', 'floor-lamp', 'floorLamp', [11, 11, 53], { style: 'globe' }, { frame: 'brass', shade: 'shade-opal' }, ['quiet-luxury', 'warm-minimal'], { brand: 'Flos', designer: 'Michael Anastassiades', price: '$1.5k' }),
  e('santacole-tmm', 'TMM Floor Lamp', 'floor-lamp', 'floorLamp', [18, 18, 67], { style: 'tmm' }, { frame: 'cherry', shade: 'shade-paper' }, ['mid-century', 'scandi'], { brand: 'Santa & Cole', designer: 'Miguel Milá, 1961', price: '$1.2k' }),
  e('gubi-grashoppa', 'Gräshoppa floor lamp', 'floor-lamp', 'floorLamp', [20, 20, 49], { style: 'grashoppa' }, { frame: 'steel-black' }, ['mid-century'], { brand: 'Gubi', designer: 'Greta Grossman, 1947', price: '$1.4k', tags: ['reading'] }),
  e('mouille-three', 'Three-Arm Floor Lamp', 'floor-lamp', 'floorLamp', [44, 40, 75], { style: 'mouille' }, {}, ['collected', 'mid-century'], { designer: 'Serge Mouille, 1953', price: '$6k+' }),
  e('task-floor', 'Articulated reading lamp', 'floor-lamp', 'floorLamp', [12, 26, 55], { style: 'task' }, { frame: 'aluminum', shade: 'shade-white' }, ['scandi', 'mid-century'], { designer: 'Tolomeo-style', price: '$600–1k', tags: ['reading'] }),
  e('linen-drum-floor', 'Linen drum floor lamp', 'floor-lamp', 'floorLamp', [20, 20, 62], { style: 'drum', shadeR: 0.25, shadeH: 0.32 }, { shade: 'shade-linen', frame: 'bronze', base: 'bronze' }, ['classic', 'warm-minimal'], { price: '$400–900' }),
  e('wood-tripod', 'Wood tripod lamp', 'floor-lamp', 'floorLamp', [24, 24, 62], { style: 'tripod', shadeR: 0.24 }, { frame: 'walnut', shade: 'shade-linen' }, ['collected', 'mid-century'], { price: '$500–1k' }),
  e('alabaster-torch', 'Alabaster torchiere', 'floor-lamp', 'floorLamp', [16, 16, 66], { style: 'torchiere' }, { frame: 'brass', base: 'brass', shade: 'shade-opal' }, ['classic', 'quiet-luxury'], { price: '$1.5k–3k' }),
  e('oluce-atollo', 'Atollo table lamp', 'table-lamp', 'tableLamp', [15, 15, 20], { style: 'mushroom' }, { base: 'lacquer-white', shade: 'lacquer-white' }, ['mid-century', 'warm-minimal'], { brand: 'Oluce', designer: 'Vico Magistretti, 1977', price: '$1.5k', mount: 'surface' }),
  e('akari-1a', 'Akari 1A table lamp', 'table-lamp', 'tableLamp', [8, 8, 15], { style: 'akari' }, { shade: 'shade-paper' }, ['warm-minimal', 'scandi'], { brand: 'Vitra', designer: 'Isamu Noguchi', price: '$300', mount: 'surface' }),
  e('ceramic-lamp', 'Ceramic table lamp', 'table-lamp', 'tableLamp', [16, 16, 26], { style: 'ceramic' }, { base: 'ceramic-cream', shade: 'shade-linen' }, ['classic', 'collected'], { price: '$400–900', mount: 'surface' }),

  // ---------------------------------------------------------------- Rugs
  e('rug-beni', 'Beni Ourain rug 9×12', 'rug', 'rug', [108, 144, 0.8], {}, { rug: 'rug-beni' }, ['warm-minimal', 'collected'], { price: '$3k–8k' }),
  e('rug-oushak', 'Vintage Oushak 10×14', 'rug', 'rug', [120, 168, 0.4], {}, { rug: 'rug-oushak' }, ['classic', 'collected'], { price: '$6k–20k' }),
  e('rug-heriz', 'Vintage Heriz 9×12', 'rug', 'rug', [108, 144, 0.4], {}, { rug: 'rug-persian-red' }, ['classic', 'collected'], { price: '$5k–15k' }),
  e('rug-oatmeal', 'Hand-loomed wool 10×14', 'rug', 'rug', [120, 168, 0.5], {}, { rug: 'rug-oatmeal' }, ['warm-minimal', 'quiet-luxury'], { price: '$3k–7k' }),
  e('rug-jute', 'Jute herringbone 9×12', 'rug', 'rug', [108, 144, 0.4], {}, { rug: 'rug-jute' }, ['scandi', 'warm-minimal'], { price: '$800–2k' }),
  e('rug-round', 'Round wool rug 8′', 'rug', 'rug', [96, 96, 0.5], { shape: 'round' }, { rug: 'rug-ivory' }, ['warm-minimal'], { price: '$1.5k–4k' }),
  e('rug-organic', 'Organic-shaped rug', 'rug', 'rug', [108, 132, 0.6], { shape: 'organic' }, { rug: 'rug-organic-moss' }, ['collected', 'warm-minimal'], { price: '$3k–7k' }),
  e('rug-stripe', 'Striped flatweave 8×10', 'rug', 'rug', [96, 120, 0.3], {}, { rug: 'rug-stripe' }, ['scandi', 'collected'], { price: '$1k–3k' }),
  e('rug-checker', 'Tufted checkerboard 8×10', 'rug', 'rug', [96, 120, 0.5], {}, { rug: 'rug-checker' }, ['collected'], { price: '$1.5k–4k' }),
  e('rug-border', 'Bordered wool 10×14', 'rug', 'rug', [120, 168, 0.5], {}, { rug: 'rug-border' }, ['classic', 'quiet-luxury'], { price: '$3k–7k' }),
  e('rug-charcoal', 'Charcoal wool 9×12', 'rug', 'rug', [108, 144, 0.5], {}, { rug: 'rug-charcoal' }, ['quiet-luxury'], { price: '$2.5k–6k' }),

  // ---------------------------------------------------------------- Plants
  e('plant-fiddle', 'Fiddle-leaf fig (7′)', 'plant', 'plant', [36, 36, 84], { species: 'fiddle', pot: 'cylinder' }, { pot: 'ceramic-white' }, ['warm-minimal', 'scandi'], { price: '$200–500' }),
  e('plant-olive', 'Olive tree (7′)', 'plant', 'plant', [40, 40, 84], { species: 'olive', pot: 'tapered' }, { pot: 'ceramic-terracotta' }, ['warm-minimal', 'collected'], { price: '$300–900' }),
  e('plant-bird', 'Bird of paradise (6′)', 'plant', 'plant', [42, 42, 72], { species: 'bird', pot: 'basket' }, { pot: 'jute' }, ['collected'], { price: '$150–400' }),
  e('plant-palm', 'Kentia palm (7′)', 'plant', 'plant', [50, 50, 84], { species: 'palm', pot: 'urn' }, { pot: 'ceramic-black' }, ['classic', 'collected'], { price: '$300–800' }),
  e('plant-monstera', 'Monstera (4′)', 'plant', 'plant', [42, 42, 48], { species: 'monstera', pot: 'bowl' }, { pot: 'ceramic-cream' }, ['collected', 'scandi'], { price: '$100–250' }),
  e('plant-snake', 'Snake plant (3′)', 'plant', 'plant', [18, 18, 36], { species: 'snake', pot: 'cylinder' }, { pot: 'concrete' }, ['scandi', 'warm-minimal'], { price: '$60–150' }),
  e('plant-ficus', 'Ficus Audrey (8′)', 'plant', 'plant', [44, 44, 96], { species: 'ficus', pot: 'tapered' }, { pot: 'ceramic-cream' }, ['warm-minimal', 'classic'], { price: '$400–1k' }),

  // ---------------------------------------------------------------- Hi-fi & music
  e('bw-801', '801 D4 Signature', 'hifi', 'speaker', [16.5, 24, 49], { style: 'bw800' }, { cabinet: 'rosenut' }, ['quiet-luxury', 'collected'], { brand: 'Bowers & Wilkins', price: '$40k/pair', tags: ['speaker'], resizable: false }),
  e('kef-blade', 'Blade One Meta', 'hifi', 'speaker', [14, 20, 63], { style: 'tower' }, { cabinet: 'gloss-white' }, ['quiet-luxury'], { brand: 'KEF', price: '$35k/pair', tags: ['speaker'], resizable: false }),
  e('bw-805-stand', '805 D4 on stands', 'hifi', 'speaker', [9.5, 13.7, 40], { style: 'standmount' }, { cabinet: 'gloss-black' }, ['quiet-luxury'], { brand: 'Bowers & Wilkins', price: '$9k/pair', tags: ['speaker'], resizable: false }),
  e('subwoofer', 'Subwoofer', 'hifi', 'speaker', [16, 18, 17], { style: 'sub' }, { cabinet: 'gloss-black' }, ['quiet-luxury'], { price: '$2k–6k', tags: ['speaker-sub'] }),
  e('steinway-b', 'Model B grand piano', 'music', 'piano', [58, 83, 40], { kind: 'grand' }, { body: 'lacquer-black' }, ['classic', 'quiet-luxury'], { brand: 'Steinway & Sons', price: '$150k+', resizable: false }),
  e('steinway-m', 'Model M grand piano', 'music', 'piano', [58, 67, 40], { kind: 'grand' }, { body: 'walnut' }, ['classic', 'collected'], { brand: 'Steinway & Sons', price: '$100k+', resizable: false }),
  e('upright-piano', 'Upright piano', 'music', 'piano', [60, 24, 50], { kind: 'upright' }, { body: 'lacquer-black' }, ['classic'], { price: '$8k–30k', resizable: false }),

  // ---------------------------------------------------------------- Baby & kids
  e('play-mat', 'Foam play mat 6×4', 'baby', 'baby', [72, 48, 1], { kind: 'mat' }, {}, ['warm-minimal'], { price: '$150–300', tags: ['baby', 'baby-safe'] }),
  e('oeuf-crib', 'Sparrow crib', 'baby', 'baby', [55, 31, 35], { kind: 'crib' }, { frame: 'lacquer-white' }, ['scandi', 'warm-minimal'], { brand: 'Oeuf', price: '$1k', tags: ['baby'] }),
  e('toy-basket', 'Woven toy basket', 'baby', 'baby', [18, 18, 14], { kind: 'basket' }, {}, ['warm-minimal', 'collected'], { price: '$80–200', tags: ['baby'] }),
  e('hearth-gate', 'Hearth gate', 'baby', 'baby', [72, 26, 30], { kind: 'gate' }, {}, ['warm-minimal'], { price: '$150–300', tags: ['baby', 'safety'] }),

  // ---------------------------------------------------------------- Seasonal
  e('xmas-tree', 'Christmas tree (7½′)', 'seasonal', 'christmasTree', [56, 56, 90], { lights: 'warm', ornaments: 'gold', presents: true }, {}, ['classic', 'warm-minimal'], { tags: ['tree', 'christmas'] }),
  e('xmas-tree-tall', 'Christmas tree (9′)', 'seasonal', 'christmasTree', [64, 64, 108], { lights: 'warm', ornaments: 'gold', presents: true }, {}, ['classic'], { tags: ['tree', 'christmas'] }),
  e('xmas-tree-slim', 'Slim Christmas tree (7½′)', 'seasonal', 'christmasTree', [42, 42, 90], { lights: 'warm', ornaments: 'red', presents: false }, {}, ['scandi', 'warm-minimal'], { tags: ['tree', 'christmas'] }),

  // ---------------------------------------------------------------- Art, mirrors, media
  e('art-canvas-large', 'Large abstract canvas', 'art', 'art', [60, 1.6, 72], { frame: 'canvas', image: 'abstract' }, {}, ['collected', 'warm-minimal'], { mount: 'wall' }),
  e('art-photo', 'Framed photograph', 'art', 'art', [30, 1.2, 40], { frame: 'thin-black', image: 'portrait', mat: true }, {}, ['warm-minimal', 'collected'], { mount: 'wall' }),
  e('art-minimal', 'Minimal linen canvas', 'art', 'art', [48, 1.6, 60], { frame: 'canvas', image: 'tan' }, {}, ['warm-minimal'], { mount: 'wall' }),
  e('mirror-round', 'Round brass mirror', 'art', 'mirror', [36, 1, 36], { shape: 'round' }, {}, ['quiet-luxury', 'classic'], { mount: 'wall', price: '$800–2k' }),
  e('tv-77', '77″ TV', 'media', 'tv', [68, 2, 39], {}, {}, ['warm-minimal'], { mount: 'wall', price: '$3k–5k' }),
  e('person', 'Scale figure (5′10″)', 'decor', 'person', [20, 12, 70], {}, {}, [], { description: 'For judging scale in 3D.' }),

  // ---------------------------------------------------------------- Built-ins (room editor)
  e('builtin-shelves', 'Built-in shelving', 'builtin', 'shelvingRun', [96, 20, 126], { baseH: 0.8, upperD: 0.32, baseStyle: 'flat', lit: true }, { fronts: 'oak-white', top: 'oak-white', body: 'paint-white' }, [], { description: 'Base cabinets with open shelves to the ceiling.' }),
  e('builtin-fireplace', 'Fireplace', 'builtin', 'fireplace', [84, 16, 126], {}, { body: 'paint-white' }, [], { tags: ['heat-source'] }),
  e('builtin-cabinets', 'Base cabinets', 'builtin', 'cabinetRun', [96, 24, 36], {}, { fronts: 'paint-white', top: 'marble-calacatta' }, []),
  e('builtin-window-seat', 'Window seat', 'builtin', 'cabinetRun', [72, 20, 18], { cushion: true }, { fronts: 'paint-white', top: 'paint-white', upholstery: 'linen-natural' }, []),
  e('builtin-column', 'Column', 'builtin', 'column', [14, 14, 126], {}, { body: 'paint-white' }, []),
  e('fixture-curtain', 'Sheer curtain', 'builtin', 'curtain', [30, 5, 124], { sheer: true }, {}, []),
  e('fixture-picture-light', 'Picture light', 'builtin', 'pictureLight', [30, 4, 2], {}, {}, [], { mount: 'wall' }),
  e('fixture-art', 'Wall art', 'builtin', 'art', [26, 1.2, 34], { frame: 'thin-black', image: 'portrait' }, {}, [], { mount: 'wall' }),
];

export const CATALOG_MAP: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export function isSeat(entry: CatalogEntry) {
  return entry.category === 'sofa' || entry.category === 'sectional' || entry.category === 'lounge-chair' || entry.category === 'dining-chair' || entry.category === 'office-chair' || entry.category === 'bench';
}

/** Pieces that do not block circulation or collide (they lie on the floor or hang on walls). */
export function isFlat(entry: CatalogEntry) {
  return entry.category === 'rug' || entry.mount === 'wall' || (entry.category === 'baby' && entry.params.kind === 'mat');
}
