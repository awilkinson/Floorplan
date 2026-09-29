import { CATALOG, STYLES } from '../catalog/catalog';
import { FINISHES } from '../catalog/finishes';
import { GENERATOR_GUIDE } from '../catalog/generators';
import { bounds, walls } from '../model/geometry';
import type { CatalogEntry, Item, Layout, Room } from '../model/types';
import { rotationToBearing, toIn } from '../model/units';
import type { Analysis } from '../design/checks';

// Everything the designer knows is in these prompts. Coordinates are inches from
// the room's north-west corner (x east, y south); orientation is the compass
// bearing an item's FRONT faces.

const r0 = (m: number) => Math.round(toIn(m));

export const DESIGNER = `You are the designer inside Floorplan Studio — a world-class interior designer and space planner. You can work convincingly in many registers: the calm of Vincent Van Duysen and Norm Architects, the layered warmth of Rose Uniacke and Axel Vervoordt, the sculptural confidence of Pierre Yovanovitch and Joseph Dirand, the Italian ease of Minotti and B&B Italia interiors, the collected personality of Kelly Wearstler or a great Parisian apartment. You plan like an architect: circulation first, then focal points and sightlines, then conversation, then light and material.

Principles you apply without being asked:
- Circulation: main walkways 36" clear (30" on minor routes). Keep door swings and the approach to glass doors clear. Don't make people walk through a conversation group.
- Anchor: a rug big enough for at least the front legs of every seat in the group; leave 8–24" of floor between the rug and walls or built-ins.
- Conversation: seats inside a 10' circle, facing each other or a shared focus; 14–18" from sofa to coffee table; coffee table about 2/3 the sofa length; side table within reach of every seat.
- Architecture: center on the fireplace and symmetrical built-ins; never block built-ins, the view or glass doors; respect the rhythm of the ceiling and openings. Float groups in a big room instead of pushing everything to the walls.
- Light: every seating group gets a lamp; reading chairs get light over the shoulder; balance ambient, task and accent.
- Restraint: fewer, better pieces; generous negative space; mix eras and materials deliberately; one bold move per scheme.
- Real life: design for this household's goals. Hi-fi: an equilateral listening triangle — speakers 2–3' from walls, toed in toward a listening seat at the apex, the seat off the back wall, ideally about 38% into the room; symmetric side walls if you can. Baby: a soft, open floor zone at least 6' across, away from the fireplace and hard edges; no glass tables; a hearth gate near the fire. Christmas: tree at least 3' from the fireplace, seen from the sofa and from outside, never in a walkway. Tea for two / reading: two comfortable chairs angled toward each other with a small table and a lamp, ideally with the view.
- Keep the owners' pieces (marked OWNED) when they work — say so — and add new catalog pieces only where they make a real difference.`;

const COORDS = `Coordinates: inches from the room's north-west corner; x increases to the east, y increases to the south. Every item is placed by its CENTER. "facing" is the compass bearing its FRONT faces: 0 = north (up the plan), 90 = east, 180 = south, 270 = west. A sofa against the south wall faces 0; a chair across the room looking west faces 270. W is side-to-side width, D is front-to-back depth.`;

function wallName(room: Room, i: number) {
  const w = walls(room)[i];
  if (!w) return `W${i + 1}`;
  const n = w.normal;
  // the wall's own side of the room, named by the direction you'd face to look at it
  const side = Math.abs(n.x) > Math.abs(n.y) ? (n.x > 0 ? 'west' : 'east') : n.y > 0 ? 'north' : 'south';
  return `W${i + 1} (${side} wall)`;
}

function span(room: Room, wall: number, offset: number, width: number) {
  const w = walls(room)[wall];
  const a = { x: w.a.x + w.dir.x * offset, y: w.a.y + w.dir.y * offset };
  const b = { x: w.a.x + w.dir.x * (offset + width), y: w.a.y + w.dir.y * (offset + width) };
  if (Math.abs(w.dir.x) > Math.abs(w.dir.y)) return `x=${r0(Math.min(a.x, b.x))}–${r0(Math.max(a.x, b.x))}`;
  return `y=${r0(Math.min(a.y, b.y))}–${r0(Math.max(a.y, b.y))}`;
}

