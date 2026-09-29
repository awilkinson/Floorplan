import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { zipSync, strToU8 } from 'fflate';
import { CATALOG_MAP } from '../catalog/catalog';
import { FINISH_MAP } from '../catalog/finishes';
import { analyzeLayout } from '../design/checks';
import { bounds, offsetPolygon, polygonArea, walls } from '../model/geometry';
import type { CatalogEntry, Item, Layout, Room, Units } from '../model/types';
import { formatArea, formatLength, formatSize, toIn } from '../model/units';
import { activeRoom, displayedLayout, fullCatalog, toast, useStore } from '../state/store';
import { PlanSvg } from '../plan/PlanSvg';
import { PRINT_PALETTE } from '../plan/palette';
import { symbolFor } from '../plan/symbols';
import { saveFile, slug } from './save';

// ---------------------------------------------------------------------------
// Scales and drawing extents

const IMPERIAL_SCALES = [
  { n: 24, label: '1/2″ = 1′-0″' },
  { n: 32, label: '3/8″ = 1′-0″' },
  { n: 48, label: '1/4″ = 1′-0″' },
  { n: 64, label: '3/16″ = 1′-0″' },
  { n: 96, label: '1/8″ = 1′-0″' },
  { n: 192, label: '1/16″ = 1′-0″' },
];
const METRIC_SCALES = [20, 25, 50, 75, 100, 200].map((n) => ({ n, label: `1:${n}` }));

function extents(room: Room) {
  const b = bounds(offsetPolygon(room.outline, room.wallThickness));
  const m = 1.0; // room for dimension strings
  return { x: b.minX - m, y: b.minY - m, w: b.w + m * 2, h: b.h + m * 2 };
}

function pickScale(room: Room, units: Units, availW: number, availH: number) {
  const e = extents(room);
  const list = units === 'metric' ? METRIC_SCALES : IMPERIAL_SCALES;
  for (const s of list) {
    const wIn = toIn(e.w) / s.n;
    const hIn = toIn(e.h) / s.n;
    if (wIn * 72 <= availW && hIn * 72 <= availH) return s;
  }
  return list[list.length - 1];
}

function scheduleOf(layout: Layout | null, catalog: Record<string, CatalogEntry>) {
  const rows: { n: number; entry: CatalogEntry; items: Item[] }[] = [];
  const byKey = new Map<string, { n: number; entry: CatalogEntry; items: Item[] }>();
  const tags: Record<string, number> = {};
  for (const it of layout?.items ?? []) {
    const e = catalog[it.ref];
    if (!e || e.category === 'decor') continue;
    const key = `${it.ref}|${JSON.stringify(it.finishes ?? {})}|${it.w ?? ''}|${it.d ?? ''}`;
    let row = byKey.get(key);
    if (!row) {
      row = { n: rows.length + 1, entry: e, items: [] };
      rows.push(row);
      byKey.set(key, row);
    }
    row.items.push(it);
    tags[it.id] = row.n;
  }
  return { rows, tags };
}

