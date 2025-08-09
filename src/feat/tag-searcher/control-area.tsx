import { Search, Trash2, CheckSquare, Square } from "lucide-react";

import { DropdownAuthor } from "./dropdowns/dropdown-author";
import { DropdownCharacter } from "./dropdowns/dropdown-character";
import { DropdownHistory } from "./dropdowns/dropdown-history";
import { DropdownTags } from "./dropdowns/dropdown-tags";
import { DropdownViewMode } from "./dropdowns/dropdown-view-mode";
import { SearchConditionSwitch } from "./search-condition-switch";

import { Button } from "@/components/ui/button";
import { useTagSearcher } from "@/src/hooks/use-tag-searcher";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const ControlArea = () => {
  const {
    setSearchCondition,
    operationMode,
    setOperationMode,
    selectedTags,
    setSelectedTags,
    selectedCharacter,
    setSelectedCharacter,
    selectedAuthor,
    setSelectedAuthor,
  } = useTagSearcherStore();
  const { handleSearch } = useTagSearcher();
  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([]);
    setSearchCondition("AND");
    setSelectedCharacter(null);
    setSelectedAuthor(null);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
      {/* Tags Dropdown */}
      <DropdownTags />

      {/* Character Dropdown */}
      <DropdownCharacter />

      {/* Author Dropdown */}
      <DropdownAuthor />

      {/* Condition Switch */}
      <SearchConditionSwitch />

      {/* Clear Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 bg-white dark:bg-gray-800"
        onClick={clearSearchConditions}
        disabled={
          selectedTags.length === 0 && !selectedCharacter && !selectedAuthor
        }
      >
        <Trash2 className="h-4 w-4 mr-1 text-red-500" />
        Clear
      </Button>

      {/* Serach Button */}
      <Button
        variant="default"
        size="sm"
        className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={handleSearch}
        disabled={
          selectedTags.length === 0 && !selectedCharacter && !selectedAuthor
        }
      >
        <Search className="h-4 w-4 mr-1" />
        Search
      </Button>

      {/* History dropdown */}
      <DropdownHistory />

      <div className="ml-auto flex items-center gap-1">
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
    </div>
  );
};
