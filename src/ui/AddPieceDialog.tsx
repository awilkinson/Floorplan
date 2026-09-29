import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ImagePlus, Link2, RotateCcw, Sparkles, Square, Replace, BookmarkPlus } from 'lucide-react';
import { closeAddPiece, useDialogs } from './dialogs';
import { Button, Dialog, LengthInput, Spinner } from './primitives';
import { DropZone } from './DropZone';
import { fileToImages, type PreparedImage } from '../ai/files';
import { importProduct } from '../ai/importer';
import { errorCopy } from '../ai/client';
import { useAIKind } from './Designer';
import { useThumb } from './thumbs';
import { activeRoom, addCustomEntry, catalogEntry, editItems, fullCatalog, setUi, toast, useStore } from '../state/store';
import { CATEGORY_LABELS } from '../catalog/catalog';
import { formatLength, parseLength } from '../model/units';
import type { CatalogEntry } from '../model/types';
import { uploadImage } from '../persist/assets';
import { addToRoom } from './Library';
import { ideasWith } from '../ai/designer';
import { settle } from '../ai/solver';

type Stage = 'input' | 'working' | 'result';

const WORKING = ['Reading the product…', 'Working out the real dimensions…', 'Matching materials and colors…', 'Building it in 3D…'];

export function AddPieceDialog() {
  const open = useDialogs((s) => s.addPiece);
  const seed = useDialogs((s) => s.addPieceSeed);
  const [stage, setStage] = useState<Stage>('input');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const [meta, setMeta] = useState<{ confidence: string; source?: string }>({ confidence: 'medium' });
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const ctl = useRef<AbortController | null>(null);
  const ai = useAIKind();
  const replacing = seed?.replaceId ? findItem(seed.replaceId) : null;

  useEffect(() => {
    if (!open) return;
    setStage('input');
    setEntry(null);
    setError(null);
    setUrl(seed?.text && /^https?:/.test(seed.text) ? seed.text : '');
    setNotes('');
    setImages([]);
  }, [open, seed]);

  useEffect(() => {
    if (stage !== 'working') return;
    const t = setInterval(() => setTick((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, [stage]);

  // Paste a screenshot or a link anywhere in the dialog.
  useEffect(() => {
    if (!open || stage !== 'input') return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        void (async () => {
          const out: PreparedImage[] = [];
          for (const f of files.slice(0, 3)) out.push(...(await fileToImages(f)));
          setImages((cur) => [...cur, ...out].slice(0, 3));
        })();
        return;
      }
      const text = e.clipboardData?.getData('text') ?? '';
      if (/^https?:\/\/\S+$/.test(text.trim()) && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) {
        e.preventDefault();
        setUrl(text.trim());
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, stage]);

  const canGo = (url.trim().length > 8 || images.length > 0) && ai !== 'none';

  const go = async () => {
    if (!canGo) return;
    setStage('working');
    setError(null);
    setTick(0);
    const c = new AbortController();
    ctl.current = c;
    try {
      const preview = images[0] ? { id: `local-preview-${Date.now()}`, url: images[0].url, kind: 'product' as const, width: images[0].width, height: images[0].height } : undefined;
      const r = await importProduct({ url: url.trim() || undefined, notes: notes.trim() || undefined, images: images.map((i) => i.blob), image: preview, signal: c.signal });
      setEntry(r.entry);
      setMeta({ confidence: r.confidence, source: r.dimensionsSource });
      setStage('result');
    } catch (e) {
      if ((e as { code?: string })?.code === 'cancelled') {
        setStage('input');
        return;
      }
      setError(errorCopy(e));
      setStage('input');
    } finally {
      ctl.current = null;
    }
  };

  const commit = async (how: 'add' | 'save' | 'ideas' | 'replace') => {
    if (!entry) return;
    let e = entry;
    if (e.image && images[0]) {
      try {
        const ref = await uploadImage(images[0].blob, 'product', { width: images[0].width, height: images[0].height, caption: e.name });
        e = { ...e, image: ref };
      } catch {
        /* keep the session image */
      }
    }
    addCustomEntry(e);
    const room = activeRoom();
    if (how === 'add') {
      if (useStore.getState().mode === 'room') setUi({ mode: 'layout' });
      addToRoom(e);
      toast(`Added the ${e.name}`, 'good');
    } else if (how === 'replace' && seed?.replaceId && room) {
      const id = seed.replaceId;
      editItems(`Replace with ${e.name}`, (items) => {
        const next = items.map((it) => (it.id === id ? { ...it, ref: e.id, w: undefined, d: undefined, h: undefined, finishes: undefined, label: undefined } : it));
        return settle(room, next, fullCatalog(), { movable: new Set([id]) }).items;
      });
      useStore.setState({ selection: [id], rightTab: 'inspect' });
      toast(`Swapped in the ${e.name}`, 'good');
    } else if (how === 'ideas') {
      setUi({ rightTab: 'designer' });
      ideasWith(e.id);
    } else {
      toast(`Saved the ${e.name} to your library`, 'good');
    }
    closeAddPiece();
  };

  const title = replacing ? `Replace the ${replacing.name.replace(/^Your /, '').toLowerCase()}` : 'Bring in a piece';
  return (
    <Dialog
      open={open}
      onClose={() => {
        ctl.current?.abort();
        closeAddPiece();
      }}
      width={stage === 'result' ? 760 : 620}
      className="add-piece"
      title={
        <div className="dh">
          <span className="dh-kicker">{stage === 'result' ? 'Here’s what I found' : 'From a link or a photo'}</span>
          <span className="dh-title">{title}</span>
        </div>
      }
      footer={
        stage === 'input' ? (
          <>
            <span className="grow muted small">{ai === 'none' ? 'Reading products uses Claude — open this page in claude.ai.' : 'Links are identified by maker and model. A screenshot with dimensions is most accurate.'}</span>
            <Button onClick={closeAddPiece}>Cancel</Button>
            <Button variant="primary" icon={<ArrowRight size={14} />} disabled={!canGo} onClick={go}>
              Bring it in
            </Button>
          </>
        ) : stage === 'working' ? (
          <>
            <span className="grow" />
            <Button icon={<Square size={13} />} onClick={() => ctl.current?.abort()}>
              Stop
            </Button>
          </>
        ) : (
          <>
            <Button variant="quiet" icon={<RotateCcw size={14} />} onClick={() => setStage('input')}>
              Start over
            </Button>
            <span className="grow" />
            <Button icon={<BookmarkPlus size={14} />} onClick={() => commit('save')}>
              Save to library
            </Button>
            {seed?.replaceId ? (
              <Button variant="primary" icon={<Replace size={14} />} onClick={() => commit('replace')}>
                Swap it in
              </Button>
            ) : (
              <>
                <Button icon={<Sparkles size={14} />} onClick={() => commit('ideas')} title="Ask the designer for three layouts built around this piece">
                  Try it in 3 layouts
                </Button>
                <Button variant="primary" icon={<Check size={14} />} onClick={() => commit('add')}>
                  Add to room
                </Button>
              </>
            )}
          </>
        )
      }
    >
      {stage === 'input' && (
        <div className="ap-input">
          <label className="url-field">
            <Link2 size={15} aria-hidden="true" />
            <input
              autoFocus
              type="url"
              inputMode="url"
              placeholder="Paste a product link — any store or maker"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void go();
              }}
            />
          </label>
          <div className="or-rule">
            <span>and / or</span>
          </div>
          <DropZone files={images} onChange={setImages} max={3} icon={<ImagePlus size={20} />} title="Drop a photo or screenshot" hint="Paste with ⌘V, or click to choose. Up to 3 images." />
          <label className="field">
            <span className="field-label">Anything I should know?</span>
            <input className="text-input" placeholder="e.g. the 96″ version in olive velvet, or ‘the one on the left’" value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </label>
          {error && <div className="notice is-error">{error}</div>}
        </div>
      )}
      {stage === 'working' && (
        <div className="ap-working" aria-live="polite">
          <div className="ap-working-imgs">{images.slice(0, 3).map((i) => <img key={i.url} src={i.url} alt="" />)}</div>
          <Spinner size={22} />
          <p>{WORKING[tick % WORKING.length]}</p>
          {url && <p className="muted small mono ap-url">{url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)}</p>}
        </div>
      )}
      {stage === 'result' && entry && <Result entry={entry} setEntry={setEntry} meta={meta} photo={images[0]?.url} />}
    </Dialog>
  );
}

function findItem(id: string): CatalogEntry | null {
  const s = useStore.getState();
  const room = activeRoom(s);
  if (!room) return null;
  const l = s.layouts[room.activeLayoutId ?? room.layoutOrder[0]];
  const it = l?.items.find((x) => x.id === id);
  return it ? catalogEntry(it.ref, s) ?? null : null;
}

function Result({ entry, setEntry, meta, photo }: { entry: CatalogEntry; setEntry: (e: CatalogEntry) => void; meta: { confidence: string; source?: string }; photo?: string }) {
  const units = useStore((s) => s.units);
  const thumb = useThumb(entry);
  const fmt = useMemo(() => (v: number) => formatLength(v, units, { precision: 2, inchesBelow: 9 }), [units]);
  const parse = (s: string) => parseLength(s, units);
  const src = meta.source === 'printed' && photo ? 'Dimensions read from your image.' : meta.source === 'printed' || meta.source === 'known' ? 'Dimensions from the maker’s published size — worth a quick check.' : 'Dimensions estimated from proportions — adjust them if you know the real size.';
  return (
    <div className="ap-result">
      <div className="ap-visual">
        <div className="ap-render">{thumb ? <img src={thumb} alt={`${entry.name} as drawn in the planner`} /> : <Spinner size={20} />}</div>
        {photo && (
          <figure className="ap-photo">
            <img src={photo} alt="Your image" />
            <figcaption>Your image</figcaption>
          </figure>
        )}
      </div>
      <div className="ap-info">
        <span className="insp-kicker">{CATEGORY_LABELS[entry.category]}</span>
        <input className="ap-name" value={entry.name} onChange={(e) => setEntry({ ...entry, name: e.target.value })} onKeyDown={(e) => e.stopPropagation()} aria-label="Name" />
        {(entry.brand || entry.designer) && <div className="insp-sub">{[entry.brand, entry.designer].filter(Boolean).join(' · ')}</div>}
        {entry.price && <div className="insp-sub">{entry.price}</div>}
        {entry.description && <p className="insp-desc">{entry.description}</p>}
        <div className="insp-label-row">
          <span className="insp-label">Size</span>
          <span className={`conf conf-${meta.confidence}`}>{meta.confidence} confidence</span>
        </div>
        <div className="size-grid">
          {(['w', 'd', 'h'] as const).map((k) => (
            <label key={k}>
              <span>{k.toUpperCase()}</span>
              <LengthInput value={entry[k]} format={fmt} parse={parse} onCommit={(v) => setEntry({ ...entry, [k]: v })} />
            </label>
          ))}
        </div>
        <p className="field-hint">{src}</p>
      </div>
    </div>
  );
}
