import { create } from "zustand";

import { CollectSummary } from "@/bindings/CollectSummary";
import { TagInfo } from "@/bindings/TagInfo";

type TagsOrganizerStore = {
  loading: boolean;
  setLoading: (bool: boolean) => void;
  collectSummary: CollectSummary[];
  setCollectSummary: (summary: CollectSummary[]) => void;
  availableTagList: TagInfo[];
  setAvailableTagList: (list: TagInfo[]) => void;
};

export const useTagsOrganizerStore = create<TagsOrganizerStore>((set) => ({
  loading: false,
  setLoading: (bool) => set({ loading: bool }),
  collectSummary: [],
  setCollectSummary: (summary) => set({ collectSummary: summary }),
  availableTagList: [],
  setAvailableTagList: (list) => set({ availableTagList: list }),
}));
