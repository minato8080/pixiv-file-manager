import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { SearchHistory } from "@/bindings/SearchHistory";
import { SearchResult } from "@/bindings/SearchResult";
import { TagInfo } from "@/bindings/TagInfo";
import { useDropdownStore } from "@/stores/dropdown-store";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";

export const useTagsSearcher = () => {
  const {
    searchCondition,
    setSearchResults,
    setSelectedFiles,
    selectedTags,
    selectedCharacter,
    selectedAuthor,
  } = useTagsSearcherStore();
  const {
    setUniqueTagList,
    setTagDropdownItems,
    setCharacterDropdownItems,
    setAuthorDropdownItems,
    setHistory,
    addHistory,
  } = useDropdownStore();

  // Handlers to fetch tags, characters, authors, and search history from the database
  const fetchTags = async () => {
    try {
      const tags = await invoke<TagInfo[]>("get_unique_tag_list");
      setUniqueTagList(tags);
      setTagDropdownItems(tags.map((t) => ({ id: t.tag, ...t })));
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const characters = await invoke<CharacterInfo[]>("get_unique_characters");
      setCharacterDropdownItems(
        characters.map((c) => ({
          id: c.character,
          ...c,
        }))
      );
    } catch (error) {
      console.error("Error fetching characters:", error);
    }
  };

  const fetchAuthors = async () => {
    try {
      const authors = await invoke<AuthorInfo[]>("get_unique_authors");
      setAuthorDropdownItems(
        authors.map((a) => ({
          id: a.author_id.toString(),
          label: a.author_name,
          ...a,
        }))
      );
    } catch (error) {
      console.error("Error fetching authors:", error);
    }
  };

  const fetchSearchHistory = async () => {
    try {
      const history = await invoke<SearchHistory[]>("get_search_history");
      setHistory(history);
    } catch (error) {
      console.error("Error fetching search history:", error);
    }
  };

  // Perform search
  const handleSearch = () => {
    if (!selectedTags) return;
    if (selectedTags.length === 0 && !selectedCharacter && !selectedAuthor) {
      return;
    }

    const performSearch = async () => {
      try {
        const results: SearchResult[] = await invoke("search_by_criteria", {
          tags: selectedTags.map((iter) => iter.tag),
          condition: searchCondition,
          character: selectedCharacter?.character,
          author: selectedAuthor?.author_id,
        });

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
          const newHistoryItem: SearchHistory = {
            tags: selectedTags.map((tags) => tags.tag),
            condition: searchCondition,
            timestamp: new Date().toLocaleString(),
            result_count: results.length,
            character: selectedCharacter?.character ?? "",
            author: selectedAuthor,
          };
          addHistory(newHistoryItem);
        }
      } catch (error) {
        console.error("Error search illusts:", error);
      }
    };
    void performSearch();
  };

  return {
    fetchTags,
    fetchAuthors,
    fetchCharacters,
    fetchSearchHistory,
    handleSearch,
  };
};
