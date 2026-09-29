import * as THREE from 'three';
import { makeFbm, makeRng, makeValueNoise } from './noise';

// Procedural textures, drawn once on canvases and reused. Detail maps are
// neutral (around white) so one texture serves every color of a finish.

export interface TexSet {
  map?: THREE.Texture;
  normal?: THREE.Texture;
  rough?: THREE.Texture;
  alpha?: THREE.Texture;
}

const cache = new Map<string, TexSet>();

function mkCanvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Height field (0..1) to a tangent-space normal map canvas. */
function normalFromHeight(h: Float32Array, w: number, hh: number, strength: number) {
  const { c, ctx } = mkCanvas(w, hh);
  const img = ctx.createImageData(w, hh);
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(values: Float32Array, w: number, h: number, lo = 0, hi = 1) {
  const { c, ctx } = mkCanvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(1, lo + (hi - lo) * values[i])) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Stamp soft blobs into a tileable height field. */
function stamp(h: Float32Array, w: number, hh: number, cx: number, cy: number, r: number, amp: number, ring = false) {
  const ir = Math.ceil(r) + 1;
  for (let y = -ir; y <= ir; y++) {
    for (let x = -ir; x <= ir; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const v = ring ? Math.max(0, 1 - Math.abs(d - 0.65) / 0.35) : Math.cos(d * Math.PI * 0.5);
      const px = (((Math.round(cx) + x) % w) + w) % w;
      const py = (((Math.round(cy) + y) % hh) + hh) % hh;
      h[py * w + px] += v * amp;
    }
  }
}

function normalize(h: Float32Array) {
  let lo = Infinity,
    hi = -Infinity;
  for (const v of h) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const s = hi - lo || 1;
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - lo) / s;
  return h;
}

function boucle(): TexSet {
  const S = 256;
  const h = new Float32Array(S * S);
  const r = makeRng(11);
  for (let i = 0; i < 2600; i++) stamp(h, S, S, r() * S, r() * S, 2.5 + r() * 3.5, 0.6 + r() * 0.6, r() > 0.35);
  normalize(h);
  const alb = new Float32Array(S * S);
  const n = makeValueNoise(3, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) alb[y * S + x] = 0.82 + h[y * S + x] * 0.16 + (n(x / 16, y / 16) - 0.5) * 0.06;
  return { map: toTexture(grayCanvas(alb, S, S), true), normal: toTexture(normalFromHeight(h, S, S, 2.4), false) };
}

function weaveGeneric(kind: 'linen' | 'weave' | 'papercord' | 'rattan'): TexSet {
  const S = 256;
  const h = new Float32Array(S * S);
  const alb = new Float32Array(S * S);
  const slub = makeValueNoise(kind.length * 7, 8);
  const threads = kind === 'linen' ? 64 : kind === 'weave' ? 48 : kind === 'papercord' ? 16 : 24;
  const cell = S / threads;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const over = kind === 'rattan' ? (cx + cy) % 4 < 2 : (cx + cy) % 2 === 0;
      const warp = Math.sin(fx * Math.PI);
      const weft = Math.sin(fy * Math.PI);
      const s = slub(x / 18, y / 5) * 0.4 + slub(y / 18 + 9, x / 5) * 0.4;
      const v = over ? weft * 0.9 + warp * 0.1 : warp * 0.9 + weft * 0.1;
      h[y * S + x] = v * (0.8 + s * 0.4);
      alb[y * S + x] = 0.84 + v * 0.12 + (s - 0.4) * (kind === 'linen' ? 0.12 : 0.06);
    }
  }
  const strength = kind === 'papercord' ? 3 : kind === 'rattan' ? 2.5 : 1.6;
  return { map: toTexture(grayCanvas(alb, S, S), true), normal: toTexture(normalFromHeight(h, S, S, strength), false) };
}

