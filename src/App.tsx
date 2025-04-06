"use client"

import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { TagSelector } from "./components/TagSelector"
import { TagList } from "./components/TagList"
import { SearchCondition } from "./components/SearchCondition"
import { ExplorerView } from "./components/ExplorerView"
import { SearchHistory } from "./components/SearchHistory"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

// Types
export type Tag = {
  id: number
  name: string
}

export type SearchHistoryItem = {
  id: number
  tags: Tag[]
  condition: "AND" | "OR"
  timestamp: string
}

export type SearchResult = {
  id: number
  title: string
  thumbnailPath: string
}

function App() {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [searchCondition, setSearchCondition] = useState<"AND" | "OR">("AND")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch all tags from database on component mount
  useEffect(() => {
    fetchTags()
    loadSearchHistory()
  }, [])

  const fetchTags = async () => {
    try {
      const tags = await invoke<Tag[]>("get_all_tags")
      setAllTags(tags)
    } catch (error) {
      console.error("Failed to fetch tags:", error)
    }
  }

  const loadSearchHistory = async () => {
    try {
      const history = await invoke<SearchHistoryItem[]>("get_search_history")
      setSearchHistory(history)
    } catch (error) {
      console.error("Failed to load search history:", error)
    }
  }

  const handleAddTag = (tag: Tag) => {
    if (!selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleRemoveTag = (tagId: number) => {
    setSelectedTags(selectedTags.filter((tag) => tag.id !== tagId))
  }

  const handleSearch = async () => {
    if (selectedTags.length === 0) return

    setIsLoading(true)
    try {
      const results = await invoke<SearchResult[]>("search_by_tags", {
        tagIds: selectedTags.map((tag) => tag.id),
        condition: searchCondition,
      })

      setSearchResults(results)

      // Save to search history
      const newHistoryItem: SearchHistoryItem = {
        id: Date.now(),
        tags: [...selectedTags],
        condition: searchCondition,
        timestamp: new Date().toISOString(),
      }

      const updatedHistory = [newHistoryItem, ...searchHistory].slice(0, 10)
      setSearchHistory(updatedHistory)
      await invoke("save_search_history", { history: updatedHistory })
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyHistorySearch = (historyItem: SearchHistoryItem) => {
    setSelectedTags(historyItem.tags)
    setSearchCondition(historyItem.condition)
    // Trigger search with a slight delay to allow state updates
    setTimeout(handleSearch, 100)
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Explorer Search</h1>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-6">
          <div className="border rounded-lg p-4 space-y-4">
            <h2 className="text-lg font-medium">Search Options</h2>

            <TagSelector allTags={allTags} onSelectTag={handleAddTag} />

            <TagList selectedTags={selectedTags} onRemoveTag={handleRemoveTag} />

            <SearchCondition condition={searchCondition} onChangeCondition={setSearchCondition} />

            <Button className="w-full" onClick={handleSearch} disabled={selectedTags.length === 0 || isLoading}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          <SearchHistory history={searchHistory} onSelectHistory={applyHistorySearch} />
        </div>

        <ExplorerView results={searchResults} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default App

