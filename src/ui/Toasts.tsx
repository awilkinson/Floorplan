import { X } from 'lucide-react';
import { useStore } from '../state/store';
import { cx } from './primitives';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('toast', t.tone && `toast-${t.tone}`)}>
          <span className="toast-text">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                t.action!.run();
                useStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => useStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
