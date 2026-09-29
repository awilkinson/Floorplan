import { useEffect, useState } from 'react';
import { BookOpen, Camera, FileText, Link2, PanelLeftClose, Ruler } from 'lucide-react';
import { addRoom, setUi, useStore } from './state/store';
import { greatRoom } from './model/templates/greatRoom';
import { boot } from './persist/sync';
import { TopBar, BrandMark } from './ui/TopBar';
import { Library } from './ui/Library';
import { Stage } from './ui/Stage';
import { RightPanel } from './ui/RightPanel';
import { Toasts } from './ui/Toasts';
import { AddPieceDialog } from './ui/AddPieceDialog';
import { NewRoomDialog } from './ui/NewRoomDialog';
import { ShortcutsDialog, useShortcuts } from './ui/Shortcuts';
import { openAddPiece, openNewRoom } from './ui/dialogs';
import { Spinner, cx } from './ui/primitives';

function example() {
  const { room, layouts } = greatRoom();
  return { rooms: [room], layouts };
}

export function App() {
  const ready = useStore((s) => s.ready);
  const hasRoom = useStore((s) => s.activeRoomId != null);
  const libraryOpen = useStore((s) => s.libraryOpen);
  const [failed, setFailed] = useState(false);
  useShortcuts();
  useEffect(() => {
    try {
      const u = localStorage.getItem('fp:units');
      if (u === 'metric' || u === 'imperial') useStore.setState({ units: u });
      if (window.innerWidth < 1180) useStore.setState({ libraryOpen: false });
      if (window.innerWidth < 900) useStore.setState({ view: '3d' });
    } catch {
      /* storage unavailable */
    }
    boot(example).catch(() => setFailed(true));
  }, []);

  if (!ready)
    return (
      <div className="boot">
        <BrandMark />
        {failed ? <p>Couldn’t load your rooms. Reload to try again.</p> : <Spinner size={16} />}
      </div>
    );
  if (!hasRoom) return <Welcome />;
  return (
    <div className={cx('app', !libraryOpen && 'lib-closed')}>
      <TopBar />
      <div className="workspace">
        {libraryOpen ? (
          <div className="lib-wrap">
            <Library />
            <button type="button" className="lib-collapse" onClick={() => setUi({ libraryOpen: false })} aria-label="Hide the library (L)" title="Hide the library (L)">
              <PanelLeftClose size={15} />
            </button>
          </div>
        ) : (
          <LibraryRail />
        )}
        <Stage />
        <RightPanel />
      </div>
      <Toasts />
      <AddPieceDialog />
      <NewRoomDialog />
      <ShortcutsDialog />
    </div>
  );
}

function LibraryRail() {
  return (
    <nav className="lib-rail" aria-label="Library">
      <button type="button" className="rail-btn" onClick={() => setUi({ libraryOpen: true })} title="Show the library (L)">
        <BookOpen size={17} />
        <span>Library</span>
      </button>
      <button type="button" className="rail-btn" onClick={() => openAddPiece()} title="Add a piece from a link or photo">
        <Link2 size={17} />
        <span>Link</span>
      </button>
    </nav>
  );
}

/** First visit with nothing saved yet. */
function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-brand">
          <BrandMark />
          <span>Floorplan Studio</span>
        </div>
        <h1>Design a room you already live in.</h1>
        <p>Measure a room from photos or a floor plan, walk around it in 3D, and try layouts with a designer who knows the pieces you own.</p>
        <div className="welcome-actions">
          <button type="button" className="welcome-opt is-primary" onClick={openNewRoom}>
            <span className="wo-icons">
              <Camera size={18} />
              <FileText size={18} />
            </span>
            <strong>Add your room</strong>
            <small>From photos, a floor plan, or just its size</small>
          </button>
          <button
            type="button"
            className="welcome-opt"
            onClick={() => {
              const { room, layouts } = greatRoom();
              addRoom(room, layouts);
            }}
          >
            <span className="wo-icons">
              <Ruler size={18} />
            </span>
            <strong>Open the Great Room example</strong>
            <small>25′ × 23′ with a coffered ceiling, library wall and hi-fi</small>
          </button>
        </div>
      </div>
      <NewRoomDialog />
      <Toasts />
    </div>
  );
}
