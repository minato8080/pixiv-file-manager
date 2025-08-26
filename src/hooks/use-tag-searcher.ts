import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import { SearchHistory, useHistoryStore } from "../stores/history-store";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { SearchResult } from "@/bindings/SearchResult";
import { TagInfo } from "@/bindings/TagInfo";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";
import { useDropdownStore } from "@/stores/dropdown-store";

export const useTagSearcher = () => {
  const {
    setSearchResults,
    setSelectedFiles,
    selectedTags,
    selectedCharacter,
    selectedAuthor,
    searchId,
    isQuickReload,
  } = useTagSearcherStore();
  const {
    setUniqueTagList,
    setTagDropdownItems,
    setCharacterDropdownItems,
    setAuthorDropdownItems,
  } = useDropdownStore();
  const { addSearchHistory } = useHistoryStore();

  // Handlers to fetch tags, characters, authors, and search history from the database
  const fetchTags = async () => {
    try {
      const tags = await invoke<TagInfo[]>("get_unique_tags");
      setUniqueTagList(tags);
      setTagDropdownItems(tags.map((t) => ({ id: t.tag, ...t })));
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const characters = await invoke<CharacterInfo[]>("get_unique_characters");
      setCharacterDropdownItems(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
    }
  };

  const fetchAuthors = async () => {
    try {
      const authors = await invoke<AuthorInfo[]>("get_unique_authors");
      setAuthorDropdownItems(authors);
    } catch (error) {
      console.error("Error fetching authors:", error);
    }
  };

  // Perform search
  const handleSearch = async () => {
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
            author: selectedAuthor?.author_id,
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
  };

  const quickReload = async () => {
    isQuickReload.current = true;
    await handleSearch();
  };

  return {
    fetchTags,
    fetchAuthors,
    fetchCharacters,
    handleSearch,
    quickReload,
  };
};
