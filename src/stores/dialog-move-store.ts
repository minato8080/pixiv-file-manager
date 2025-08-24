import { create } from "zustand";

import { SearchResult } from "@/bindings/SearchResult";

type DialogMoveStore = {
  isMoveFilesDialogOpen: boolean;
  moveFilesDialogSelectedFiles: SearchResult[];
  moveLinkedFiles: boolean;
  setMoveLinkedFiles: (isMove: boolean) => void;
  openMoveFilesDialog: (files: SearchResult[]) => void;
  closeMoveFilesDialog: () => void;
  reset: () => void;
};

export const useDialogMoveStore = create<DialogMoveStore>((set) => ({
  isMoveFilesDialogOpen: false,
  moveFilesDialogSelectedFiles: [],
  moveLinkedFiles: false,
  setMoveLinkedFiles: (isMove: boolean) => set({ moveLinkedFiles: isMove }),
  openMoveFilesDialog: (files: SearchResult[]) =>
    set({
      isMoveFilesDialogOpen: true,
      moveFilesDialogSelectedFiles: files,
    }),
  closeMoveFilesDialog: () =>
    set({
      isMoveFilesDialogOpen: false,
      moveFilesDialogSelectedFiles: [],
    }),
  reset: () =>
    set({
      isMoveFilesDialogOpen: false,
      moveFilesDialogSelectedFiles: [],
      moveLinkedFiles: false,
    }),
}));
