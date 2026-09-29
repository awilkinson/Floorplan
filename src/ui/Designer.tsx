import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ImagePlus, Loader2, RotateCcw, Sparkles, Square, Undo2, X, Eye, Wand2 } from 'lucide-react';
import { acceptProposal, activeRoom, previewProposal, undo, useStore, type Proposal } from '../state/store';
import { askDesigner, askForIdeas, clearThread, stopDesigner, useThread, type Msg } from '../ai/designer';
import { getAI } from '../ai/client';
import { PlanSvg } from '../plan/PlanSvg';
import { CATALOG_MAP } from '../catalog/catalog';
import { bounds, offsetPolygon } from '../model/geometry';
import { usePalette } from '../plan/palette';
import { Button, IconButton, cx } from './primitives';
import { GoalsEditor } from './RoomPanel';
import type { Room } from '../model/types';
import { fileToImages } from '../ai/files';

export function useAIKind() {
  const [kind, setKind] = useState<'claude' | 'mock' | 'none' | 'loading'>('loading');
  useEffect(() => {
    let alive = true;
    getAI().then((c) => alive && setKind(c.kind));
    return () => {
      alive = false;
    };
  }, []);
  return kind;
}

const QUICK: { label: string; prompt: string; ideas?: boolean; goal?: RegExp }[] = [
  { label: 'Set up for listening', prompt: 'Set the room up for serious hi-fi listening: a proper equilateral triangle with the B&W speakers and a great listening seat, without wrecking the rest of the room.', goal: /hi-?fi|listen/i },
  { label: 'Make it baby-safe', prompt: 'Make the room safer and better for the baby: a soft open play floor, nothing sharp or glass at crawling height, a gate for the fireplace, toys stored nearby.', goal: /baby|kid|child/i },
  { label: 'Christmas morning', prompt: 'Design the room for Christmas: find the best spot for a big tree and arrange the seating for opening presents by the fire.', ideas: true, goal: /christmas|holiday/i },
  { label: 'Tea for two by the window', prompt: 'Create a quiet reading and tea-for-two corner with the view: two great chairs, a small table and good light.', goal: /tea|read/i },
  { label: 'Critique this layout', prompt: 'Critique the current layout like a top designer would: what works, what doesn’t, and the three moves you’d make first. Don’t change anything yet.' },
  { label: 'Edit it down', prompt: 'Edit the room down: remove clutter and anything that fights the architecture, keeping only the pieces that earn their place.' },
];

const NO_MSGS: Msg[] = [];

