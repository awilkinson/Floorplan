import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'default'; size?: 'sm' | 'md'; icon?: ReactNode; active?: boolean };

export function Button({ variant = 'default', size = 'md', icon, active, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" className={cx('btn', `btn-${variant}`, `btn-${size}`, active && 'is-active', !children && 'btn-icon', className)} {...rest}>
      {icon}
      {children && <span className="btn-label">{children}</span>}
    </button>
  );
}

export function IconButton({ label, icon, active, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('icon-btn', active && 'is-active', className)} {...rest}>
      {icon}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', label }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; label?: string }) {
  return (
    <div className={cx('seg', `seg-${size}`)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} title={o.title} className={cx('seg-opt', o.value === value && 'is-on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, title, tone }: { on?: boolean; onClick?: () => void; children: ReactNode; title?: string; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return (
    <button type="button" className={cx('chip', on && 'is-on', tone && `chip-${tone}`)} onClick={onClick} title={title} aria-pressed={on}>
      {children}
    </button>
  );
}

/** A lightweight popover anchored to its trigger. */
export function Popover({ trigger, children, align = 'start', side = 'bottom', width, open: openProp, onOpenChange }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'start' | 'end' | 'center'; side?: 'bottom' | 'top'; width?: number; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const anchor = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const pw = pop.current?.offsetWidth ?? width ?? 240;
      const ph = pop.current?.offsetHeight ?? 200;
      let left = align === 'end' ? r.right - pw : align === 'center' ? r.left + r.width / 2 - pw / 2 : r.left;
      left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
      let top = side === 'top' ? r.top - ph - 6 : r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      setPos({ left, top });
    };
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', place);
    };
  }, [open, align, side, width]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (pop.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  });
  const close = () => setOpen(false);
  return (
    <>
      <span ref={anchor} className="pop-anchor">
        {trigger({ open, toggle: () => setOpen(!open) })}
      </span>
      {open &&
        createPortal(
          <div ref={pop} className="popover" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }} role="dialog">
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ icon, children, onClick, hint, danger, disabled }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; hint?: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={cx('menu-item', danger && 'is-danger')} onClick={onClick} disabled={disabled}>
      {icon && <span className="menu-icon">{icon}</span>}
      <span className="menu-text">{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  );
}

export function Dialog({ open, onClose, title, children, width = 640, footer, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="dialog-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('dialog', className)} style={{ width: `min(${width}px, calc(100vw - 32px))` }} role="dialog" aria-modal="true">
        {title && <div className="dialog-head">{title}</div>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/** A length input that shows architectural feet-inches and accepts anything parseLength does. */
export function LengthInput({ value, onCommit, format, parse, id, width = 86, disabled }: { value: number; onCommit: (v: number) => void; format: (v: number) => string; parse: (s: string) => number | null; id?: string; width?: number; disabled?: boolean }) {
  const [text, setText] = useState(format(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(format(value));
  }, [value, focus, format]);
  const commit = () => {
    const v = parse(text);
    if (v != null && isFinite(v) && v > 0) onCommit(v);
    else setText(format(value));
  };
  return (
    <input
      id={id}
      className="len-input"
      style={{ width }}
      value={text}
      disabled={disabled}
      onFocus={(e) => {
        setFocus(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onBlur={() => {
        setFocus(false);
        commit();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setText(format(value));
          (e.target as HTMLInputElement).blur();
        }
        e.stopPropagation();
      }}
    />
  );
}