function velvet(): TexSet {
  const S = 256;
  const f = makeFbm(21, 8, 4);
  const g = makeValueNoise(5, 64);
  const h = new Float32Array(S * S);
  const alb = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = f(x / 32, y / 32);
      h[y * S + x] = v * 0.7 + g(x / 4, y / 4) * 0.3;
      alb[y * S + x] = 0.86 + (v - 0.5) * 0.18;
    }
  return { map: toTexture(grayCanvas(alb, S, S), true), normal: toTexture(normalFromHeight(h, S, S, 0.8), false) };
}

function leather(): TexSet {
  const S = 256;
  const r = makeRng(77);
  const pts: [number, number][] = [];
  for (let i = 0; i < 180; i++) pts.push([r() * S, r() * S]);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let d1 = 1e9,
        d2 = 1e9;
      for (const [px, py] of pts) {
        let dx = Math.abs(x - px);
        let dy = Math.abs(y - py);
        if (dx > S / 2) dx = S - dx;
        if (dy > S / 2) dy = S - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      h[y * S + x] = Math.sqrt(d2) - Math.sqrt(d1);
    }
  normalize(h);
  const alb = new Float32Array(S * S);
  const n = makeFbm(9, 8, 3);
  for (let i = 0; i < S * S; i++) alb[i] = 0.86 + Math.min(1, h[i] * 2) * 0.1 + (n((i % S) / 32, Math.floor(i / S) / 32) - 0.5) * 0.12;
  return { map: toTexture(grayCanvas(alb, S, S), true), normal: toTexture(normalFromHeight(h.map((v) => Math.min(1, v * 3)), S, S, 1.2), false) };
}

function wood(dark = false): TexSet {
  const W = 512;
  const H = 256;
  const warp = makeFbm(31, 4, 4);
  const fine = makeValueNoise(8, 128);
  const alb = new Float32Array(W * H);
  const h = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const w = warp(u * 4, v * 4);
      const rings = Math.sin((v * 22 + w * 3.2) * Math.PI * 2);
      const streak = fine(x / 3, y * 1.2) * 0.5 + fine(x / 11 + 40, y * 0.6) * 0.5;
      const ringLine = Math.pow(Math.abs(rings), 6);
      const lum = 0.9 - ringLine * 0.22 - (streak - 0.5) * 0.16 + (w - 0.5) * 0.12;
      alb[y * W + x] = dark ? lum * 0.95 : lum;
      h[y * W + x] = streak * 0.6 - ringLine * 0.4;
      rough[y * W + x] = 0.5 + ringLine * 0.25 + (streak - 0.5) * 0.2;
    }
  }
  return {
    map: toTexture(grayCanvas(alb, W, H), true),
    normal: toTexture(normalFromHeight(h, W, H, 0.9), false),
    rough: toTexture(grayCanvas(rough, W, H), false),
  };
}

function burl(): TexSet {
  const S = 512;
  const f = makeFbm(51, 4, 5);
  const alb = new Float32Array(S * S);
  const r = makeRng(3);
  const eyes: [number, number, number][] = Array.from({ length: 60 }, () => [r() * S, r() * S, 2 + r() * 5]);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const a = f(x / 64, y / 64);
      const b = f(x / 64 + a * 3, y / 64 + a * 2);
      let v = 0.75 + Math.sin(b * 40) * 0.12 + (a - 0.5) * 0.3;
      for (const [ex, ey, er] of eyes) {
        const d = Math.hypot(x - ex, y - ey);
        if (d < er) v -= (1 - d / er) * 0.5;
      }
      alb[y * S + x] = v;
    }
  return { map: toTexture(grayCanvas(alb, S, S), true) };
}

