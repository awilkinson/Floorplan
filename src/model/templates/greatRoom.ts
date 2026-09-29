import type { Item, Layout, Opening, Room } from '../types';
import { bearingToRotation, inch } from '../units';

// The great room, reconstructed from five photos. Estimated at 25′ × 23′ with a
// 10′-6″ coffered ceiling; plan north is the wall of French doors to the terrace.
// Inches throughout, converted on the way out.

const I = inch;
let n = 0;
const id = (p: string) => `${p}-${(++n).toString(36)}`;

function at(ref: string, x: number, y: number, bearing: number, extra: Partial<Item> = {}): Item {
  return { id: extra.id ?? id(ref.replace(/^own-|^builtin-|^fixture-/, '')), ref, x: I(x), y: I(y), rotation: bearingToRotation(bearing), ...extra };
}

const openings: Opening[] = [
  // North wall: three pairs of French doors with transoms.
  { id: 'fd-west', kind: 'french-door', wall: 0, offset: I(27), width: I(72), height: I(96), sill: 0, swing: 'out', glazed: true, transom: I(18), lites: [1, 1], frame: 'white', label: 'Terrace doors' },
  { id: 'fd-center', kind: 'french-door', wall: 0, offset: I(114), width: I(72), height: I(96), sill: 0, swing: 'out', glazed: true, transom: I(18), lites: [1, 1], frame: 'white', label: 'Terrace doors' },
  { id: 'fd-east', kind: 'french-door', wall: 0, offset: I(201), width: I(72), height: I(96), sill: 0, swing: 'out', glazed: true, transom: I(18), lites: [1, 1], frame: 'white', label: 'Terrace doors' },
  // East wall: arched glass door to the hall, the arched oak-lined built-in.
  { id: 'door-hall', kind: 'door', wall: 1, offset: I(90), width: I(42), height: I(96), sill: 0, swing: 'in', hinge: 'start', archRise: I(21), glazed: true, lites: [2, 5], frame: 'oak', label: 'Hall door' },
  {
    id: 'niche',
    kind: 'niche',
    wall: 1,
    offset: I(162),
    width: I(90),
    height: I(90),
    sill: 0,
    archRise: I(18),
    depth: I(16),
    niche: { baseHeight: I(36), baseStyle: 'panel-doors', shelves: 3, lining: 'oak', mirrorBack: true, lit: true },
    label: 'Arched built-in',
  },
  // South wall: arched glass door beside the library wall.
  { id: 'door-den', kind: 'door', wall: 2, offset: I(9), width: I(42), height: I(96), sill: 0, swing: 'in', hinge: 'end', archRise: I(21), glazed: true, lites: [2, 6], frame: 'oak', label: 'Den door' },
];

const fixtures: Item[] = [
  // Library wall: white shelves to the ceiling over a white-oak base with a curved end.
  at('builtin-shelves', 108, 266, 0, {
    id: 'shelves-south',
    w: I(216),
    d: I(20),
    fixed: true,
    wall: 2,
    params: { bays: 5, baseH: I(32), baseD: I(20), upperD: I(12), curvedEnd: 'left', curveLen: I(20), baseStyle: 'flat', lit: true },
    finishes: { fronts: 'oak-white', top: 'oak-white', body: 'paint-white' },
    label: 'Library wall',
  }),
  // Fireplace wall: shelves either side of a plaster breast with a linear gas insert.
  at('builtin-shelves', 8, 218, 90, {
    id: 'shelves-west-s',
    w: I(76),
    d: I(16),
    fixed: true,
    wall: 3,
    params: { bays: 2, baseH: I(30), baseD: I(16), upperD: I(12), baseStyle: 'panel', lit: true },
    finishes: { fronts: 'oak-white', top: 'oak-white', body: 'paint-white' },
    label: 'Shelves',
  }),
  at('builtin-fireplace', 8, 138, 90, {
    id: 'fireplace',
    w: I(84),
    d: I(16),
    fixed: true,
    wall: 3,
    params: { fireboxW: I(42), fireboxH: I(24), sill: I(16), hearthD: I(18) },
    finishes: { body: 'paint-white' },
    label: 'Fireplace',
  }),
  at('builtin-shelves', 8, 58, 90, {
    id: 'shelves-west-n',
    w: I(76),
    d: I(16),
    fixed: true,
    wall: 3,
    params: { bays: 2, baseH: I(30), baseD: I(16), upperD: I(12), baseStyle: 'panel', lit: true },
    finishes: { fronts: 'oak-white', top: 'oak-white', body: 'paint-white' },
    label: 'Shelves',
  }),
  // Three framed photographs over the fireplace, with a picture light.
  at('fixture-art', 16.6, 108, 90, { id: 'art-1', wall: 3, w: I(24), h: I(31), d: I(1.2), elevation: I(80), fixed: true, params: { frame: 'thin-black', image: 'portrait-slate', mat: false } }),
  at('fixture-art', 16.6, 138, 90, { id: 'art-2', wall: 3, w: I(24), h: I(31), d: I(1.2), elevation: I(80), fixed: true, params: { frame: 'thin-black', image: 'portrait-rose', mat: false } }),
  at('fixture-art', 16.6, 168, 90, { id: 'art-3', wall: 3, w: I(24), h: I(31), d: I(1.2), elevation: I(80), fixed: true, params: { frame: 'thin-black', image: 'portrait-sand', mat: false } }),
  at('fixture-picture-light', 18, 138, 90, { id: 'picture-light', wall: 3, w: I(34), d: I(4), h: I(2), elevation: I(101), fixed: true }),
  // Large tan canvas on the east wall.
  at('art-minimal', 299.2, 52, 270, { id: 'canvas', wall: 1, w: I(46), h: I(58), d: I(1.6), elevation: I(64), fixed: true, label: 'Tan canvas' }),
  // Sheer curtain stacks at each end of the window wall.
  at('fixture-curtain', 13.5, 3, 180, { id: 'curtain-w', wall: 0, w: I(26), d: I(5), h: I(124), fixed: true }),
  at('fixture-curtain', 286.5, 3, 180, { id: 'curtain-e', wall: 0, w: I(26), d: I(5), h: I(124), fixed: true }),
];

