"use client";

import type React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { X, Search, Clock, Filter, ChevronDown } from "lucide-react";

// Types
interface GetUniqueTagListResp {
  tag: string;
}

interface SearchHistory {
  id: number;
  tags: GetUniqueTagListResp[];
  condition: "AND" | "OR";
  timestamp: Date;
}

interface SearchResult {
  id: number;
  title: string;
  thumbnailUrl: string;
}

const TagsSearcher: React.FC = () => {
  // State
  const [availableTags, setAvailableTags] = useState<GetUniqueTagListResp[]>(
    []
  );
  const [selectedTags, setSelectedTags] = useState<GetUniqueTagListResp[]>([]);
  const [searchCondition, setSearchCondition] = useState<"AND" | "OR">("AND");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // Fetch tags from database (mock implementation)
  useEffect(() => {
    const fetchTags = async () => {
      const tags = await invoke<GetUniqueTagListResp[]>("get_unique_tag_list");
      setAvailableTags(tags);
      console.log(tags);
    };

    fetchTags();
  }, []);

  // Add tag to selected tags
  const addTag = (tag: GetUniqueTagListResp) => {
    if (!selectedTags.some((t) => t.tag === tag.tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setIsTagDropdownOpen(false);
  };

  // Remove tag from selected tags
  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((param) => param.tag !== tag));
  };

  // Perform search
  const handleSearch = () => {
    if (selectedTags.length === 0) return;

    // Mock search results
    const mockResults: SearchResult[] = Array(20)
      .fill(null)
      .map((_, index) => ({
        id: index,
        title: `Result ${index + 1}`,
        thumbnailUrl: `/placeholder.svg?height=100&width=100`,
      }));

    setSearchResults(mockResults);

    // Add to search history
    const newHistoryItem: SearchHistory = {
      id: Date.now(),
      tags: [...selectedTags],
      condition: searchCondition,
      timestamp: new Date(),
    };

    const updatedHistory = [newHistoryItem, ...searchHistory].slice(0, 10);
    setSearchHistory(updatedHistory);
  };

  // Apply history item
  const applyHistoryItem = (historyItem: SearchHistory) => {
    setSelectedTags(historyItem.tags);
    setSearchCondition(historyItem.condition);
    setIsHistoryOpen(false);
  };

  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold mb-4">File Explorer</h1>

        {/* Search Controls */}
        <div className="flex flex-col gap-4">
          {/* Tag Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              >
                <Filter className="w-4 h-4" />
                Select Tags
                <ChevronDown className="w-4 h-4" />
              </button>

              {isTagDropdownOpen && (
                <div className="absolute z-10 mt-1 w-56 max-h-60 overflow-auto bg-white border rounded-md shadow-lg">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.tag}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100"
                      onClick={() => addTag(tag)}
                    >
                      {tag.tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Condition */}
            <div className="flex items-center gap-2 ml-2">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="condition"
                  checked={searchCondition === "AND"}
                  onChange={() => setSearchCondition("AND")}
                />
                AND
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="condition"
                  checked={searchCondition === "OR"}
                  onChange={() => setSearchCondition("OR")}
                />
                OR
              </label>
            </div>

            {/* Search Button */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ml-auto"
              onClick={handleSearch}
              disabled={selectedTags.length === 0}
            >
              <Search className="w-4 h-4" />
              Search
            </button>

            {/* History Button */}
            <button
              className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            >
              <Clock className="w-4 h-4" />
              History
            </button>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedTags.map((tag) => (
                <div
                  key={tag.tag}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md"
                >
                  {tag.tag}
                  <button
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => removeTag(tag.tag)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search History Dropdown */}
      {isHistoryOpen && (
        <div className="absolute top-32 right-4 z-20 w-80 bg-white border rounded-md shadow-lg">
          <div className="p-2 border-b font-medium">Recent Searches</div>
          <div className="max-h-80 overflow-auto">
            {searchHistory.length > 0 ? (
              searchHistory.map((item) => (
                <button
                  key={item.id}
                  className="w-full p-3 text-left hover:bg-gray-50 border-b"
                  onClick={() => applyHistoryItem(item)}
                >
                  <div className="flex flex-wrap gap-1 mb-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag.tag}
                        className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-md"
                      >
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Condition: {item.condition}</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                No search history
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="flex-1 overflow-auto p-4">
        {searchResults.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="flex flex-col items-center p-2 bg-white rounded-md shadow-sm hover:shadow-md cursor-pointer"
              >
                <img
                  src={result.thumbnailUrl || "/placeholder.svg"}
                  alt={result.title}
                  className="w-full aspect-square object-cover mb-2"
                />
                <span className="text-sm text-center truncate w-full">
                  {result.title}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="w-12 h-12 mb-2" />
            <p>Select tags and search to see results</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsSearcher;
