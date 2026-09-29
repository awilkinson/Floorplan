import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { activeLayout, activeRoom, editItems, fullCatalog, previewProposal, setProposals, toast, useStore, type Proposal } from '../state/store';
import { analyzeLayout } from '../design/checks';
import { errorCopy, getAI, parseJsonLoose, type AIError } from './client';
import { editPrompt, ideasPrompt, type IdeaRequest } from './prompts';
import { ideaToLayout, rawToItems, resolveRef, settle, type RawIdea, type RawItem } from './solver';
import type { Item, Layout, Zone } from '../model/types';
import { bearingToRotation, inch } from '../model/units';
import { FINISH_MAP } from '../catalog/finishes';

export interface Msg {
  id: string;
  role: 'user' | 'designer';
  text: string;
  status?: 'thinking' | 'streaming' | 'done' | 'error';
  kind?: 'ideas' | 'edit';
  proposals?: string[];
  applied?: boolean;
  fixes?: string[];
  images?: string[];
  at: number;
}

interface ThreadState {
  byRoom: Record<string, Msg[]>;
  busy: boolean;
  controller: AbortController | null;
}

export const useThread = create<ThreadState>(() => ({ byRoom: {}, busy: false, controller: null }));

function roomId() {
  return useStore.getState().activeRoomId ?? 'none';
}

function push(m: Omit<Msg, 'id' | 'at'>): string {
  const id = nanoid(8);
  const rid = roomId();
  useThread.setState((s) => ({ byRoom: { ...s.byRoom, [rid]: [...(s.byRoom[rid] ?? []), { ...m, id, at: Date.now() }] } }));
  return id;
}

function patch(id: string, p: Partial<Msg>) {
  const rid = roomId();
  useThread.setState((s) => ({ byRoom: { ...s.byRoom, [rid]: (s.byRoom[rid] ?? []).map((m) => (m.id === id ? { ...m, ...p } : m)) } }));
}

export function stopDesigner() {
  useThread.getState().controller?.abort();
}

export function clearThread() {
  const rid = roomId();
  useThread.setState((s) => ({ byRoom: { ...s.byRoom, [rid]: [] } }));
}

function history(): { role: 'user' | 'assistant'; text: string }[] {
  return (useThread.getState().byRoom[roomId()] ?? []).filter((m) => m.status !== 'thinking' && m.text).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
}

const IDEA_RE = /\b(ideas?|options?|layouts?|alternatives?|directions?|schemes?|variations?)\b|\bdifferent ways\b|\bsurprise me\b/i;

// ---------------------------------------------------------------------------

