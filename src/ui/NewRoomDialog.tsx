import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, FileText, RefreshCw, Ruler, Square } from 'lucide-react';
import { closeNewRoom, useDialogs } from './dialogs';
import { Button, Dialog, Field, LengthInput, Spinner, cx } from './primitives';
import { DropZone } from './DropZone';
import { tilesOf, type PreparedImage } from '../ai/files';
import { blankRoom, scanRoom, scanToRoom, type ScanRaw } from '../ai/roomScan';
import { errorCopy } from '../ai/client';
import { useAIKind, useImagesVisible } from './Designer';
import { addRoom, fullCatalog, setUi, toast, useStore } from '../state/store';
import { PlanSvg } from '../plan/PlanSvg';
import { usePalette } from '../plan/palette';
import { bounds, offsetPolygon, polygonArea } from '../model/geometry';
import { formatArea, formatLength, inch, parseLength } from '../model/units';
import type { AssetRef, Layout, Room, RoomKind } from '../model/types';
import { uploadImage } from '../persist/assets';
import { GOAL_SUGGESTIONS } from './RoomPanel';
import { askForIdeas } from '../ai/designer';

type Stage = 'start' | 'manual' | 'working' | 'review';

const KINDS: { id: RoomKind; name: string }[] = [
  { id: 'living', name: 'Living room' },
  { id: 'family', name: 'Family room' },
  { id: 'den', name: 'Den or library' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'nursery', name: 'Nursery' },
  { id: 'dining', name: 'Dining room' },
  { id: 'office', name: 'Office' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'other', name: 'Something else' },
];

