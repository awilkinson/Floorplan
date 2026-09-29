// Core data model. All lengths are meters, angles radians, unless noted.
// Plan coordinates: x grows to the right (plan east), y grows down (plan south),
// origin at the top-left of the room's bounding box. In 3D, plan (x, y) maps to
// world (x, 0, y) with +Y up.
//
// Item rotation is clockwise-positive in plan view. At rotation 0 an item's
// front faces +y (the bottom of the plan).

export type Vec2 = { x: number; y: number };

export type RoomKind =
  | 'living'
  | 'family'
  | 'bedroom'
  | 'nursery'
  | 'dining'
  | 'office'
  | 'kitchen'
  | 'den'
  | 'other';

export type OpeningKind =
  | 'door'
  | 'double-door'
  | 'french-door'
  | 'sliding-door'
  | 'pocket-door'
  | 'window'
  | 'opening'
  | 'archway'
  | 'niche';

export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Index of the wall edge: outline[wall] -> outline[wall + 1]. */
  wall: number;
  /** Distance along the wall from its start corner to the opening's near side. */
  offset: number;
  width: number;
  /** Height of the clear opening (door head / window head) above the floor, excluding arch or transom. */
  height: number;
  /** Sill height for windows; 0 for doors. */
  sill: number;
  /** Door swing: into the room, or out of it. Ignored for windows and openings. */
  swing?: 'in' | 'out';
  /** Which jamb carries the hinge, relative to the wall direction. */
  hinge?: 'start' | 'end';
  /** Arched head: rise of the arch in meters (0 or undefined = square head). */
  archRise?: number;
  /** Height of a glazed transom above the door head. */
  transom?: number;
  glazed?: boolean;
  /** Number of glass panes across and down per leaf (true divided lites). */
  lites?: [number, number];
  frame?: 'white' | 'oak' | 'black' | 'bronze';
  /** Niche depth into the wall (kind === 'niche'). */
  depth?: number;
  /** Niche fit-out. */
  niche?: {
    baseHeight: number;
    baseStyle: 'panel-doors' | 'flat-oak' | 'open';
    shelves: number;
    lining: 'oak' | 'white' | 'walnut';
    mirrorBack?: boolean;
    lit?: boolean;
  };
  curtains?: boolean;
  label?: string;
}

export type WallTreatment = 'plain' | 'paneled' | 'wainscot' | 'shiplap';

export interface WallSpec {
  treatment?: WallTreatment;
  color?: string;
}

export type FloorKind = 'wood-dark' | 'wood-mid' | 'wood-light' | 'herringbone' | 'stone' | 'concrete' | 'carpet' | 'tile';

export interface CeilingSpec {
  style: 'flat' | 'coffered' | 'beamed' | 'tray';
  /** Coffer grid counts along x and y. */
  grid?: [number, number];
  beamWidth?: number;
  beamDepth?: number;
  color?: string;
  potLights?: boolean;
}

export interface RoomFinishes {
  floor: FloorKind;
  floorColor?: string;
  wallColor: string;
  trimColor: string;
  baseboard: number;
  crown: boolean;
  ceiling: CeilingSpec;
}

export interface AssetRef {
  /** Asset store id (32 hex chars) or a local key when running offline. */
  id: string;
  /** Resolved display URL for this session (not persisted). */
  url?: string;
  caption?: string;
  kind?: 'photo' | 'plan' | 'product' | 'texture';
  width?: number;
  height?: number;
}

