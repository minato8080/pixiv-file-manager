import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";

import { useCommonStore } from "./common-store";

import { CollectSummary } from "@/bindings/CollectSummary";
import { FileSummary } from "@/bindings/FileSummary";
import { TagInfo } from "@/bindings/TagInfo";

type FileOrganizerStore = {
  collectSummary: CollectSummary[];
  setCollectSummary: (summary: CollectSummary[]) => void;
  availableTagList: TagInfo[];
  setAvailableTagList: (list: TagInfo[]) => void;
  syncDialogOpen: boolean;
  setSyncDialogOpen: (open: boolean) => void;
  syncResults: FileSummary[];
  setSyncResults: (results: FileSummary[]) => void;
  selectedItems: Set<number>;
  setSelectedItems: (items: Set<number>) => void;
  // Commands
  loadSummary: () => Promise<void>;
  syncDB: () => Promise<void>;
  deleteSelectedItems: () => Promise<void>;
};

export const useFileOrganizerStore = create<FileOrganizerStore>((set, get) => ({
  collectSummary: [],
  setCollectSummary: (summary) => set({ collectSummary: summary }),
  availableTagList: [],
  setAvailableTagList: (list) => set({ availableTagList: list }),
  syncDialogOpen: false,
  setSyncDialogOpen: (open) => set({ syncDialogOpen: open }),
  syncResults: [],
  setSyncResults: (results) => set({ syncResults: results }),
  selectedItems: new Set(),
  setSelectedItems: (items) => set({ selectedItems: items }),

  // Commands
  loadSummary: async () => {
    const setLoading = useCommonStore.getState().setLoading;
    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("load_assignments");
      get().setCollectSummary(summary);
    } finally {
      setLoading(false);
    }
  },

  syncDB: async () => {
    const setLoading = useCommonStore.getState().setLoading;
    const { setSyncDialogOpen, setSyncResults, setSelectedItems } = get();

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folder to sync with database",
      });

      if (!selected) return;

      setLoading(true);
      setSyncDialogOpen(true);
      try {
        const fileSummary: FileSummary[] = await invoke("sync_db", {
          root: selected,
        });
        setSyncResults(fileSummary);
        setSelectedItems(new Set());
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error during sync:", error);
      setLoading(false);
    }
  },

  deleteSelectedItems: async () => {
    const setLoading = useCommonStore.getState().setLoading;
    const {
      selectedItems,
      syncResults,
      setSyncDialogOpen,
      setSyncResults,
      setSelectedItems,
      loadSummary,
    } = get();

    if (selectedItems.size === 0) return;

    setLoading(true);
    try {
      const itemsToDelete = syncResults.filter((_, index) =>
        selectedItems.has(index)
      );

      await invoke("delete_missing_illusts", { items: itemsToDelete });

      setSyncDialogOpen(false);
      setSyncResults([]);
      setSelectedItems(new Set());

      await loadSummary();
    } catch (error) {
      console.error("Error deleting items:", error);
    } finally {
      setLoading(false);
    }
  },
}));
