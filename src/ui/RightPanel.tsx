import { Hammer, ListChecks, MousePointer2, Wand2 } from 'lucide-react';
import { setUi, useStore } from '../state/store';
import { Designer } from './Designer';
import { Inspector } from './Inspector';
import { Checks, useAnalysis } from './Checks';
import { RoomPanel } from './RoomPanel';
import { cx } from './primitives';

export function RightPanel() {
  const tab = useStore((s) => s.rightTab);
  const mode = useStore((s) => s.mode);
  const selCount = useStore((s) => s.selection.length);
  const a = useAnalysis();
  const issues = a ? a.checks.filter((c) => c.status === 'bad' || c.status === 'warn').length : 0;
  const tabs =
    mode === 'room'
      ? [
          { id: 'designer' as const, label: 'Room', icon: <Hammer size={14} /> },
          { id: 'inspect' as const, label: selCount > 1 ? `${selCount} built-ins` : 'Built-in', icon: <MousePointer2 size={14} /> },
        ]
      : [
          { id: 'designer' as const, label: 'Designer', icon: <Wand2 size={14} /> },
          { id: 'inspect' as const, label: selCount > 1 ? `${selCount} pieces` : 'Piece', icon: <MousePointer2 size={14} /> },
          { id: 'checks' as const, label: 'Checks', icon: <ListChecks size={14} />, badge: a ? a.score : undefined, tone: a ? (a.score >= 85 ? 'good' : a.score >= 65 ? 'warn' : 'bad') : undefined },
        ];
  const current = mode === 'room' && tab === 'checks' ? 'designer' : tab;
  return (
    <aside className="right-panel" aria-label="Designer and details">
      <div className="rp-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={current === t.id} className={cx('rp-tab', current === t.id && 'is-on')} onClick={() => setUi({ rightTab: t.id })}>
            {t.icon}
            <span>{t.label}</span>
            {'badge' in t && t.badge != null && (
              <span className={cx('rp-badge', `rp-badge-${t.tone}`)} title={issues ? `${issues} to look at` : 'All good'}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="rp-body">
        {current === 'designer' && (mode === 'room' ? <div className="rp-scroll"><RoomPanel /></div> : <Designer />)}
        {current === 'inspect' && (
          <div className="rp-scroll">
            <Inspector />
          </div>
        )}
        {current === 'checks' && (
          <div className="rp-scroll">
            <Checks />
          </div>
        )}
      </div>
    </aside>
  );
}
