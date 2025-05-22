import { create } from "zustand";
import { SearchResult } from "@/bindings/SearchResult";

type DialogEditStore = {
  isEditTagsDialogOpen: boolean;
  editTagsDialogSelectedFiles: SearchResult[];
  isEditTagsDialogSubmitting: boolean;
  setEditTagsDialogSelectedFiles: (files: SearchResult[]) => void;
  openEditTagsDialog: (files: SearchResult[]) => void;
  closeEditTagsDialog: () => void;
  setEditTagsDialogSubmitting: (submitting: boolean) => void;
  reset: () => void;
};

export const useDialogEditStore = create<DialogEditStore>((set) => ({
  isEditTagsDialogOpen: false,
  editTagsDialogSelectedFiles: [],
  isEditTagsDialogSubmitting: false,
  setEditTagsDialogSelectedFiles: (files: SearchResult[]) =>
    set({
      editTagsDialogSelectedFiles: files,
    }),
  openEditTagsDialog: (files: SearchResult[]) =>
    set({
      isEditTagsDialogOpen: true,
      editTagsDialogSelectedFiles: files,
    }),
  closeEditTagsDialog: () =>
    set({
      isEditTagsDialogOpen: false,
      editTagsDialogSelectedFiles: [],
      isEditTagsDialogSubmitting: false,
    }),
  setEditTagsDialogSubmitting: (submitting: boolean) =>
    set({ isEditTagsDialogSubmitting: submitting }),
  reset: () =>
    set({
      isEditTagsDialogOpen: false,
      editTagsDialogSelectedFiles: [],
      isEditTagsDialogSubmitting: false,
    }),
}));
