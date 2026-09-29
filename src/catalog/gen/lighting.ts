import { box, cyl, part, sph, type Built, type GenCtx, type LightSpec, type Part } from '../parts';

const WARM = '#FFD3A1';

function drumShade(y: number, r: number, h: number, parts: Part[], lights: LightSpec[], taper = 0.92) {
  parts.push(part({ t: 'cyl', rt: r * taper, rb: r, h, seg: 48, open: true }, 'shade', [0, y, 0], { plan: 'dash', planCircle: r }));
  parts.push(part(sph(0.03), '$bulb', [0, y - h * 0.1, 0], { plan: false, noShadow: true }));
  lights.push({ p: [0, y - h * 0.05, 0], color: WARM, intensity: 1.2, distance: 5, kind: 'lamp' });
}

export function floorLamp(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'drum';
  const parts: Part[] = [];
  const lights: LightSpec[] = [];
  switch (style) {
    case 'drum': {
      const sr = pr.shadeR ?? Math.min(w, d) / 2;
      const sh = pr.shadeH ?? sr * 0.66;
      parts.push(part(cyl(0.15, 0.16, 0.025, 40), 'base', [0, 0.0125, 0], { plan: 'hidden' }));
      parts.push(part(cyl(0.009, 0.009, h - sh * 0.5, 12), 'frame', [0, (h - sh * 0.5) / 2, 0], { plan: false }));
      drumShade(h - sh / 2, sr, sh, parts, lights);
      break;
    }
    case 'tripod': {
      const sr = pr.shadeR ?? 0.24;
      const sh = sr * 0.75;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        parts.push(part(cyl(0.012, 0.016, h - sh * 0.3, 10), 'frame', [Math.sin(a) * 0.14, (h - sh * 0.3) / 2, Math.cos(a) * 0.14], { r: [Math.cos(a) * -0.12, 0, Math.sin(a) * 0.12], plan: false }));
      }
      drumShade(h - sh / 2, sr, sh, parts, lights);
      break;
    }
    case 'arc': {
      // Arco: marble block, steel arc reaching forward, dome shade.
      const baseZ = -d / 2 + 0.16;
      parts.push(part(box(0.3, 0.27, 0.4, 0.03), 'base', [0, 0.135, baseZ], { plan: 'line' }));
      const reach = d - 0.4;
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = t * Math.PI * 0.95;
        pts.push([0, 0.27 + Math.sin(a) * (h - 0.4) + t * 0.1, baseZ + (1 - Math.cos(a)) * (reach / 2)]);
      }
      parts.push(part({ t: 'tube', pts, r: 0.012, smooth: true }, '$chrome', [0, 0, 0], { plan: 'thin', planStrokes: [[[0, baseZ], [0, d / 2 - 0.2]]] }));
      const end = pts[pts.length - 1];
      parts.push(part({ t: 'lathe', pts: [[0.001, 0.16], [0.06, 0.155], [0.16, 0.08], [0.2, 0], [0.19, 0]], seg: 40 }, '$chrome', [0, end[1] - 0.2, end[2]], { plan: 'dash', planCircle: 0.2 }));
      parts.push(part(sph(0.04), '$bulb', [0, end[1] - 0.2, end[2]], { plan: false, noShadow: true }));
      lights.push({ p: [0, end[1] - 0.25, end[2]], color: WARM, intensity: 1.4, distance: 5, kind: 'lamp' });
      break;
    }
    case 'akari': {
      // Noguchi Akari UF-series: paper column on thin legs.
      const r = Math.min(w, d) / 2;
      const legH = h * 0.32;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        parts.push(part(cyl(0.004, 0.004, legH, 6), '$black', [Math.sin(a) * r * 0.5, legH / 2, Math.cos(a) * r * 0.5], { plan: false }));
      }
      const lh = h - legH;
      parts.push(part({ t: 'lathe', seg: 40, pts: [[r * 0.94, 0], [r, lh * 0.1], [r, lh * 0.9], [r * 0.94, lh]] }, 'shade', [0, legH, 0], { plan: 'line', planCircle: r }));
      parts.push(part(sph(0.03), '$bulb', [0, legH + lh * 0.5, 0], { plan: false, noShadow: true }));
      lights.push({ p: [0, legH + lh * 0.5, 0], color: WARM, intensity: 1.6, distance: 5, kind: 'lamp' });
      break;
    }
    case 'globe': {
      parts.push(part(cyl(0.12, 0.13, 0.02, 32), 'frame', [0, 0.01, 0], { plan: 'hidden' }));
      parts.push(part(cyl(0.005, 0.005, h - 0.3, 8), 'frame', [0, (h - 0.3) / 2, 0], { plan: false }));
      parts.push(part({ t: 'torus', r: 0.06, tube: 0.006 }, 'frame', [0, h - 0.3, 0], { plan: false }));
      parts.push(part(sph(0.15, 0.15, 0.15, 32), 'shade', [0, h - 0.15, 0], { plan: 'line', planCircle: 0.15 }));
      lights.push({ p: [0, h - 0.15, 0], color: WARM, intensity: 1.3, distance: 5, kind: 'lamp' });
      break;
    }
    case 'captain-flint': {
      parts.push(part(cyl(0.15, 0.15, 0.03, 40), 'base', [0, 0.015, -0.02], { plan: 'line', planCircle: 0.15 }));
      const pts: [number, number, number][] = [
        [0, 0.03, -0.02],
        [0, h * 0.6, -0.02],
        [0, h - 0.12, 0.02],
        [0, h - 0.03, 0.12],
        [0, h - 0.05, 0.22],
      ];
      parts.push(part({ t: 'tube', pts, r: 0.009, smooth: true }, 'frame', [0, 0, 0], { plan: 'thin', planStrokes: [[[0, -0.02], [0, 0.22]]] }));
      parts.push(part(cyl(0.05, 0.05, 0.03, 24), 'frame', [0, h - 0.07, 0.23], { r: [0.4, 0, 0], plan: false }));
      parts.push(part(cyl(0.035, 0.035, 0.005, 24), '$bulb', [0, h - 0.087, 0.23], { r: [0.4, 0, 0], plan: false, noShadow: true }));
      lights.push({ p: [0, h - 0.12, 0.26], color: WARM, intensity: 0.9, distance: 4, kind: 'lamp' });
      break;
    }
    case 'task': {
      parts.push(part(cyl(0.12, 0.13, 0.03, 32), 'frame', [0, 0.015, 0], { plan: 'line', planCircle: 0.13 }));
      parts.push(part(cyl(0.01, 0.01, h * 0.62, 10), 'frame', [0, h * 0.31, 0], { plan: false }));
      parts.push(part(cyl(0.008, 0.008, 0.62, 10), 'frame', [0, h * 0.62 + 0.2, 0.25], { r: [1.0, 0, 0], plan: 'thin', planStrokes: [[[0, 0], [0, 0.5]]] }));
      parts.push(part({ t: 'cyl', rt: 0.04, rb: 0.1, h: 0.14, seg: 32, open: true }, 'shade', [0, h - 0.1, 0.5], { r: [0.5, 0, 0], plan: 'dash', planCircle: 0.1 }));
      lights.push({ p: [0, h - 0.18, 0.55], color: WARM, intensity: 0.9, distance: 4, kind: 'lamp' });
      break;
    }
    case 'tmm': {
      // Santa & Cole TMM: wood pole, cross feet, round parchment shade
      for (const a of [0, Math.PI / 2]) parts.push(part(box(0.5, 0.04, 0.05, 0.01), 'frame', [0, 0.02, 0], { r: [0, a, 0], plan: 'thin' }));
      parts.push(part(cyl(0.013, 0.013, h - 0.1, 12), 'frame', [0, (h - 0.1) / 2, 0], { plan: false }));
      drumShade(h - 0.16, 0.22, 0.28, parts, lights, 0.75);
      break;
    }
    case 'grashoppa': {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.3;
        parts.push(part(cyl(0.008, 0.008, h * 0.9, 8), 'frame', [Math.sin(a) * 0.22, h * 0.43, Math.cos(a) * 0.22], { r: [Math.cos(a) * -0.28, 0, Math.sin(a) * 0.28], plan: false }));
      }
      parts.push(part({ t: 'cyl', rt: 0.035, rb: 0.11, h: 0.3, seg: 32, open: true }, 'frame', [0, h - 0.18, 0.12], { r: [0.7, 0, 0], plan: 'dash', planCircle: 0.11 }));
      lights.push({ p: [0, h - 0.28, 0.25], color: WARM, intensity: 0.9, distance: 4, kind: 'lamp' });
      break;
    }
    case 'mouille': {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        parts.push(part(cyl(0.006, 0.006, 0.45, 8), '$black', [Math.sin(a) * 0.14, 0.2, Math.cos(a) * 0.14], { r: [Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3], plan: false }));
      }
      parts.push(part(cyl(0.008, 0.008, h - 0.6, 8), '$black', [0, 0.4 + (h - 0.6) / 2, 0], { plan: false }));
      const arms = [
        [0.55, h - 0.1, 0.1, 0],
        [0.7, h - 0.35, -0.3, 2.1],
        [0.45, h - 0.55, 0.35, 4.2],
      ];
      arms.forEach(([len, y, z, a]) => {
        const x = Math.sin(a) * len;
        const zz = Math.cos(a) * len * 0.6 + z * 0.2;
        parts.push(part({ t: 'tube', pts: [[0, y - 0.1, 0], [x * 0.5, y + 0.05, zz * 0.5], [x, y, zz]], r: 0.005, smooth: true }, '$black', [0, 0, 0], { plan: 'thin', planStrokes: [[[0, 0], [x, zz]]] }));
        parts.push(part({ t: 'lathe', pts: [[0.001, 0.12], [0.03, 0.11], [0.07, 0.04], [0.08, 0]], seg: 24 }, '$black', [x, y - 0.12, zz], { r: [0.6, a, 0], plan: false }));
        lights.push({ p: [x, y - 0.1, zz], color: WARM, intensity: 0.5, distance: 3, kind: 'lamp' });
      });
      break;
    }
    case 'torchiere': {
      parts.push(part(cyl(0.14, 0.15, 0.03, 32), 'base', [0, 0.015, 0], { plan: 'hidden' }));
      parts.push(part(cyl(0.012, 0.012, h - 0.1, 10), 'frame', [0, (h - 0.1) / 2, 0], { plan: false }));
      parts.push(part({ t: 'lathe', pts: [[0.001, 0], [0.05, 0.005], [0.2, 0.09], [0.21, 0.1]], seg: 40 }, 'shade', [0, h - 0.1, 0], { plan: 'dash', planCircle: 0.21 }));
      lights.push({ p: [0, h + 0.05, 0], color: WARM, intensity: 1.2, distance: 5, kind: 'lamp' });
      break;
    }
  }
  return { parts, lights };
}