function stone(kind: 'travertine' | 'marble' | 'terrazzo'): TexSet {
  const S = 512;
  const alb = new Float32Array(S * S);
  const h = new Float32Array(S * S).fill(0.5);
  if (kind === 'travertine') {
    const f = makeFbm(61, 4, 5);
    const band = makeValueNoise(62, 8);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const b = band(x / 256, y / 24) * 0.6 + f(x / 128, y / 48) * 0.4;
        alb[y * S + x] = 0.84 + (b - 0.5) * 0.22;
      }
    const r = makeRng(63);
    for (let i = 0; i < 420; i++) {
      const cx = r() * S;
      const cy = r() * S;
      const rx = 1 + r() * 6;
      const ry = 0.6 + r() * 1.6;
      for (let y = -4; y <= 4; y++)
        for (let x = -8; x <= 8; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (d < 1) {
            const px = ((Math.round(cx + x) % S) + S) % S;
            const py = ((Math.round(cy + y) % S) + S) % S;
            alb[py * S + px] -= 0.16 * (1 - d);
            h[py * S + px] -= 0.4 * (1 - d);
          }
        }
    }
  } else if (kind === 'marble') {
    const f = makeFbm(71, 4, 6);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const t = f(x / 128, y / 128);
        const vein = Math.abs(Math.sin((x / S + y / S * 0.6 + t * 2.4) * Math.PI * 3));
        const fineVein = Math.abs(Math.sin((x / S * 1.7 - y / S + t * 3.2) * Math.PI * 7));
        const v = 1 - Math.pow(1 - vein, 14) * 0.45 - Math.pow(1 - fineVein, 24) * 0.25;
        alb[y * S + x] = v * 0.97 + (t - 0.5) * 0.05;
      }
  } else {
    const r = makeRng(81);
    alb.fill(0.92);
    const tones = [0.55, 0.7, 0.4, 0.8, 0.62];
    for (let i = 0; i < 900; i++) {
      const cx = r() * S;
      const cy = r() * S;
      const rr = 1.5 + r() * 5;
      const tone = tones[Math.floor(r() * tones.length)];
      for (let y = -6; y <= 6; y++)
        for (let x = -6; x <= 6; x++) {
          if (x * x + y * y > rr * rr * (0.6 + r() * 0.4)) continue;
          const px = ((Math.round(cx + x) % S) + S) % S;
          const py = ((Math.round(cy + y) % S) + S) % S;
          alb[py * S + px] = tone;
        }
    }
  }
  return {
    map: toTexture(grayCanvas(alb, S, S), true),
    normal: kind === 'travertine' ? toTexture(normalFromHeight(h, S, S, 2), false) : undefined,
  };
}

function cane(): TexSet {
  const S = 256;
  const { c, ctx } = mkCanvas(S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const step = S / 8;
  const lw = step * 0.18;
  ctx.lineWidth = lw;
  const lines = (dx: number, dy: number, sx: number, sy: number) => {
    for (let i = -16; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(sx * i * step - dx * S, sy * i * step - dy * S);
      ctx.lineTo(sx * i * step + dx * S, sy * i * step + dy * S);
      ctx.stroke();
    }
  };
  // vertical, horizontal, and the two diagonals — the classic open cane weave
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(S, i * step);
    ctx.stroke();
  }
  ctx.lineWidth = lw * 0.9;
  lines(1, 1, 1, 0);
  lines(1, -1, 1, 0);
  const alpha = ctx.getImageData(0, 0, S, S);
  const h = new Float32Array(S * S);
  const alb = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const a = alpha.data[i * 4] / 255;
    h[i] = a;
    alb[i] = 0.8 + a * 0.18;
  }
  return {
    map: toTexture(grayCanvas(alb, S, S), true),
    normal: toTexture(normalFromHeight(h, S, S, 2.2), false),
    alpha: toTexture(c, false),
  };
}

function paper(): TexSet {
  const S = 256;
  const f = makeFbm(91, 16, 4);
  const alb = new Float32Array(S * S);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const rib = Math.pow(Math.abs(Math.sin((y / S) * Math.PI * 12)), 40);
      const fib = f(x / 16, y / 64);
      alb[y * S + x] = 0.9 + (fib - 0.5) * 0.12 - rib * 0.1;
      h[y * S + x] = rib + fib * 0.2;
    }
  return { map: toTexture(grayCanvas(alb, S, S), true), normal: toTexture(normalFromHeight(h, S, S, 1.5), false) };
}

