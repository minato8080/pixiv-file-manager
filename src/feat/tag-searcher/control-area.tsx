import { Search, Trash2, CheckSquare, Square } from "lucide-react";
import { useEffect } from "react";

import { DropdownAuthor } from "./dropdowns/dropdown-author";
import { DropdownCharacter } from "./dropdowns/dropdown-character";
import { DropdownHistory } from "./dropdowns/dropdown-history";
import { DropdownTags } from "./dropdowns/dropdown-tags";
import { DropdownViewMode } from "./dropdowns/dropdown-view-mode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const ControlArea = () => {
  const {
    operationMode,
    setOperationMode,
    selectedTags,
    setSelectedTags,
    selectedCharacter,
    setSelectedCharacter,
    selectedAuthor,
    setSelectedAuthor,
    searchResults,
    setSearchResults,
    searchId,
    setSearchId,
    filterDropdowns,
  } = useTagSearcherStore();
  const { handleSearch } = useTagSearcherStore();

  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([]);
    setSelectedCharacter(null);
    setSelectedAuthor(null);
    setSearchResults([]);
    setSearchId("");
  };

  useEffect(
    () => void filterDropdowns(),
    [selectedTags, selectedCharacter, selectedAuthor, filterDropdowns]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
      {/* Tags Dropdown */}
      <DropdownTags />

      {/* Character Dropdown */}
      <DropdownCharacter />

      {/* Author Dropdown */}
      <DropdownAuthor />

      <div className="flex items-center gap-1">
        <Input
          type="number"
          placeholder="Search by ID..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="h-9 w-32 bg-white dark:bg-gray-800"
        />
      </div>

      {/* Clear Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 bg-white dark:bg-gray-800"
        onClick={clearSearchConditions}
        disabled={
          selectedTags.length === 0 &&
          !selectedCharacter &&
          !selectedAuthor &&
          searchResults.length === 0 &&
          !searchId
        }
      >
        <Trash2 className="h-4 w-4 mr-1 text-red-500" />
        Clear
      </Button>

      {/* Search Button */}
      <Button
        variant="default"
        size="sm"
        className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => void handleSearch()}
        disabled={
          selectedTags.length === 0 &&
          !selectedCharacter &&
          !selectedAuthor &&
          !searchId
        }
      >
        <Search className="h-4 w-4 mr-1" />
        Search
      </Button>

      {/* History dropdown */}
      <DropdownHistory />

      {/* View Mode Selector */}
      <DropdownViewMode />

      {/* Select Button */}
      <Button
        variant={operationMode ? "secondary" : "outline"}
        size="sm"
        className={`h-9 ${
          operationMode
            ? "bg-blue-100 text-blue-800 border-blue-300"
            : "bg-white dark:bg-gray-800"
        }`}
        onClick={() => setOperationMode(!operationMode)}
      >
        {operationMode ? (
          <CheckSquare className="h-4 w-4 text-blue-600" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        <span className="ml-1">Select</span>
      </Button>
    </div>
  );
};
