import { create } from "zustand";

type DialogDeleteStore = {
  isDeleteFilesDialogOpen: boolean;
  deleteFilesDialogSelectedFiles: string[];
  openDeleteFilesDialog: (files: string[]) => void;
  closeDeleteFilesDialog: () => void;
  reset: () => void;
};

export const useDialogDeleteStore = create<DialogDeleteStore>((set) => ({
  isDeleteFilesDialogOpen: false,
  deleteFilesDialogSelectedFiles: [],
  openDeleteFilesDialog: (files: string[]) =>
    set({
      isDeleteFilesDialogOpen: true,
      deleteFilesDialogSelectedFiles: files,
    }),
  closeDeleteFilesDialog: () =>
    set({
      isDeleteFilesDialogOpen: false,
      deleteFilesDialogSelectedFiles: [],
    }),
  reset: () =>
    set({
      isDeleteFilesDialogOpen: false,
      deleteFilesDialogSelectedFiles: [],
    }),
}));