function sizeStr(it: Item, e: CatalogEntry) {
  return `${r0(it.w ?? e.w)}×${r0(it.d ?? e.d)}×${r0(it.h ?? e.h)}`;
}

export function roomBrief(room: Room, catalog: Record<string, CatalogEntry>): string {
  const b = bounds(room.outline);
  const ws = walls(room);
  const lines: string[] = [];
  lines.push(`ROOM "${room.name}" (${room.kind}). About ${r0(b.w)}" east–west × ${r0(b.h)}" north–south; ceiling ${r0(room.ceilingHeight)}". ${room.finishes.ceiling.style} ceiling, ${room.finishes.floor.replace('-', ' ')} floor, walls ${room.finishes.wallColor}.${room.outlook && room.outlook !== 'none' ? ` Outlook: ${room.outlook} view.` : ''}`);
  if (room.survey?.note) lines.push(`Survey: ${room.survey.note}`);
  lines.push(`Outline (inner faces, clockwise): ${room.outline.map((p) => `(${r0(p.x)},${r0(p.y)})`).join(' ')}`);
  lines.push('WALLS AND OPENINGS:');
  for (const w of ws) {
    const ops = room.openings.filter((o) => o.wall === w.index);
    const desc = ops
      .map((o) => {
        const k = o.kind === 'niche' ? 'recessed built-in niche (do not block)' : `${o.label ? o.label + ': ' : ''}${o.kind}${o.swing && o.kind !== 'window' ? `, swings ${o.swing}` : ''}${o.sill ? `, sill ${r0(o.sill)}"` : ''}`;
        return `${k} at ${span(room, o.wall, o.offset, o.width)}`;
      })
      .join('; ');
    lines.push(`- ${wallName(room, w.index)}: (${r0(w.a.x)},${r0(w.a.y)})→(${r0(w.b.x)},${r0(w.b.y)}), ${r0(w.length)}".${desc ? ' ' + desc + '.' : ''}`);
  }
  if (room.fixtures.length) {
    lines.push('FIXED BUILT-INS (part of the architecture — keep clear, never move):');
    for (const f of room.fixtures) {
      const e = catalog[f.ref];
      if (!e) continue;
      if (e.generator === 'curtain' || e.generator === 'pictureLight') continue;
      const extra = e.generator === 'fireplace' ? `; hearth extends ${r0((f.params?.hearthD as number) ?? 0.45)}" into the room — keep 36" clear in front, it's a heat source` : e.generator === 'shelvingRun' ? '; keep 24" clear in front of the shelves' : '';
      lines.push(`- ${f.label ?? e.name}: center (${r0(f.x)},${r0(f.y)}), ${r0(f.w ?? e.w)}×${r0(f.d ?? e.d)}, faces ${rotationToBearing(f.rotation)}${e.mount === 'wall' ? `, hung on the wall at ${r0(f.elevation ?? 1.4)}"` : ''}${extra}`);
    }
  }
  if (room.goals.length) lines.push(`WHAT THE ROOM NEEDS TO DO: ${room.goals.join('; ')}.`);
  if (room.notes) lines.push(`OWNER NOTES: ${room.notes}`);
  return lines.join('\n');
}

export function layoutBrief(layout: Layout | null, catalog: Record<string, CatalogEntry>): string {
  if (!layout || !layout.items.length) return 'FURNITURE NOW: (empty room)';
  const lines = [`FURNITURE NOW — layout "${layout.name}" (id | ref | name | center | facing | W×D×H):`];
  for (const it of layout.items) {
    const e = catalog[it.ref];
    if (!e) continue;
    const fin = it.finishes ? ` | finish ${Object.entries(it.finishes).map(([k, v]) => `${k}=${v}`).join(',')}` : '';
    lines.push(`- ${it.id} | ${it.ref} | ${e.name}${e.owned ? ' (OWNED)' : ''} | (${r0(it.x)},${r0(it.y)}) | ${rotationToBearing(it.rotation)} | ${sizeStr(it, e)}${e.mount === 'wall' ? ` | on wall at ${r0(it.elevation ?? 1.4)}"` : ''}${fin}`);
  }
  return lines.join('\n');
}

export function analysisBrief(a: Analysis | null): string {
  if (!a) return '';
  const issues = a.checks.filter((c) => c.status !== 'good');
  const good = a.checks.filter((c) => c.status === 'good');
  const out = [`PLANNER CHECKS (score ${a.score}/100):`];
  for (const c of issues) out.push(`- [${c.status}] ${c.label}${c.detail ? ' — ' + c.detail : ''}`);
  if (good.length) out.push(`- working: ${good.map((c) => c.label).join('; ')}`);
  if (a.playZone) out.push(`- largest open floor: ${r0(a.playZone.r * 2)}" circle centered (${r0(a.playZone.x)},${r0(a.playZone.y)})`);
  if (a.treeSpot) out.push(`- best spot for a tree: (${r0(a.treeSpot.x)},${r0(a.treeSpot.y)})`);
  return out.join('\n');
}

export function catalogBrief(custom: Record<string, CatalogEntry>, opts: { compact?: boolean } = {}): string {
  const all = [...Object.values(custom), ...CATALOG].filter((e) => e.category !== 'builtin');
  const lines = ['CATALOG (ref | name | maker | W×D×H in | category | styles | price):'];
  for (const e of all) {
    const maker = [e.brand, e.designer].filter(Boolean).join(' · ') || '—';
    lines.push(`${e.id} | ${e.name}${e.owned ? ' (OWNED)' : ''}${e.custom ? ' (added by owner)' : ''} | ${opts.compact ? (e.brand ?? '—') : maker} | ${r0(e.w)}×${r0(e.d)}×${r0(e.h)} | ${e.category}${e.mount && e.mount !== 'floor' ? ' (' + e.mount + ')' : ''} | ${e.styles.join(',') || '—'} | ${e.price ?? '—'}`);
  }
  lines.push(`STYLES: ${STYLES.map((s) => `${s.id} = ${s.name} (${s.blurb})`).join('; ')}`);
  return lines.join('\n');
}

export function finishBrief(): string {
  const fam: Record<string, string[]> = {};
  for (const f of FINISHES) {
    if (f.family === 'foliage' || f.family === 'special') continue;
    (fam[f.family] ??= []).push(f.id);
  }
  return `FINISH IDS by family (use in "finish" maps, keyed by slot such as upholstery, cushions, pillows, legs, frame, top, base, body, fronts, shade, pot, rug, seat, shell): ${Object.entries(fam)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join(' | ')}`;
}

// ---------------------------------------------------------------------------

export interface IdeaRequest {
  count: number;
  brief?: string;
  occasion?: string;
  feature?: { ref: string; name: string };
  keepClose?: boolean;
}

export function ideasPrompt(room: Room, layout: Layout | null, catalog: Record<string, CatalogEntry>, custom: Record<string, CatalogEntry>, a: Analysis | null, req: IdeaRequest): string {
  const range =
    req.count >= 3
      ? `Make the ${req.count} ideas genuinely different — different design directions (choose from the STYLES, and name the direction in your own words) AND different plans: e.g. one that evolves the current arrangement with a few smart moves, one bolder rearrangement of the zones, and one that reimagines the room with new pieces. Each must still work for every goal.`
      : 'Make it the strongest scheme you can.';
  const feat = req.feature ? `\nThe owner wants to see the new piece "${req.feature.name}" (ref ${req.feature.ref}) in the room: every idea must include it, placed where it looks and works best.` : '';
  const occ = req.occasion ? `\nOccasion: design for ${req.occasion}.` : '';
  const brief = req.brief ? `\nOWNER'S REQUEST: ${req.brief}` : '';
  return `TASK: ideas
${DESIGNER}

${COORDS}

${roomBrief(room, catalog)}

${layoutBrief(layout, catalog)}

${analysisBrief(a)}

${catalogBrief(custom, { compact: true })}

${finishBrief()}
${brief}${occ}${feat}

Design ${req.count} complete layout idea${req.count > 1 ? 's' : ''} for this room. ${range}

Rules for the plan:
- A layout replaces the furniture above: list EVERY piece that should be in the room, including rugs, lamps, plants and art. Keep an owned piece's existing id when you keep it; give new pieces a short new id.
- Use only refs from the CATALOG. You may override W/D (inches) for resizable pieces such as rugs, tables and sofas, and set finishes with FINISH IDS.
- Place by center in inches. Nothing may overlap another piece (dining chairs may tuck under a table; a bench may touch the back of a sofa), sit inside a built-in, cross a wall, block a door swing or the approach to glass doors. Keep 36" main paths.
- Wall art and TVs (mount wall) go on a wall: place the center 1" out from the wall face and give "elevation" (inches, center height). Table lamps (mount surface) go on a table's top: use the same x,y as a point on that table.
- Include "zones" for the areas that matter to the goals (listening seat, play floor, tea for two, tree…).

Reply with ${req.count} JSON object${req.count > 1 ? 's' : ''}, ONE PER LINE (JSON Lines), no other text, no code fences. Each object:
{"name":"evocative 2–4 word name","direction":"design direction in 2–4 words","concept":"2–3 sentences: the idea and how it serves the goals","moves":["short bullet of a key move and why", "…3–6 bullets"],"items":[{"id":"sofa","ref":"own-sofa","x":150,"y":138,"facing":270,"w":110,"d":40,"finish":{"upholstery":"boucle-oat"},"elevation":60}],"zones":[{"kind":"listening|play|conversation|reading|tea|tree|dining|work|note","label":"LISTENING SEAT","x":0,"y":0,"w":60,"d":60}],"shopping":["refs of new pieces to buy"]}
Omit optional fields you don't need (w, d, finish, elevation).`;
}

export function editPrompt(room: Room, layout: Layout | null, catalog: Record<string, CatalogEntry>, custom: Record<string, CatalogEntry>, a: Analysis | null, request: string, history: { role: 'user' | 'assistant'; text: string }[], focus?: string[]): string {
  const past = history.slice(-8).map((h) => `${h.role === 'user' ? 'OWNER' : 'YOU'}: ${h.text}`).join('\n');
  return `TASK: edit
${DESIGNER}

${COORDS}

${roomBrief(room, catalog)}

${layoutBrief(layout, catalog)}

${analysisBrief(a)}

${catalogBrief(custom, { compact: true })}

${finishBrief()}
${past ? `\nCONVERSATION SO FAR:\n${past}\n` : ''}${focus?.length ? `\nThe owner has selected: ${focus.join(', ')}.` : ''}
OWNER: ${request}

Answer as the designer. If they ask for a change, make it with the fewest, best moves and keep everything else where it is; if they ask a question or want a critique, answer it and change nothing unless they asked. Follow every planning rule (no overlaps, clear doors and paths, pieces inside the room, wall pieces on walls with elevation).

Reply with ONE JSON object and nothing else:
{"reply":"1–3 sentences in a warm, confident designer voice: what you did and why (or your answer)","ops":[
 {"op":"move","id":"sofa","x":150,"y":138,"facing":270},
 {"op":"add","ref":"flos-arco","id":"arco","x":120,"y":200,"facing":0,"finish":{"base":"marble-nero"}},
 {"op":"remove","id":"bench"},
 {"op":"swap","id":"coffee-table","ref":"travertine-drum","finish":{"top":"travertine"}},
 {"op":"finish","id":"sofa","slot":"upholstery","finish":"boucle-oat"},
 {"op":"resize","id":"rug","w":144,"d":180}
],"zones":[]}
Use "ops": [] when nothing should change. Include "zones" only if they help explain the plan.`;
}

export function productPrompt(url: string | undefined, notes: string | undefined, imageCount: number): string {
  return `TASK: product
You are cataloguing a piece of furniture for a 3D room planner. ${imageCount ? `You have ${imageCount} image(s) of it (product photo or a screenshot of a product page — read any dimensions, materials and price printed on it).` : ''}${url ? ` Product link: ${url} — you cannot open it, but the URL often names the maker and model; use what you know about that exact product.` : ''}${notes ? ` Owner notes: ${notes}` : ''}

Identify the piece and describe it with the planner's parametric generators so it can be drawn in 3D and in plan. Prefer printed or well-known real dimensions; otherwise estimate from proportions and typical sizes for that kind of piece (sofa seat height 16–18", depth 36–42"; lounge chair 30–36" wide; coffee table 14–17" high; dining table 29–30"; floor lamp 55–70").

GENERATORS AND THEIR PARAMETERS:
${GENERATOR_GUIDE}
${finishBrief()}

Reply with ONE JSON object and nothing else:
{"name":"model name as sold","brand":"maker or empty","designer":"designer and year or empty","category":"sofa|sectional|lounge-chair|ottoman|dining-chair|coffee-table|side-table|dining-table|desk|console|storage|bed|rug|floor-lamp|table-lamp|plant|hifi|music|baby|bench|art|media|office-chair|decor","generator":"one of the generators","params":{},"w":0,"d":0,"h":0,"finishes":{"slot":"finish id"},"colors":{"slot":"#hex when no finish id is close"},"styles":["style ids"],"price":"$ range or empty","description":"one line on what makes it special","confidence":"high|medium|low","imageUse":"none|rug|art","dimensionsSource":"printed|known|estimated"}
w, d, h are inches. For rugs and wall art set imageUse so the photo itself is used as the pattern.
"styles" uses these ids: ${STYLES.map((s) => s.id).join(', ')}.
"dimensionsSource": "printed" only when you read the numbers in one of the images; "known" when they are the maker's published size you know; otherwise "estimated".`;
}

export function roomScanPrompt(meta: { name: string; kind: string; photos: number; plans: number; measurements?: string }, custom: Record<string, CatalogEntry>): string {
  return `TASK: scan
You are an architect measuring a room for a 3D planner from ${meta.photos} photo(s)${meta.plans ? ` and ${meta.plans} floor plan image(s) (the plan images come first${meta.plans > 1 ? '; after a full sheet, the next images may be zoomed crops of that same sheet so small dimension text is legible' : ''})` : ''}. The owner calls it "${meta.name}" (${meta.kind}).${meta.measurements ? ` Measurements the owner gave: ${meta.measurements}. Treat these as exact.` : ''}

Be as accurate as you can:
- ${meta.plans ? 'Read the floor plan first: its dimension strings override anything you estimate from photos. Find this room on the plan (by name, or by matching doors, windows and built-ins to the photos).' : 'Work out the size from references in the photos: interior doors are about 80" tall (84–96" in larger homes), door leaves 30–36" wide, French door leaves 30–36", countertops 36", dining tables 29–30", seat height 17–18", outlets about 14" and switches 48" above the floor, baseboards 4–9", typical ceilings 96–120". Cross-check every estimate against two references and across photos.'}
- Build one consistent plan: walls as an outline, then openings on walls, then built-ins, then loose furniture.
- North is the TOP of the plan: make the wall with the most windows or the main view the north wall (W1) unless the plan shows otherwise.

${COORDS}
The outline runs clockwise from the north-west corner (0,0), so W1 is the north wall, then around to the east, south and west walls. For each opening, "offset" is inches along its wall from that wall's start corner (clockwise order) to the near side of the opening.

Use these furniture refs when a piece matches (otherwise the closest generic): ${[...Object.values(custom), ...CATALOG].filter((e) => e.category !== 'builtin' && !e.owned).map((e) => e.id).join(', ')}.

Reply with ONE JSON object and nothing else:
{"name":"${meta.name}","kind":"${meta.kind}","outline":[[0,0],[300,0],[300,276],[0,276]],"ceiling":108,"ceilingStyle":"flat|coffered|beamed","floor":"wood-dark|wood-mid|wood-light|stone|concrete|carpet|tile","wallColor":"#F1EEE7","walls":[{"treatment":"plain|paneled|wainscot"}],"outlook":"water|garden|city|none",
"openings":[{"kind":"door|double-door|french-door|sliding-door|window|opening|archway|niche","wall":0,"offset":27,"width":72,"height":96,"sill":0,"swing":"in|out","hinge":"start|end","arched":false,"glazed":true,"label":"Terrace doors"}],
"fixtures":[{"type":"shelves|fireplace|cabinets|window-seat|column","wall":2,"offset":0,"width":216,"depth":20,"height":126,"label":"Library wall"}],
"furniture":[{"ref":"closest catalog ref","name":"what it is","x":130,"y":140,"facing":270,"w":96,"d":38,"h":30,"finish":{"upholstery":"linen-natural"}}],
"confidence":"low|medium|high","assumptions":["short notes on what you estimated"],"questions":["up to 3 short questions whose answers would most improve accuracy, e.g. 'How long is the fireplace wall?'"]}
Walls array has one entry per outline edge.`;
}