export function NewRoomDialog() {
  const open = useDialogs((s) => s.newRoom);
  const units = useStore((s) => s.units);
  const ai = useAIKind();
  const [stage, setStage] = useState<Stage>('start');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RoomKind>('living');
  const [goals, setGoals] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [plans, setPlans] = useState<PreparedImage[]>([]);
  const [measure, setMeasure] = useState('');
  const [desc, setDesc] = useState('');
  const visible = useImagesVisible();
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<ScanRaw | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dims, setDims] = useState({ w: inch(16 * 12), d: inch(14 * 12), h: inch(9 * 12) });
  const [saving, setSaving] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage('start');
    setName('');
    setKind('living');
    setGoals([]);
    setPhotos([]);
    setPlans([]);
    setMeasure('');
    setDesc('');
    setRaw(null);
    setAnswers({});
    setError(null);
  }, [open]);

  const roomName = name.trim() || KINDS.find((k) => k.id === kind)?.name || 'New room';
  const method: 'photos' | 'plan' | 'photos+plan' | 'manual' = visible === false || (!plans.length && !photos.length) ? 'manual' : plans.length && photos.length ? 'photos+plan' : plans.length ? 'plan' : 'photos';
  const preview = useMemo(() => (raw ? scanToRoom(raw, { name: roomName, kind, photos: [], method }, fullCatalog()) : null), [raw, roomName, kind, method]);

  const scan = async (extra?: string) => {
    setStage('working');
    setError(null);
    setProgress(visible === false ? 'Drawing the room from your description…' : plans.length ? 'Reading the floor plan…' : 'Looking at the photos…');
    const c = new AbortController();
    ctl.current = c;
    try {
      const planBlobs: Blob[] = [];
      for (const p of visible === false ? [] : plans) {
        planBlobs.push(p.blob);
        // Big sheets: add zoomed quadrants so small dimension text stays readable.
        if (Math.max(p.width, p.height) > 1500 && plans.length === 1) planBlobs.push(...(await tilesOf(p, 2, 2)));
      }
      const m = [measure.trim(), extra].filter(Boolean).join('. ');
      const r = await scanRoom({ name: roomName, kind, photos: photos.map((p) => p.blob), plans: planBlobs, measurements: m || undefined, description: desc.trim() || undefined, signal: c.signal, onProgress: setProgress }, useStore.getState().custom);
      if (!r || !Array.isArray(r.outline) || r.outline.length < 3) throw { code: 'bad_output', message: '' };
      setRaw(r);
      setAnswers({});
      setStage('review');
    } catch (e) {
      if ((e as { code?: string })?.code === 'cancelled') {
        setStage(raw ? 'review' : 'start');
        return;
      }
      setError(errorCopy(e));
      setStage(raw ? 'review' : 'start');
    } finally {
      ctl.current = null;
    }
  };

  const create = async (built: { room: Room; layout: Layout }) => {
    setSaving(true);
    try {
      const refs: AssetRef[] = [];
      for (const p of photos) {
        try {
          refs.push(await uploadImage(p.blob, 'photo', { width: p.width, height: p.height, caption: p.name }));
        } catch {
          /* keep going without this one */
        }
      }
      let underlay: Room['underlay'];
      if (plans[0]) {
        try {
          const ref = await uploadImage(plans[0].blob, 'plan', { width: plans[0].width, height: plans[0].height, caption: plans[0].name });
          const b = bounds(built.room.outline);
          underlay = { asset: ref, scale: (b.w * 1.5) / plans[0].width, x: -b.w * 0.25, y: -b.h * 0.25, rotation: 0, opacity: 0.45, visible: false };
        } catch {
          /* optional */
        }
      }
      const room: Room = { ...built.room, name: roomName, photos: refs, underlay, goals, updatedAt: Date.now() };
      addRoom(room, [built.layout]);
      setUi({ rightTab: 'designer', mode: 'layout' });
      closeNewRoom();
      toast(`Added ${room.name}`, 'good', ai !== 'none' ? { label: 'Get layout ideas', run: () => void askForIdeas() } : undefined);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => formatLength(v, units, { precision: 1 });
  const parse = (s: string) => parseLength(s, units, units === 'metric' ? 'm' : 'ft');
  const described = desc.trim().length > 15 || measure.trim().length > 8;
  const canScan = ai !== 'none' && (visible === false ? described : photos.length > 0 || plans.length > 0 || described);

  return (
    <Dialog
      open={open}
      onClose={() => {
        ctl.current?.abort();
        closeNewRoom();
      }}
      width={stage === 'review' ? 900 : 720}
      className="new-room"
      title={
        <div className="dh">
          <span className="dh-kicker">{stage === 'review' ? 'Check the measurements' : stage === 'manual' ? 'Type the size' : 'New room'}</span>
          <span className="dh-title">{stage === 'review' ? roomName : 'Add a room'}</span>
        </div>
      }
      footer={
        stage === 'start' ? (
          <>
            <button type="button" className="link-btn" onClick={() => setStage('manual')}>
              <Ruler size={12} /> Skip the photos and type the size
            </button>
            <span className="grow" />
            <Button onClick={closeNewRoom}>Cancel</Button>
            <Button variant="primary" icon={<ArrowRight size={14} />} disabled={!canScan} onClick={() => scan()}>
              {visible === false || (!photos.length && !plans.length) ? 'Build the room' : 'Measure the room'}
            </Button>
          </>
        ) : stage === 'manual' ? (
          <>
            <Button variant="quiet" icon={<ArrowLeft size={14} />} onClick={() => setStage('start')}>
              Back
            </Button>
            <span className="grow" />
            <Button variant="primary" icon={<Check size={14} />} disabled={saving} onClick={() => create(blankRoom(roomName, kind, dims.w / 0.0254, dims.d / 0.0254, dims.h / 0.0254))}>
              Create room
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
            <Button variant="quiet" icon={<ArrowLeft size={14} />} onClick={() => setStage('start')}>
              Back
            </Button>
            <span className="grow" />
            {raw?.questions?.length ? (
              <Button
                icon={<RefreshCw size={14} />}
                disabled={!Object.values(answers).some((a) => a.trim())}
                onClick={() =>
                  scan(
                    (raw.questions ?? [])
                      .map((q, i) => (answers[i]?.trim() ? `${q} ${answers[i].trim()}` : ''))
                      .filter(Boolean)
                      .join('. '),
                  )
                }
              >
                Re-measure with my answers
              </Button>
            ) : null}
            <Button variant="primary" icon={saving ? <Spinner size={13} /> : <Check size={14} />} disabled={!preview || saving} onClick={() => preview && create(preview)}>
              Create room
            </Button>
          </>
        )
      }
    >
      {stage === 'start' && (
        <div className="nr-start">
          <div className="nr-row">
            <Field label="Name">
              <input className="text-input" autoFocus placeholder="e.g. Great Room, Nursery, Den" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            </Field>
            <Field label="Kind of room">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as RoomKind)}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="nr-sources">
            <div className="nr-source">
              <div className="nr-source-head">
                <Camera size={14} /> Photos of the room
              </div>
              <DropZone files={photos} onChange={setPhotos} max={8} icon={<Camera size={20} />} title="Drop photos" hint="Shoot from the corners so every wall shows up. 3–6 photos is ideal." />
            </div>
            <div className="nr-source">
              <div className="nr-source-head">
                <FileText size={14} /> A floor plan, if you have one
                <span className="nr-rec">Most accurate</span>
              </div>
              <DropZone files={plans} onChange={setPlans} max={2} pdf icon={<FileText size={20} />} title="Drop a plan" hint="PDF, a listing plan, or a photo of a sketch with measurements." />
            </div>
          </div>
          {visible === false && (
            <div className="notice">
              <strong>Claude can’t see photos or plans in this window,</strong> so it can’t measure from them here. Describe the room below and it will draw it; any photos you add are still saved with the room. In a browser tab at claude.ai, measuring from photos may work.
            </div>
          )}
          <Field label={visible === false ? 'Describe the room' : 'Describe the room (optional)'} hint="Walls, doors and windows, built-ins, the view — whatever you know.">
            <textarea
              className="text-input"
              id="nr-desc"
              rows={3}
              placeholder="e.g. About 25 by 23 feet, 10½′ coffered ceiling. Three pairs of French doors on the north wall to a terrace; fireplace in the middle of the west wall with shelves either side; library shelves along the south wall; a door to the hall on the east wall."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </Field>
          <Field label="Measurements you know (optional)" hint="Even one real measurement makes everything else more accurate.">
            <input className="text-input" placeholder="e.g. fireplace wall 23′, ceiling 10′-6″, doors 8′ tall" value={measure} onChange={(e) => setMeasure(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          </Field>
          <div className="field">
            <span className="field-label">What’s it for? (optional)</span>
            <div className="chip-wrap">
              {GOAL_SUGGESTIONS.map((g) => (
                <button key={g} type="button" className={cx('chip', goals.includes(g) && 'is-on')} aria-pressed={goals.includes(g)} onClick={() => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          {ai === 'none' && <div className="notice">Measuring from photos and plans uses Claude, which works when this page is open in claude.ai. You can still type the size.</div>}
          {error && <div className="notice is-error">{error}</div>}
        </div>
      )}

      {stage === 'manual' && (
        <div className="nr-manual">
          <div className="nr-row">
            <Field label="Name">
              <input className="text-input" autoFocus placeholder="e.g. Nursery" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            </Field>
            <Field label="Kind of room">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as RoomKind)}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="size-grid nr-dims">
            <label>
              <span>Width</span>
              <LengthInput value={dims.w} format={fmt} parse={parse} width={110} onCommit={(v) => setDims({ ...dims, w: v })} />
            </label>
            <label>
              <span>Depth</span>
              <LengthInput value={dims.d} format={fmt} parse={parse} width={110} onCommit={(v) => setDims({ ...dims, d: v })} />
            </label>
            <label>
              <span>Ceiling</span>
              <LengthInput value={dims.h} format={fmt} parse={parse} width={110} onCommit={(v) => setDims({ ...dims, h: v })} />
            </label>
          </div>
          <p className="field-hint">You’ll get a clean rectangle. Add doors, windows and built-ins afterwards from the room editor, and reshape walls by dragging them on the plan.</p>
        </div>
      )}

      {stage === 'working' && (
        <div className="ap-working" aria-live="polite">
          <div className="ap-working-imgs">
            {[...plans, ...photos].slice(0, 5).map((i) => (
              <img key={i.url} src={i.url} alt="" />
            ))}
          </div>
          <Spinner size={22} />
          <p>{progress || 'Measuring…'}</p>
          <p className="muted small">Careful measuring takes a minute or two.</p>
        </div>
      )}

      {stage === 'review' && preview && raw && <Review room={preview.room} layout={preview.layout} raw={raw} answers={answers} setAnswers={setAnswers} photos={photos} units={units} error={error} />}
    </Dialog>
  );
}

function Review({ room, layout, raw, answers, setAnswers, photos, units, error }: { room: Room; layout: Layout; raw: ScanRaw; answers: Record<number, string>; setAnswers: (a: Record<number, string>) => void; photos: PreparedImage[]; units: 'imperial' | 'metric'; error: string | null }) {
  const palette = usePalette();
  const catalog = useMemo(() => fullCatalog(), []);
  const outer = offsetPolygon(room.outline, room.wallThickness);
  const b = bounds(outer);
  const rb = bounds(room.outline);
  const pad = 0.2;
  const conf = room.survey?.confidence ?? 'medium';
  return (
    <div className="nr-review">
      <div className="nr-plan">
        <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Plan of ${room.name}`}>
          <PlanSvg room={room} layout={layout} catalog={catalog} units={units} options={{ dims: false, labels: false, grid: false, overlays: { circulation: false, clearances: false, hifi: false, zones: false } }} palette={palette} />
        </svg>
        <div className="nr-plan-dims mono">
          <span>
            {formatLength(rb.w, units, { compact: true })} × {formatLength(rb.h, units, { compact: true })}
          </span>
          <span>{formatArea(polygonArea(room.outline), units)}</span>
          <span>Ceiling {formatLength(room.ceilingHeight, units, { compact: true })}</span>
        </div>
        {photos.length > 0 && (
          <div className="nr-photos">
            {photos.slice(0, 6).map((p) => (
              <img key={p.url} src={p.url} alt="" />
            ))}
          </div>
        )}
      </div>
      <div className="nr-facts">
        <div className="nr-conf">
          <span className={`conf conf-${conf}`}>{conf} confidence</span>
          <span className="muted small">
            {room.openings.length} opening{room.openings.length === 1 ? '' : 's'} · {room.fixtures.length} built-in{room.fixtures.length === 1 ? '' : 's'} · {layout.items.length} piece{layout.items.length === 1 ? '' : 's'} of furniture
          </span>
        </div>
        {raw.assumptions && raw.assumptions.length > 0 && (
          <section>
            <h4 className="insp-label">What I assumed</h4>
            <ul className="nr-list">
              {raw.assumptions.slice(0, 6).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </section>
        )}
        {raw.questions && raw.questions.length > 0 && (
          <section>
            <h4 className="insp-label">Help me be more accurate</h4>
            {raw.questions.slice(0, 3).map((q, i) => (
              <label key={i} className="nr-q">
                <span>{q}</span>
                <input className="text-input" placeholder="Your answer" value={answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
              </label>
            ))}
          </section>
        )}
        <p className="field-hint">You can fine-tune everything after: drag walls on the plan, or measure one wall and the whole room rescales to match.</p>
        {error && <div className="notice is-error">{error}</div>}
      </div>
    </div>
  );
}
