import { ScrollArea } from "@radix-ui/react-scroll-area";
import { CheckSquare, Square, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SearchResult } from "@/bindings/SearchResult";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VIEW_MODES } from "@/src/constants";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const TagsSearcherResultArea = () => {
  const [innerSearchResults, setInnerSearchResults] = useState<SearchResult[]>(
    []
  );

  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const {
    searchResults,
    selectedFiles,
    setSelectedFiles,
    operationMode,
    currentViewMode,
    setSelectedImage,
  } = useTagSearcherStore();

  useEffect(() => {
    if (searchResults.length === 0) return;
    if (timeoutId.current) clearTimeout(timeoutId.current);

    setInnerSearchResults([]);
    // 遅延読み込み
    const updateResultsInBatches = (results: SearchResult[]) => {
      let index = 0;
      const batchSize = 10; // N件ずつ処理
      const delay = 1000; // N秒間隔で処理

      const processBatch = () => {
        // 50件ずつ取り出してURL変換
        const batch = results.slice(index, index + batchSize);

        // searchResultsに追加
        setInnerSearchResults((prevResults) => [...prevResults, ...batch]);

        index += batchSize;

        // 全ての結果を処理し終えたら停止
        if (index < results.length) {
          timeoutId.current = setTimeout(processBatch, delay);
        }
      };

      // 最初のバッチを処理開始
      processBatch();
    };
    updateResultsInBatches(searchResults);
  }, [searchResults]);

  // Toggle item selection
  const toggleItemSelection = (fileName: SearchResult) => {
    if (operationMode) {
      setSelectedFiles(
        selectedFiles.includes(fileName)
          ? selectedFiles.filter((p) => p !== fileName)
          : [...selectedFiles, fileName]
      );
    }
  };

  return (
    <Card className="flex-1 overflow-hidden border-2 border-gray-200 dark:border-gray-700">
      <ScrollArea className="h-full overflow-auto">
        {innerSearchResults.length > 0 ? (
          currentViewMode === "details" ? (
            <div className="w-full">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {operationMode && <th className="w-8 p-2"></th>}
                    <th className="text-left p-2 text-xs font-medium">File</th>
                    <th className="text-left p-2 text-xs font-medium">
                      Location
                    </th>
                    <th className="text-left p-2 text-xs font-medium">
                      Author
                    </th>
                    <th className="text-left p-2 text-xs font-medium">
                      Character
                    </th>
                    <th className="text-left p-2 text-xs font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {innerSearchResults.map((result) => (
                    <tr
                      key={result.file_name}
                      className={cn(
                        "hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700",
                        operationMode &&
                          selectedFiles.includes(result) &&
                          "bg-blue-100 dark:bg-blue-900/30"
                      )}
                      onClick={() => {
                        if (operationMode) {
                          toggleItemSelection(result);
                        } else {
                          setSelectedImage(result.file_name);
                        }
                      }}
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
          ) : (
            <div
              className={`grid ${VIEW_MODES[currentViewMode].gridCols} gap-1 p-2`}
            >
              {innerSearchResults.map((result) => (
                <div
                  key={result.file_name}
                  className={cn(
                    "flex flex-col items-center p-1 rounded-md border hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer",
                    operationMode &&
                      selectedFiles.includes(result) &&
                      "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
                    !selectedFiles.includes(result) &&
                      "border-gray-200 dark:border-gray-700"
                  )}
                  onClick={() => {
                    if (operationMode) {
                      toggleItemSelection(result);
                    } else {
                      setSelectedImage(result.file_name);
                    }
                  }}
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
                    src={result.thumbnail_url || "/placeholder.svg"}
                    alt={result.file_name}
                    className={`object-contain mb-1 rounded border border-gray-200 dark:border-gray-700 ${VIEW_MODES[currentViewMode].size}`}
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
  );
};
