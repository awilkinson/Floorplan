import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { activeLayout, activeRoom, addCustomEntry, editItems, fullCatalog, previewProposal, setProposals, toast, useStore, type Proposal } from '../state/store';
import { analyzeLayout } from '../design/checks';
import { errorCopy, getAI, imageSupport, parseJsonLoose, type AIError } from './client';
import { photoFactsText, readPhoto } from './vision';
import { importProduct } from './importer';
import { uploadImage } from '../persist/assets';
import { editPrompt, ideasPrompt, type IdeaRequest } from './prompts';
import { ideaToLayout, rawToItems, resolveRef, settle, type RawIdea, type RawItem } from './solver';
import type { CatalogEntry, Item, Layout, Zone } from '../model/types';
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
  /** What the designer is doing while it thinks. */
  progress?: string;
  /** Pieces this reply brought into the library. */
  newRefs?: string[];
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
    // Tolerate replies that aren't one object per line: a JSON array, or
    // pretty-printed objects spread over several lines.
    const seen = new Set(useStore.getState().proposals.filter((p) => ids.includes(p.id)).map((p) => p.layout.name));
    const objects = topLevelObjects(text);
    if (!objects.length) {
      try {
        const arr = parseJsonLoose(text);
        if (Array.isArray(arr)) objects.push(...arr.map((x) => JSON.stringify(x)));
      } catch {
        /* ignore */
      }
    }
    for (const o of objects) {
      try {
        const name = (JSON.parse(o) as RawIdea).name;
        if (name && seen.has(name)) continue;
      } catch {
        continue;
      }
      handleLine(o.replace(/\n/g, ' '));
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

/** Every balanced top-level {...} in a text, respecting strings. */
function topLevelObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) out.push(text.slice(start, i + 1));
    }
  }
  return out;
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