/** Render the plan into a detached SVG element sized in points at a real scale. */
function renderPlanSvg(room: Room, layout: Layout | null, units: Units, scaleN: number, tags?: Record<string, number>, ascii = false): SVGSVGElement {
  const e = extents(room);
  const mpp = (scaleN * 0.0254) / 72; // meters of room per point on paper
  const wPt = e.w / mpp;
  const hPt = e.h / mpp;
  const catalog = fullCatalog();
  // A presentation sheet shows the design, not the planner's critique: keep a
  // listening triangle only when it works, and skip computed suggestions.
  const full = layout ? analyzeLayout(room, layout, useStore.getState().custom) : null;
  const analysis = full ? { ...full, hifi: full.hifi?.ok ? full.hifi : undefined, playZone: undefined, treeSpot: undefined } : null;
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => {
    root.render(
      createElement(
        'svg',
        { xmlns: 'http://www.w3.org/2000/svg', width: wPt, height: hPt, viewBox: `${e.x} ${e.y} ${e.w} ${e.h}` },
        createElement('rect', { x: e.x, y: e.y, width: e.w, height: e.h, fill: '#ffffff' }),
        createElement(PlanSvg, {
          room,
          layout,
          catalog,
          units,
          options: { dims: true, labels: !tags, grid: false, overlays: { circulation: false, clearances: false, hifi: !!analysis?.hifi && room.goals.some((g) => /hi-?fi|listen/i.test(g)), zones: true }, exportMpp: mpp, tags },
          analysis,
          palette: PRINT_PALETTE,
        }),
      ),
    );
  });
  const svg = host.querySelector('svg') as SVGSVGElement;
  root.unmount();
  // print-safe type: concrete fonts, no halo strokes
  svg.querySelectorAll('text').forEach((t) => {
    const st = t.getAttribute('style') ?? '';
    t.setAttribute('style', st.replace(/var\(--font-mono[^)]*\)/g, 'Courier, monospace').replace(/var\(--font-ui[^)]*\)/g, 'Helvetica, Arial, sans-serif').replace(/paint-order:[^;]+;?/g, ''));
    t.removeAttribute('stroke');
    t.removeAttribute('stroke-width');
    t.removeAttribute('paint-order');
    if (ascii) {
      // the PDF's built-in fonts have no prime or fraction glyphs
      t.style.letterSpacing = '';
      const walk = (n: Node) => {
        if (n.nodeType === 3) n.nodeValue = asciiText(n.nodeValue ?? '');
        n.childNodes.forEach(walk);
      };
      walk(t);
    }
  });
  return svg;
}

function asciiText(t: string) {
  return t
    .replace(/(\d)½/g, '$1 1/2')
    .replace(/(\d)¼/g, '$1 1/4')
    .replace(/(\d)¾/g, '$1 3/4')
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"');
}

function drawingTitle(room: Room, layout: Layout | null) {
  return `${room.name} — ${layout?.name ?? 'Layout'}`;
}

// ---------------------------------------------------------------------------

export async function exportPlan(format: 'pdf' | 'svg' | 'png') {
  const room = activeRoom();
  const layout = displayedLayout();
  const units = useStore.getState().units;
  if (!room) return;
  const catalog = fullCatalog();
  try {
    if (format === 'pdf') {
      await exportPdf(room, layout, units, catalog);
      return;
    }
    const scale = pickScale(room, units, 11 * 72, 9 * 72);
    const svg = renderPlanSvg(room, layout, units, scale.n);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = drawingTitle(room, layout);
    svg.prepend(title);
    const xml = new XMLSerializer().serializeToString(svg);
    const name = `${slug(room.name)}-${slug(layout?.name ?? 'plan')}`;
    if (format === 'svg') {
      await saveFile(`${name}.svg`, new Blob([xml], { type: 'image/svg+xml' }));
      return;
    }
    const png = await svgToPng(xml, parseFloat(svg.getAttribute('width')!), parseFloat(svg.getAttribute('height')!), 3);
    await saveFile(`${name}.png`, png);
  } catch (e) {
    console.error(e);
    toast('The drawing couldn’t be exported. Try again, or pick another format.', 'error');
  }
}

