import { convertFileSrc } from "@tauri-apps/api/core";
import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  Filter,
  Trash2,
  FolderInput,
  CheckSquare,
  Square,
  Folder,
  X,
  History,
  ChevronDown,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VIEW_MODES, type ViewMode } from "./constants";
import type {
  AuthorInfo,
  GetUniqueTagListResp,
  SearchHistory,
  SearchResult,
} from "./types";

export default function TagsSearcher() {
  // State
  const [availableTags, setAvailableTags] = useState<GetUniqueTagListResp[]>(
    []
  );
  const [selectedTags, setSelectedTags] = useState<GetUniqueTagListResp[]>([]);
  const [searchCondition, setSearchCondition] = useState<"AND" | "OR">("AND");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [operationMode, setOperationMode] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetFolder, setTargetFolder] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [availableCharacters, setAvailableCharacters] = useState<string[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<AuthorInfo[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null
  );
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorInfo | null>(null);
  const [isCharacterDropdownOpen, setIsCharacterDropdownOpen] = useState(false);
  const [isAuthorDropdownOpen, setIsAuthorDropdownOpen] = useState(false);
  const [characterFilter, setCharacterFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");

  // Refs for dropdown
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);
  const characterDropdownRef = useRef<HTMLDivElement>(null);
  const authorDropdownRef = useRef<HTMLDivElement>(null);

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(
    VIEW_MODES[0]
  );

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Tag dropdown
      if (
        isTagDropdownOpen &&
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false);
      }

      // History dropdown
      if (
        isHistoryDropdownOpen &&
        historyDropdownRef.current &&
        !historyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsHistoryDropdownOpen(false);
      }

      // View mode dropdown
      if (
        isViewModeDropdownOpen &&
        viewModeDropdownRef.current &&
        !viewModeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsViewModeDropdownOpen(false);
      }

      // Character dropdown
      if (
        isCharacterDropdownOpen &&
        characterDropdownRef.current &&
        !characterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCharacterDropdownOpen(false);
      }

      // Author dropdown
      if (
        isAuthorDropdownOpen &&
        authorDropdownRef.current &&
        !authorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAuthorDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isTagDropdownOpen,
    isHistoryDropdownOpen,
    isViewModeDropdownOpen,
    isCharacterDropdownOpen,
    isAuthorDropdownOpen,
  ]);

  // Fetch tags, characters, authors, and search history from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tags
        const tags = await invoke<GetUniqueTagListResp[]>(
          "get_unique_tag_list"
        );
        setAvailableTags(tags);

        // Fetch characters
        const characters = await invoke<string[]>("get_unique_characters");
        setAvailableCharacters(characters);

        // Fetch authors
        const authors = await invoke<AuthorInfo[]>("get_unique_authors");
        setAvailableAuthors(authors);

        // Fetch search history
        const history = await invoke<SearchHistory[]>("get_search_history");
        setSearchHistory(history);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Add keyboard and mouse wheel event listeners for view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Plus/Minus to change view mode
      if (e.ctrlKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          const currentIndex = VIEW_MODES.findIndex(
            (mode) => mode.id === currentViewMode.id
          );
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(VIEW_MODES[nextIndex]);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          const currentIndex = VIEW_MODES.findIndex(
            (mode) => mode.id === currentViewMode.id
          );
          const nextIndex = Math.min(VIEW_MODES.length - 1, currentIndex + 1);
          setCurrentViewMode(VIEW_MODES[nextIndex]);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Ctrl + Mouse wheel to change view mode
      if (e.ctrlKey) {
        e.preventDefault();
        const currentIndex = VIEW_MODES.findIndex(
          (mode) => mode.id === currentViewMode.id
        );
        if (e.deltaY < 0) {
          // Scroll up - larger icons
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(VIEW_MODES[nextIndex]);
        } else {
          // Scroll down - smaller icons
          const nextIndex = Math.min(VIEW_MODES.length - 1, currentIndex + 1);
          setCurrentViewMode(VIEW_MODES[nextIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [currentViewMode, VIEW_MODES]);

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

  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([]);
    setSearchCondition("AND");
    setSelectedCharacter(null);
    setSelectedAuthor(null);
  };

  // Perform search
  const handleSearch = () => {
    if (selectedTags.length === 0 && !selectedCharacter && !selectedAuthor)
      return;

    const performSearch = async () => {
      try {
        const results: SearchResult[] = await invoke("search_by_criteria", {
          tags: selectedTags.map((tag) => tag.tag),
          condition: searchCondition,
          character: selectedCharacter,
          author: selectedAuthor?.author_id,
        });

        setSearchResults(
          results.map((r) => {
            const url = convertFileSrc(r.thumbnail_url);
            r.thumbnail_url = url;
            return r;
          })
        );
        setSelectedItems([]);

        // Save search history to DB
        if (results.length > 0) {
          const newHistoryItem: SearchHistory = {
            id: Date.now(),
            tags: [...selectedTags],
            condition: searchCondition,
            timestamp: new Date(),
            result_count: results.length,
          };

          const updatedHistory = [newHistoryItem, ...searchHistory].slice(
            0,
            10
          );
          setSearchHistory(updatedHistory);
        }
      } catch (error) {
        console.error("検索エラー:", error);
      }
    };

    performSearch();
  };

  // Apply history item
  const applyHistoryItem = (historyItem: SearchHistory) => {
    setSelectedTags(historyItem.tags);
    setSearchCondition(historyItem.condition);
    setIsHistoryDropdownOpen(false);
  };

  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Toggle item selection
  const toggleItemSelection = (id: number) => {
    if (operationMode) {
      setSelectedItems((prev) =>
        prev.includes(id)
          ? prev.filter((itemId) => itemId !== id)
          : [...prev, id]
      );
    }
  };

  // Select all items
  const selectAllItems = () => {
    setSelectedItems(searchResults.map((item) => item.id));
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItems([]);
  };

  // Handle move operation
  const handleMove = () => {
    if (selectedItems.length === 0) return;
    setShowMoveDialog(true);
  };

  // Confirm move operation
  const confirmMove = async () => {
    try {
      // Invoke to Rust backend
      await invoke("move_files", {
        fileIds: selectedItems,
        targetFolder: targetFolder,
      });
      console.log(`Moving ${selectedItems.length} files to ${targetFolder}`);
    } catch (error) {
      console.error("Error moving files:", error);
    } finally {
      setShowMoveDialog(false);
      setSelectedItems([]);
    }
  };

  // Handle delete operation
  const handleDelete = () => {
    if (selectedItems.length === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Invoke to Rust backend
      await invoke("delete_files", {
        fileIds: selectedItems,
      });
      console.log(`Deleting ${selectedItems.length} files`);

      // Remove deleted items from search results
      setSearchResults(
        searchResults.filter((result) => !selectedItems.includes(result.id))
      );
      setSelectedItems([]);
    } catch (error) {
      console.error("Error deleting files:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Handle folder selection
  const handleSelectFolder = async () => {
    try {
      // Function to select folders
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folders containing images",
      });

      if (selected) {
        setTargetFolder(selected);
      }
    } catch (error) {
      console.error("Error selecting folders:", error);
    }
  };

  // Filter available tags
  const filteredTags = availableTags.filter((tag) =>
    tag.tag.toLowerCase().includes(tagFilter.toLowerCase())
  );

  // Filter available characters
  const filteredCharacters = availableCharacters.filter((character) =>
    character.toLowerCase().includes(characterFilter.toLowerCase())
  );

  // Filter available authors
  const filteredAuthors = availableAuthors.filter((author) =>
    author.author_name.toLowerCase().includes(authorFilter.toLowerCase())
  );

  const openImage = async (fileId: number, filePath: string) => {
    if (operationMode) return; // 選択モード中は画像を開かない

    try {
      await invoke("open_image", {
        fileId,
        filePath,
      });
      console.log(`Opening image: ${filePath} (ID: ${fileId})`);
    } catch (error) {
      console.error("Error opening image:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact search controls with more color */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 bg-white dark:bg-gray-800 border shadow-sm"
            onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
          >
            <Filter className="h-4 w-4 mr-1 text-blue-500" />
            Tag
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>

          {isTagDropdownOpen && (
            <div
              ref={tagDropdownRef}
              className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
            >
              <div className="p-2 border-b">
                <Input
                  placeholder="Filter tags..."
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag) => (
                    <button
                      key={tag.tag}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex justify-between items-center"
                      onClick={() => addTag(tag)}
                    >
                      <span className="truncate">{tag.tag}</span>
                      <Badge className="ml-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        +{tag.count}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    No tags found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Character Dropdown */}
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 bg-white dark:bg-gray-800 border shadow-sm"
            onClick={() => setIsCharacterDropdownOpen(!isCharacterDropdownOpen)}
          >
            <Users className="h-4 w-4 mr-1 text-purple-500" />
            {selectedCharacter || "Character"}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>

          {isCharacterDropdownOpen && (
            <div
              ref={characterDropdownRef}
              className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
            >
              <div className="p-2 border-b">
                <Input
                  placeholder="Filter characters..."
                  value={characterFilter}
                  onChange={(e) => setCharacterFilter(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {selectedCharacter && (
                  <button
                    className="w-full px-3 py-2 text-left bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 flex justify-between items-center"
                    onClick={() => {
                      setSelectedCharacter(null);
                      setIsCharacterDropdownOpen(false);
                    }}
                  >
                    <span className="flex items-center text-red-600 dark:text-red-400">
                      <X className="h-4 w-4 mr-1" />
                      Clear selection
                    </span>
                  </button>
                )}
                {filteredCharacters.length > 0 ? (
                  filteredCharacters.map((character) => (
                    <button
                      key={character}
                      className={`w-full px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 flex justify-between items-center ${
                        selectedCharacter === character
                          ? "bg-purple-100 dark:bg-purple-900/30"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedCharacter(character);
                        setIsCharacterDropdownOpen(false);
                      }}
                    >
                      <span className="truncate">{character}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    No characters found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Author Dropdown */}
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 bg-white dark:bg-gray-800 border shadow-sm"
            onClick={() => setIsAuthorDropdownOpen(!isAuthorDropdownOpen)}
          >
            <User className="h-4 w-4 mr-1 text-green-500" />
            {selectedAuthor?.author_name || "Author"}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>

          {isAuthorDropdownOpen && (
            <div
              ref={authorDropdownRef}
              className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
            >
              <div className="p-2 border-b">
                <Input
                  placeholder="Filter authors..."
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {selectedAuthor && (
                  <button
                    className="w-full px-3 py-2 text-left bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 flex justify-between items-center"
                    onClick={() => {
                      setSelectedAuthor(null);
                      setIsAuthorDropdownOpen(false);
                    }}
                  >
                    <span className="flex items-center text-red-600 dark:text-red-400">
                      <X className="h-4 w-4 mr-1" />
                      Clear selection
                    </span>
                  </button>
                )}
                {filteredAuthors.length > 0 ? (
                  filteredAuthors.map((author) => (
                    <button
                      key={author.author_id}
                      className={`w-full px-3 py-2 text-left hover:bg-green-50 dark:hover:bg-green-900/20 flex justify-between items-center ${
                        selectedAuthor?.author_id === author.author_id
                          ? "bg-green-100 dark:bg-green-900/30"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedAuthor(author);
                        setIsAuthorDropdownOpen(false);
                      }}
                    >
                      <span className="truncate">{author.author_name}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    No authors found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-md border shadow-sm w-[100px] justify-center">
          <Switch
            id="search-condition"
            checked={searchCondition === "OR"}
            onCheckedChange={(checked) =>
              setSearchCondition(checked ? "OR" : "AND")
            }
            className={
              searchCondition === "OR" ? "bg-green-500" : "bg-blue-500"
            }
          />
          <Label
            htmlFor="search-condition"
            className="font-medium w-8 text-center"
          >
            {searchCondition}
          </Label>
        </div>

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

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-white dark:bg-gray-800"
            onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
          >
            <History className="h-4 w-4 mr-1 text-purple-500" />
            History
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>

          {isHistoryDropdownOpen && (
            <div
              ref={historyDropdownRef}
              className="absolute z-50 mt-1 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
            >
              {searchHistory.length > 0 ? (
                searchHistory.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex flex-col items-start p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                    onClick={() => {
                      applyHistoryItem(item);
                      setIsHistoryDropdownOpen(false);
                    }}
                  >
                    <div className="flex flex-wrap gap-1 mb-1 w-full">
                      {item.tags.map((tag) => (
                        <Badge
                          key={tag.tag}
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800"
                        >
                          {tag.tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 w-full">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {item.condition} • {item.result_count} results
                      </span>
                      <span>{formatTimestamp(item.timestamp)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500">
                  No search history available
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* View Mode Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-white dark:bg-gray-800"
              onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
            >
              {currentViewMode.icon}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>

            {isViewModeDropdownOpen && (
              <div
                ref={viewModeDropdownRef}
                className="absolute z-50 right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden"
              >
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setCurrentViewMode(mode);
                      setIsViewModeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                      currentViewMode.id === mode.id
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
      {(selectedTags.length > 0 || selectedCharacter || selectedAuthor) && (
        <div className="flex flex-wrap gap-1 mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.tag}
              className="pl-2 h-6 flex items-center gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200"
            >
              {tag.tag}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full"
                onClick={() => removeTag(tag.tag)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {selectedCharacter && (
            <Badge className="pl-2 h-6 flex items-center gap-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200">
              <Users className="h-3 w-3 mr-1" />
              {selectedCharacter}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full"
                onClick={() => setSelectedCharacter(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {selectedAuthor && (
            <Badge className="pl-2 h-6 flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200">
              <User className="h-3 w-3 mr-1" />
              {selectedAuthor.author_name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full"
                onClick={() => setSelectedAuthor(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Operation Controls */}
      {operationMode && searchResults.length > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={selectAllItems}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1 text-green-500" />
            Select All
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={deselectAllItems}
          >
            <Square className="h-3.5 w-3.5 mr-1 text-red-500" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={handleMove}
            disabled={selectedItems.length === 0}
          >
            <FolderInput className="h-3.5 w-3.5 mr-1 text-blue-500" />
            Move ({selectedItems.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={handleDelete}
            disabled={selectedItems.length === 0 || isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" />
            {isDeleting ? "Deleting..." : `Delete (${selectedItems.length})`}
          </Button>

          <div className="ml-auto text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedItems.length} of {searchResults.length} selected
          </div>
        </div>
      )}

      {/* Results Area */}
      <Card className="flex-1 overflow-hidden border-2 border-gray-200 dark:border-gray-700">
        <ScrollArea className="h-full">
          {searchResults.length > 0 ? (
            currentViewMode.id === "details" ? (
              <div className="w-full">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {operationMode && <th className="w-8 p-2"></th>}
                      <th className="text-left p-2 text-xs font-medium">
                        File
                      </th>
                      <th className="text-left p-2 text-xs font-medium">
                        Location
                      </th>
                      <th className="text-left p-2 text-xs font-medium">
                        Author
                      </th>
                      <th className="text-left p-2 text-xs font-medium">
                        Character
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((result) => (
                      <tr
                        key={result.id}
                        className={cn(
                          "hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700",
                          operationMode &&
                            selectedItems.includes(result.id) &&
                            "bg-blue-100 dark:bg-blue-900/30"
                        )}
                        onClick={() => {
                          if (operationMode) {
                            toggleItemSelection(result.id);
                          } else {
                            openImage(result.id, result.file_name);
                          }
                        }}
                      >
                        {operationMode && (
                          <td className="p-2">
                            {selectedItems.includes(result.id) ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                        )}
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={result.thumbnail_url || "/placeholder.svg"}
                              alt={result.file_name}
                              className="h-8 w-8 object-contain rounded border border-gray-200 dark:border-gray-700"
                            />
                            <span className="text-sm">{result.file_name}</span>
                          </div>
                        </td>
                        <td className="p-2 text-sm text-gray-600 dark:text-gray-300">
                          {result.save_dir}
                        </td>
                        <td className="p-2 text-sm text-gray-600 dark:text-gray-300">
                          {result.author.author_name || "-"}
                        </td>
                        <td className="p-2 text-sm text-gray-600 dark:text-gray-300">
                          {result.character || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`grid ${currentViewMode.gridCols} gap-3 p-3`}>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-md border hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer",
                      operationMode &&
                        selectedItems.includes(result.id) &&
                        "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
                      !selectedItems.includes(result.id) &&
                        "border-gray-200 dark:border-gray-700"
                    )}
                    onClick={() => {
                      if (operationMode) {
                        toggleItemSelection(result.id);
                      } else {
                        openImage(result.id, result.file_name);
                      }
                    }}
                  >
                    {operationMode && (
                      <div className="self-start mb-1">
                        {selectedItems.includes(result.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    )}
                    <img
                      src={result.thumbnail_url || "/placeholder.svg"}
                      alt={result.file_name}
                      className={`object-contain mb-1 rounded border border-gray-200 dark:border-gray-700 ${currentViewMode.size}`}
                    />
                    <span className="text-xs text-center truncate w-full">
                      {result.file_name}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
              <Search className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-base">Select tags and search to see results</p>
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Add status bar at the bottom */}
      {searchResults.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div>{searchResults.length} items</div>
          <div className="flex items-center gap-2">
            <span>View: {currentViewMode.name}</span>
            <span className="text-gray-400">|</span>
            <span>Ctrl+Mouse wheel or Ctrl+/- to change view</span>
          </div>
        </div>
      )}

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Move {selectedItems.length} files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Destination Folder</Label>
              <div className="flex gap-2">
                <Input
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  placeholder="C:/Path/To/Destination"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  onClick={handleSelectFolder}
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmMove}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Move Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Delete Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete {selectedItems.length} file(s)?
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
