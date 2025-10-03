import { ChevronDown, History } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOutsideClose } from "@/src/hooks/useOutsideClose";
import { SearchHistory, useHistoryStore } from "@/src/stores/history-store";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const DropdownHistory = () => {
  const { searchHistory } = useHistoryStore();
  const [isOpen, setIsOpen] = useState(false);

  const {
    setSelectedTags,
    setSelectedCharacter,
    setSelectedAuthor,
    setSearchId,
  } = useTagSearcherStore();

  const dropdownRef = useOutsideClose<HTMLDivElement>({
    onClose: () => setIsOpen(false),
    enabled: isOpen,
  });

  // Apply history item
  const applyHistoryItem = (history: SearchHistory) => {
    setSelectedTags(history.tags.map((tag) => ({ tag, count: 0 })));
    setSelectedCharacter(
      history.character
        ? {
            character: history.character,
            count: null,
          }
        : null
    );
    setSelectedAuthor(history.author);
    if (history.id) setSearchId(history.id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 bg-white dark:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <History className="h-4 w-4 mr-1 text-purple-500" />
        History
        <ChevronDown className="h-4 w-4 ml-1" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 max-h-64 overflow-auto bg-white dark:bg-gray-800 rounded-md shadow-lg border">
          {searchHistory.length > 0 ? (
            searchHistory.map((item) => (
              <button
                key={item.timestamp}
                className="w-full flex flex-col items-start p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                onClick={() => {
                  applyHistoryItem(item);
                  setIsOpen(false);
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
                  {item.id && (
                    <Badge
                      key={item.id}
                      variant="outline"
                      className="text-xs bg-green-50 text-green-500 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800"
                    >
                      {item.id}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 w-full">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {item.count} results
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
  );
};
DropdownHistory.displayName = "DropdownHistory";
