import { create } from "zustand";

import { SearchResult } from "@/bindings/SearchResult";

type DialogLabelStore = {
  isLabelCharacterDialogOpen: boolean;
  labelCharacterDialogSelectedFiles: SearchResult[];
  isLabelCharacterDialogSubmitting: boolean;
  initialName?: string;
  availableCharacters: string[];
  setAvailableCharacters: (files: string[]) => void;
  openLabelCharacterDialog: (
    files: SearchResult[],
    initialName: string,
    availableCharacters: string[]
  ) => void;
  closeLabelCharacterDialog: () => void;
  setLabelCharacterDialogSubmitting: (submitting: boolean) => void;
  reset: () => void;
};

export const useDialogLabelStore = create<DialogLabelStore>((set) => ({
  isLabelCharacterDialogOpen: false,
  labelCharacterDialogSelectedFiles: [],
  isLabelCharacterDialogSubmitting: false,
  availableCharacters: [],
  setAvailableCharacters: (items: string[]) =>
    set({ availableCharacters: items }),
  openLabelCharacterDialog: (
    files: SearchResult[],
    initialName: string,
    availableCharacters: string[]
  ) =>
    set({
      isLabelCharacterDialogOpen: true,
      labelCharacterDialogSelectedFiles: files,
      initialName: initialName,
      availableCharacters: availableCharacters,
    }),
  closeLabelCharacterDialog: () =>
    set({
      isLabelCharacterDialogOpen: false,
      labelCharacterDialogSelectedFiles: [],
      isLabelCharacterDialogSubmitting: false,
    }),
  setLabelCharacterDialogSubmitting: (submitting: boolean) =>
    set({ isLabelCharacterDialogSubmitting: submitting }),
  reset: () =>
    set({
      isLabelCharacterDialogOpen: false,
      labelCharacterDialogSelectedFiles: [],
      isLabelCharacterDialogSubmitting: false,
      availableCharacters: [],
    }),
}));
