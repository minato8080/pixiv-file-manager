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
import { UniqueTagList } from "@/bindings/UniqueTagList";
import { SearchResult } from "@/bindings/SearchResult";
import { SearchHistory } from "@/bindings/SearchHistory";
import { AuthorInfo } from "@/bindings/AuthorInfo";
import { DropdownHandle, ForwardedFilterDropdown, Item } from "./dropdown";
import { AuthorDropdown, CharacterDropdown } from "./types/app-types";
import {
  CharacterNameDialog,
  CharacterNameDialogHandle,
} from "./CharacterNameDialog";

export default function TagsSearcher() {
  // State
  const [searchCondition, setSearchCondition] = useState<"AND" | "OR">("AND");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [operationMode, setOperationMode] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetFolder, setTargetFolder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const characterNameDialogRef = useRef<CharacterNameDialogHandle>(null);

  // State for dropdown
  const [selectedTags, setSelectedTags] = useState<UniqueTagList[]>([]);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterDropdown | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorDropdown | null>(
    null
  );
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);

  // Refs for dropdown
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(
    VIEW_MODES[0]
  );

  const tagDropdownHandlerRef =
    useRef<DropdownHandle<UniqueTagList & Item>>(null);
  const charaDropdownHandlerRef =
    useRef<DropdownHandle<CharacterDropdown>>(null);
  const authorDropdownHandlerRef =
    useRef<DropdownHandle<AuthorInfo & Item>>(null);

  // データベースからタグ、キャラクター、著者、検索履歴を取得するハンドラ
  const fetchTags = async () => {
    try {
      const tags = await invoke<UniqueTagList[]>("get_unique_tag_list");
      tagDropdownHandlerRef.current?.setAvailableItems(
        tags.map((t) => ({ id: t.tag, label: t.tag, ...t }))
      );
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const characters = await invoke<string[]>("get_unique_characters");
      charaDropdownHandlerRef.current?.setAvailableItems(
        characters.map((character) => ({
          id: character,
          label: character,
          character,
        }))
      );
    } catch (error) {
      console.error("Error fetching characters:", error);
    }
  };

  const fetchAuthors = async () => {
    try {
      const authors = await invoke<AuthorInfo[]>("get_unique_authors");
      authorDropdownHandlerRef.current?.setAvailableItems(
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
      setSearchHistory(history);
    } catch (error) {
      console.error("Error fetching search history:", error);
    }
  };

  // useEffectでハンドラを呼び出す
  useEffect(() => {
    fetchTags();
    fetchCharacters();
    fetchAuthors();
    fetchSearchHistory();
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

  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([]);
    setSearchCondition("AND");
    setSelectedCharacter(null);
    setSelectedAuthor(null);
  };

  // Perform search
  const handleSearch = () => {
    if (!selectedTags) return;
    if (selectedTags.length === 0 && !selectedCharacter && !selectedAuthor) {
      return;
    } else {
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
    }
  };

  // Apply history item
  const applyHistoryItem = (history: SearchHistory) => {
    setSelectedTags(history.tags.map((tag) => ({ tag, count: 0 })));
    setSelectedCharacter(
      history.character
        ? {
            id: history.character,
            label: history.character,
            character: history.character,
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
    setIsHistoryDropdownOpen(false);
  };

  // Toggle item selection
  const toggleItemSelection = (fileName: string) => {
    if (operationMode) {
      setSelectedFiles((prev) =>
        prev.includes(fileName)
          ? prev.filter((p) => p !== fileName)
          : [...prev, fileName]
      );
    }
  };

  // Select all items
  const selectAllItems = () => {
    setSelectedFiles(searchResults.map((item) => item.file_name));
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedFiles([]);
  };

  // Handle move operation
  const handleMove = () => {
    if (selectedFiles.length === 0) return;
    setShowMoveDialog(true);
  };

  // Confirm move operation
  const confirmMove = async () => {
    try {
      // Invoke to Rust backend
      await invoke("move_files", {
        fileNames: selectedFiles,
        targetFolder: targetFolder,
      });
      console.log(`Moving ${selectedFiles.length} files to ${targetFolder}`);
    } catch (error) {
      console.error("Error moving files:", error);
      return;
    } finally {
      setShowMoveDialog(false);
    }

    const folderName = targetFolder.split("\\").pop() ?? "";
    // open dialog
    characterNameDialogRef.current?.open(selectedFiles, folderName);

    handleSearch();
  };

  const handleLabel = async (name: string, selectedFiles: string[]) => {
    await invoke("label_character_name", {
      fileNames: selectedFiles,
      characterName: name,
    });
    await fetchCharacters();
    handleSearch();
  };

  // Handle delete operation
  const handleDelete = () => {
    if (selectedFiles.length === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Invoke to Rust backend
      await invoke("delete_files", {
        fileIds: selectedFiles,
      });
      console.log(`Deleting ${selectedFiles.length} files`);

      // Remove deleted items from search results
      setSearchResults(
        searchResults.filter(
          (result) => !selectedFiles.includes(result.file_name)
        )
      );
      setSelectedFiles([]);
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
        {/* Tags Dropdown */}
        <ForwardedFilterDropdown
          mode="multiple"
          ButtonIcon={<Filter className="h-4 w-4 mr-1 text-blue-500" />}
          buttonText={"Tag"}
          selectedItem={selectedTags.map((tag) => ({
            id: tag.tag,
            label: tag.tag,
            ...tag,
          }))}
          setSelectedItem={(items) => {
            setSelectedTags(items.map((item) => ({ ...item })));
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
              className="absolute z-50 mt-1 w-80 max-h-64 overflow-auto bg-white dark:bg-gray-800 rounded-md shadow-lg border"
            >
              {searchHistory.length > 0 ? (
                searchHistory.map((item) => (
                  <button
                    key={item.timestamp}
                    className="w-full flex flex-col items-start p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                    onClick={() => {
                      applyHistoryItem(item);
                      setIsHistoryDropdownOpen(false);
                    }}
                  >
                    <div className="flex flex-wrap gap-1 mb-1 w-full ">
                      {item.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {item.character && (
                        <Badge
                          key={item.character}
                          variant="outline"
                          className="text-xs bg-purple-50 text-purple-500 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800"
                        >
                          {item.character}
                        </Badge>
                      )}
                      {item.author && (
                        <Badge
                          key={item.author?.author_id}
                          variant="outline"
                          className="text-xs bg-green-50 text-green-500 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800"
                        >
                          {item.author?.author_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 w-full">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {item.condition} • {item.result_count} results
                      </span>
                      <span>{item.timestamp}</span>
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
                onClick={() =>
                  tagDropdownHandlerRef.current?.removeItem(tag.tag)
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {selectedCharacter && (
            <Badge className="pl-2 h-6 flex items-center gap-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200">
              <Users className="h-3 w-3 mr-1" />
              {selectedCharacter.character}
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
            disabled={selectedFiles.length === 0}
          >
            <FolderInput className="h-3.5 w-3.5 mr-1 text-blue-500" />
            Move ({selectedFiles.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={handleDelete}
            disabled={selectedFiles.length === 0 || isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" />
            {isDeleting ? "Deleting..." : `Delete (${selectedFiles.length})`}
          </Button>

          <div className="ml-auto text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedFiles.length} of {searchResults.length} selected
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
                            selectedFiles.includes(result.file_name) &&
                            "bg-blue-100 dark:bg-blue-900/30"
                        )}
                        onClick={() => {
                          if (operationMode) {
                            toggleItemSelection(result.file_name);
                          } else {
                            openImage(result.id, result.file_name);
                          }
                        }}
                      >
                        {operationMode && (
                          <td className="p-2">
                            {selectedFiles.includes(result.file_name) ? (
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
                        selectedFiles.includes(result.file_name) &&
                        "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
                      !selectedFiles.includes(result.file_name) &&
                        "border-gray-200 dark:border-gray-700"
                    )}
                    onClick={() => {
                      if (operationMode) {
                        toggleItemSelection(result.file_name);
                      } else {
                        openImage(result.id, result.file_name);
                      }
                    }}
                  >
                    {operationMode && (
                      <div className="self-start mb-1">
                        {selectedFiles.includes(result.file_name) ? (
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
        <div className="flex items-center justify-between text-xs text-gray-500 p-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div>{searchResults.length} items</div>
        </div>
      )}

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Move {selectedFiles.length} files</DialogTitle>
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
              Are you sure you want to delete {selectedFiles.length} file(s)?
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

      {/* Character Name Input Dialog */}
      <CharacterNameDialog
        onSubmit={handleLabel}
        ref={characterNameDialogRef}
      />
    </div>
  );
}
