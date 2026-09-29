# Floorplan Studio

A room-layout studio that runs as a claude.ai Artifact. Each room has a real-time 3D view you can orbit or walk through at eye level. Beside it is a CAD-style plan with dimension strings, door swings and a title block. A designer, backed by the viewer's own Claude plan, proposes layouts in different directions, edits them from chat, and checks each one against how the room is used.

## What it does

- **3D and plan together.** Drag pieces in either view; both stay in sync. The plan snaps to walls and neighbors and shows live clearances to the walls. It also marks door swings, walkways, conflicts, the hi-fi listening triangle and zones.
- **Design checks.** Every layout is scored on:
  - fit, paths from each door and door clearances
  - conversation distances, coffee-table reach and rug anchoring
  - the listening triangle
  - baby safety: open play floor, hearth, glass
  - a spot for a Christmas tree
  - lamps
- **The designer** (Claude via the Artifact `sample` capability):
  - *Three new layouts* streams three complete schemes in different directions. Each comes with a mini plan, a concept and key moves, and can be previewed in 3D before saving.
  - Chat edits make the fewest moves needed. A solver settles any overlaps, and every change can be undone.
  - *Bring in a piece* reads a product link and/or a photo or screenshot and builds a parametric model with real dimensions. The piece can then be added to the room, swapped for an existing one, or tried in three layouts.
  - *Add a room* measures a room from photos plus an optional floor plan (PDF or image). It shows its assumptions and follow-up questions and can re-measure with your answers. You can also type a size to get a clean rectangle.
- **Room editor.** Drag corners, walls and openings on the plan. Measure one real wall and the whole room rescales. You can also add doors and windows, set finishes and wall treatments, and trace over a floor-plan underlay.
- **Exports:**
  - an 11×17 PDF sheet with the plan at an architectural scale, a furniture schedule and a title block
  - the plan as SVG or PNG
  - a DXF for AutoCAD (zipped)
  - a 3D snapshot
  - a CSV shopping list
  - the layout data as JSON
- **Persistence.** In claude.ai, rooms, layouts and added pieces live in the artifact's database, and photos and plans go to its asset store. Anywhere else the app keeps working, saving to the browser's localStorage and IndexedDB.

## Stack

Vite, React 19, TypeScript, three.js with @react-three/fiber, drei and postprocessing (N8AO, bloom, AgX tone mapping), and zustand. Exports use jsPDF with svg2pdf.js and fflate; pdf.js reads uploaded plans.

Furniture is generated, not modeled. Each catalog entry is a generator plus parameters and finishes. That one part tree draws both the 3D meshes and the plan symbols, which is how a piece imported from a link appears in both views. Textures (oak planks, bouclé, linen, leather, stone, rugs, art) are procedural.

## Develop

```sh
npm install
npm run dev          # http://127.0.0.1:5173
npm run typecheck
```

Outside claude.ai the designer shows a notice and everything else works. For development, `window.__FP_MOCK_AI__ = async (task, prompt) => reply` stands in for Claude. It works only in dev builds, keyed by the `TASK:` line at the top of each prompt.

## Build the artifact

```sh
npm run build:artifact
```

This writes `artifact/index.html` (title, inlined styles, font link, root and module script) and `artifact/files.json`. The JSON maps each bundled script to its published path. Publish the page with those files beside it, declaring the capabilities `sample`, `db`, `assets` and `downloads`.

## Layout

```
src/model       types, units (feet-inches parsing and formatting), geometry, the Great Room template
src/catalog     finishes, part helpers, furniture generators, the designer catalog
src/three       room shell, materials, procedural textures, furniture meshes, lights, camera, effects
src/plan        the CAD drawing (symbols, dimensions, openings), the interactive plan, the room editor
src/design      layout analysis and scoring
src/interaction snapping and placement
src/ai          Claude client, prompts, solver, designer, product import, room scan
src/persist     artifact database sync and asset storage, with local fallbacks
src/export      PDF, SVG, PNG, DXF, CSV, JSON
src/ui          the interface
```
