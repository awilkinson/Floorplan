import type { Units } from './types';

export const IN = 0.0254;
export const FT = 0.3048;

export const inch = (n: number) => n * IN;
export const ft = (feet: number, inches = 0) => feet * FT + inches * IN;
export const toIn = (m: number) => m / IN;
export const toFt = (m: number) => m / FT;

export const deg = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

/** Normalise an angle to [0, 2π). */
export function normAngle(a: number) {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}

function fracInches(inches: number, denom = 2): string {
  const whole = Math.floor(inches + 1e-6);
  const frac = Math.round((inches - whole) * denom);
  if (frac === 0) return `${whole}`;
  if (frac === denom) return `${whole + 1}`;
  let n = frac;
  let d = denom;
  while (n % 2 === 0 && d % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  return whole > 0 ? `${whole} ${n}/${d}` : `${n}/${d}`;
}

export interface FormatOptions {
  /** Show inches-only below this many feet (imperial). */
  inchesBelow?: number;
  /** Round imperial to this fraction of an inch (2 = half inches). */
  precision?: number;
  compact?: boolean;
}

/** Architectural length: 12'-6", 7 1/2", 3.81 m, 95 cm. */
export function formatLength(m: number, units: Units, opts: FormatOptions = {}): string {
  const sign = m < 0 ? '−' : '';
  const v = Math.abs(m);
  if (units === 'metric') {
    if (v < 1) return `${sign}${Math.round(v * 100)} cm`;
    return `${sign}${(Math.round(v * 100) / 100).toFixed(2)} m`;
  }
  const precision = opts.precision ?? 2;
  let totalIn = Math.round(toIn(v) * precision) / precision;
  const below = opts.inchesBelow ?? 2;
  if (totalIn < below * 12) return `${sign}${fracInches(totalIn, precision)}″`;
  let feet = Math.floor(totalIn / 12);
  let rem = totalIn - feet * 12;
  if (rem >= 12 - 1e-6) {
    feet += 1;
    rem = 0;
  }
  if (opts.compact && rem < 1e-6) return `${sign}${feet}′`;
  return `${sign}${feet}′-${fracInches(rem, precision)}″`;
}

/** Short size label: 96″ × 40″, or 244 × 102 cm. */
export function formatSize(w: number, d: number, units: Units, h?: number): string {
  if (units === 'metric') {
    const cm = (v: number) => Math.round(v * 100);
    return h != null ? `${cm(w)} × ${cm(d)} × ${cm(h)} cm` : `${cm(w)} × ${cm(d)} cm`;
  }
  const i = (v: number) => {
    const n = Math.round(toIn(v) * 2) / 2;
    return Number.isInteger(n) ? `${n}` : n.toFixed(1);
  };
  return h != null ? `${i(w)}″ × ${i(d)}″ × ${i(h)}″` : `${i(w)}″ × ${i(d)}″`;
}

export function formatArea(m2: number, units: Units): string {
  if (units === 'metric') return `${m2.toFixed(1)} m²`;
  return `${Math.round(m2 / (FT * FT))} sq ft`;
}

/**
 * Parse a typed length. Accepts 12'6", 12' 6", 12ft 6in, 150", 150 in, 12.5', 12-6,
 * 3.2m, 320cm, 95 cm. A bare number is read in `bare` units.
 */
export function parseLength(input: string, units: Units, bare: 'in' | 'ft' | 'cm' | 'm' = units === 'metric' ? 'cm' : 'in'): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[′’']/g, "'")
    .replace(/[″”"]/g, '"')
    .replace(/\s+/g, ' ');
  if (!s) return null;

  let m = s.match(/^(-?\d+(?:\.\d+)?)\s*(m|meters?|metres?)$/);
  if (m) return parseFloat(m[1]);
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*(cm|centimet(?:er|re)s?)$/);
  if (m) return parseFloat(m[1]) / 100;
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm)$/);
  if (m) return parseFloat(m[1]) / 1000;

  // feet and inches: 12'6", 12' 6", 12ft 6in, 12 ft, 12-6
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*-?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in|inch|inches)?)?$/);
  if (m) {
    const feet = parseFloat(m[1]);
    let inches = m[2] ? parseFloat(m[2]) : 0;
    if (m[3] && m[4]) inches += parseInt(m[3], 10) / parseInt(m[4], 10);
    return ft(feet, inches);
  }
  m = s.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (m) return ft(parseFloat(m[1]), parseFloat(m[2]));

  // inches with optional fraction: 30", 30 1/2", 30.5 in
  m = s.match(/^(-?\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in|inch|inches)$/);
  if (m) {
    let inches = parseFloat(m[1]);
    if (m[2] && m[3]) inches += parseInt(m[2], 10) / parseInt(m[3], 10);
    return inch(inches);
  }
  m = s.match(/^(\d+)\/(\d+)\s*(?:"|in)?$/);
  if (m) return inch(parseInt(m[1], 10) / parseInt(m[2], 10));

  m = s.match(/^(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const n = parseFloat(m[1]);
    switch (bare) {
      case 'in':
        return inch(n);
      case 'ft':
        return ft(n);
      case 'cm':
        return n / 100;
      case 'm':
        return n;
    }
  }
  return null;
}

/** Round to a sensible increment for the unit system (1/2″ or 5 mm). */
export function snapLength(m: number, units: Units, step?: number): number {
  const s = step ?? (units === 'metric' ? 0.005 : IN / 2);
  return Math.round(m / s) * s;
}

export const compassName = (bearingDeg: number) => {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(normAngle(deg(bearingDeg)) / (Math.PI / 4)) % 8];
};

/**
 * The designer speaks in compass bearings: the direction an item's FRONT faces,
 * 0 = plan north (up), 90 = east, 180 = south, 270 = west.
 * Internally rotation is clockwise from "front faces +y (south)".
 */
export const bearingToRotation = (bearingDeg: number) => normAngle(deg(bearingDeg - 180));
export const rotationToBearing = (rotation: number) => Math.round(toDeg(normAngle(rotation + Math.PI))) % 360;