export async function askForIdeas(brief?: string, req: Partial<IdeaRequest> = {}) {
  const s = useStore.getState();
  const room = activeRoom(s);
  if (!room || useThread.getState().busy) return;
  const layout = activeLayout(s);
  const catalog = fullCatalog(s);
  const ai = await getAI();
  if (brief !== undefined || !req.feature) push({ role: 'user', text: brief || 'Suggest three layouts in different directions.' });
  const mid = push({ role: 'designer', text: '', status: 'thinking', kind: 'ideas' });
  if (ai.kind === 'none') {
    patch(mid, { status: 'error', text: errorCopy({ code: 'unavailable', message: '' }) });
    return;
  }
  const controller = new AbortController();
  useThread.setState({ busy: true, controller });
  const analysis = layout ? analyzeLayout(room, layout, s.custom) : null;
  const prompt = ideasPrompt(room, layout, catalog, s.custom, analysis, { count: 3, brief, ...req });
  const ids: string[] = [];
  setProposals(() => []);
  previewProposal(null);
  let consumed = 0;
  const handleLine = (line: string) => {
    const t = line.trim();
    if (!t || !t.startsWith('{')) return;
    let raw: RawIdea;
    try {
      raw = JSON.parse(t) as RawIdea;
    } catch {
      return;
    }
    const pid = `idea-${nanoid(6)}`;
    const { layout: l, fixes } = ideaToLayout(room, raw, catalog, pid);
    const p: Proposal = { id: pid, layout: l, status: 'ready', fixes, shopping: raw.shopping };
    ids.push(pid);
    setProposals((list) => [...list, p]);
    patch(mid, { status: 'streaming', proposals: [...ids], text: ids.length === 1 ? 'Here’s the first direction — more on the way.' : `${ids.length} directions so far…` });
    if (ids.length === 1) previewProposal(pid);
  };
  try {
    const text = await ai.text(prompt, {
      tier: 'complex',
      cache: false,
      signal: controller.signal,
      onText: ({ text }) => {
        const lines = text.split('\n');
        // every line but the last is complete
        for (let i = consumed; i < lines.length - 1; i++) handleLine(lines[i]);
        consumed = Math.max(consumed, lines.length - 1);
      },
    });
    const lines = text.split('\n');
    for (let i = consumed; i < lines.length; i++) handleLine(lines[i]);
    if (!ids.length) {
      // tolerate a single JSON array reply
      try {
        const arr = parseJsonLoose(text);
        if (Array.isArray(arr)) arr.forEach((x) => handleLine(JSON.stringify(x)));
      } catch {
        /* ignore */
      }
    }
    if (!ids.length) throw { code: 'invalid_json', message: 'no ideas' } as AIError;
    const names = useStore
      .getState()
      .proposals.filter((p) => ids.includes(p.id))
      .map((p) => `“${p.layout.name}”`);
    patch(mid, { status: 'done', proposals: ids, text: `${names.length === 1 ? 'One direction' : `${names.length} directions`}: ${names.join(', ')}. Flip through them on the canvas and save the one you like — you can keep refining it after.` });
  } catch (e) {
    const code = (e as AIError)?.code;
    patch(mid, { status: code === 'cancelled' ? 'done' : 'error', text: code === 'cancelled' && ids.length ? `Stopped after ${ids.length} idea${ids.length > 1 ? 's' : ''}.` : errorCopy(e), proposals: ids });
  } finally {
    useThread.setState({ busy: false, controller: null });
  }
}

// ---------------------------------------------------------------------------

interface RawOp {
  op: 'move' | 'add' | 'remove' | 'swap' | 'finish' | 'resize';
  id?: string;
  ref?: string;
  x?: number;
  y?: number;
  facing?: number;
  w?: number;
  d?: number;
  finish?: Record<string, string> | string;
  slot?: string;
  elevation?: number;
}

function applyOps(items: Item[], ops: RawOp[], catalog: ReturnType<typeof fullCatalog>, notes: string[]): { items: Item[]; touched: Set<string> } {
  let list = items.map((it) => ({ ...it }));
  const touched = new Set<string>();
  const find = (id?: string) => list.find((x) => x.id === id);
  for (const op of ops ?? []) {
    switch (op.op) {
      case 'move': {
        const it = find(op.id);
        if (!it) break;
        if (op.x != null) it.x = inch(op.x);
        if (op.y != null) it.y = inch(op.y);
        if (op.facing != null) it.rotation = bearingToRotation(op.facing);
        if (op.elevation != null) it.elevation = inch(op.elevation);
        it.wall = undefined;
        touched.add(it.id);
        break;
      }
      case 'add': {
        if (!op.ref) break;
        const added = rawToItems([{ id: op.id, ref: op.ref, x: op.x ?? 0, y: op.y ?? 0, facing: op.facing, w: op.w, d: op.d, finish: typeof op.finish === 'object' ? op.finish : undefined, elevation: op.elevation } as RawItem], catalog, notes);
        for (const a of added) {
          while (find(a.id)) a.id = `${a.id}-${nanoid(3)}`;
          list.push(a);
          touched.add(a.id);
        }
        break;
      }
      case 'remove':
        list = list.filter((x) => x.id !== op.id);
        break;
      case 'swap': {
        const it = find(op.id);
        const e = op.ref ? resolveRef(op.ref, catalog) : null;
        if (!it || !e) break;
        it.ref = e.id;
        it.w = it.d = it.h = undefined;
        it.params = undefined;
        it.finishes = typeof op.finish === 'object' ? Object.fromEntries(Object.entries(op.finish).filter(([, v]) => FINISH_MAP[v])) : undefined;
        touched.add(it.id);
        break;
      }
      case 'finish': {
        const it = find(op.id);
        const f = typeof op.finish === 'string' ? op.finish : undefined;
        if (!it || !op.slot || !f || !FINISH_MAP[f]) break;
        it.finishes = { ...(it.finishes ?? {}), [op.slot]: f };
        break;
      }
      case 'resize': {
        const it = find(op.id);
        if (!it) break;
        if (op.w) it.w = inch(op.w);
        if (op.d) it.d = inch(op.d);
        touched.add(it.id);
        break;
      }
    }
  }
  return { items: list, touched };
}