async function svgToPng(xml: string, w: number, h: number, k: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportPdf(room: Room, layout: Layout | null, units: Units, catalog: Record<string, CatalogEntry>) {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'tabloid' });
  const W = 1224;
  const H = 792;
  const M = 36;
  const colW = 318;
  const drawW = W - M * 2 - colW - 24;
  const drawH = H - M * 2;
  const { rows, tags } = scheduleOf(layout, catalog);
  const scale = pickScale(room, units, drawW, drawH);
  const svg = renderPlanSvg(room, layout, units, scale.n, tags, true);
  const sw = parseFloat(svg.getAttribute('width')!);
  const sh = parseFloat(svg.getAttribute('height')!);
  const x0 = M + (drawW - sw) / 2;
  const y0 = M + (drawH - sh) / 2;
  document.body.appendChild(svg);
  svg.style.position = 'absolute';
  svg.style.left = '-99999px';
  try {
    await doc.svg(svg, { x: x0, y: y0, width: sw, height: sh });
  } finally {
    svg.remove();
  }
  // sheet border
  doc.setDrawColor(40);
  doc.setLineWidth(0.8);
  doc.rect(M - 12, M - 12, W - (M - 12) * 2, H - (M - 12) * 2);
  const cx = W - M - colW;
  doc.setLineWidth(0.5);
  doc.line(cx - 12, M - 12, cx - 12, H - M + 12);

  // right column
  let y = M + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text('FLOORPLAN STUDIO', cx, y);
  y += 22;
  doc.setTextColor(20);
  doc.setFont('times', 'italic');
  doc.setFontSize(24);
  doc.text(room.name, cx, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(layout?.name ?? 'Layout', cx, y);
  if (layout?.direction) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(layout.direction, cx + doc.getTextWidth((layout?.name ?? '') + '   ') + 4, y);
    doc.setTextColor(20);
  }
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const b = bounds(room.outline);
  const facts = `${formatLength(b.w, units, { compact: true })} × ${formatLength(b.h, units, { compact: true })}   ·   ${formatArea(polygonArea(room.outline), units)}   ·   ceiling ${formatLength(room.ceilingHeight, units, { compact: true })}`;
  doc.setTextColor(90);
  doc.text(facts.replace(/[′]/g, "'").replace(/[″]/g, '"'), cx, y);
  doc.setTextColor(20);
  y += 18;
  if (layout?.concept) {
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(layout.concept, colW);
    doc.text(lines, cx, y);
    y += lines.length * 12 + 8;
  }
  if (layout?.moves?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text('DESIGN MOVES', cx, y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(20);
    layout.moves.slice(0, 6).forEach((m, i) => {
      const lines = doc.splitTextToSize(`${i + 1}.  ${m}`, colW);
      doc.text(lines, cx, y);
      y += lines.length * 10.5 + 3;
    });
    y += 6;
  }
  // furniture schedule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110);
  doc.text('FURNITURE SCHEDULE', cx, y);
  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20);
  doc.setFontSize(7.8);
  const maxY = H - M - 118;
  for (const r of rows) {
    if (y > maxY) {
      doc.setTextColor(110);
      doc.text(`+ ${rows.length - r.n + 1} more`, cx + 16, y);
      break;
    }
    const e = r.entry;
    const it = r.items[0];
    const size = formatSize(it.w ?? e.w, it.d ?? e.d, units).replace(/[″]/g, '"');
    const qty = r.items.length > 1 ? `×${r.items.length} ` : '';
    const maker = e.owned ? 'owned' : [e.brand, e.price].filter(Boolean).join(' · ');
    doc.setDrawColor(40);
    doc.circle(cx + 5, y - 2.6, 5);
    doc.setFontSize(6.5);
    doc.text(String(r.n), cx + 5, y - 0.6, { align: 'center' });
    doc.setFontSize(7.8);
    doc.text(`${qty}${e.name.replace(/^Your /, '')}`, cx + 16, y);
    doc.setTextColor(110);
    doc.text(`${size}${maker ? '  ·  ' + maker : ''}`, cx + 16, y + 9);
    doc.setTextColor(20);
    y += 21;
  }
  // title block
  const tbY = H - M - 96;
  doc.setDrawColor(40);
  doc.setLineWidth(0.6);
  doc.rect(cx, tbY, colW, 96);
  doc.line(cx, tbY + 32, cx + colW, tbY + 32);
  doc.line(cx + colW * 0.62, tbY + 32, cx + colW * 0.62, tbY + 96);
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text('PROJECT', cx + 8, tbY + 11);
  doc.text('SCALE', cx + 8, tbY + 44);
  doc.text('DATE', cx + 8, tbY + 72);
  doc.text('SHEET', cx + colW * 0.62 + 8, tbY + 44);
  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.text(drawingTitle(room, layout).replace(/—/g, '-'), cx + 8, tbY + 25);
  doc.setFontSize(9);
  doc.text(`${scale.label.replace(/[′]/g, "'").replace(/[″]/g, '"')}  (tabloid, 11×17)`, cx + 8, tbY + 57);
  doc.text(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), cx + 8, tbY + 85);
  doc.setFontSize(20);
  doc.text(`A-${101 + Math.max(0, room.layoutOrder.indexOf(layout?.id ?? ''))}`, cx + colW * 0.62 + 8, tbY + 70);
  if (room.survey?.method === 'photos' || (room.survey?.method === 'manual' && room.survey.confidence !== 'high')) {
    doc.setFontSize(6.5);
    doc.setTextColor(140);
    doc.text(room.survey.method === 'photos' ? 'Estimated from photos. Verify on site.' : 'Estimated. Verify on site.', cx + colW * 0.62 + 8, tbY + 86);
  }
  // north arrow
  const nx = cx + colW - 22;
  const ny = tbY - 26;
  doc.setDrawColor(20);
  doc.setFillColor(20, 20, 20);
  doc.triangle(nx, ny - 14, nx - 6, ny + 6, nx, ny + 2, 'F');
  doc.triangle(nx, ny - 14, nx + 6, ny + 6, nx, ny + 2, 'S');
  doc.setFontSize(8);
  doc.text('N', nx, ny + 16, { align: 'center' });
  const blob = doc.output('blob');
  await saveFile(`${slug(room.name)}-${slug(layout?.name ?? 'plan')}.pdf`, blob);
}

