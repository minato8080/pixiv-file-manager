import { create } from "zustand";

import { useHistoryStore } from "./history-store";
import { useTagSearcherStore } from "./tag-searcher-store";

import { AssociateInfo } from "@/bindings/AssociateInfo";
import { EditTag } from "@/bindings/EditTag";
import { SearchResult } from "@/bindings/SearchResult";

export type TagState = {
  value: string;
  status: "unchanged" | "deleted" | "edited" | "added";
};

export type FileTagState = {
  fileId: number;
  fileName: string;
  tags: TagState[];
};

type DialogEditStore = {
  isEditTagsDialogOpen: boolean;
  availableTags: string[];
  isOverwriteMode: boolean;
  isUpdateLinkedFiles: boolean;
  associateInfo: AssociateInfo | null;
  setAvailableTags: (tags: string[]) => void;
  openEditTagsDialog: (files: SearchResult[]) => void;
  closeEditTagsDialog: () => void;
  setIsOverwriteMode: (mode: boolean) => void;
  setIsUpdateLinkedFiles: (update: boolean) => void;
  setAssociateInfo: (info: AssociateInfo | null) => void;

  resetMainUI: () => void;
};

type AddRemoveTagStore = {
  fileTagStates: FileTagState[];
  tagToAdd: string;
  tagToRemove: string;
  allExistingTags: string[];
  setFileTagStates: (states: FileTagState[]) => void;
  setTagToAdd: (tags: string) => void;
  setTagToRemove: (tags: string) => void;
  setAllExistingTags: (tags: string[]) => void;
  resetAddRemoveState: () => void;
  addTagsToAll: () => void;
  removeTagsFromAll: () => void;
  createAddRemoveForm: () => EditTag[];
};

type OverwriteStore = {
  overwriteTags: TagState[];
  editingTagIndex: number | null;
  editingTagValue: string;
  tagToOverwrite: string;
  setOverwriteTags: (tags: TagState[]) => void;
  setEditingTagIndex: (index: number | null) => void;
  setEditingTagValue: (val: string) => void;
  setTagToOverwrite: (val: string) => void;
  resetOverwriteState: () => void;
  createOverwriteForm: () => {
    fileNames: string[];
    tags: string[];
  };
};

export const useDialogEditStore = create<
  DialogEditStore & AddRemoveTagStore & OverwriteStore
>((set, get) => ({
  // Main UI
  isEditTagsDialogOpen: false,
  availableTags: [],
  isOverwriteMode: false,
  isUpdateLinkedFiles: false,
  associateInfo: null,
  setAvailableTags: (tags) => set({ availableTags: tags }),
  openEditTagsDialog: () =>
    set({
      isEditTagsDialogOpen: true,
    }),
  closeEditTagsDialog: () => {
    get().resetMainUI();
    get().resetAddRemoveState();
    get().resetOverwriteState();
  },
  resetMainUI: () =>
    set({
      isEditTagsDialogOpen: false,
      isUpdateLinkedFiles: false,
      associateInfo: null,
    }),
  setIsOverwriteMode: (mode) => set({ isOverwriteMode: mode }),
  setIsUpdateLinkedFiles: (update) => set({ isUpdateLinkedFiles: update }),
  setAssociateInfo: (info) => set({ associateInfo: info }),

  // AddRemoveTagStore
  fileTagStates: [],
  tagToAdd: "",
  tagToRemove: "",
  allExistingTags: [],

  setFileTagStates: (states) => set({ fileTagStates: states }),
  setTagToAdd: (tags) => set({ tagToAdd: tags }),
  setTagToRemove: (tags) => set({ tagToRemove: tags }),
  setAllExistingTags: (tags) => set({ allExistingTags: tags }),

  resetAddRemoveState: () =>
    set({
      fileTagStates: [],
      tagToAdd: "",
      tagToRemove: "",
      allExistingTags: [],
    }),

  addTagsToAll: () => {
    const { tagToAdd, fileTagStates, allExistingTags } = get();
    if (!tagToAdd) return;

    const tagsArray = tagToAdd
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    set({
      tagToAdd: "",
      fileTagStates: fileTagStates.map((file) => ({
        ...file,
        tags: [
          ...file.tags,
          ...tagsArray
            .filter((tag) => !file.tags.some((t) => t.value === tag))
            .map((tag) => ({ value: tag, status: "added" as const })),
        ],
      })),
      allExistingTags: [...allExistingTags, ...tagsArray],
    });
  },

  removeTagsFromAll: () => {
    const { tagToRemove, fileTagStates, allExistingTags } = get();
    if (!tagToRemove) return;

    set({
      tagToRemove: "",
      fileTagStates: fileTagStates.map((file) => ({
        ...file,
        tags: file.tags.map((tag) =>
          tag.value === tagToRemove ? { ...tag, status: "deleted" } : tag
        ),
      })),
      allExistingTags: allExistingTags.filter((tag) => tag !== tagToRemove),
    });
  },

  createAddRemoveForm: (): { file_name: string; tags: string[] }[] =>
    get().fileTagStates.map((fileState) => ({
      file_name: fileState.fileName,
      tags: fileState.tags
        .filter((tag) => tag.status !== "deleted")
        .map((tag) => tag.value),
    })),

  // Overwrite UI
  overwriteTags: [],
  editingTagIndex: null,
  editingTagValue: "",
  tagToOverwrite: "",

  setOverwriteTags: (tags) => set({ overwriteTags: tags }),
  setEditingTagIndex: (index) => set({ editingTagIndex: index }),
  setEditingTagValue: (val) => set({ editingTagValue: val }),
  setTagToOverwrite: (val) => set({ tagToOverwrite: val }),

  resetOverwriteState: () =>
    set({
      overwriteTags: [],
      editingTagIndex: null,
      editingTagValue: "",
      tagToOverwrite: "",
    }),

  createOverwriteForm: () => {
    const { overwriteTags } = get();
    const finalTags = overwriteTags
      .filter((t) => t.status !== "deleted")
      .map((t) => t.value);

    useHistoryStore.getState().addOverwriteHistory(finalTags);

    return {
      fileNames: useTagSearcherStore
        .getState()
        .selectedFiles.map((f) => f.file_name),
      tags: finalTags,
    };
  },
}));
