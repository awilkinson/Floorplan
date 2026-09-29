// What the page itself can read from a photo, for views where Claude can't be
// sent images: the piece's outline against a plain background (so its
// proportions), and its main colors. It's no substitute for Claude seeing the
// photo, but together with the owner's words ("add this couch") it is enough
// to build a piece in the right color and shape.

export interface PhotoFacts {
  width: number;
  height: number;
  /** A product shot: the piece stands on a plain, even background. */
  plain: boolean;
  /** Bounding box of the piece (plain backgrounds only). */
  subject?: { aspect: number; coverage: number; fill: number };
  colors: { hex: string; share: number; name: string }[];
}

const NAMED: [string, string][] = [
  ['bright white', '#F7F7F5'],
  ['warm white', '#EEE8DC'],
  ['ivory', '#F1EAD6'],
  ['oatmeal', '#D9CDB8'],
  ['sand', '#CDB894'],
  ['camel', '#B98B55'],
  ['cognac', '#9A5A2E'],
  ['tan leather', '#A77B52'],
  ['natural oak', '#C8A77C'],
  ['walnut', '#6B4A33'],
  ['espresso', '#3B2A21'],
  ['black', '#1B1B1C'],
  ['charcoal', '#3C3E41'],
  ['slate grey', '#6C737A'],
  ['mid grey', '#9A9C9D'],
  ['light grey', '#C9CACA'],
  ['greige', '#B9B0A2'],
  ['taupe', '#8E8073'],
  ['sage', '#A3AD92'],
  ['olive', '#6E7045'],
  ['forest green', '#34503F'],
  ['emerald', '#1F6B53'],
  ['teal', '#2E6E73'],
  ['dusty blue', '#8FA3B4'],
  ['navy', '#243650'],
  ['cobalt', '#2F4FA8'],
  ['lilac', '#B7A7C4'],
  ['blush', '#E3B8AE'],
  ['terracotta', '#B5603F'],
  ['rust', '#9C4A2A'],
  ['burgundy', '#6A2530'],
  ['oxblood', '#5A1F1F'],
  ['mustard', '#C9A13B'],
  ['brass', '#B08D57'],
  ['chrome', '#C9CDD1'],
  ['cream', '#EDE3C8'],
];

function hex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const NAMED_LAB = NAMED.map(([n, h]) => [n, toLab(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16))] as const);

