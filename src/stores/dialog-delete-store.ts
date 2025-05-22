import { create } from "zustand";

type DialogDeleteStore = {
  isDeleteFilesDialogOpen: boolean;
  deleteFilesDialogSelectedFiles: string[];
  isDeleteFilesDialogSubmitting: boolean;
  openDeleteFilesDialog: (files: string[]) => void;
  closeDeleteFilesDialog: () => void;
  setDeleteFilesDialogSubmitting: (submitting: boolean) => void;
  reset: () => void;
};

export const useDialogDeleteStore = create<DialogDeleteStore>((set) => ({
  isDeleteFilesDialogOpen: false,
  deleteFilesDialogSelectedFiles: [],
  isDeleteFilesDialogSubmitting: false,
  openDeleteFilesDialog: (files: string[]) =>
    set({
      isDeleteFilesDialogOpen: true,
      deleteFilesDialogSelectedFiles: files,
    }),
  closeDeleteFilesDialog: () =>
    set({
      isDeleteFilesDialogOpen: false,
      deleteFilesDialogSelectedFiles: [],
      isDeleteFilesDialogSubmitting: false,
    }),
  setDeleteFilesDialogSubmitting: (submitting: boolean) =>
    set({ isDeleteFilesDialogSubmitting: submitting }),
  reset: () =>
    set({
      isDeleteFilesDialogOpen: false,
      deleteFilesDialogSelectedFiles: [],
      isDeleteFilesDialogSubmitting: false,
    }),
}));
