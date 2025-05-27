import { create } from "zustand";

import { AuthorDropdown, CharacterDropdown } from "../types/app-types";

import { SearchHistory } from "@/bindings/SearchHistory";
import { TagInfo } from "@/bindings/TagInfo";

type DropdownStore = {
  uniqueTagList: TagInfo[];
  tagDropdownItems: TagInfo[];
  characterDropdownItems: CharacterDropdown[];
  authorDropdownItems: AuthorDropdown[];
  history: SearchHistory[];
  setUniqueTagList: (tags: TagInfo[]) => void;
  setTagDropdownItems: (items: TagInfo[]) => void;
  setCharacterDropdownItems: (items: CharacterDropdown[]) => void;
  setAuthorDropdownItems: (items: AuthorDropdown[]) => void;
  setHistory: (history: SearchHistory[]) => void;
  addHistory: (history: SearchHistory) => void;
  reset: () => void;
};

export const useDropdownStore = create<DropdownStore>((set) => ({
  uniqueTagList: [],
  tagDropdownItems: [],
  characterDropdownItems: [],
  authorDropdownItems: [],
  history: [],
  setUniqueTagList: (tags) => set({ uniqueTagList: tags }),
  setTagDropdownItems: (items) => set({ tagDropdownItems: items }),
  setCharacterDropdownItems: (items) => set({ characterDropdownItems: items }),
  setAuthorDropdownItems: (items) => set({ authorDropdownItems: items }),
  setHistory: (history) => set({ history: history }),
  addHistory: (item) => set((state) => ({ history: [...state.history, item] })),
  reset: () =>
    set({
      uniqueTagList: [],
      tagDropdownItems: [],
      characterDropdownItems: [],
      authorDropdownItems: [],
      history: [],
    }),
}));
