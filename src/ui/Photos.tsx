import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import type { AssetRef, Room } from '../model/types';
import { assetUrl, uploadImage } from '../persist/assets';
import { editRoom, toast } from '../state/store';
import { fileToImages } from '../ai/files';
import { Button, Dialog, IconButton, Spinner } from './primitives';

/** The owner's photos of the room, for comparing against the 3D view. */
export function RoomPhotos({ room }: { room: Room }) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: File[]) => {
    setBusy(true);
    const refs: AssetRef[] = [];
    for (const f of files.slice(0, 8)) {
      try {
        const [img] = await fileToImages(f);
        const ref = await uploadImage(img.blob, 'photo', { width: img.width, height: img.height, caption: f.name });
        refs.push({ ...ref, url: ref.url ?? img.url });
      } catch {
        toast(`Couldn’t add ${f.name}`, 'error');
      }
    }
    setBusy(false);
    if (refs.length) editRoom('Add photos', (r) => ({ ...r, photos: [...r.photos, ...refs] }));
  };
  return (
    <section className="insp-section">
      <div className="insp-label-row">
        <span className="insp-label">Photos</span>
        <label className="link-btn">
          {busy ? <Spinner size={11} /> : <ImagePlus size={12} />} Add
          <input type="file" accept="image/*" multiple hidden onChange={(e) => (void add(Array.from(e.target.files ?? [])), (e.target.value = ''))} />
        </label>
      </div>
      {room.photos.length ? (
        <div className="photo-grid">
          {room.photos.map((p, i) => (
            <button key={p.id} type="button" className="photo-thumb" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`}>
              <img src={assetUrl(p)} alt={p.caption ?? ''} loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="field-hint">Add photos of the room to compare them with the 3D view.</p>
      )}
      <Lightbox room={room} index={open} onIndex={setOpen} />
    </section>
  );
}

function Lightbox({ room, index, onIndex }: { room: Room; index: number | null; onIndex: (i: number | null) => void }) {
  const n = room.photos.length;
  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndex((index + 1) % n);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, n, onIndex]);
  const p = index != null ? room.photos[index] : null;
  return (
    <Dialog open={!!p} onClose={() => onIndex(null)} width={1100} className="lightbox">
      {p && (
        <div className="lb">
          <img src={assetUrl(p)} alt={p.caption ?? `Photo ${index! + 1}`} />
          <div className="lb-bar">
            <span className="mono small">
              {index! + 1} / {n}
            </span>
            <span className="grow" />
            {n > 1 && (
              <>
                <IconButton label="Previous photo" icon={<ChevronLeft size={16} />} onClick={() => onIndex((index! - 1 + n) % n)} />
                <IconButton label="Next photo" icon={<ChevronRight size={16} />} onClick={() => onIndex((index! + 1) % n)} />
              </>
            )}
            <Button
              size="sm"
              variant="quiet"
              icon={<Trash2 size={13} />}
              onClick={() => {
                const id = p.id;
                onIndex(null);
                editRoom('Remove photo', (r) => ({ ...r, photos: r.photos.filter((x) => x.id !== id) }));
              }}
            >
              Remove from room
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
