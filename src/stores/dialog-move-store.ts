import { create } from "zustand";

import { SearchResult } from "@/bindings/SearchResult";

type DialogMoveStore = {
  isMoveFilesDialogOpen: boolean;
  moveFilesDialogSelectedFiles: SearchResult[];
  isMoveFilesDialogSubmitting: boolean;
  moveLinkedFiles: boolean;
  setMoveLinkedFiles: (isMove: boolean) => void;
  openMoveFilesDialog: (files: SearchResult[]) => void;
  closeMoveFilesDialog: () => void;
  setMoveFilesDialogSubmitting: (submitting: boolean) => void;
  reset: () => void;
};

export const useDialogMoveStore = create<DialogMoveStore>((set) => ({
  isMoveFilesDialogOpen: false,
  moveFilesDialogSelectedFiles: [],
  isMoveFilesDialogSubmitting: false,
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
      isMoveFilesDialogSubmitting: false,
    }),
  setMoveFilesDialogSubmitting: (submitting: boolean) =>
    set({ isMoveFilesDialogSubmitting: submitting }),
  reset: () =>
    set({
      isMoveFilesDialogOpen: false,
      moveFilesDialogSelectedFiles: [],
      isMoveFilesDialogSubmitting: false,
      moveLinkedFiles: false,
    }),
}));
