import { useState } from 'react';
import { Box, Check, ChevronDown, Copy, Download, FileImage, FileText, FileJson, Hammer, LayoutPanelLeft, Map, MoreHorizontal, PencilLine, Plus, Redo2, Ruler, Sparkles, Table2, Trash2, Undo2, Camera } from 'lucide-react';
import { activeRoom, createLayout, deleteLayout, deleteRoom, redo, renameLayout, setActiveLayout, setActiveRoom, setUi, undo, useStore } from '../state/store';
import { bounds, polygonArea } from '../model/geometry';
import { formatArea, formatLength } from '../model/units';
import { Button, IconButton, MenuItem, Popover, Segmented, cx } from './primitives';
import { openNewRoom } from './dialogs';
import { exportPlan, exportSnapshot, exportDxf, exportShoppingList, exportLayoutJson } from '../export/exporters';
import { askForIdeas } from '../ai/designer';

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="15" width="5" height="4" fill="var(--bg)" />
      <path d="M11 17 L11 12 A5 5 0 0 1 16 17" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <rect x="4.5" y="4.5" width="5" height="3.2" fill="currentColor" />
    </svg>
  );
}

export function TopBar() {
  const room = useStore((s) => activeRoom(s));
  const rooms = useStore((s) => s.rooms);
  const layouts = useStore((s) => s.layouts);
  const view = useStore((s) => s.view);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const mode = useStore((s) => s.mode);
  const units = useStore((s) => s.units);
  const [renaming, setRenaming] = useState<string | null>(null);

  const b = room ? bounds(room.outline) : null;
  return (
    <header className="topbar">
      <div className="tb-left">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Floorplan Studio</span>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <Popover
          width={320}
          trigger={({ toggle, open }) => (
            <button type="button" className={cx('room-switch', open && 'is-open')} onClick={toggle} aria-haspopup="menu">
              <span className="room-name">{room?.name ?? 'No room'}</span>
              {b && <span className="room-dims">{formatLength(b.w, units, { compact: true })} × {formatLength(b.h, units, { compact: true })}</span>}
              <ChevronDown size={14} />
            </button>
          )}
        >
          {(close) => (
            <div className="menu">
              <div className="menu-label">Rooms</div>
              {Object.values(rooms).map((r) => {
                const rb = bounds(r.outline);
                return (
                  <MenuItem
                    key={r.id}
                    icon={r.id === room?.id ? <Check size={14} /> : <Map size={14} />}
                    hint={formatArea(polygonArea(r.outline), units)}
                    onClick={() => {
                      setActiveRoom(r.id);
                      close();
                    }}
                  >
                    {r.name} <span className="menu-sub">{formatLength(rb.w, units, { compact: true })} × {formatLength(rb.h, units, { compact: true })}</span>
                  </MenuItem>
                );
              })}
              <div className="menu-sep" />
              <MenuItem
                icon={<Plus size={14} />}
                onClick={() => {
                  close();
                  openNewRoom();
                }}
              >
                Add a room from photos or a plan…
              </MenuItem>
              {room && (
                <MenuItem
                  icon={<Hammer size={14} />}
                  onClick={() => {
                    close();
                    setUi({ mode: mode === 'room' ? 'layout' : 'room', rightTab: 'inspect' });
                    useStore.setState({ selection: [] });
                  }}
                >
                  {mode === 'room' ? 'Back to furniture' : 'Edit walls, doors and built-ins'}
                </MenuItem>
              )}
              <div className="menu-sep" />
              <div className="menu-label">Units</div>
              <div className="menu-pad">
                <Segmented size="sm" value={units} onChange={(u) => setUi({ units: u })} options={[{ value: 'imperial', label: 'Feet & inches' }, { value: 'metric', label: 'Metric' }]} />
              </div>
              {room && Object.keys(rooms).length > 1 && (
                <>
                  <div className="menu-sep" />
                  <MenuItem
                    icon={<Trash2 size={14} />}
                    danger
                    onClick={() => {
                      close();
                      deleteRoom(room.id);
                    }}
                  >
                    Delete {room.name}
                  </MenuItem>
                </>
              )}
            </div>
          )}
        </Popover>
      </div>

      <nav className="tb-tabs" aria-label="Layouts">
        {mode === 'room' ? (
          <div className="edit-banner">
            <Ruler size={14} /> Editing the room shell — drag corners, walls and doors on the plan
            <Button size="sm" variant="primary" onClick={() => setUi({ mode: 'layout' })}>
              Done
            </Button>
          </div>
        ) : (
          room?.layoutOrder.map((id) => {
            const l = layouts[id];
            if (!l) return null;
            const active = (room.activeLayoutId ?? room.layoutOrder[0]) === id;
            return (
              <div key={id} className={cx('tab', active && 'is-active')}>
                {renaming === id ? (
                  <input
                    className="tab-rename"
                    autoFocus
                    defaultValue={l.name}
                    onBlur={(e) => {
                      if (e.target.value.trim()) renameLayout(id, e.target.value.trim());
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button type="button" className="tab-btn" onClick={() => setActiveLayout(id)} onDoubleClick={() => setRenaming(id)} title={l.concept ?? l.name}>
                    {l.source === 'ai' && <Sparkles size={12} className="tab-ai" aria-label="Designer layout" />}
                    {l.name}
                  </button>
                )}
                {active && renaming !== id && (
                  <Popover
                    width={220}
                    align="end"
                    trigger={({ toggle }) => <IconButton className="tab-more" label="Layout options" icon={<MoreHorizontal size={14} />} onClick={toggle} />}
                  >
                    {(close) => (
                      <div className="menu">
                        <MenuItem
                          icon={<PencilLine size={14} />}
                          onClick={() => {
                            close();
                            setRenaming(id);
                          }}
                        >
                          Rename
                        </MenuItem>
                        <MenuItem
                          icon={<Copy size={14} />}
                          onClick={() => {
                            close();
                            createLayout(`${l.name} (copy)`, 'current');
                          }}
                        >
                          Duplicate
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 size={14} />}
                          danger
                          disabled={room.layoutOrder.length <= 1}
                          onClick={() => {
                            close();
                            deleteLayout(id);
                          }}
                        >
                          Delete layout
                        </MenuItem>
                      </div>
                    )}
                  </Popover>
                )}
              </div>
            );
          })
        )}
        {mode !== 'room' && room && (
          <Popover width={260} trigger={({ toggle }) => <IconButton className="tab-add" label="New layout" icon={<Plus size={15} />} onClick={toggle} />}>
            {(close) => (
              <div className="menu">
                <MenuItem
                  icon={<Sparkles size={14} />}
                  onClick={() => {
                    close();
                    askForIdeas();
                  }}
                >
                  Ask the designer for 3 ideas
                </MenuItem>
                <MenuItem
                  icon={<Copy size={14} />}
                  onClick={() => {
                    close();
                    createLayout('New layout', 'current');
                  }}
                >
                  Copy the current layout
                </MenuItem>
                <MenuItem
                  icon={<LayoutPanelLeft size={14} />}
                  onClick={() => {
                    close();
                    createLayout('Empty room', 'blank');
                  }}
                >
                  Start from an empty room
                </MenuItem>
              </div>
            )}
          </Popover>
        )}
      </nav>

      <div className="tb-right">
        <Segmented
          size="sm"
          label="View"
          value={view}
          onChange={(v) => setUi({ view: v })}
          options={[
            { value: '3d', label: <><Box size={13} /> 3D</>, title: '3D only (1)' },
            { value: 'split', label: 'Split', title: '3D and plan (2)' },
            { value: 'plan', label: <><Map size={13} /> Plan</>, title: 'Plan only (3)' },
          ]}
        />
        <div className="tb-group">
          <IconButton label="Undo (⌘Z)" icon={<Undo2 size={16} />} onClick={undo} disabled={!canUndo} />
          <IconButton label="Redo (⇧⌘Z)" icon={<Redo2 size={16} />} onClick={redo} disabled={!canRedo} />
        </div>
        <Popover
          width={280}
          align="end"
          trigger={({ toggle }) => (
            <Button size="sm" icon={<Download size={14} />} onClick={toggle}>
              Export
            </Button>
          )}
        >
          {(close) => (
            <div className="menu">
              <div className="menu-label">Drawing</div>
              <MenuItem icon={<FileText size={14} />} hint="11×17" onClick={() => (close(), exportPlan('pdf'))}>
                Plan as PDF
              </MenuItem>
              <MenuItem icon={<FileImage size={14} />} onClick={() => (close(), exportPlan('svg'))}>
                Plan as SVG
              </MenuItem>
              <MenuItem icon={<FileImage size={14} />} onClick={() => (close(), exportPlan('png'))}>
                Plan as PNG
              </MenuItem>
              <MenuItem icon={<Ruler size={14} />} hint=".zip" onClick={() => (close(), exportDxf())}>
                DXF for AutoCAD
              </MenuItem>
              <div className="menu-sep" />
              <div className="menu-label">3D</div>
              <MenuItem icon={<Camera size={14} />} onClick={() => (close(), exportSnapshot())}>
                Snapshot of the 3D view
              </MenuItem>
              <div className="menu-sep" />
              <div className="menu-label">Lists</div>
              <MenuItem icon={<Table2 size={14} />} hint=".csv" onClick={() => (close(), exportShoppingList())}>
                Shopping list
              </MenuItem>
              <MenuItem icon={<FileJson size={14} />} hint=".json" onClick={() => (close(), exportLayoutJson())}>
                Layout data
              </MenuItem>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
