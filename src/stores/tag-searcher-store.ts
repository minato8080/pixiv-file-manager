import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ViewModeKey } from "../constants";
import { useDropdownStore } from "./dropdown-store";
import { SearchHistory, useHistoryStore } from "./history-store";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { SearchResult } from "@/bindings/SearchResult";
import { TagInfo } from "@/bindings/TagInfo";

type MemoriedStore = {
  currentViewMode: ViewModeKey;
  setCurrentViewMode: (viewMode: ViewModeKey) => void;
};

const useMemoriedStore = create<MemoriedStore>()(
  persist(
    (set) => ({
      currentViewMode: "medium",
      setCurrentViewMode: (viewMode) => set({ currentViewMode: viewMode }),
    }),
    { name: "tag_searcher_store" }
  )
);

type TagSearcherStore = {
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
  searchId: string;
  isQuickReload: { current: boolean };
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
  setSearchId: (id: string) => void;
  toggleItemSelection: (fileName: SearchResult) => void;
  fetchTags: () => Promise<void>;
  fetchCharacters: () => Promise<void>;
  fetchAuthors: () => Promise<void>;
  filterDropdowns: () => Promise<void>;
  handleSearch: () => Promise<SearchResult[] | undefined>;
  quickReload: () => Promise<void>;
};

export const useTagSearcherStore = create<TagSearcherStore>((set, get) => ({
  searchResults: [],
  selectedFiles: [],
  operationMode: false,
  isDeleting: false,
  currentViewMode: useMemoriedStore.getState().currentViewMode,
  selectedImage: null,
  selectedTags: [],
  selectedCharacter: null,
  selectedAuthor: null,
  isViewModeDropdownOpen: false,
  searchId: "",
  isQuickReload: { current: false },
  setSearchResults: (results) => set({ searchResults: results }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  setOperationMode: (mode) => set({ operationMode: mode }),
  setIsDeleting: (deleting) => set({ isDeleting: deleting }),
  setCurrentViewMode: (viewMode) => {
    useMemoriedStore.getState().setCurrentViewMode(viewMode);
    set({ currentViewMode: viewMode });
  },
  setSelectedImage: (image) => set({ selectedImage: image }),
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  setSelectedCharacter: (character) => set({ selectedCharacter: character }),
  setSelectedAuthor: (author) => set({ selectedAuthor: author }),
  setIsViewModeDropdownOpen: (open) => set({ isViewModeDropdownOpen: open }),
  setSearchId: (id) => set({ searchId: id }),

  toggleItemSelection: (fileName) => {
    const { operationMode, selectedFiles, setSelectedFiles } = get();
    if (operationMode) {
      setSelectedFiles(
        selectedFiles.includes(fileName)
          ? selectedFiles.filter((p) => p !== fileName)
          : [...selectedFiles, fileName]
      );
    }
  },

  fetchTags: async () => {
    const { setUniqueTagList, setTagDropdownItems } =
      useDropdownStore.getState();
    try {
      const tags = await invoke<TagInfo[]>("get_unique_tags");
      setUniqueTagList(tags);
      setTagDropdownItems(tags.map((t) => ({ id: t.tag, ...t })));
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  },

  fetchCharacters: async () => {
    const { setCharacterDropdownItems, setUniqueCharacterList } =
      useDropdownStore.getState();
    try {
      const characters = await invoke<CharacterInfo[]>("get_unique_characters");
      setUniqueCharacterList(characters);
      setCharacterDropdownItems(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
    }
  },

  fetchAuthors: async () => {
    const { setAuthorDropdownItems } = useDropdownStore.getState();
    try {
      const authors = await invoke<AuthorInfo[]>("get_unique_authors");
      setAuthorDropdownItems(authors);
    } catch (error) {
      console.error("Error fetching authors:", error);
    }
  },

  filterDropdowns: async () => {
    const { selectedTags, selectedCharacter, selectedAuthor } = get();
    const {
      setTagDropdownItems,
      setCharacterDropdownItems,
      setAuthorDropdownItems,
    } = useDropdownStore.getState();
    try {
      const [ftags, characters, authors] = await invoke<
        [TagInfo[], CharacterInfo[], AuthorInfo[]]
      >("filter_dropdowns", {
        tags: selectedTags.map((t) => t.tag),
        character: selectedCharacter?.character,
        authorId: selectedAuthor?.author_id,
      });
      setTagDropdownItems(ftags.map((t) => ({ id: t.tag, ...t })));
      setCharacterDropdownItems(characters);
      setAuthorDropdownItems(authors);
    } catch (error) {
      console.error("Error fetching filterd dropdowns:", error);
    }
  },

  // Perform search
  handleSearch: async () => {
    const {
      setSearchResults,
      setSelectedFiles,
      selectedTags,
      selectedCharacter,
      selectedAuthor,
      searchId,
    } = get();
    const { addSearchHistory } = useHistoryStore.getState();

    if (
      selectedTags.length === 0 &&
      !selectedCharacter &&
      !selectedAuthor &&
      !searchId
    ) {
      return;
    }

    const performSearch = async () => {
      try {
        let results: SearchResult[] = [];
        if (searchId) {
          results = await invoke("search_by_id", {
            id: Number(searchId),
          });
        } else {
          results = await invoke("search_by_criteria", {
            tags: selectedTags.map((iter) => iter.tag),
            character: selectedCharacter?.character,
            authorId: selectedAuthor?.author_id,
          });
        }

        setSearchResults(
          results.map((r) => {
            const url = convertFileSrc(r.thumbnail_url);
            r.thumbnail_url = url;
            return r;
          })
        );
        setSelectedFiles([]);

        // Save search history to DB
        if (results.length > 0) {
          const newHistoryItem: SearchHistory =
            searchId === ""
              ? {
                  id: null,
                  tags: selectedTags.map((tags) => tags.tag),
                  character: selectedCharacter?.character ?? null,
                  author: selectedAuthor,
                  timestamp: new Date().toLocaleString(),
                  count: results.length,
                }
              : {
                  id: searchId,
                  tags: [],
                  character: null,
                  author: null,
                  timestamp: new Date().toLocaleString(),
                  count: results.length,
                };
          addSearchHistory(newHistoryItem);
        }
        return results;
      } catch (error) {
        console.error("Error search illusts:", error);
      }
    };
    return await performSearch();
  },

  quickReload: async () => {
    get().isQuickReload.current = true;
    await get().handleSearch();
  },
}));
