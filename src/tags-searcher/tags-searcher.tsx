import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

import {
  Search,
  Filter,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VIEW_MODES, ViewModeKey } from "../constants";
import { SearchHistory } from "@/bindings/SearchHistory";
import { DropdownHandle, ForwardedFilterDropdown } from "../dropdown";
import {
  AuthorDropdown,
  CharacterDropdown,
  TagDropdown,
} from "../types/app-types";
import { DialogLabelCharacter } from "./dialog-label-character";
import { DialogMoveFiles } from "./dialog-move-files";
import { DialogDeleteFiles } from "./dialog-delete-files";
import { DropdownHistory, DropdownHistoryHandle } from "./dropdown-history";
import { DialogEditTags } from "./dialog-edit-tags";
import { ImageViewerModal } from "../image-viewer-modal";
import { TagsSearcherResultArea } from "./result-area";
import { TagsArea } from "./tags-area";
import { useTagsSearcherStore } from "../stores/tags-searcher-store";
import { SearchConditionSwitch } from "./search-condition-switch";
import { OperationArea } from "./operation-area";
import { useTagsSearcher } from "../hooks/use-tags-searcher";

export default function TagsSearcher() {
  const {
    setSearchCondition,
    searchResults,
    operationMode,
    setOperationMode,
    currentViewMode,
    setCurrentViewMode,
    selectedImage,
    setSelectedImage,
    selectedTags,
    setSelectedTags,
    selectedCharacter,
    setSelectedCharacter,
    selectedAuthor,
    setSelectedAuthor,
    isViewModeDropdownOpen,
    setIsViewModeDropdownOpen,
  } = useTagsSearcherStore();

  // Refs for dropdown
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);
  const historyDropdownHandlerRef = useRef<DropdownHistoryHandle>(null);
  const tagDropdownHandlerRef = useRef<DropdownHandle<TagDropdown>>(null);
  const charaDropdownHandlerRef =
    useRef<DropdownHandle<CharacterDropdown>>(null);
  const authorDropdownHandlerRef = useRef<DropdownHandle<AuthorDropdown>>(null);

  const {
    fetchTags,
    fetchCharacters,
    fetchAuthors,
    fetchSearchHistory,
    handleSearch,
  } = useTagsSearcher();


  // Call handlers to fetch data using useEffect
  useEffect(() => {
    fetchTags();
    fetchCharacters();
    fetchAuthors();
    fetchSearchHistory();
    const unlisten = listen<null>("update_db", () => {
      fetchTags();
      fetchCharacters();
      fetchAuthors();
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Add keyboard and mouse wheel event listeners for view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Plus/Minus to change view mode
      if (e.ctrlKey) {
        const viewModeKeys = Object.keys(VIEW_MODES) as ViewModeKey[];
        const currentIndex = viewModeKeys.indexOf(currentViewMode);

        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          const nextIndex = Math.min(viewModeKeys.length - 1, currentIndex + 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Ctrl + Mouse wheel to change view mode
      if (e.ctrlKey) {
        e.preventDefault();
        const viewModeKeys = Object.keys(VIEW_MODES) as ViewModeKey[];
        const currentIndex = viewModeKeys.indexOf(currentViewMode);
        if (e.deltaY < 0) {
          // Scroll up - larger icons
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        } else {
          // Scroll down - smaller icons
          const nextIndex = Math.min(viewModeKeys.length - 1, currentIndex + 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [VIEW_MODES[currentViewMode], VIEW_MODES]);

  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([]);
    setSearchCondition("AND");
    setSelectedCharacter(null);
    setSelectedAuthor(null);
  };

  // Apply history item
  const applyHistoryItem = (history: SearchHistory) => {
    setSelectedTags(history.tags.map((tag) => ({ tag, count: 0 })));
    setSelectedCharacter(
      history.character
        ? {
            id: history.character,
            character: history.character,
            count: null,
          }
        : null
    );
    setSelectedAuthor(
      history.author
        ? {
            id: history.author.author_id.toString(),
            label: history.author.author_name,
            ...history.author,
          }
        : null
    );
    setSearchCondition(history.condition as "AND" | "OR");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact search controls with more color */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        {/* Tags Dropdown */}
        <ForwardedFilterDropdown
          mode="multiple"
          ButtonIcon={<Filter className="h-4 w-4 mr-1 text-blue-500" />}
          buttonText={"Tag"}
          selectedItem={selectedTags.map((tag) => ({
            id: tag.tag,
            ...tag,
          }))}
          setSelectedItem={(items) => {
            const uniqueItems = items.filter(
              (item, index, self) =>
                index === self.findIndex((t) => t.tag === item.tag)
            );
            setSelectedTags(uniqueItems.map((item) => ({ ...item })));
          }}
          ref={tagDropdownHandlerRef}
        />

        {/* Character Dropdown */}
        <ForwardedFilterDropdown
          mode="single"
          ButtonIcon={<Users className="h-4 w-4 mr-1 text-purple-500" />}
          buttonText={"Chara"}
          selectedItem={selectedCharacter}
          setSelectedItem={setSelectedCharacter}
          ref={charaDropdownHandlerRef}
        />

        {/* Author Dropdown */}
        <ForwardedFilterDropdown
          mode="single"
          ButtonIcon={<User className="h-4 w-4 mr-1 text-green-500" />}
          buttonText={"Author"}
          selectedItem={selectedAuthor}
          setSelectedItem={setSelectedAuthor}
          ref={authorDropdownHandlerRef}
        />

        {/* Condition Switch */}
        <SearchConditionSwitch />

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
        <DropdownHistory
          applyHistoryItem={applyHistoryItem}
          ref={historyDropdownHandlerRef}
        />

        <div className="ml-auto flex items-center gap-1">
          {/* View Mode Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-white dark:bg-gray-800"
              onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
            >
              {VIEW_MODES[currentViewMode].icon}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>

            {isViewModeDropdownOpen && (
              <div
                ref={viewModeDropdownRef}
                className="absolute z-50 right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
              >
                {Object.entries(VIEW_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentViewMode(key as ViewModeKey);
                      setIsViewModeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                      currentViewMode === key
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {mode.icon}
                    <span>{mode.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Selected Tags */}
      <TagsArea
        onRemoveItem={(tag) => tagDropdownHandlerRef.current?.removeItem(tag)}
      />

      {/* Operation Controls */}
      <OperationArea />

      {/* Results Area */}
      <TagsSearcherResultArea />

      {/* Add status bar at the bottom */}
      {searchResults.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 p-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div>{searchResults.length} items</div>
        </div>
      )}

      {/* Move Dialog */}
      <DialogMoveFiles />

      {/* Delete Confirmation Dialog */}
      <DialogDeleteFiles />

      {/* Character Name Input Dialog */}
      <DialogLabelCharacter />

      <DialogEditTags />

      <ImageViewerModal
        searchResults={searchResults}
        selectedItem={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
