import { create } from 'zustand';
import type { Guide } from '../interaction/snap';

// Camera-derived view state shared by the 3D scene and the plan.
export interface ViewState {
  hiddenWalls: number[];
  inside: boolean;
  ceiling: boolean;
  guides: Guide[];
  /** Plan position of the 3D camera and its heading, for the plan's camera marker. */
  cam: { x: number; y: number; heading: number; fov: number } | null;
}

export const useView = create<ViewState>(() => ({ hiddenWalls: [], inside: false, ceiling: true, guides: [], cam: null }));

export function setGuides(guides: Guide[]) {
  const cur = useView.getState().guides;
  if (cur.length === 0 && guides.length === 0) return;
  useView.setState({ guides });
}