function brushed(): TexSet {
  const W = 256;
  const H = 256;
  const n = makeValueNoise(101, 256);
  const r = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r[y * W + x] = n(x / 64, y * 1.0);
  return { rough: toTexture(grayCanvas(r, W, H, 0.7, 1.15), false) };
}

export function detailTextures(kind: string): TexSet {
  const key = `detail:${kind}`;
  let t = cache.get(key);
  if (t) return t;
  switch (kind) {
    case 'boucle':
      t = boucle();
      break;
    case 'linen':
    case 'weave':
    case 'papercord':
    case 'rattan':
      t = weaveGeneric(kind);
      break;
    case 'velvet':
      t = velvet();
      break;
    case 'leather':
      t = leather();
      break;
    case 'wood':
      t = wood(false);
      break;
    case 'wood-dark':
      t = wood(true);
      break;
    case 'burl':
      t = burl();
      break;
    case 'travertine':
    case 'marble':
    case 'terrazzo':
      t = stone(kind);
      break;
    case 'cane':
      t = cane();
      break;
    case 'paper':
      t = paper();
      break;
    case 'brushed':
      t = brushed();
      break;
    default:
      t = {};
  }
  cache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Floor planks

/** Shift a color in sRGB HSL space (safe for very dark colors). */
export function shade(hex: string, dl = 0, ds = 0, dh = 0): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  c.setHSL((hsl.h + dh + 1) % 1, Math.max(0, Math.min(1, hsl.s + ds)), Math.max(0, Math.min(1, hsl.l + dl)), THREE.SRGBColorSpace);
  return c;
}

export function plankFloor(base: string, plankW = 0.178, span = 2.49): TexSet & { span: number } {
  const key = `floor:${base}:${plankW}`;
  const hit = cache.get(key) as (TexSet & { span: number }) | undefined;
  if (hit) return hit;
  const S = 1024;
  const pxPerM = S / span;
  const r = makeRng(1234);
  const rows = Math.round(span / plankW);
  const rowH = S / rows;
  // plank layout per row: boundaries that wrap around the tile
  const layout: { start: number; len: number; tone: number; warm: number; seed: number }[][] = [];
  for (let row = 0; row < rows; row++) {
    const planks: { start: number; len: number; tone: number; warm: number; seed: number }[] = [];
    const x0 = -r() * S * 0.6;
    let x = x0;
    while (x < x0 + S - 0.8 * pxPerM) {
      const len = Math.min((0.8 + r() * 1.6) * pxPerM, x0 + S - x);
      planks.push({ start: x, len, tone: (r() - 0.5) * 0.22, warm: (r() - 0.5) * 0.05, seed: Math.floor(r() * 1e6) });
      x += len;
    }
    // the last plank closes the tile exactly so rows wrap seamlessly
    const last = planks[planks.length - 1];
    last.len = x0 + S - last.start;
    layout.push(planks);
  }
  const baseC = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  baseC.getHSL(hsl, THREE.SRGBColorSpace);
  const warp = makeFbm(41, 8, 4);
  const fine = makeValueNoise(42, 256);
  const { c, ctx } = mkCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const tmp = new THREE.Color();
  // per-plank colors
  const plankCol = layout.map((pl) =>
    pl.map((p) => {
      tmp.setHSL((hsl.h + p.warm * 0.3 + 1) % 1, Math.max(0, Math.min(1, hsl.s + p.warm)), Math.max(0.02, hsl.l * (1 + p.tone)), THREE.SRGBColorSpace);
      return [tmp.r, tmp.g, tmp.b];
    }),
  );
  for (let y = 0; y < S; y++) {
    const row = Math.min(rows - 1, Math.floor(y / rowH));
    const vy = y - row * rowH;
    const pl = layout[row];
    for (let x = 0; x < S; x++) {
      // find the plank covering x (with wrap)
      let pi = 0;
      let px = x;
      for (let k = 0; k < pl.length; k++) {
        const p = pl[k];
        const xx = x < p.start ? x + S : x;
        if (xx >= p.start && xx < p.start + p.len) {
          pi = k;
          px = xx - p.start;
          break;
        }
        const x2 = x - S;
        if (x2 >= p.start && x2 < p.start + p.len) {
          pi = k;
          px = x2 - p.start;
          break;
        }
      }
      const p = pl[pi];
      const u = px / pxPerM + p.seed * 0.001;
      const v = vy / rowH;
      const w = warp(u * 1.5, v * 2 + p.seed * 0.0003);
      const ring = Math.sin((v * 5.5 + w * 2.2 + u * 0.08) * Math.PI * 2);
      const ringLine = Math.pow(Math.abs(ring), 9);
      const streak = fine(u * 14, v * 60) * 0.6 + fine(u * 3 + 11, v * 22) * 0.4;
      const lum = 1 - ringLine * 0.16 - (streak - 0.5) * 0.22 + (w - 0.5) * 0.1;
      // plank edges: tiny bevel shadow
      const edge = Math.min(vy, rowH - vy, px, p.len - px);
      const gap = edge < 1.2 ? 0.58 : edge < 2.2 ? 0.86 : 1;
      const [pr, pg, pb] = plankCol[row][pi];
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, Math.max(0, Math.pow(pr, 1 / 2.2) * 255 * lum * gap));
      img.data[i + 1] = Math.min(255, Math.max(0, Math.pow(pg, 1 / 2.2) * 255 * lum * gap));
      img.data[i + 2] = Math.min(255, Math.max(0, Math.pow(pb, 1 / 2.2) * 255 * lum * gap));
      img.data[i + 3] = 255;
      height[y * S + x] = (edge < 1.5 ? 0 : 0.6) + streak * 0.25 - ringLine * 0.1;
      rough[y * S + x] = 0.42 + p.tone * 0.3 + ringLine * 0.12 + (streak - 0.5) * 0.12;
    }
  }
  ctx.putImageData(img, 0, 0);
  const out = {
    map: toTexture(c, true),
    normal: toTexture(normalFromHeight(height, S, S, 1.4), false),
    rough: toTexture(grayCanvas(rough, S, S), false),
    span,
  };
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Rugs

