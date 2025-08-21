import { create } from "zustand";

import {
  FileTagState,
  TagState,
} from "../feat/tag-searcher/dialogs/dialog-edit-tag";

import { AssociateInfo } from "@/bindings/AssociateInfo";
import { EditTag } from "@/bindings/EditTag";
import { SearchResult } from "@/bindings/SearchResult";

type DialogEditStore = {
  isEditTagsDialogOpen: boolean;
  selectedFiles: SearchResult[];
  availableTags: string[];
  isEditTagsDialogSubmitting: boolean;
  isOverwriteMode: boolean;
  isUpdateLinkedFiles: boolean;
  associateInfo: AssociateInfo | null;
  setSelectedFiles: (files: SearchResult[]) => void;
  setAvailableTags: (tags: string[]) => void;
  openEditTagsDialog: (files: SearchResult[]) => void;
  closeEditTagsDialog: () => void;
  setEditTagsDialogSubmitting: (submitting: boolean) => void;
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
  selectedFileForTags: string;
  editingTagIndex: number | null;
  editingTagValue: string;
  tagToOverwrite: string;
  setOverwriteTags: (tags: TagState[]) => void;
  setSelectedFileForTags: (file: string) => void;
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
  selectedFiles: [],
  availableTags: [],
  isEditTagsDialogSubmitting: false,
  isOverwriteMode: false,
  isUpdateLinkedFiles: false,
  associateInfo: null,
  setSelectedFiles: (files: SearchResult[]) => set({ selectedFiles: files }),
  setAvailableTags: (tags) => set({ availableTags: tags }),
  openEditTagsDialog: (files: SearchResult[]) =>
    set({
      isEditTagsDialogOpen: true,
      selectedFiles: files,
    }),
  closeEditTagsDialog: () => {
    get().resetMainUI();
    get().resetAddRemoveState();
    get().resetOverwriteState();
  },
  setEditTagsDialogSubmitting: (submitting: boolean) =>
    set({ isEditTagsDialogSubmitting: submitting }),
  resetMainUI: () =>
    set({
      isEditTagsDialogOpen: false,
      selectedFiles: [],
      isEditTagsDialogSubmitting: false,
      isOverwriteMode: false,
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
  selectedFileForTags: "",
  editingTagIndex: null,
  editingTagValue: "",
  tagToOverwrite: "",

  setOverwriteTags: (tags) => set({ overwriteTags: tags }),
  setSelectedFileForTags: (file) => set({ selectedFileForTags: file }),
  setEditingTagIndex: (index) => set({ editingTagIndex: index }),
  setEditingTagValue: (val) => set({ editingTagValue: val }),
  setTagToOverwrite: (val) => set({ tagToOverwrite: val }),

  resetOverwriteState: () =>
    set({
      overwriteTags: [],
      selectedFileForTags: "",
      editingTagIndex: null,
      editingTagValue: "",
      tagToOverwrite: "",
    }),

  createOverwriteForm: () => {
    const { overwriteTags: tags } = get();
    const finalTags = tags
      .filter((t) => t.status !== "deleted")
      .map((t) => t.value);

    return {
      fileNames: get().selectedFiles.map((f) => f.file_name),
      tags: finalTags,
    };
  },
}));