function chairsAround(cx: number, cy: number, radius: number, bearings: number[]): Item[] {
  return bearings.map((b, i) => {
    const r = (b * Math.PI) / 180;
    return at('own-dining-chair', cx + Math.sin(r) * radius, cy - Math.cos(r) * radius, (b + 180) % 360, { id: `dining-chair-${i + 1}` });
  });
}

export function greatRoomAsIs(roomId: string): Layout {
  const items: Item[] = [
    at('own-rug', 106, 138, 180, { id: 'rug' }),
    at('own-sofa', 132, 138, 270, { id: 'sofa' }),
    at('own-coffee', 80, 138, 270, { id: 'coffee-table' }),
    at('own-lounge', 74, 196, 0, { id: 'lounge-s' }),
    at('own-lounge', 74, 80, 180, { id: 'lounge-n' }),
    at('own-bench', 164, 138, 90, { id: 'bench' }),
    at('own-side', 134, 72, 270, { id: 'side-table' }),
    at('own-drum-lamp', 122, 206, 270, { id: 'drum-lamp' }),
    at('own-flint', 40, 208, 45, { id: 'reading-lamp' }),
    at('own-lily', 166, 198, 0, { id: 'peace-lily' }),
    at('own-guitar', 30, 90, 110, { id: 'guitar' }),
    at('own-bw802', 34, 28, 125, { id: 'speaker-w' }),
    at('own-bw802', 274, 26, 230, { id: 'speaker-e' }),
    at('own-round-table', 214, 78, 0, { id: 'round-table' }),
    ...chairsAround(214, 78, 35, [45, 135, 225, 315]),
    at('own-desk-lamp', 250, 24, 200, { id: 'table-lamp' }),
    at('own-play-table', 222, 190, 0, { id: 'play-table' }),
    at('own-bouncer-pink', 187, 148, 200, { id: 'bouncer-pink' }),
    at('own-bouncer', 140, 214, 300, { id: 'bouncer' }),
  ];
  const now = Date.now();
  return {
    id: `${roomId}~as-is`,
    roomId,
    name: 'As it is today',
    direction: 'Current',
    concept: 'Your room as photographed: sofa facing the fireplace between two bouclé chairs, the round table working as a desk by the east terrace doors, the play table by the den door.',
    items,
    source: 'as-is',
    createdAt: now,
    updatedAt: now,
  };
}

export function greatRoom(): { room: Room; layouts: Layout[] } {
  const now = Date.now();
  const roomId = 'great-room';
  const room: Room = {
    id: roomId,
    name: 'Great Room',
    kind: 'living',
    outline: [
      { x: 0, y: 0 },
      { x: I(300), y: 0 },
      { x: I(300), y: I(276) },
      { x: 0, y: I(276) },
    ],
    ceilingHeight: I(126),
    wallThickness: I(6),
    walls: [{ treatment: 'plain' }, { treatment: 'paneled' }, { treatment: 'paneled' }, { treatment: 'plain' }],
    openings,
    fixtures,
    finishes: {
      floor: 'wood-dark',
      floorColor: '#3B291E',
      wallColor: '#F1EEE7',
      trimColor: '#F4F2EC',
      baseboard: I(8.5),
      crown: true,
      ceiling: { style: 'coffered', grid: [5, 4], beamWidth: I(9), beamDepth: I(9), potLights: true },
    },
    outlook: 'water',
    photos: [],
    goals: ['Hi-fi listening', 'Baby play', 'Quiet reading and tea for two', 'Family lounging', 'Christmas'],
    notes:
      'Coffered ceiling, dark oak floors. Fireplace wall flanked by built-in shelves; long library wall with a curved white-oak base; arched oak-lined built-in between two arched glass doors; three pairs of French doors to a covered terrace with a water view. Owners are audiophiles (B&W 802 D4 pair, McIntosh amplification on the shelves) with a baby.',
    layoutOrder: [`${roomId}~as-is`],
    activeLayoutId: `${roomId}~as-is`,
    northAngle: 0,
    createdAt: now,
    updatedAt: now,
    survey: {
      method: 'photos',
      confidence: 'medium',
      note: 'Estimated from 5 photos: about 25′ × 23′ with a 10′-6″ coffered ceiling. Add a floor plan or measure one wall to calibrate.',
    },
  };
  return { room, layouts: [greatRoomAsIs(roomId)] };
}
