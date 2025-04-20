import { listen } from "@tauri-apps/api/event";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ProcessStats } from "@/bindings/ProcessStats";
import { TagProgress } from "@/bindings/TagProgress";
import { FileCounts } from "@/bindings/FileCounts";

export default function TagsFetcher() {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [fileCounts, setFileCounts] = useState<FileCounts>({
    folders: [],
    total: 0,
    processing_time: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<TagProgress>({
    success: 0,
    fail: 0,
    current: 0,
    total: 0,
  });
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [showFailedDetails, setShowFailedDetails] = useState(false);

  listen<TagProgress>("tag_progress", (event) => {
    setProgress(event.payload);
  });

  // Function to select folders
  const selectFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select folders containing images",
      });
      if (!selected) return;

      const filesCounts: FileCounts = await invoke("count_files_in_dir", {
        dirPaths: selected,
      });
      setFileCounts(filesCounts);

      if (Array.isArray(selected)) {
        setSelectedFolders(selected);
      } else if (selected !== null) {
        setSelectedFolders([selected]);
      }
    } catch (error) {
      console.error("Error selecting folders:", error);
    }
  };

  // Clear selected folders
  const clearSelection = () => {
    setSelectedFolders([]);
    setStats(null);
  };

  // Function to start processing
  const startProcessing = async () => {
    if (selectedFolders.length === 0) return;

    setIsProcessing(true);
    setProgress({
      success: 0,
      fail: 0,
      current: 0,
      total: 0,
    });
    setStats(null);

    try {
      const result = await invoke<ProcessStats>(
        "process_capture_illust_detail",
        {
          folders: selectedFolders,
        }
      );

      setStats(result);
    } catch (error) {
      console.error("Error processing tags:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Control buttons at top */}
      <div className="flex items-center gap-2 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
        <Button
          onClick={selectFolders}
          disabled={isProcessing}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <FolderOpen className="h-4 w-4" />
          Add Folders
        </Button>

        <Button
          variant="outline"
          onClick={clearSelection}
          disabled={isProcessing || selectedFolders.length === 0}
          className="bg-white dark:bg-gray-800"
        >
          <Trash2 className="h-4 w-4 mr-1 text-red-500" />
          Clear Selection
        </Button>

        <Button
          variant="default"
          onClick={startProcessing}
          disabled={isProcessing || selectedFolders.length === 0}
          className="ml-auto bg-blue-600 hover:bg-blue-700"
        >
          <Play className="h-4 w-4 mr-1" />
          {isProcessing ? "Processing..." : "Process Tags"}
        </Button>
      </div>

      {/* Selected folders */}
      <Card className="flex-1 overflow-hidden border-2 border-gray-200 dark:border-gray-700">
        <ScrollArea className="h-full">
          {selectedFolders.length > 0 ? (
            <div className="p-3 space-y-3">
              {selectedFolders.map((folder, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 text-sm border-b pb-2 border-gray-200 dark:border-gray-700"
                >
                  <div className="truncate flex-1">
                    <p
                      className="font-medium truncate text-blue-700 dark:text-blue-300"
                      title={folder}
                    >
                      {folder}
                    </p>
                    {fileCounts && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <Badge
                          variant="outline"
                          className="h-5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                        >
                          {fileCounts.folders[index].base_count} files
                        </Badge>
                        <Badge
                          variant="outline"
                          className="h-5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                        >
                          {fileCounts.folders[index].sub_dir_count} in
                          subdirectories
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {fileCounts && (
                <div className="flex items-center justify-between pt-2 border-t mt-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Total:</span>
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    >
                      {fileCounts.total} files
                    </Badge>
                  </div>
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Est. processing time: {fileCounts.processing_time}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500">
              <div className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No folders selected</p>
                <p className="text-sm text-gray-400 mt-1">
                  Click "Add Folders" to begin
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Processing progress */}
      {isProcessing && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium">Processing images...</span>
            <span>
              {progress.current} / {progress.total || "?"}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : "30%",
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Results */}
      {stats && !isProcessing && (
        <Card className="mt-3 p-3 border-2 border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {stats.total_files}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Files Processed
              </div>
            </div>
            <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {stats.failed_files}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                Failed Files
              </div>
            </div>
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {(Number(stats.processing_time_ms) / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Processing Time
              </div>
            </div>
          </div>

          {stats.failed_files > 0 && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFailedDetails(!showFailedDetails)}
                className="w-full justify-between bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30"
              >
                Failed Files
                <Badge variant="destructive">{stats.failed_files}</Badge>
              </Button>

              {showFailedDetails && (
                <ScrollArea className="h-[100px] mt-2 border rounded-md border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                  <div className="p-2">
                    {stats.failed_file_paths.map((path, index) => (
                      <div
                        key={index}
                        className="text-xs truncate py-1 text-red-700 dark:text-red-300"
                        title={path}
                      >
                        {path}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
