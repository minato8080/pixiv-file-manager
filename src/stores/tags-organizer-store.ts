import { create } from "zustand";

import { CollectSummary } from "@/bindings/CollectSummary";

type TagsOrganizerStore = {
  collectSummary: CollectSummary[];
  setCollectSummary: (summary: CollectSummary[]) => void;
  loading: boolean;
  setLoading: (bool: boolean) => void;
  // associatedTagList: string[];
  // setAssociatedTagList: (list: string[]) => void;
};

export const useTagsOrganizerStore = create<TagsOrganizerStore>((set) => ({
  collectSummary: [],
  setCollectSummary: (summary) => set({ collectSummary: summary }),
  loading: false,
  setLoading: (bool) => set({ loading: bool }),
  // associatedTagList: [],
  // setAssociatedTagList: (list) => set({ associatedTagList: list }),
}));
