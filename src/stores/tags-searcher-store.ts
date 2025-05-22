import { create } from "zustand";
import { SearchResult } from "@/bindings/SearchResult";
import { ViewModeKey } from "../constants";
import { TagInfo } from "@/bindings/TagInfo";
import { AuthorDropdown, CharacterDropdown } from "../types/app-types";

type TagsSearcherStore = {
  searchCondition: "AND" | "OR";
  searchResults: SearchResult[];
  selectedFiles: SearchResult[];
  operationMode: boolean;
  isDeleting: boolean;
  currentViewMode: ViewModeKey;
  selectedImage: string | null;
  selectedTags: TagInfo[];
  selectedCharacter: CharacterDropdown | null;
  selectedAuthor: AuthorDropdown | null;
  isViewModeDropdownOpen: boolean;
  setSearchCondition: (condition: "AND" | "OR") => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSelectedFiles: (files: SearchResult[]) => void;
  setOperationMode: (mode: boolean) => void;
  setIsDeleting: (deleting: boolean) => void;
  setCurrentViewMode: (viewMode: ViewModeKey) => void;
  setSelectedImage: (image: string | null) => void;
  setSelectedTags: (tags: TagInfo[]) => void;
  setSelectedCharacter: (character: CharacterDropdown | null) => void;
  setSelectedAuthor: (author: AuthorDropdown | null) => void;
  setIsViewModeDropdownOpen: (open: boolean) => void;
};

export const useTagsSearcherStore = create<TagsSearcherStore>((set) => ({
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