export interface PlanUnderlay {
  asset: AssetRef;
  /** Meters per image pixel. */
  scale: number;
  /** Plan position of the image's top-left corner. */
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
}

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  /** Interior face of the walls, in order around the room. */
  outline: Vec2[];
  ceilingHeight: number;
  wallThickness: number;
  walls: WallSpec[];
  openings: Opening[];
  /** Built-ins and other fixed pieces that belong to the architecture. */
  fixtures: Item[];
  finishes: RoomFinishes;
  /** What is outside the windows, for the 3D view. */
  outlook?: 'water' | 'garden' | 'city' | 'none';
  photos: AssetRef[];
  underlay?: PlanUnderlay;
  /** What the room needs to do well; the designer plans around these. */
  goals: string[];
  notes: string;
  layoutOrder: string[];
  activeLayoutId?: string;
  /** Plan north offset (radians) for the north arrow. */
  northAngle?: number;
  createdAt: number;
  updatedAt: number;
  /** How the room was captured and how sure we are about its dimensions. */
  survey?: {
    method: 'photos' | 'plan' | 'photos+plan' | 'manual' | 'template';
    confidence?: 'low' | 'medium' | 'high';
    note?: string;
  };
}

export interface Item {
  id: string;
  /** Catalog entry id. */
  ref: string;
  x: number;
  y: number;
  rotation: number;
  /** Overrides of the catalog entry's size. */
  w?: number;
  d?: number;
  h?: number;
  /** Height above the floor (wall art, pieces on a surface). */
  elevation?: number;
  /** Finish choice per material slot, e.g. { upholstery: 'boucle-ivory' }. */
  finishes?: Record<string, string>;
  /** Generator parameter overrides. */
  params?: Record<string, unknown>;
  label?: string;
  locked?: boolean;
  /** Fixed pieces are part of the room, not the layout. */
  fixed?: boolean;
  /** Wall this piece is set against, when attached. */
  wall?: number;
  hidden?: boolean;
}

export interface Zone {
  kind: 'play' | 'listening' | 'conversation' | 'reading' | 'tea' | 'tree' | 'work' | 'dining' | 'path' | 'note';
  /** Center and size of the zone's rectangle, or a circle when r is set. */
  x: number;
  y: number;
  w?: number;
  d?: number;
  r?: number;
  label?: string;
}

export interface Layout {
  id: string;
  roomId: string;
  name: string;
  /** Design direction, e.g. "Warm minimal". */
  direction?: string;
  concept?: string;
  moves?: string[];
  items: Item[];
  zones?: Zone[];
  source: 'as-is' | 'manual' | 'ai';
  /** Occasion this layout is for, e.g. Christmas. */
  occasion?: string;
  createdAt: number;
  updatedAt: number;
}

export type Category =
  | 'sofa'
  | 'sectional'
  | 'lounge-chair'
  | 'ottoman'
  | 'dining-chair'
  | 'coffee-table'
  | 'side-table'
  | 'dining-table'
  | 'desk'
  | 'console'
  | 'storage'
  | 'bed'
  | 'rug'
  | 'floor-lamp'
  | 'table-lamp'
  | 'plant'
  | 'hifi'
  | 'music'
  | 'baby'
  | 'seasonal'
  | 'bench'
  | 'art'
  | 'media'
  | 'office-chair'
  | 'decor'
  | 'builtin';

export type MaterialSlot = string;

export interface CatalogEntry {
  id: string;
  name: string;
  brand?: string;
  designer?: string;
  category: Category;
  generator: string;
  params: Record<string, unknown>;
  /** Default size (meters). */
  w: number;
  d: number;
  h: number;
  /** Default finish per slot. */
  finishes: Record<MaterialSlot, string>;
  /** Allowed finishes per slot (defaults to every finish of the slot's family). */
  options?: Record<MaterialSlot, string[]>;
  styles: string[];
  /** Approximate retail price, display only. */
  price?: string;
  url?: string;
  tags?: string[];
  owned?: boolean;
  /** Mounting: floor (default), wall (art, TV), or surface (table lamps). */
  mount?: 'floor' | 'wall' | 'surface';
  description?: string;
  /** Custom pieces added from a link or photo. */
  custom?: boolean;
  image?: AssetRef;
  resizable?: boolean;
}

export type ViewMode = '3d' | 'split' | 'plan';
export type Units = 'imperial' | 'metric';