export function Designer() {
  const room = useStore((s) => activeRoom(s));
  const rid = useStore((s) => s.activeRoomId ?? 'none');
  const msgs = useThread((s) => s.byRoom[rid] ?? NO_MSGS);
  const busy = useThread((s) => s.busy);
  const kind = useAIKind();
  const scroller = useRef<HTMLDivElement>(null);
  const [showGoals, setShowGoals] = useState(false);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, msgs[msgs.length - 1]?.text, msgs[msgs.length - 1]?.proposals?.length]);
  if (!room) return null;
  const quick = QUICK.filter((q) => !q.goal || room.goals.some((g) => q.goal!.test(g)));
  return (
    <div className="designer">
      {kind === 'none' && (
        <div className="notice">
          <strong>The designer works inside claude.ai.</strong> Open this page there and it uses your Claude plan — no keys or setup. Everything else works here.
        </div>
      )}
      <div className="designer-scroll" ref={scroller}>
        <div className="designer-intro">
          <button type="button" className="goal-line" onClick={() => setShowGoals(!showGoals)} aria-expanded={showGoals}>
            <span className="goal-kicker">Designing for</span>
            <span className="goal-list">{room.goals.length ? room.goals.join(' · ') : 'Add what the room needs to do'}</span>
            <span className="goal-edit">{showGoals ? 'Done' : 'Edit'}</span>
          </button>
          {showGoals && <GoalsEditor room={room} />}
          <button type="button" className="ideas-cta" disabled={busy} onClick={() => askForIdeas()}>
            <span className="ideas-icon">
              <Sparkles size={18} />
            </span>
            <span className="ideas-text">
              <strong>Three new layouts</strong>
              <small>In different directions, each drawn and checked against your goals</small>
            </span>
          </button>
          <div className="quick">
            {quick.map((q) => (
              <button key={q.label} type="button" className="chip" disabled={busy} onClick={() => (q.ideas ? askForIdeas(q.prompt) : askDesigner(q.prompt))}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
        {msgs.map((m) => (
          <Message key={m.id} m={m} room={room} />
        ))}
      </div>
      <Composer busy={busy} />
    </div>
  );
}

function Message({ m, room }: { m: Msg; room: Room }) {
  const proposals = useStore((s) => s.proposals);
  const preview = useStore((s) => s.preview);
  if (m.role === 'user')
    return (
      <div className="msg msg-user">
        {m.images?.map((u) => <img key={u} src={u} alt="" className="msg-img" />)}
        <p>{m.text}</p>
      </div>
    );
  const list = (m.proposals ?? []).map((id) => proposals.find((p) => p.id === id)).filter(Boolean) as Proposal[];
  const saved = (m.proposals ?? []).length > list.length;
  return (
    <div className={cx('msg msg-designer', m.status === 'error' && 'is-error')}>
      <div className="msg-who">
        <Wand2 size={12} /> Designer
      </div>
      {m.status === 'thinking' ? (
        <p className="thinking">
          <Loader2 size={14} className="spin" /> {m.kind === 'ideas' ? 'Sketching three directions — a minute or two for well-considered plans…' : 'Thinking it through…'}
        </p>
      ) : (
        <p>{m.text}</p>
      )}
      {m.status === 'streaming' && (
        <p className="thinking small">
          <Loader2 size={12} className="spin" /> Still drawing…
        </p>
      )}
      {list.length > 0 && (
        <div className="proposals">
          {list.map((p) => (
            <ProposalCard key={p.id} p={p} room={room} active={preview === p.id} />
          ))}
        </div>
      )}
      {saved && list.length === 0 && <p className="muted small">Saved to your layouts.</p>}
      {m.fixes && m.fixes.length > 0 && (
        <details className="fixes">
          <summary>{m.fixes.length} small adjustment{m.fixes.length > 1 ? 's' : ''} so everything fits</summary>
          <ul>
            {m.fixes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      )}
      {m.applied && (
        <div className="msg-actions">
          <Button size="sm" variant="quiet" icon={<Undo2 size={13} />} onClick={() => undo()}>
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}

function ProposalCard({ p, room, active }: { p: Proposal; room: Room; active: boolean }) {
  const palette = usePalette();
  const custom = useStore((s) => s.custom);
  const catalog = useMemo(() => ({ ...CATALOG_MAP, ...custom }), [custom]);
  const b = bounds(offsetPolygon(room.outline, room.wallThickness));
  const pad = 0.15;
  const vb = `${b.minX - pad} ${b.minY - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
  const newCount = p.layout.items.filter((i) => !catalog[i.ref]?.owned).length;
  return (
    <div className={cx('proposal', active && 'is-active')}>
      <button type="button" className="proposal-plan" onClick={() => previewProposal(active ? null : p.id)} aria-label={`Preview ${p.layout.name}`}>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <PlanSvg room={room} layout={p.layout} catalog={catalog} units="imperial" options={{ dims: false, labels: false, grid: false, overlays: { circulation: false, clearances: false, hifi: false, zones: true } }} palette={palette} />
        </svg>
        <span className="proposal-eye">
          <Eye size={13} /> {active ? 'Previewing' : 'Preview'}
        </span>
      </button>
      <div className="proposal-body">
        <div className="proposal-head">
          <span className="proposal-name">{p.layout.name}</span>
          {p.layout.direction && <span className="proposal-dir">{p.layout.direction}</span>}
        </div>
        {p.layout.concept && <p className="proposal-concept">{p.layout.concept}</p>}
        {p.layout.moves && p.layout.moves.length > 0 && (
          <ul className="proposal-moves">
            {p.layout.moves.slice(0, 4).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        <div className="proposal-foot">
          <span className="muted small">
            {p.layout.items.length} pieces{newCount ? ` · ${newCount} new` : ''}
          </span>
          <Button size="sm" variant={active ? 'primary' : 'default'} icon={<Check size={13} />} onClick={() => acceptProposal(p.id)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Composer({ busy }: { busy: boolean }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([]);
  const selection = useStore((s) => s.selection);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(160, el.scrollHeight) + 'px';
  }, [text]);
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    void askDesigner(t, { focusIds: selection.length ? selection : undefined, images: images.map((i) => i.blob) });
    setText('');
    setImages([]);
  };
  return (
    <div className="composer">
      {images.length > 0 && (
        <div className="composer-imgs">
          {images.map((im, i) => (
            <span key={im.url} className="composer-img">
              <img src={im.url} alt="" />
              <button type="button" aria-label="Remove image" onClick={() => setImages(images.filter((_, j) => j !== i))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-row">
        <label className="icon-btn" title="Attach an inspiration photo">
          <ImagePlus size={16} />
          <input
            type="file"
            accept="image/*"
            hidden
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              const out: { blob: Blob; url: string }[] = [];
              for (const f of files.slice(0, 3)) {
                try {
                  const [img] = await fileToImages(f);
                  out.push({ blob: img.blob, url: img.url });
                } catch {
                  /* skip */
                }
              }
              setImages((cur) => [...cur, ...out].slice(0, 3));
              e.target.value = '';
            }}
          />
        </label>
        <textarea
          ref={ta}
          id="designer-input"
          rows={1}
          placeholder={selection.length ? 'Ask about the selected piece…' : 'Ask for anything — “make room for a piano”, “cozier for winter”'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={async (e) => {
            const files = Array.from(e.clipboardData.files ?? []).filter((f) => f.type.startsWith('image/'));
            if (!files.length) return;
            e.preventDefault();
            for (const f of files.slice(0, 3)) {
              const [img] = await fileToImages(f);
              setImages((cur) => [...cur, { blob: img.blob, url: img.url }].slice(0, 3));
            }
          }}
        />
        {busy ? <IconButton label="Stop" icon={<Square size={14} />} className="send-btn is-stop" onClick={stopDesigner} /> : <IconButton label="Send" icon={<ArrowUp size={16} />} className="send-btn" onClick={send} disabled={!text.trim()} />}
      </div>
      <div className="composer-foot">
        <button type="button" className="link-btn" onClick={clearThread}>
          <RotateCcw size={11} /> New conversation
        </button>
        <span className="muted small">Uses your Claude plan</span>
      </div>
    </div>
  );
}