function nameOf(r: number, g: number, b: number) {
  const L = toLab(r, g, b);
  let best = NAMED_LAB[0][0];
  let bd = Infinity;
  for (const [n, l] of NAMED_LAB) {
    const d = (l[0] - L[0]) ** 2 + (l[1] - L[1]) ** 2 + (l[2] - L[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

async function pixels(blob: Blob, edge = 200) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const w = Math.max(8, Math.round(bmp.width * k));
  const h = Math.max(8, Math.round(bmp.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const out = { data: ctx.getImageData(0, 0, w, h).data, w, h, W: bmp.width, H: bmp.height };
  bmp.close?.();
  return out;
}

/** Main colors by k-means over the given pixels. */
function palette(data: Uint8ClampedArray, idx: number[], k = 5) {
  if (!idx.length) return [];
  // seed from the most common coarse bins
  const bins = new Map<number, number>();
  for (const i of idx) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  const seeds = [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key]) => [((key >> 8) & 15) * 16 + 8, ((key >> 4) & 15) * 16 + 8, (key & 15) * 16 + 8]);
  const cs = seeds.map((s) => [...s]);
  const assign = new Array(idx.length).fill(0);
  for (let it = 0; it < 8; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    idx.forEach((i, n) => {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < cs.length; c++) {
        const d = (data[i] - cs[c][0]) ** 2 + (data[i + 1] - cs[c][1]) ** 2 + (data[i + 2] - cs[c][2]) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      assign[n] = best;
      sum[best][0] += data[i];
      sum[best][1] += data[i + 1];
      sum[best][2] += data[i + 2];
      sum[best][3]++;
    });
    sum.forEach((s, c) => {
      if (s[3]) cs[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  const counts = cs.map(() => 0);
  assign.forEach((a) => counts[a]++);
  // merge near-identical clusters
  const out: { rgb: number[]; n: number }[] = [];
  cs.forEach((c, i) => {
    if (!counts[i]) return;
    const near = out.find((o) => Math.hypot(o.rgb[0] - c[0], o.rgb[1] - c[1], o.rgb[2] - c[2]) < 22);
    if (near) {
      const t = near.n + counts[i];
      near.rgb = near.rgb.map((v, j) => (v * near.n + c[j] * counts[i]) / t);
      near.n = t;
    } else out.push({ rgb: c, n: counts[i] });
  });
  return out
    .sort((a, b) => b.n - a.n)
    .map((o) => ({ hex: hex(o.rgb[0], o.rgb[1], o.rgb[2]), share: o.n / idx.length, name: nameOf(o.rgb[0], o.rgb[1], o.rgb[2]) }))
    .filter((c) => c.share >= 0.04);
}

export async function readPhoto(blob: Blob): Promise<PhotoFacts> {
  const { data, w, h, W, H } = await pixels(blob);
  // the border ring tells us whether this is a product shot on a plain ground
  const ring: number[] = [];
  const m = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (x < m || y < m || x >= w - m || y >= h - m) ring.push((y * w + x) * 4);
  const mean = [0, 1, 2].map((c) => ring.reduce((s, i) => s + data[i + c], 0) / ring.length);
  const near = ring.filter((i) => Math.hypot(data[i] - mean[0], data[i + 1] - mean[1], data[i + 2] - mean[2]) < 30).length / ring.length;
  const plain = near > 0.82;
  const fg: number[] = [];
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  if (plain) {
    const rows = new Array(h).fill(0);
    const cols = new Array(w).fill(0);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (Math.hypot(data[i] - mean[0], data[i + 1] - mean[1], data[i + 2] - mean[2]) > 38) {
          fg.push(i);
          rows[y]++;
          cols[x]++;
        }
      }
    // ignore stray pixels (shadows, specks) when finding the outline
    const rt = w * 0.015;
    const ct = h * 0.015;
    rows.forEach((n, y) => {
      if (n > rt) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    });
    cols.forEach((n, x) => {
      if (n > ct) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    });
  } else {
    // a scene: read the colors of the middle of the frame
    for (let y = Math.round(h * 0.2); y < h * 0.8; y++) for (let x = Math.round(w * 0.2); x < w * 0.8; x++) fg.push((y * w + x) * 4);
  }
  const facts: PhotoFacts = { width: W, height: H, plain, colors: palette(data, fg) };
  if (plain && x1 > x0 && y1 > y0) {
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    facts.subject = { aspect: bw / bh, coverage: (bw * bh) / (w * h), fill: fg.length / (bw * bh) };
  }
  return facts;
}

/** A plain-language account of the photos for a prompt. */
export function photoFactsText(all: PhotoFacts[]): string {
  return all
    .map((f, i) => {
      const cols = f.colors
        .slice(0, 4)
        .map((c) => `${c.name} ${c.hex} (${Math.round(c.share * 100)}%)`)
        .join(', ');
      if (f.plain && f.subject) {
        const a = f.subject.aspect;
        const shape = a >= 1.6 ? `${a.toFixed(1)}× as wide as it is tall` : a <= 0.7 ? `${(1 / a).toFixed(1)}× as tall as it is wide` : `about as wide as it is tall (${a.toFixed(2)}:1)`;
        return `Photo ${i + 1}: a product shot on a plain background. As photographed, the piece is ${shape} and fills ${Math.round(f.subject.fill * 100)}% of its outline (lower means open legs, arms or a see-through frame). Main colors of the piece: ${cols || 'unclear'}.`;
      }
      return `Photo ${i + 1}: a photo of a room or scene (the piece couldn't be separated from its surroundings). Colors in the middle of the frame: ${cols || 'unclear'}.`;
    })
    .join('\n');
}
