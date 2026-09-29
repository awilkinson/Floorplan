import { toast } from '../state/store';

interface DownloadsNS {
  save(req: { filename: string; data: Blob | string | ArrayBuffer }): Promise<{ status: 'saved' | 'delivered' }>;
}

let dl: Promise<DownloadsNS | null> | null = null;
function downloads() {
  if (!dl) {
    dl = (async () => {
      try {
        if (typeof window.claude?.use !== 'function') return null;
        return ((await window.claude.use('downloads')) as DownloadsNS | null) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return dl;
}

/** Offer a generated file. In claude.ai this asks the viewer to confirm the save. */
export async function saveFile(filename: string, data: Blob) {
  const d = await downloads();
  if (d) {
    try {
      const r = await d.save({ filename, data });
      if (r.status === 'saved') toast(`Saved ${filename}`, 'good');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return;
      if (code === 'rejected_extension' || code === 'extension_not_enabled') toast('That file type can’t be saved from here.', 'error');
      else if (code === 'rate_limited') toast('A save is already waiting for you to confirm.', 'info');
      else toast('Saving isn’t available in this view.', 'error');
    }
    return;
  }
  // Outside claude.ai: a normal browser download.
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
