import { ScrollArea } from "@radix-ui/react-scroll-area";
import { CheckSquare, Square, Search } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import type { SearchResult } from "@/bindings/SearchResult";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VIEW_MODES } from "@/src/constants";
import { useClickHandler } from "@/src/hooks/useClickHandler";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const TagsSearcherResultArea = () => {
  const {
    searchResults,
    currentViewMode,
    operationMode,
    setOperationMode,
    toggleItemSelection,
    showImage,
    selectedFiles,
    isQuickReload,
    selectedImage,
    setSelectedFiles,
  } = useTagSearcherStore();

  const [delayedSearchResults, setDelayedSearchResults] = useState<
    SearchResult[]
  >([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const anchorIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedImage) {
      containerRef.current?.focus();
    }
  }, [searchResults, selectedImage]);

  useEffect(() => {
    if (isQuickReload.current) {
      setDelayedSearchResults(searchResults);
      isQuickReload.current = false;
      return;
    }

    setDelayedSearchResults([]);
    // 遅延読み込み
    const updateResultsInBatches = (results: SearchResult[]) => {
      let index = 0;
      const batchSize = 10; // N件ずつ処理
      const delay = 1000; // N秒間隔で処理

      const processBatch = () => {
        const batch = results.slice(index, index + batchSize);

        setDelayedSearchResults((prevResults) => [...prevResults, ...batch]);

        index += batchSize;

        // 全ての結果を処理し終えたら停止
        if (index < results.length) {
          timeoutId.current = setTimeout(processBatch, delay);
        }
      };

      processBatch();
    };
    updateResultsInBatches(searchResults);

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults]);

  useEffect(() => {
    const element = itemRefs.current.get(focusedIndex);
    if (element) {
      element.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (delayedSearchResults.length === 0) return;

    const isGrid = currentViewMode !== "details";
    let cols = 1; // Default to 1 for details view

    if (isGrid && gridRef.current) {
      const style = getComputedStyle(gridRef.current);
      const gridCols = style.gridTemplateColumns.split(" ").length;
      cols = gridCols > 0 ? gridCols : 1;
    }

    let newIndex = focusedIndex;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        newIndex = Math.min(
          focusedIndex + cols,
          delayedSearchResults.length - 1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        newIndex = Math.max(focusedIndex - cols, 0);
        break;
      case "ArrowRight":
        if (isGrid) {
          e.preventDefault();
          newIndex = Math.min(
            focusedIndex + 1,
            delayedSearchResults.length - 1
          );
        }
        break;
      case "ArrowLeft":
        if (isGrid) {
          e.preventDefault();
          newIndex = Math.max(focusedIndex - 1, 0);
        }
        break;
      case "Enter":
      case " ":
        if (isGrid) {
          e.preventDefault();
          showImage(searchResults[focusedIndex].file_name);
        }
        break;
      default:
        return;
    }

    setFocusedIndex(newIndex);

    if (operationMode) {
      if (e.shiftKey && anchorIndex.current !== null) {
        // Shift + Arrow: extend selection
        const start = Math.min(anchorIndex.current, newIndex);
        const end = Math.max(anchorIndex.current, newIndex);
        const range = delayedSearchResults.slice(start, end + 1);
        setSelectedFiles(range);
      } else {
        // Arrow only: move selection
        anchorIndex.current = newIndex;
        setSelectedFiles([delayedSearchResults[newIndex]]);
      }
    }
  };

  /** item クリック処理 */
  const onClick = (
    e: React.MouseEvent,
    result: SearchResult,
    index: number
  ) => {
    containerRef.current?.focus();

    if (!operationMode) {
      showImage(result.file_name);
      setFocusedIndex(index);
      return;
    }

    if (e.shiftKey && anchorIndex.current !== null) {
      // Shift + Click: select range from anchor to current
      e.preventDefault();
      const start = Math.min(anchorIndex.current, index);
      const end = Math.max(anchorIndex.current, index);
      const range = delayedSearchResults.slice(start, end + 1);
      setSelectedFiles(range);
    } else {
      // Ctrl/Cmd + Click: toggle individual item
      e.preventDefault();
      toggleItemSelection(result);
      anchorIndex.current = index;
    }

    setFocusedIndex(index);
  };

  const onDoubleClick = (
    _e: React.MouseEvent,
    result: SearchResult,
    index: number
  ) => {
    if (operationMode) {
      showImage(result.file_name);
    } else {
      setOperationMode(true);
      setSelectedFiles([result]);
      setFocusedIndex(index);
    }
  };

  const handleClick = useClickHandler({
    onClick,
    onDoubleClick,
  });

  const renderDetails = () => {
    return (
      <div className="w-full select-none">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
            <tr>
              {operationMode && <th className="w-8 p-2"></th>}
              <th className="text-left p-2 text-xs font-medium">File</th>
              <th className="text-left p-2 text-xs font-medium">Location</th>
              <th className="text-left p-2 text-xs font-medium">Author</th>
              <th className="text-left p-2 text-xs font-medium">Character</th>
              <th className="text-left p-2 text-xs font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {delayedSearchResults.map((result, index) => (
              <tr
                key={result.file_name}
                ref={(el) => {
                  if (el) itemRefs.current.set(index, el);
                  else itemRefs.current.delete(index);
                }}
                className={cn(
                  "hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700 cursor-pointer",
                  operationMode &&
                    selectedFiles.includes(result) &&
                    "bg-blue-100 dark:bg-blue-900/30",
                  focusedIndex === index && "bg-blue-100"
                )}
                onClick={(e) => handleClick(e, result, index)}
              >
                {operationMode && (
                  <td className="p-2">
                    {selectedFiles.includes(result) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </td>
                )}
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={result.thumbnail_url || "./placeholder.svg"}
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
                  {result.author_name}
                </td>
                <td className="p-2 text-sm text-gray-600 dark:text-gray-300">
                  {result.character ?? "-"}
                </td>
                <td className="p-2 text-sm text-gray-600 dark:text-gray-300">
                  {result.tags ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderGdid = () => {
    return (
      <div
        ref={gridRef}
        className={`grid ${VIEW_MODES[currentViewMode].gridStyle} gap-1 p-2 select-none`}
      >
        {delayedSearchResults.map((result, index) => (
          <div
            key={result.file_name}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            className={cn(
              "flex flex-col items-center p-1 rounded-md border hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer",
              operationMode &&
                selectedFiles.includes(result) &&
                "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
              !selectedFiles.includes(result) &&
                "border-gray-200 dark:border-gray-700",
              focusedIndex === index && "ring-2 ring-blue-400"
            )}
            onClick={(e) => handleClick(e, result, index)}
          >
            {operationMode && (
              <div className="self-start mb-1">
                {selectedFiles.includes(result) ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
              </div>
            )}
            <img
              src={result.thumbnail_url || "./placeholder.svg"}
              alt={result.file_name}
              className={`object-contain mb-1 rounded border border-gray-200 dark:border-gray-700 ${VIEW_MODES[currentViewMode].size}`}
            />
            <span className="text-xs text-center truncate w-full">
              {result.file_name}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card
      className="flex-1 overflow-hidden border-2 border-gray-200 dark:border-gray-700 focus:outline-none"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <ScrollArea className="h-full overflow-auto focus:outline-none">
        {delayedSearchResults.length > 0 ? (
          currentViewMode === "details" ? (
            renderDetails()
          ) : (
            renderGdid()
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
            <Search className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-base">Select tags and search to see results</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
