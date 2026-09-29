import type { Generator } from './parts';
import { bench, curvedSofa, daybed, diningChair, loungeChair, officeChair, ottoman, pleatedLounge, quiltedModular, sectional, sofa } from './gen/seating';
import { storage, table, usm } from './gen/tables';
import { floorLamp, pictureLight, tableLamp } from './gen/lighting';
import { art, baby, bed, christmasTree, curtain, guitar, mirror, person, piano, plant, rug, speaker, tv } from './gen/misc';
import { cabinetRun, column, fireplace, shelvingRun } from './gen/builtins';

export const GENERATORS: Record<string, Generator> = {
  sofa,
  sectional,
  curvedSofa,
  quiltedModular,
  pleatedLounge,
  loungeChair,
  ottoman,
  bench,
  daybed,
  diningChair,
  officeChair,
  table,
  storage,
  usm,
  floorLamp,
  tableLamp,
  pictureLight,
  rug,
  plant,
  christmasTree,
  speaker,
  piano,
  bed,
  baby,
  guitar,
  art,
  tv,
  curtain,
  mirror,
  person,
  shelvingRun,
  fireplace,
  cabinetRun,
  column,
};

/** A compact description of each generator's knobs, for the AI when it builds new pieces. */
export const GENERATOR_GUIDE = `
sofa: {arms:'track'|'slope'|'round'|'none'|'shelter'|'block'|'wood'|'thin', armW(m), armH(m), back:'loose'|'tight'|'pillows'|'channel', base:'legs'|'plinth'|'floating'|'skirt'|'bun'|'metal'|'sled', legH(m), seatH(m), seats(int), pillows(int), round(m edge radius), twoTone(bool: separate 'cushions' slot)}  slots: upholstery, cushions?, pillows, accent, legs
sectional: {kind:'L'|'chaise'|'U', side:'left'|'right', seatDepth(m), base:'floating'|'legs'|'metal'}  slots: upholstery, pillows, accent, legs
curvedSofa: {seatDepth(m), seats(int)}  slots: upholstery, pillows
quiltedModular: {module(m), arms(bool), back(bool)}  slots: upholstery   (Camaleonda-like)
pleatedLounge: {rolls(int), arms(bool)}  slots: upholstery   (Togo-like)
loungeChair: {style:'club'|'boxy'|'barrel'|'slipper'|'jeanneret'|'spanish'|'papercord'|'eames'|'womb'|'egg'|'wing'|'barcelona'|'lc2'|'swivel'|'rocker'|'glider'|'pacha'|'wire', base, legH, seatH}  slots vary: upholstery, legs, frame, panel, seat, shell, cushions
ottoman: {style:'box'|'round'|'pouf'|'eames', legH}  slots: upholstery, legs
bench: {top:'upholstered'|'woven'|'wood', legs:'square'|'tapered'|'metal'|'panel'}  slots: upholstery|seat, frame
daybed: {legH, bolster(bool)}  slots: frame, upholstery
diningChair: {style:'upholstered'|'cab'|'wishbone'|'cane'|'shell'|'bentwood'}  slots: upholstery|seat|shell, frame
table: {shape:'rect'|'round'|'oval'|'racetrack'|'square'|'blob'|'noguchi'|'rounded', base:'legs'|'tapered'|'splay'|'metal'|'pedestal'|'column'|'tulip'|'conic'|'trestle'|'plinth'|'drum'|'cylinders'|'panel'|'waterfall'|'platner'|'e1027'|'x'|'hairpin'|'sawhorse', topT(m), styling:'none'|'books'|'books-bowl'|'full', shelf(bool), drawer(bool)}  slots: top, base
storage: {kind:'credenza'|'sideboard'|'media'|'dresser'|'nightstand'|'bookcase'|'record'|'toy-shelf', doors(int), drawers(int), open(bool), legs:'legs'|'plinth'|'metal'|'none', handle:'bar'|'knob'|'none'}  slots: body, fronts, legs
floorLamp: {style:'drum'|'tripod'|'arc'|'akari'|'globe'|'captain-flint'|'task'|'tmm'|'grashoppa'|'mouille'|'torchiere', shadeR(m), shadeH(m)}  slots: shade, frame, base
tableLamp: {style:'ceramic'|'mushroom'|'akari'}  slots: shade, base
rug: {shape:'rect'|'round'|'organic'}  slots: rug (colorway)
plant: {species:'fiddle'|'olive'|'bird'|'palm'|'monstera'|'snake'|'lily'|'ficus', pot:'cylinder'|'tapered'|'bowl'|'urn'|'basket'}  slots: pot
speaker: {style:'bw800'|'tower'|'standmount'|'sub'}  slots: cabinet
piano: {kind:'grand'|'upright'}  slots: body
bed: {headboard:'upholstered'|'channel'|'wood'|'none', legH}  slots: frame, upholstery, bedding, legs
`;
