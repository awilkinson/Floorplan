import { useDeferredValue, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { analyzeCached, type Check } from '../design/checks';
import { activeRoom, displayedLayout, select, toggleOverlay, useStore } from '../state/store';
import { cx } from './primitives';
import { askDesigner } from '../ai/designer';

const GROUP_ORDER: Check['group'][] = ['Fit', 'Flow', 'Seating', 'Hi-fi', 'Baby', 'Christmas', 'Light'];

export function useAnalysis() {
  const room = useStore((s) => activeRoom(s));
  const layout = useStore((s) => displayedLayout(s));
  const custom = useStore((s) => s.custom);
  const deferred = useDeferredValue(layout);
  return useMemo(() => (room && deferred ? analyzeCached(room, deferred, custom) : null), [room, deferred, custom]);
}

export function ScoreRing({ score, size = 54 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const tone = score >= 85 ? 'var(--good)' : score >= 65 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring" role="img" aria-label={`Layout score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="4" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.32} fill="var(--ink)" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
        {score}
      </text>
    </svg>
  );
}

export function Checks() {
  const a = useAnalysis();
  const preview = useStore((s) => s.preview);
  if (!a) return <div className="empty-note pad">No layout to check yet.</div>;
  const groups = GROUP_ORDER.map((g) => ({ g, list: a.checks.filter((c) => c.group === g) })).filter((x) => x.list.length);
  const issues = a.checks.filter((c) => c.status === 'bad' || c.status === 'warn');
  return (
    <div className="checks">
      <div className="checks-head">
        <ScoreRing score={a.score} />
        <div>
          <div className="checks-title">{a.score >= 85 ? 'Works well' : a.score >= 65 ? 'A few things to tune' : 'Needs work'}</div>
          <div className="checks-sub">
            {issues.length ? `${issues.length} thing${issues.length > 1 ? 's' : ''} to look at` : 'Paths, clearances and groupings all check out'}
            {preview ? ' in this idea' : ''}
          </div>
        </div>
      </div>
      {issues.length > 0 && !preview && (
        <button type="button" className="fix-all" onClick={() => askDesigner(`Fix these problems in the current layout with the smallest changes that keep its character: ${issues.map((i) => i.label + (i.detail ? ` (${i.detail})` : '')).join('; ')}.`)}>
          Ask the designer to fix {issues.length === 1 ? 'this' : 'these'}
        </button>
      )}
      {groups.map(({ g, list }) => (
        <section key={g} className="check-group">
          <h4>{g}</h4>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cx('check', `check-${c.status}`)}
              onClick={() => {
                if (c.items?.length) select(c.items);
                if (c.group === 'Hi-fi') toggleOverlay('hifi', true);
                if (c.group === 'Flow') toggleOverlay('circulation', true);
                if (c.group === 'Baby' || c.group === 'Christmas') toggleOverlay('zones', true);
                if (c.id === 'fit' || c.id === 'doors') toggleOverlay('clearances', true);
              }}
            >
              <span className="check-icon">{c.status === 'good' ? <CheckCircle2 size={15} /> : c.status === 'warn' ? <AlertCircle size={15} /> : c.status === 'bad' ? <XCircle size={15} /> : <Info size={15} />}</span>
              <span className="check-text">
                <span className="check-label">{c.label}</span>
                {c.detail && <span className="check-detail">{c.detail}</span>}
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
