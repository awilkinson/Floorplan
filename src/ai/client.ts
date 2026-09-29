// The designer talks to Claude through the claude.ai Artifact `sample`
// capability: calls run on the viewer's own Claude plan, with no API key.

export type Tier = 'quick' | 'default' | 'complex';

export interface AskOptions {
  images?: Blob[];
  tier?: Tier;
  signal?: AbortSignal;
  onText?: (u: { text: string; delta: string }) => void;
  cache?: boolean;
}

export interface AIError {
  code: string;
  message: string;
  text?: string;
}

export interface AIClient {
  kind: 'claude' | 'mock' | 'none';
  text(input: string, opts?: AskOptions): Promise<string>;
  json<T = unknown>(input: string, opts?: AskOptions): Promise<T>;
  imageLimit(): Promise<{ maxCount: number; maxInputBytes: number; mediaTypes: string[] } | null>;
}

interface SampleFn {
  (input: string, options?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T>(input: string, options?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
    __FP_MOCK_AI__?: (kind: string, input: string) => Promise<string>;
  }
}

function opts(o: AskOptions = {}) {
  const out: Record<string, unknown> = {};
  if (o.images?.length) out.images = o.images;
  if (o.tier) out.modelTier = o.tier;
  if (o.signal) out.signal = o.signal;
  if (o.onText) out.onText = o.onText;
  if (o.cache === false) out.cache = false;
  return out;
}

function sampleClient(sample: SampleFn): AIClient {
  return {
    kind: 'claude',
    async text(input, o) {
      const r = await sample(input, opts(o));
      return r.text;
    },
    async json<T>(input: string, o?: AskOptions) {
      return sample.json<T>(input, opts(o));
    },
    async imageLimit() {
      try {
        const l = await sample.limits();
        return l.images ?? null;
      } catch {
        return null;
      }
    },
  };
}

/** Dev-only stand-in, fed by recorded fixtures, so the flows can be exercised outside claude.ai. */
function mockClient(): AIClient {
  const run = async (input: string, o?: AskOptions) => {
    const kind = input.match(/^TASK: (\w+)/m)?.[1] ?? 'unknown';
    const text = await window.__FP_MOCK_AI__!(kind, input);
    if (o?.onText) {
      let acc = '';
      for (const chunk of text.match(/[\s\S]{1,400}/g) ?? []) {
        if (o.signal?.aborted) throw { code: 'cancelled', message: 'cancelled' };
        await new Promise((r) => setTimeout(r, 30));
        acc += chunk;
        o.onText({ text: acc, delta: chunk });
      }
    }
    return text;
  };
  return {
    kind: 'mock',
    text: run,
    async json<T>(input: string, o?: AskOptions) {
      const t = await run(input, o);
      return parseJsonLoose(t) as T;
    },
    async imageLimit() {
      if ((window as unknown as { __FP_MOCK_NO_IMAGES__?: boolean }).__FP_MOCK_NO_IMAGES__) return null;
      return { maxCount: 8, maxInputBytes: 20_000_000, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] };
    },
  };
}

const none: AIClient = {
  kind: 'none',
  async text() {
    throw { code: 'unavailable', message: 'The designer needs claude.ai' } as AIError;
  },
  async json() {
    throw { code: 'unavailable', message: 'The designer needs claude.ai' } as AIError;
  },
  async imageLimit() {
    return null;
  },
};

let pending: Promise<AIClient> | null = null;

export function getAI(): Promise<AIClient> {
  if (pending) return pending;
  pending = (async () => {
    if (import.meta.env.DEV && window.__FP_MOCK_AI__) return mockClient();
    const use = window.claude?.use;
    if (typeof use !== 'function') return none;
    try {
      const sample = (await window.claude!.use('sample')) as SampleFn | null;
      if (sample) return sampleClient(sample);
    } catch {
      /* fall through */
    }
    return none;
  })();
  return pending;
}

/** Whether Claude can be shown images in this view (cached). */
let imagesP: Promise<{ maxCount: number } | null> | null = null;
export function imageSupport(): Promise<{ maxCount: number } | null> {
  if (!imagesP) imagesP = getAI().then((ai) => ai.imageLimit().catch(() => null));
  return imagesP;
}

/** Parse a reply that should be JSON, tolerating fences and a sentence around it. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* keep going */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* keep going */
    }
  }
  const first = Math.min(...['{', '['].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
  const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (first < last) return JSON.parse(t.slice(first, last + 1));
  throw { code: 'invalid_json', message: 'The reply was not JSON', text } as AIError;
}

/** Plain-language copy for a failed call. */
export function errorCopy(e: unknown): string {
  const code = (e as AIError)?.code ?? 'upstream_error';
  switch (code) {
    case 'unavailable':
      return 'The designer works when this page is open in claude.ai — it uses your Claude plan. Everything else works here.';
    case 'not_granted':
      return 'The designer needs permission to use Claude. Allow it from this page’s permissions menu in claude.ai, then try again.';
    case 'sampling_disabled':
      return 'Claude isn’t available for this account right now.';
    case 'rate_limited':
      return 'You’ve hit a usage limit for the moment. Give it a minute and try again.';
    case 'session_expired':
      return 'Your claude.ai session expired. Sign in again and retry.';
    case 'image_rejected':
      return 'One of the images couldn’t be read. Try a JPG or PNG under 20 MB.';
    case 'images_unavailable':
      return 'Claude can’t see photos in this window. Describe the piece in a few words, or open this page in your browser at claude.ai.';
    case 'prompt_too_large':
      return 'That was too much to send at once. Try fewer photos or a shorter note.';
    case 'refused':
      return 'The designer couldn’t help with that request. Try wording it differently.';
    case 'invalid_json':
      return 'The designer’s answer came back garbled. Try again — it usually works on a second go.';
    case 'cancelled':
      return 'Stopped.';
    default:
      return 'Something went wrong reaching Claude. Try again in a moment.';
  }
}
