import { useEffect, useState } from 'react';
import type { Palette } from './PlanSvg';

function read(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    ink: g('--plan-ink', '#1B1C20'),
    ink2: g('--muted', '#55565B'),
    poche: g('--plan-poche', '#1F2024'),
    fill: g('--plan-fill', '#FFFFFF'),
    paper: g('--plan-bg', '#FFFFFF'),
    faint: g('--plan-faint', '#D7D4CC'),
    dim: g('--plan-dim', '#2F4FD8'),
    accent: g('--accent', '#2F4FD8'),
    warn: g('--warn', '#B45309'),
    bad: g('--bad', '#B42318'),
    good: g('--good', '#2E7D4F'),
  };
}

/** The drawing's palette follows the page theme. */
export function usePalette(): Palette {
  const [p, setP] = useState<Palette>(() => read());
  useEffect(() => {
    const update = () => setP(read());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      obs.disconnect();
    };
  }, []);
  return p;
}

/** A fixed light palette for exported drawings. */
export const PRINT_PALETTE: Palette = {
  ink: '#16171A',
  ink2: '#5A5A57',
  poche: '#1C1D20',
  fill: '#FFFFFF',
  paper: '#FFFFFF',
  faint: '#CFCBC2',
  dim: '#2F4FD8',
  accent: '#2F4FD8',
  warn: '#B45309',
  bad: '#B42318',
  good: '#2E7D4F',
};