const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const PIECE_RE = /\b(add|put|place|swap|replace|try|buy|bought|get|use|bring|want|love|like|this|these|that|those|here'?s|sofa|couch|sectional|settee|chair|armchair|lounger|stool|bench|ottoman|pouf|table|desk|console|sideboard|credenza|cabinet|bookcase|shelf|shelving|dresser|bed|crib|rug|carpet|lamp|sconce|pendant|plant|mirror|art|print|painting|speaker|piano|tv)\b/i;
const MOOD_RE = /\b(inspir\w*|vibe|mood|style like|feel like|look like|palette|colou?rs? like)\b/i;

export async function askDesigner(message: string, opts: { focusIds?: string[]; images?: Blob[] } = {}) {
  const s = useStore.getState();
  const room = activeRoom(s);
  if (!room || useThread.getState().busy) return;
  const urls = [...new Set(message.match(URL_RE) ?? [])].slice(0, 4);
  const images = opts.images ?? [];
  // Links, or photos of a piece ("add this couch"), bring the piece in first.
  if (urls.length || (images.length && PIECE_RE.test(message) && !MOOD_RE.test(message))) return addPiecesFromChat(message, urls, images);
  if (IDEA_RE.test(message) && !opts.focusIds?.length && !/\b(this|the current|it)\b.*\b(layout)\b/i.test(message)) return askForIdeas(message);
  if (!activeLayout(s)) return;
  const hist = history();
  push({ role: 'user', text: message, images: images.map((b) => URL.createObjectURL(b)) });
  const mid = push({ role: 'designer', text: '', status: 'thinking', kind: 'edit' });
  await runEdit(mid, message, hist, { focusIds: opts.focusIds, images });
}

/** Ask for an edit to the active layout and apply it, reporting into message `mid`. */
async function runEdit(mid: string, message: string, hist: { role: 'user' | 'assistant'; text: string }[], opts: { focusIds?: string[]; images?: Blob[]; after?: string; newRefs?: string[]; keepBusy?: boolean } = {}) {
  const s = useStore.getState();
  const room = activeRoom(s);
  const layout = activeLayout(s);
  if (!room || !layout) return;
  const ai = await getAI();
  if (ai.kind === 'none') {
    patch(mid, { status: 'error', text: errorCopy({ code: 'unavailable', message: '' }) });
    return;
  }
  const controller = useThread.getState().controller ?? new AbortController();
  useThread.setState({ busy: true, controller });
  const catalog = fullCatalog(s);
  const analysis = analyzeLayout(room, layout, s.custom);
  try {
    // Photos go to Claude where the view allows; elsewhere the planner describes them.
    let request = message;
    let images: Blob[] | undefined;
    if (opts.images?.length) {
      const lim = await imageSupport();
      if (lim) images = opts.images.slice(0, lim.maxCount);
      else {
        try {
          request += `\n\n(The owner attached photo(s) you can't see in this window. The planner measured: ${photoFactsText(await Promise.all(opts.images.slice(0, 3).map(readPhoto)))})`;
        } catch {
          /* send the words alone */
        }
      }
    }
    const prompt = editPrompt(room, layout, catalog, s.custom, analysis, request, hist, opts.focusIds);
    const res = (await ai.json<{ reply?: string; ops?: RawOp[]; zones?: Zone[] }>(prompt, { tier: 'default', cache: false, signal: controller.signal, images })) ?? {};
    const notes: string[] = [];
    const ops = Array.isArray(res.ops) ? res.ops : [];
    let applied = false;
    if (ops.length) {
      const { items, touched } = applyOps(layout.items, ops, catalog, notes);
      const settled = settle(room, items, catalog, { movable: touched });
      notes.push(...settled.fixes);
      editItems(`Designer: ${message.replace(URL_RE, '').trim().slice(0, 40) || 'new pieces'}`, () => settled.items, { layoutId: layout.id });
      if (Array.isArray(res.zones) && res.zones.length) {
        const zones = res.zones.map((z) => ({ ...z, x: inch(z.x), y: inch(z.y), w: z.w ? inch(z.w) : undefined, d: z.d ? inch(z.d) : undefined, r: z.r ? inch(z.r) : undefined }));
        useStore.setState((st) => ({ layouts: { ...st.layouts, [layout.id]: { ...st.layouts[layout.id], zones } as Layout } }));
      }
      applied = true;
    }
    const text = [res.reply || (applied ? 'Done.' : 'Here’s my take.'), opts.after].filter(Boolean).join('\n\n');
    patch(mid, { status: 'done', text, applied, fixes: notes, newRefs: opts.newRefs });
  } catch (e) {
    patch(mid, { status: 'error', text: errorCopy(e), newRefs: opts.newRefs });
  } finally {
    if (!opts.keepBusy) useThread.setState({ busy: false, controller: null });
  }
}

/**
 * Pieces from links or photos in the chat: read each one into the library,
 * then have the designer place them in the room (or ask what they are).
 */
async function addPiecesFromChat(message: string, urls: string[], images: Blob[]) {
  const hist = history();
  const thumbs = images.map((b) => URL.createObjectURL(b));
  push({ role: 'user', text: message, images: thumbs });
  const mid = push({ role: 'designer', text: '', status: 'thinking', kind: 'edit', progress: urls.length > 1 ? `Reading ${urls.length} links…` : urls.length ? 'Reading the link…' : 'Looking at your photo…' });
  const ai = await getAI();
  if (ai.kind === 'none') {
    patch(mid, { status: 'error', text: errorCopy({ code: 'unavailable', message: '' }) });
    return;
  }
  const controller = new AbortController();
  useThread.setState({ busy: true, controller });
  const words = message.replace(URL_RE, ' ').replace(/\s+/g, ' ').trim();
  const jobs = urls.length ? urls.map((u) => ({ url: u, images: urls.length === 1 ? images : [] })) : [{ url: undefined as string | undefined, images }];
  try {
    const results = await Promise.allSettled(
      jobs.map((j, i) =>
        importProduct({
          url: j.url,
          notes: words || undefined,
          images: j.images,
          image: j.images[0] ? { id: `local-chat-${Date.now()}-${i}`, url: thumbs[0], kind: 'product' } : undefined,
          signal: controller.signal,
        }),
      ),
    );
    if (controller.signal.aborted) throw { code: 'cancelled', message: '' };
    const added: CatalogEntry[] = [];
    const questions: string[] = [];
    let unseen = false;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== 'fulfilled') continue;
      const { entry, needsInfo, confidence, sawPhotos } = r.value;
      if (!sawPhotos) unseen = true;
      // a link we couldn't identify: ask rather than invent a piece
      if (needsInfo && confidence === 'low' && !jobs[i].images.length) {
        if (!questions.includes(needsInfo)) questions.push(needsInfo);
        continue;
      }
      let e = entry;
      if (e.image && jobs[i].images[0]) {
        try {
          e = { ...e, image: await uploadImage(jobs[i].images[0], 'product', { caption: e.name }) };
        } catch {
          /* keep the session image */
        }
      }
      addCustomEntry(e);
      added.push(e);
      if (needsInfo && !questions.includes(needsInfo)) questions.push(needsInfo);
    }
    if (!added.length) {
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      patch(mid, {
        status: questions.length ? 'done' : 'error',
        progress: undefined,
        text: questions.length ? `${questions.join(' ')} I can’t open links from here, so the name, a few words about it, or a photo will do.` : errorCopy(failed?.reason),
      });
      useThread.setState({ busy: false, controller: null });
      return;
    }
    const names = added.map((e) => `the ${e.name}`).join(' and ');
    const list = added.map((e) => `${e.id} “${e.name}” ${Math.round(e.w / 0.0254)}×${Math.round(e.d / 0.0254)}×${Math.round(e.h / 0.0254)}″ (${e.category})`).join('; ');
    const placement = `${message}\n\n(The planner has added ${added.length > 1 ? 'these new pieces' : 'this new piece'} to the CATALOG: ${list}. Place ${added.length > 1 ? 'them' : 'it'} in the room where ${added.length > 1 ? 'they work' : 'it works'} best with "add" ops using ${added.length > 1 ? 'those refs' : 'that ref'}. If a new piece is clearly meant to take the place of one already here — a new sofa for the old sofa — use "swap" on that piece instead. Move other pieces only as much as needed.)`;
    const after = [unseen ? 'I couldn’t see your photo in this window, so I matched its colors and proportions — check the size under Piece.' : '', questions.join(' ')].filter(Boolean).join(' ');
    patch(mid, { progress: `Placing ${names}…` });
    if (IDEA_RE.test(message)) {
      patch(mid, { status: 'done', progress: undefined, text: `Added ${names} to your library.${after ? ' ' + after : ''} Sketching three layouts around ${added.length > 1 ? 'them' : 'it'}…`, newRefs: added.map((e) => e.id) });
      useThread.setState({ busy: false, controller: null });
      void askForIdeas(undefined, { feature: { ref: added[0].id, name: added[0].name } });
      return;
    }
    await runEdit(mid, placement, hist, { after, newRefs: added.map((e) => e.id) });
  } catch (e) {
    patch(mid, { status: (e as AIError)?.code === 'cancelled' ? 'done' : 'error', progress: undefined, text: (e as AIError)?.code === 'cancelled' ? 'Stopped.' : errorCopy(e) });
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
