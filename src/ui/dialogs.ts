import { create } from 'zustand';

export interface DialogState {
  addPiece: boolean;
  addPieceSeed?: { replaceId?: string; text?: string };
  newRoom: boolean;
  shortcuts: boolean;
  roomDetails: boolean;
}

export const useDialogs = create<DialogState>(() => ({ addPiece: false, newRoom: false, shortcuts: false, roomDetails: false }));

export function openAddPiece(seed?: DialogState['addPieceSeed']) {
  useDialogs.setState({ addPiece: true, addPieceSeed: seed });
}
export function closeAddPiece() {
  useDialogs.setState({ addPiece: false, addPieceSeed: undefined });
}
export function openNewRoom() {
  useDialogs.setState({ newRoom: true });
}
export function closeNewRoom() {
  useDialogs.setState({ newRoom: false });
}
export function toggleShortcuts(v?: boolean) {
  useDialogs.setState((s) => ({ shortcuts: v ?? !s.shortcuts }));
}