export async function askDesigner(message: string, opts: { focusIds?: string[]; images?: Blob[] } = {}) {
  const s = useStore.getState();
  const room = activeRoom(s);
  if (!room || useThread.getState().busy) return;
  if (IDEA_RE.test(message) && !opts.focusIds?.length && !/\b(this|the current|it)\b.*\b(layout)\b/i.test(message)) return askForIdeas(message);
  const layout = activeLayout(s);
  if (!layout) return;
  const hist = history();
  push({ role: 'user', text: message });
  const mid = push({ role: 'designer', text: '', status: 'thinking', kind: 'edit' });
  const ai = await getAI();
  if (ai.kind === 'none') {
    patch(mid, { status: 'error', text: errorCopy({ code: 'unavailable', message: '' }) });
    return;
  }
  const controller = new AbortController();
  useThread.setState({ busy: true, controller });
  const catalog = fullCatalog(s);
  const analysis = analyzeLayout(room, layout, s.custom);
  try {
    const prompt = editPrompt(room, layout, catalog, s.custom, analysis, message, hist, opts.focusIds);
    const res = (await ai.json<{ reply?: string; ops?: RawOp[]; zones?: Zone[] }>(prompt, { tier: 'default', cache: false, signal: controller.signal, images: opts.images })) ?? {};
    const notes: string[] = [];
    const ops = Array.isArray(res.ops) ? res.ops : [];
    let applied = false;
    if (ops.length) {
      const { items, touched } = applyOps(layout.items, ops, catalog, notes);
      const settled = settle(room, items, catalog, { movable: touched });
      notes.push(...settled.fixes);
      editItems(`Designer: ${message.slice(0, 40)}`, () => settled.items, { layoutId: layout.id });
      if (Array.isArray(res.zones) && res.zones.length) {
        const zones = res.zones.map((z) => ({ ...z, x: inch(z.x), y: inch(z.y), w: z.w ? inch(z.w) : undefined, d: z.d ? inch(z.d) : undefined, r: z.r ? inch(z.r) : undefined }));
        useStore.setState((st) => ({ layouts: { ...st.layouts, [layout.id]: { ...st.layouts[layout.id], zones } as Layout } }));
      }
      applied = true;
    }
    patch(mid, { status: 'done', text: res.reply || (applied ? 'Done.' : 'Here’s my take.'), applied, fixes: notes });
  } catch (e) {
    patch(mid, { status: 'error', text: errorCopy(e) });
  } finally {
    useThread.setState({ busy: false, controller: null });
  }
}

/** Ideas that feature a newly added piece. */
export function ideasWith(ref: string) {
  const e = fullCatalog()[ref];
  if (!e) return;
  push({ role: 'user', text: `Show me the ${e.name} in the room — three different ways.` });
  void askForIdeas(undefined, { feature: { ref, name: e.name } });
}

export function toastUnavailable() {
  toast(errorCopy({ code: 'unavailable', message: '' }), 'info');
}
