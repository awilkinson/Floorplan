import { useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { fileToImages, type PreparedImage } from '../ai/files';
import { cx, Spinner } from './primitives';
import { toast } from '../state/store';

/** Photos, screenshots and PDF plans: click, drop or paste. */
export function DropZone({
  files,
  onChange,
  max = 6,
  pdf = false,
  icon,
  title,
  hint,
  compact,
  pdfPages = 2,
}: {
  files: PreparedImage[];
  onChange: (f: PreparedImage[]) => void;
  max?: number;
  pdf?: boolean;
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
  pdfPages?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (list: File[]) => {
    if (!list.length) return;
    setBusy(true);
    const out: PreparedImage[] = [];
    for (const f of list) {
      if (files.length + out.length >= max) break;
      try {
        out.push(...(await fileToImages(f, pdfPages)));
      } catch {
        toast(`Couldn’t read ${f.name}. Try a JPEG, PNG${pdf ? ' or PDF' : ''}.`, 'error');
      }
    }
    setBusy(false);
    onChange([...files, ...out].slice(0, max));
  };
  return (
    <div
      className={cx('dropzone', over && 'is-over', compact && 'is-compact', files.length > 0 && 'has-files')}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void take(Array.from(e.dataTransfer.files));
      }}
    >
      {files.length > 0 && (
        <div className="dz-files">
          {files.map((f, i) => (
            <span key={f.url} className="dz-file">
              <img src={f.url} alt={f.name} />
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X size={11} />
              </button>
            </span>
          ))}
          {files.length < max && (
            <button type="button" className="dz-more" onClick={() => input.current?.click()} aria-label="Add more">
              +
            </button>
          )}
        </div>
      )}
      {files.length === 0 && (
        <button type="button" className="dz-empty" onClick={() => input.current?.click()}>
          <span className="dz-icon">{busy ? <Spinner size={18} /> : icon}</span>
          <span className="dz-text">
            <strong>{title}</strong>
            {hint && <small>{hint}</small>}
          </span>
        </button>
      )}
      {busy && files.length > 0 && (
        <span className="dz-busy">
          <Spinner size={12} /> Preparing…
        </span>
      )}
      <input
        ref={input}
        type="file"
        hidden
        multiple={max > 1}
        accept={pdf ? 'image/*,application/pdf,.pdf' : 'image/*'}
        onChange={(e) => {
          void take(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
