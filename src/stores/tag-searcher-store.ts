import { create } from "zustand";

import { ViewModeKey } from "../constants";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { SearchResult } from "@/bindings/SearchResult";
import { TagInfo } from "@/bindings/TagInfo";

type TagSearcherStore = {
  searchCondition: "AND" | "OR";
  searchResults: SearchResult[];
  selectedFiles: SearchResult[];
  operationMode: boolean;
  isDeleting: boolean;
  currentViewMode: ViewModeKey;
  selectedImage: string | null;
  selectedTags: TagInfo[];
  selectedCharacter: CharacterInfo | null;
  selectedAuthor: AuthorInfo | null;
  isViewModeDropdownOpen: boolean;
  setSearchCondition: (condition: "AND" | "OR") => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSelectedFiles: (files: SearchResult[]) => void;
  setOperationMode: (mode: boolean) => void;
  setIsDeleting: (deleting: boolean) => void;
  setCurrentViewMode: (viewMode: ViewModeKey) => void;
  setSelectedImage: (image: string | null) => void;
  setSelectedTags: (tags: TagInfo[]) => void;
  setSelectedCharacter: (character: CharacterInfo | null) => void;
  setSelectedAuthor: (author: AuthorInfo | null) => void;
  setIsViewModeDropdownOpen: (open: boolean) => void;
};

export const useTagSearcherStore = create<TagSearcherStore>((set) => ({
  searchCondition: "AND",
  searchResults: [],
  selectedFiles: [],
  operationMode: false,
  isDeleting: false,
  currentViewMode: "details",
  selectedImage: null,
  selectedTags: [],
  selectedCharacter: null,
  selectedAuthor: null,
  isViewModeDropdownOpen: false,
  setSearchCondition: (condition) => set({ searchCondition: condition }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setOperationMode: (mode) => set({ operationMode: mode }),
  setIsDeleting: (deleting) => set({ isDeleting: deleting }),
  setCurrentViewMode: (viewMode) => set({ currentViewMode: viewMode }),
  setSelectedImage: (image) => set({ selectedImage: image }),
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  setSelectedCharacter: (character) => set({ selectedCharacter: character }),
  setSelectedAuthor: (author) => set({ selectedAuthor: author }),
  setIsViewModeDropdownOpen: (open) => set({ isViewModeDropdownOpen: open }),
}));
