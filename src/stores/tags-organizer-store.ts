import { create } from "zustand";

import { CollectSummary } from "@/bindings/CollectSummary";

type TagsOrganizerStore = {
  collectSummary: CollectSummary[];
  unassignedTags: string[];
  setCollectSummary: (summary: CollectSummary[]) => void;
  setUnassignedTags: (tags: string[]) => void;
};

export const useTagsOrganizerStore = create<TagsOrganizerStore>((set) => ({
  collectSummary: [],
  unassignedTags: [],
  setCollectSummary: (summary) => set({ collectSummary: summary }),
  setUnassignedTags: (tags) => set({ unassignedTags: tags }),
}));
