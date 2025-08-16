import { create } from "zustand";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { SearchHistory } from "@/bindings/SearchHistory";
import { TagInfo } from "@/bindings/TagInfo";

type DropdownStore = {
  uniqueTagList: TagInfo[];
  tagDropdownItems: TagInfo[];
  characterDropdownItems: CharacterInfo[];
  authorDropdownItems: AuthorInfo[];
  history: SearchHistory[];
  setUniqueTagList: (tags: TagInfo[]) => void;
  setTagDropdownItems: (items: TagInfo[]) => void;
  setCharacterDropdownItems: (items: CharacterInfo[]) => void;
  setAuthorDropdownItems: (items: AuthorInfo[]) => void;
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
