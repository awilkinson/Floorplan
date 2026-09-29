// Turn whatever the owner drops in (photos, screenshots, PDF plans) into
// reasonably sized JPEG/PNG blobs for Claude and for storage.

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  url: string;
  name: string;
}

const MAX_EDGE = 2000;

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

async function toJpeg(src: CanvasImageSource & { width: number; height: number }, name: string, edge = MAX_EDGE, type: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<PreparedImage> {
  const k = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(src, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type, 0.9));
  return { blob, width: w, height: h, url: URL.createObjectURL(blob), name };
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist');
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      lib.GlobalWorkerOptions.workerSrc = worker;
      return lib;
    })();
  }
  return pdfjsPromise;
}

async function pdfPages(file: File, maxPages: number): Promise<PreparedImage[]> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  const out: PreparedImage[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2400 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c } as unknown as Parameters<typeof page.render>[0]).promise;
    out.push(await toJpeg(c, `${file.name} p${p}`, 2400, 'image/png'));
  }
  return out;
}

export async function fileToImages(file: File, maxPdfPages = 2): Promise<PreparedImage[]> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return pdfPages(file, maxPdfPages);
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name)) throw new Error('unsupported');
  const bmp = await loadBitmap(file);
  return [await toJpeg(bmp as CanvasImageSource & { width: number; height: number }, file.name)];
}

/** Crop tiles of a large drawing so small dimension text stays legible to Claude. */
export async function tilesOf(img: PreparedImage, cols = 2, rows = 2): Promise<Blob[]> {
  const bmp = await loadBitmap(img.blob);
  const W = (bmp as { width: number }).width;
  const H = (bmp as { height: number }).height;
  const out: Blob[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const c = document.createElement('canvas');
      const tw = Math.ceil(W / cols) + 40;
      const th = Math.ceil(H / rows) + 40;
      c.width = tw;
      c.height = th;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(bmp as CanvasImageSource, -i * (W / cols) + 20, -j * (H / rows) + 20);
      out.push(await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png')));
    }
  return out;
}