export function tableLamp(ctx: GenCtx): Built {
  const { w, d, h, params: pr } = ctx;
  const style: string = pr.style ?? 'ceramic';
  const parts: Part[] = [];
  const lights: LightSpec[] = [];
  if (style === 'mushroom') {
    const r = Math.min(w, d) / 2;
    parts.push(part(cyl(r * 0.28, r * 0.3, h * 0.55, 32), 'base', [0, h * 0.275, 0], { plan: false }));
    parts.push(part({ t: 'cyl', rt: r * 0.3, rb: r * 0.5, h: h * 0.12, seg: 32 }, 'base', [0, h * 0.6, 0], { plan: false }));
    parts.push(part(sph(r, h * 0.3, r, 32), 'shade', [0, h * 0.72, 0], { plan: 'line', planCircle: r }));
    lights.push({ p: [0, h * 0.7, 0], color: WARM, intensity: 0.6, distance: 3, kind: 'lamp' });
  } else if (style === 'akari') {
    const r = Math.min(w, d) / 2;
    parts.push(part(sph(r, h * 0.42, r, 24), 'shade', [0, h * 0.55, 0], { plan: 'line', planCircle: r }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      parts.push(part(cyl(0.003, 0.003, h * 0.2, 6), '$black', [Math.sin(a) * r * 0.4, h * 0.1, Math.cos(a) * r * 0.4], { plan: false }));
    }
    lights.push({ p: [0, h * 0.55, 0], color: WARM, intensity: 0.7, distance: 3, kind: 'lamp' });
  } else {
    const r = Math.min(w, d) / 2;
    const bh = h * 0.5;
    parts.push(part({ t: 'lathe', seg: 32, pts: [[0.001, 0], [r * 0.35, 0], [r * 0.5, bh * 0.4], [r * 0.4, bh * 0.85], [r * 0.12, bh], [0.001, bh]] }, 'base', [0, 0, 0], { plan: false }));
    parts.push(part(cyl(0.006, 0.006, h * 0.2, 8), '$brassDecor', [0, bh + h * 0.1, 0], { plan: false }));
    drumShade(h - h * 0.2, r, h * 0.38, parts, lights, 0.8);
    lights[lights.length - 1].intensity = 0.6;
  }
  return { parts, lights };
}

/** Picture light: brass bar above art. */
export function pictureLight(ctx: GenCtx): Built {
  const { w } = ctx;
  return {
    parts: [
      part(cyl(0.018, 0.018, w, 20), '$brassDecor', [0, 0.0, 0.03], { r: [0, 0, Math.PI / 2], plan: false }),
      part(box(0.02, 0.02, 0.08, 0.004), '$brassDecor', [0, 0.02, -0.01], { plan: false }),
      part(box(w * 0.9, 0.005, 0.012, 0), '$bulb', [0, -0.018, 0.03], { plan: false, noShadow: true }),
    ],
    lights: [{ p: [0, -0.1, 0.12], color: WARM, intensity: 0.5, distance: 2.5, kind: 'picture' }],
  };
}