// ---------------------------------------------------------------------------

export async function exportSnapshot() {
  const canvas = document.querySelector('.pane-3d canvas') as HTMLCanvasElement | null;
  const room = activeRoom();
  const layout = displayedLayout();
  if (!canvas || !room) {
    toast('Open the 3D view to take a snapshot.', 'info');
    return;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) {
    toast('The snapshot couldn’t be captured.', 'error');
    return;
  }
  await saveFile(`${slug(room.name)}-${slug(layout?.name ?? 'view')}-3d.png`, blob);
}

export async function exportShoppingList() {
  const room = activeRoom();
  const layout = displayedLayout();
  const units = useStore.getState().units;
  if (!room || !layout) return;
  const catalog = fullCatalog();
  const { rows } = scheduleOf(layout, catalog);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [['#', 'Piece', 'Maker', 'Designer', 'Size (W × D × H)', 'Finishes', 'Qty', 'Status', 'Price (approx.)', 'Link'].map(esc).join(',')];
  for (const r of rows) {
    const e = r.entry;
    const it = r.items[0];
    const fin = Object.entries({ ...e.finishes, ...(it.finishes ?? {}) })
      .map(([k, v]) => `${k}: ${FINISH_MAP[v]?.name ?? v}`)
      .join('; ');
    lines.push(
      [String(r.n), e.name, e.brand ?? '', e.designer ?? '', formatSize(it.w ?? e.w, it.d ?? e.d, units, it.h ?? e.h), fin, String(r.items.length), e.owned ? 'Owned' : 'To buy', e.price ?? '', e.url ?? '']
        .map(esc)
        .join(','),
    );
  }
  await saveFile(`${slug(room.name)}-${slug(layout.name)}-shopping-list.csv`, new Blob([lines.join('\n')], { type: 'text/csv' }));
}

