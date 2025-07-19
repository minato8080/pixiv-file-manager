import { create } from "zustand";

import { CollectSummary } from "@/bindings/CollectSummary";

type TagsOrganizerStore = {
  loading: boolean;
  collectSummary: CollectSummary[];
  setLoading: (bool: boolean) => void;
  setCollectSummary: (summary: CollectSummary[]) => void;
};

export const useTagsOrganizerStore = create<TagsOrganizerStore>((set) => ({
  loading: false,
  collectSummary: [],
  setLoading: (bool) => set({ loading: bool }),
  setCollectSummary: (summary) => set({ collectSummary: summary }),
}));
