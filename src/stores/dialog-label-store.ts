import { create } from "zustand";

import { SearchResult } from "@/bindings/SearchResult";

type DialogLabelStore = {
  isLabelCharacterDialogOpen: boolean;
  labelCharacterDialogSelectedFiles: SearchResult[];
  initialName?: string;
  availableCharacters: string[];
  setAvailableCharacters: (files: string[]) => void;
  openLabelCharacterDialog: (
    files: SearchResult[],
    initialName: string,
    availableCharacters: string[]
  ) => void;
  closeLabelCharacterDialog: () => void;
  reset: () => void;
};

export const useDialogLabelStore = create<DialogLabelStore>((set) => ({
  isLabelCharacterDialogOpen: false,
  labelCharacterDialogSelectedFiles: [],
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
      availableCharacters: [],
    }),
  reset: () =>
    set({
      isLabelCharacterDialogOpen: false,
      labelCharacterDialogSelectedFiles: [],
      availableCharacters: [],
    }),
}));
