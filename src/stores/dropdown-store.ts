import { create } from "zustand";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { TagInfo } from "@/bindings/TagInfo";

type DropdownStore = {
  uniqueTagList: TagInfo[];
  uniqueCharacterList: CharacterInfo[];
  tagDropdownItems: TagInfo[];
  characterDropdownItems: CharacterInfo[];
  authorDropdownItems: AuthorInfo[];
  setUniqueTagList: (tags: TagInfo[]) => void;
  setUniqueCharacterList: (items: CharacterInfo[]) => void;
  setTagDropdownItems: (items: TagInfo[]) => void;
  setCharacterDropdownItems: (items: CharacterInfo[]) => void;
  setAuthorDropdownItems: (items: AuthorInfo[]) => void;
  reset: () => void;
};

export const useDropdownStore = create<DropdownStore>((set) => ({
  uniqueTagList: [],
  uniqueCharacterList: [],
  tagDropdownItems: [],
  characterDropdownItems: [],
  authorDropdownItems: [],
  history: [],
  setUniqueTagList: (tags) => set({ uniqueTagList: tags }),
  setUniqueCharacterList: (items) => set({ uniqueCharacterList: items }),
  setTagDropdownItems: (items) => set({ tagDropdownItems: items }),
  setCharacterDropdownItems: (items) => set({ characterDropdownItems: items }),
  setAuthorDropdownItems: (items) => set({ authorDropdownItems: items }),
  reset: () =>
    set({
      uniqueTagList: [],
      tagDropdownItems: [],
      characterDropdownItems: [],
      authorDropdownItems: [],
    }),
}));