export function rugTexture(pattern: string, palette: string[], w: number, d: number, seed: number, shape: string): TexSet {
  const key = `rug:${pattern}:${palette.join(',')}:${w.toFixed(2)}:${d.toFixed(2)}:${seed}:${shape}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const PX = 640;
  const W = w >= d ? PX : Math.round((PX * w) / d);
  const H = w >= d ? Math.round((PX * d) / w) : PX;
  const { c, ctx } = mkCanvas(W, H);
  const pal = palette.length ? palette : ['#DDD2BE', '#9A8B75'];
  const [c0, c1, c2, c3, c4] = [pal[0], pal[1] ?? pal[0], pal[2] ?? pal[1] ?? pal[0], pal[3] ?? pal[0], pal[4] ?? pal[1] ?? pal[0]];
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, W, H);
  const f = makeFbm(seed + 17, 4, 5);
  const img = () => ctx.getImageData(0, 0, W, H);
  const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
  if (pattern === 'abstract') {
    const d0 = img();
    const A = new THREE.Color(c0),
      B = new THREE.Color(c1),
      C = new THREE.Color(c2),
      D = new THREE.Color(c3),
      E = new THREE.Color(c4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const v = y / H;
        const n1 = f(u * 2.2, v * 2.2);
        const n2 = f(u * 3 + 5, v * 3 + 2);
        let col = A.clone();
        const ochre = n2 > 0.56 ? Math.min(1, (n2 - 0.56) * 6) : 0;
        col = mix(col, B, ochre * 0.8);
        const blue = n1 > 0.5 ? Math.min(1, (n1 - 0.5) * 5) : 0;
        col = mix(col, D, blue);
        const deep = n1 > 0.62 ? Math.min(1, (n1 - 0.62) * 6) : 0;
        col = mix(col, C, deep);
        const ink = n1 > 0.72 ? Math.min(1, (n1 - 0.72) * 8) : 0;
        col = mix(col, E, ink * 0.8);
        const i = (y * W + x) * 4;
        d0.data[i] = col.r * 255;
        d0.data[i + 1] = col.g * 255;
        d0.data[i + 2] = col.b * 255;
      }
    ctx.putImageData(d0, 0, 0);
  } else if (pattern === 'beni') {
    ctx.strokeStyle = c1;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, W / 180);
    const r = makeRng(seed);
    const cells = Math.max(3, Math.round(w / 0.45));
    const cw = W / cells;
    const ch = cw * 1.6;
    for (let row = -1; row < H / ch + 1; row++) {
      for (let col = 0; col <= cells; col++) {
        const x = col * cw + (row % 2 ? cw / 2 : 0);
        const y = row * ch;
        ctx.beginPath();
        const j = () => (r() - 0.5) * cw * 0.12;
        ctx.moveTo(x + j(), y - ch / 2 + j());
        ctx.lineTo(x + cw / 2 + j(), y + j());
        ctx.lineTo(x + j(), y + ch / 2 + j());
        ctx.lineTo(x - cw / 2 + j(), y + j());
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'persian' || pattern === 'border') {
    const bw = Math.min(W, H) * (pattern === 'persian' ? 0.1 : 0.06);
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c0;
    ctx.fillRect(bw, bw, W - 2 * bw, H - 2 * bw);
    if (pattern === 'persian') {
      ctx.strokeStyle = c3;
      ctx.lineWidth = bw * 0.18;
      ctx.strokeRect(bw * 0.5, bw * 0.5, W - bw, H - bw);
      ctx.fillStyle = c2;
      const r = makeRng(seed);
      for (let i = 0; i < 260; i++) {
        const x = bw + r() * (W - 2 * bw);
        const y = bw + r() * (H - 2 * bw);
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x, y, 3 + r() * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, W * 0.16, H * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c4;
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, W * 0.08, H * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = c1;
      ctx.lineWidth = bw * 0.12;
      ctx.strokeRect(bw * 1.6, bw * 1.6, W - bw * 3.2, H - bw * 3.2);
    }
  } else if (pattern === 'stripes') {
    const n = Math.round(d / 0.12);
    for (let i = 0; i < n; i++) {
      const y = (i / n) * H;
      ctx.fillStyle = i % 5 === 0 ? c1 : i % 7 === 3 ? c2 : c0;
      ctx.fillRect(0, y, W, H / n + 1);
    }
  } else if (pattern === 'checker') {
    const n = Math.max(4, Math.round(w / 0.3));
    const s = W / n;
    for (let y = 0; y < H / s; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? c1 : c0;
        ctx.fillRect(x * s, y * s, s + 1, s + 1);
      }
  } else if (pattern === 'jute') {
    const s = W / Math.max(20, Math.round(w / 0.04));
    for (let y = 0; y < H; y += s)
      for (let x = 0; x < W; x += s) {
        ctx.fillStyle = (Math.floor(x / s) + Math.floor(y / s)) % 2 ? c0 : c1;
        ctx.save();
        ctx.translate(x + s / 2, y + s / 2);
        ctx.rotate(((Math.floor(y / (s * 4)) % 2 ? 1 : -1) * Math.PI) / 4);
        ctx.fillRect(-s * 0.7, -s * 0.25, s * 1.4, s * 0.5);
        ctx.restore();
      }
  } else if (pattern === 'play') {
    const s = W / Math.max(3, Math.round(w / 0.6));
    for (let y = 0; y < H / s; y++)
      for (let x = 0; x < W / s; x++) {
        ctx.fillStyle = (x + y) % 2 ? c1 : c0;
        ctx.fillRect(x * s, y * s, s, s);
      }
  } else {
    // solid / organic — heathered wool
    const d0 = img();
    const A = new THREE.Color(c0);
    const B = new THREE.Color(c1);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const col = mix(A, B, f(x / 40, y / 40) * 0.8);
        const i = (y * W + x) * 4;
        d0.data[i] = col.r * 255;
        d0.data[i + 1] = col.g * 255;
        d0.data[i + 2] = col.b * 255;
      }
    ctx.putImageData(d0, 0, 0);
  }
  // pile noise over everything
  const d1 = img();
  const n = makeValueNoise(seed + 3, 64);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = 0.93 + n(x / 1.5, y / 1.5) * 0.1;
      const i = (y * W + x) * 4;
      d1.data[i] *= k;
      d1.data[i + 1] *= k;
      d1.data[i + 2] *= k;
    }
  ctx.putImageData(d1, 0, 0);
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const out = { map: t, normal: detailTextures('boucle').normal };
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Art

export function artTexture(kind: string): THREE.Texture {
  const key = `art:${kind}`;
  const hit = cache.get(key);
  if (hit?.map) return hit.map;
  const W = 384;
  const H = 480;
  const { c, ctx } = mkCanvas(W, H);
  const r = makeRng(kind.length * 31 + kind.charCodeAt(0));
  if (kind.startsWith('portrait')) {
    const bg = kind.endsWith('rose') ? ['#B98D93', '#8E6167'] : kind.endsWith('sand') ? ['#B7A993', '#8D7D66'] : ['#8993A0', '#5E6672'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, bg[0]);
    g.addColorStop(1, bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // plinth
    ctx.fillStyle = 'rgba(40,30,30,0.35)';
    ctx.fillRect(W * 0.2, H * 0.78, W * 0.6, H * 0.22);
    // sculptural bust
    ctx.fillStyle = '#1B1818';
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.34, W * 0.12, H * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind.endsWith('rose') ? '#E8C3B0' : '#D9B8A0';
    ctx.beginPath();
    ctx.moveTo(W * 0.42, H * 0.45);
    ctx.quadraticCurveTo(W * 0.5, H * 0.5, W * 0.58, H * 0.45);
    ctx.lineTo(W * 0.72, H * 0.8);
    ctx.lineTo(W * 0.28, H * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(W * 0.46, H * 0.3, W * 0.03, H * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'tan') {
    ctx.fillStyle = '#C9AE8E';
    ctx.fillRect(0, 0, W, H);
    const f = makeFbm(5, 8, 4);
    const d = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = 0.92 + f(x / 48, y / 48) * 0.14;
        const i = (y * W + x) * 4;
        d.data[i] *= k;
        d.data[i + 1] *= k;
        d.data[i + 2] *= k;
      }
    ctx.putImageData(d, 0, 0);
  } else if (kind === 'landscape') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#D9DCD8');
    g.addColorStop(0.55, '#B8C0C0');
    g.addColorStop(0.56, '#6E7E86');
    g.addColorStop(1, '#4A5860');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7B858A';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.56);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * 0.5 - Math.sin(x / 50) * 18 - r() * 8);
    ctx.lineTo(W, H * 0.56);
    ctx.fill();
  } else {
    // abstract color field
    const cols = ['#C66A3D', '#E7D2B0', '#2E3B4E', '#D9A441', '#8E9A83', '#F0E9DC'];
    ctx.fillStyle = '#EFE7DA';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.globalAlpha = 0.85;
      const x = r() * W * 0.6;
      const y = r() * H * 0.7;
      ctx.beginPath();
      if (r() > 0.5) ctx.ellipse(x + W * 0.2, y + H * 0.15, W * (0.12 + r() * 0.2), H * (0.08 + r() * 0.15), r() * 3, 0, Math.PI * 2);
      else ctx.rect(x, y, W * (0.2 + r() * 0.4), H * (0.1 + r() * 0.25));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, { map: t });
  return t;
}

/** Book-spine / generic noise used for fabrics on large flats (curtains). */
export function sheerTexture(): THREE.Texture {
  const key = 'sheer';
  const hit = cache.get(key);
  if (hit?.map) return hit.map;
  const S = 128;
  const f = makeValueNoise(9, 32);
  const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) v[y * S + x] = 0.85 + f(x / 2, y / 16) * 0.15;
  const t = toTexture(grayCanvas(v, S, S), true);
  cache.set(key, { map: t });
  return t;
}