export async function exportLayoutJson() {
  const room = activeRoom();
  const layout = displayedLayout();
  if (!room || !layout) return;
  const data = { app: 'Floorplan Studio', version: 1, units: 'meters', room, layout, pieces: Object.fromEntries(layout.items.map((i) => [i.ref, fullCatalog()[i.ref] ?? CATALOG_MAP[i.ref]])) };
  await saveFile(`${slug(room.name)}-${slug(layout.name)}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

// ---------------------------------------------------------------------------
// DXF (R12 ASCII), zipped because the download allow-list has no .dxf.

function dxfHeader() {
  return ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '1', '9', '$MEASUREMENT', '70', '0', '0', 'ENDSEC'].join('\n');
}

function dxfLayers(names: string[]) {
  const out = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(names.length)];
  const colors: Record<string, number> = { WALLS: 7, OPENINGS: 4, FURNITURE: 7, BUILTINS: 8, DIMENSIONS: 5, TEXT: 7 };
  for (const n of names) out.push('0', 'LAYER', '2', n, '70', '0', '62', String(colors[n] ?? 7), '6', 'CONTINUOUS');
  out.push('0', 'ENDTAB', '0', 'ENDSEC');
  return out.join('\n');
}

export async function exportDxf() {
  const room = activeRoom();
  const layout = displayedLayout();
  const units = useStore.getState().units;
  if (!room) return;
  const catalog = fullCatalog();
  const ents: string[] = [];
  // y is flipped for CAD (y up); units are inches
  const X = (m: number) => (toIn(m)).toFixed(3);
  const Y = (m: number) => (-toIn(m)).toFixed(3);
  const poly = (pts: { x: number; y: number }[], layer: string, closed = true) => {
    ents.push('0', 'POLYLINE', '8', layer, '66', '1', '70', closed ? '1' : '0');
    for (const p of pts) ents.push('0', 'VERTEX', '8', layer, '10', X(p.x), '20', Y(p.y));
    ents.push('0', 'SEQEND', '8', layer);
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, layer: string) => ents.push('0', 'LINE', '8', layer, '10', X(a.x), '20', Y(a.y), '11', X(b.x), '21', Y(b.y));
  const text = (p: { x: number; y: number }, s: string, h: number, layer: string) => ents.push('0', 'TEXT', '8', layer, '10', X(p.x), '20', Y(p.y), '40', (toIn(h)).toFixed(2), '1', s.replace(/[″]/g, '"').replace(/[′]/g, "'"));
  poly(room.outline, 'WALLS');
  poly(offsetPolygon(room.outline, room.wallThickness), 'WALLS');
  const ws = walls(room);
  for (const o of room.openings) {
    const w = ws[o.wall];
    if (!w) continue;
    const a = { x: w.a.x + w.dir.x * o.offset, y: w.a.y + w.dir.y * o.offset };
    const b = { x: w.a.x + w.dir.x * (o.offset + o.width), y: w.a.y + w.dir.y * (o.offset + o.width) };
    line(a, b, 'OPENINGS');
    if (o.kind === 'door') {
      const hinge = o.hinge === 'end' ? b : a;
      const n = o.swing === 'out' ? { x: -w.normal.x, y: -w.normal.y } : w.normal;
      line(hinge, { x: hinge.x + n.x * o.width, y: hinge.y + n.y * o.width }, 'OPENINGS');
    }
    text({ x: (a.x + b.x) / 2 + w.normal.x * 0.2, y: (a.y + b.y) / 2 + w.normal.y * 0.2 }, (o.label ?? o.kind).toUpperCase(), 0.08, 'TEXT');
  }
  for (const w of ws) {
    const out = { x: -w.normal.x * (room.wallThickness + 0.4), y: -w.normal.y * (room.wallThickness + 0.4) };
    const a = { x: w.a.x + out.x, y: w.a.y + out.y };
    const b = { x: w.b.x + out.x, y: w.b.y + out.y };
    line(a, b, 'DIMENSIONS');
    text({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, formatLength(w.length, units, { precision: 2 }), 0.12, 'DIMENSIONS');
  }
  const pathPts = (d: string, it: Item) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    const len = p.getTotalLength();
    const n = Math.max(4, Math.min(64, Math.round(len / 0.05)));
    const c = Math.cos(it.rotation);
    const s = Math.sin(it.rotation);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const q = p.getPointAtLength((len * i) / n);
      pts.push({ x: it.x + q.x * c - q.y * s, y: it.y + q.x * s + q.y * c });
    }
    return pts;
  };
  const all = [...room.fixtures.map((f) => ({ it: f, layer: 'BUILTINS' })), ...(layout?.items ?? []).map((it) => ({ it, layer: 'FURNITURE' }))];
  for (const { it, layer } of all) {
    const e = catalog[it.ref];
    if (!e) continue;
    const sym = symbolFor(it, e, room.ceilingHeight);
    for (const sh of sym.shapes) poly(pathPts(sh.d, it), layer, /Z\s*$/.test(sh.d));
    text({ x: it.x, y: it.y }, (it.label ?? e.name).replace(/^Your /, '').toUpperCase(), 0.07, 'TEXT');
  }
  const dxf = [dxfHeader(), dxfLayers(['WALLS', 'OPENINGS', 'FURNITURE', 'BUILTINS', 'DIMENSIONS', 'TEXT']), ['0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC'].join('\n'), '0\nEOF'].join('\n');
  const name = `${slug(room.name)}-${slug(layout?.name ?? 'plan')}`;
  const zip = zipSync({ [`${name}.dxf`]: strToU8(dxf), 'README.txt': strToU8(`${drawingTitle(room, layout)}\nDXF R12, units: inches. Layers: WALLS, OPENINGS, FURNITURE, BUILTINS, DIMENSIONS, TEXT.\nExported from Floorplan Studio.`) });
  await saveFile(`${name}-dxf.zip`, new Blob([zip], { type: 'application/zip' }));
}
