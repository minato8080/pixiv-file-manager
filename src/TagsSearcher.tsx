"use client"

import type React from "react"
import { invoke } from "@tauri-apps/api/core"
import { useState, useEffect, useRef } from "react"
import {
  X,
  Search,
  Clock,
  Filter,
  ChevronDown,
  Trash2,
  Grid,
  List,
  LayoutGrid,
  Maximize2,
  FolderInput,
  CheckSquare,
  Square,
  Folder,
} from "lucide-react"

// Types
interface GetUniqueTagListResp {
  tag: string
  count: number
}

interface SearchHistory {
  id: number
  tags: GetUniqueTagListResp[]
  condition: "AND" | "OR"
  timestamp: Date
}

interface SearchResult {
  id: number
  suffix: number | null
  author: string | null
  character: string | null
  save_dir: string | null
  file_name: string
  thumbnail_url: string
}

interface ViewMode {
  id: string
  name: string
  icon: React.ReactNode
  gridCols: string
  size: string
}

const TagsSearcher: React.FC = () => {
  // State
  const [availableTags, setAvailableTags] = useState<GetUniqueTagListResp[]>([])
  const [selectedTags, setSelectedTags] = useState<GetUniqueTagListResp[]>([])
  const [searchCondition, setSearchCondition] = useState<"AND" | "OR">("AND")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [operationMode, setOperationMode] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showMoveConfirmation, setShowMoveConfirmation] = useState(false)
  const [movedCount, setMovedCount] = useState(0)
  const [targetFolder, setTargetFolder] = useState("")

  // View mode state
  const viewModes: ViewMode[] = [
    {
      id: "large",
      name: "Large Icons",
      icon: <Maximize2 className="w-4 h-4" />,
      gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
      size: "aspect-square",
    },
    {
      id: "medium",
      name: "Medium Icons",
      icon: <LayoutGrid className="w-4 h-4" />,
      gridCols: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
      size: "aspect-square",
    },
    {
      id: "small",
      name: "Small Icons",
      icon: <Grid className="w-4 h-4" />,
      gridCols: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12",
      size: "h-16 w-16",
    },
    {
      id: "details",
      name: "Details",
      icon: <List className="w-4 h-4" />,
      gridCols: "",
      size: "h-10 w-10",
    },
  ]
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewModes[0])

  // Refs for click outside detection
  const historyRef = useRef<HTMLDivElement>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const tagButtonRef = useRef<HTMLButtonElement>(null)

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close history dropdown when clicking outside
      if (
        isHistoryOpen &&
        historyRef.current &&
        !historyRef.current.contains(event.target as Node) &&
        historyButtonRef.current &&
        !historyButtonRef.current.contains(event.target as Node)
      ) {
        setIsHistoryOpen(false)
      }

      // Close tag dropdown when clicking outside
      if (
        isTagDropdownOpen &&
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node) &&
        tagButtonRef.current &&
        !tagButtonRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isHistoryOpen, isTagDropdownOpen])

  // Handle keyboard and wheel events for view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault()
          changeViewMode("larger")
        } else if (e.key === "-") {
          e.preventDefault()
          changeViewMode("smaller")
        }
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          changeViewMode("larger")
        } else {
          changeViewMode("smaller")
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("wheel", handleWheel)
    }
  }, [currentViewMode])

  // Change view mode (larger or smaller)
  const changeViewMode = (direction: "larger" | "smaller") => {
    const currentIndex = viewModes.findIndex((mode) => mode.id === currentViewMode.id)
    let newIndex

    if (direction === "larger") {
      newIndex = Math.max(0, currentIndex - 1)
    } else {
      newIndex = Math.min(viewModes.length - 1, currentIndex + 1)
    }

    setCurrentViewMode(viewModes[newIndex])
  }

  // Fetch tags from database (mock implementation)
  useEffect(() => {
    const fetchTags = async () => {
      const tags = await invoke<GetUniqueTagListResp[]>("get_unique_tag_list")
      setAvailableTags(tags)
      console.log(tags)
    }

    fetchTags()
  }, [])

  // Add tag to selected tags
  const addTag = (tag: GetUniqueTagListResp) => {
    if (!selectedTags.some((t) => t.tag === tag.tag)) {
      setSelectedTags([...selectedTags, tag])
    }
    setIsTagDropdownOpen(false)
  }

  // Remove tag from selected tags
  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((param) => param.tag !== tag))
  }

  // Clear all search conditions
  const clearSearchConditions = () => {
    setSelectedTags([])
    setSearchCondition("AND")
  }

  // Perform search
  const handleSearch = () => {
    if (selectedTags.length === 0) return

    // Mock search results
    const mockResults: SearchResult[] = Array(20)
      .fill(null)
      .map((_, index) => ({
        id: index,
        suffix: null,
        author: index % 3 === 0 ? "Author " + (index % 5) : null,
        character: index % 4 === 0 ? "Character " + (index % 6) : null,
        save_dir: `C:/Users/Documents/Images/Folder${index % 5}`,
        file_name: `Result_${index + 1}.png`,
        thumbnail_url: `/placeholder.svg?height=100&width=100`,
      }))

    setSearchResults(mockResults)
    setSelectedItems([])

    // Add to search history
    const newHistoryItem: SearchHistory = {
      id: Date.now(),
      tags: [...selectedTags],
      condition: searchCondition,
      timestamp: new Date(),
    }

    const updatedHistory = [newHistoryItem, ...searchHistory].slice(0, 10)
    setSearchHistory(updatedHistory)
  }

  // Apply history item
  const applyHistoryItem = (historyItem: SearchHistory) => {
    setSelectedTags(historyItem.tags)
    setSearchCondition(historyItem.condition)
    setIsHistoryOpen(false)
  }

  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return date.toLocaleString()
  }

  // Toggle item selection
  const toggleItemSelection = (id: number) => {
    if (operationMode) {
      setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
    }
  }

  // Select all items
  const selectAllItems = () => {
    setSelectedItems(searchResults.map((item) => item.id))
  }

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItems([])
  }

  // Handle move operation
  const handleMove = () => {
    if (selectedItems.length === 0) return
    setShowMoveDialog(true)
  }

  // Confirm move operation
  const confirmMove = () => {
    setMovedCount(selectedItems.length)
    setShowMoveDialog(false)
    setShowMoveConfirmation(true)
    setSelectedItems([])
  }

  // Open target location
  const openTargetLocation = () => {
    // In a real app, this would open the folder
    console.log(`Opening folder: ${targetFolder}`)
    setShowMoveConfirmation(false)
  }

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
                ref={tagButtonRef}
                className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              >
                <Filter className="w-4 h-4" />
                Select Tags
                <ChevronDown className="w-4 h-4" />
              </button>

              {isTagDropdownOpen && (
                <div
                  ref={tagDropdownRef}
                  className="absolute z-10 mt-1 w-56 max-h-60 overflow-auto bg-white border rounded-md shadow-lg"
                >
                  {availableTags.map((tag) => (
                    <button
                      key={tag.tag}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100"
                      onClick={() => addTag(tag)}
                    >
                      {tag.tag} +{tag.count}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Condition */}
            <div className="flex flex-col">
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

            {/* Clear Button */}
            <button
              className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700"
              onClick={clearSearchConditions}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>

            {/* Search Button */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={handleSearch}
              disabled={selectedTags.length === 0}
            >
              <Search className="w-4 h-4" />
              Search
            </button>

            {/* History Button */}
            <button
              ref={historyButtonRef}
              className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            >
              <Clock className="w-4 h-4" />
              History
            </button>

            <div className="ml-auto flex items-center gap-2">
              {/* View Mode Selector */}
              <div className="flex border rounded-md overflow-hidden">
                {viewModes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`p-2 ${currentViewMode.id === mode.id ? "bg-gray-200" : "bg-white hover:bg-gray-50"}`}
                    onClick={() => setCurrentViewMode(mode)}
                    title={mode.name}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>

              {/* Operation Mode Toggle */}
              <button
                className={`flex items-center gap-2 px-3 py-2 border rounded-md ${
                  operationMode ? "bg-blue-100 border-blue-300" : "hover:bg-gray-50"
                }`}
                onClick={() => setOperationMode(!operationMode)}
              >
                {operationMode ? "Exit Selection" : "Select Files"}
              </button>
            </div>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <div key={tag.tag} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                  {tag.tag}
                  <button className="text-blue-600 hover:text-blue-800" onClick={() => removeTag(tag.tag)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Operation Controls */}
          {operationMode && searchResults.length > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded-md">
              <button
                className="flex items-center gap-1 px-3 py-1 bg-white border rounded-md hover:bg-gray-50"
                onClick={selectAllItems}
              >
                <CheckSquare className="w-4 h-4" />
                Select All
              </button>
              <button
                className="flex items-center gap-1 px-3 py-1 bg-white border rounded-md hover:bg-gray-50"
                onClick={deselectAllItems}
              >
                <Square className="w-4 h-4" />
                Deselect All
              </button>
              <button
                className="flex items-center gap-1 px-3 py-1 bg-white border rounded-md hover:bg-gray-50"
                onClick={handleMove}
                disabled={selectedItems.length === 0}
              >
                <FolderInput className="w-4 h-4" />
                Move Selected ({selectedItems.length})
              </button>
              <span className="ml-auto text-sm text-blue-700">
                {selectedItems.length} of {searchResults.length} selected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search History Dropdown */}
      {isHistoryOpen && (
        <div ref={historyRef} className="absolute top-32 right-4 z-20 w-80 bg-white border rounded-md shadow-lg">
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
                      <span key={tag.tag} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-md">
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
              <div className="p-4 text-center text-gray-500">No search history</div>
            )}
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="flex-1 overflow-auto p-4">
        {searchResults.length > 0 ? (
          currentViewMode.id === "details" ? (
            <div className="bg-white rounded-md shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {operationMode && <th scope="col" className="px-3 py-2 w-10"></th>}
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      File
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Modified
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Size
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Author
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Character
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchResults.map((result) => (
                    <tr
                      key={result.id}
                      className={`hover:bg-gray-50 ${operationMode && selectedItems.includes(result.id) ? "bg-blue-50" : ""}`}
                      onClick={() => toggleItemSelection(result.id)}
                    >
                      {operationMode && (
                        <td className="px-3 py-2">
                          <div className="flex items-center">
                            {selectedItems.includes(result.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <img
                            src={result.thumbnail_url || "/placeholder.svg"}
                            alt={result.file_name}
                            className="h-10 w-10 mr-2 object-cover"
                          />
                          <span className="text-sm">{result.file_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">{new Date().toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{result.save_dir}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{Math.floor(Math.random() * 1000) + 100} KB</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{result.author || "-"}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{result.character || "-"}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {selectedTags
                          .slice(0, 3)
                          .map((t) => t.tag)
                          .join(", ")}
                        {selectedTags.length > 3 ? "..." : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`grid ${currentViewMode.gridCols} gap-4`}>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className={`flex flex-col items-center p-2 bg-white rounded-md shadow-sm hover:shadow-md cursor-pointer ${
                    operationMode && selectedItems.includes(result.id) ? "ring-2 ring-blue-500 bg-blue-50" : ""
                  }`}
                  onClick={() => toggleItemSelection(result.id)}
                >
                  {operationMode && (
                    <div className="self-start mb-1">
                      {selectedItems.includes(result.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  )}
                  <img
                    src={result.thumbnail_url || "/placeholder.svg"}
                    alt={result.file_name}
                    className={`object-cover mb-2 ${currentViewMode.size}`}
                  />
                  <span className="text-sm text-center truncate w-full">{result.file_name}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="w-12 h-12 mb-2" />
            <p>Select tags and search to see results</p>
          </div>
        )}
      </div>

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full">
            <h3 className="text-lg font-medium mb-4">Move {selectedItems.length} files</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border rounded-md px-3 py-2"
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  placeholder="C:/Path/To/Destination"
                />
                <button className="p-2 border rounded-md">
                  <Folder className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-md hover:bg-gray-50" onClick={() => setShowMoveDialog(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" onClick={confirmMove}>
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Confirmation Dialog */}
      {showMoveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full">
            <h3 className="text-lg font-medium mb-4">Files Moved</h3>
            <p className="mb-4">
              {movedCount} files have been moved to {targetFolder || "the selected destination"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                onClick={() => setShowMoveConfirmation(false)}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={openTargetLocation}
              >
                Open Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TagsSearcher
