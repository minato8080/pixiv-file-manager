import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Trash2, Play, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { FileCounts } from "@/bindings/FileCounts";
import type { ProcessStats } from "@/bindings/ProcessStats";
import type { TagProgress } from "@/bindings/TagProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const TAG_PROGRESS_INIT = {
  success: 0,
  fail: 0,
  current: 0,
  total: 0,
  elapsed_time: "00:00:00",
  remaining_time: "00:00:00",
} as const;

export default function TagFetcher() {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [fileCounts, setFileCounts] = useState<FileCounts>({
    folders: [],
    total: 0,
    process_time: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<TagProgress>(TAG_PROGRESS_INIT);
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [showFailedDetails, setShowFailedDetails] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen<TagProgress>("tag_progress", (event) => {
          setProgress(event.payload);
        });
      } catch (error) {
        console.warn("Failed to setup Tauri event listener:", error);
      }
    };
    void setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Function to select folders
  const selectFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select folders containing images",
      });
      if (!selected) return;

      const nextState = [...selectedFolders, ...selected];
      const filesCounts: FileCounts = await invoke("count_files_in_dir", {
        folders: nextState,
      });
      setFileCounts(filesCounts);

      setSelectedFolders(nextState);
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
    setProgress(TAG_PROGRESS_INIT);
    setStats(null);

    try {
      const result = await invoke<ProcessStats>("capture_illust_detail", {
        folders: selectedFolders,
      });

      setStats(result);
    } catch (error) {
      console.error("Error processing tags:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to start processing
  const startRecaputure = async () => {
    setIsProcessing(true);
    setProgress(TAG_PROGRESS_INIT);
    setStats(null);

    try {
      const result = await invoke<ProcessStats>("recapture_illust_detail", {
        folders: selectedFolders,
      });

      setStats(result);
    } catch (error) {
      console.error("Error processing tags:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Control buttons at top */}

      <div className="flex gap-2 p-2 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b border-slate-300 dark:border-slate-600">
        <Button
          onClick={() => void selectFolders()}
          disabled={isProcessing}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <FolderOpen className="h-4 w-4 mr-1" />
          Add Folders
        </Button>

        <Button
          variant="outline"
          onClick={clearSelection}
          disabled={isProcessing || selectedFolders.length === 0}
          size="sm"
          className="border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700 bg-transparent"
        >
          <Trash2 className="h-4 w-4 mr-1 text-red-500" />
          Clear
        </Button>

        <Button
          variant="outline"
          onClick={() => void startRecaputure()}
          disabled={isProcessing}
          size="sm"
          className="border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          <RotateCw className="h-4 w-4 mr-1 text-amber-600" />
          Retry Missing Files
        </Button>
        <Button
          variant="default"
          onClick={() => void startProcessing()}
          disabled={isProcessing || selectedFolders.length === 0}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Play className="h-4 w-4 mr-1" />
          Process Tags
        </Button>
      </div>

      {fileCounts && selectedFolders.length > 0 && (
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-b border-indigo-200 dark:border-indigo-700 p-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Total:
              </span>
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
                {fileCounts.total} files
              </Badge>
            </div>
            <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Est. time: {fileCounts.process_time}
            </div>
          </div>
        </div>
      )}

      <Card className="flex-1 overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 m-2 py-2">
        <ScrollArea className="h-full">
          {selectedFolders.length > 0 ? (
            <div className="p-2 space-y-2">
              {selectedFolders.map((folder, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 text-sm p-2 rounded-md bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"
                >
                  <div className="truncate flex-1 min-w-0">
                    <p
                      className="font-medium truncate text-slate-800 dark:text-slate-200 text-xs"
                      title={folder}
                    >
                      {folder}
                    </p>
                    {fileCounts && (
                      <div className="flex items-center gap-1 mt-1">
                        <Badge
                          variant="outline"
                          className="h-4 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                        >
                          {fileCounts.folders[index]?.base_count || 0} files
                        </Badge>
                        <Badge
                          variant="outline"
                          className="h-4 text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                        >
                          +{fileCounts.folders[index]?.sub_dir_count || 0}{" "}
                          subdirectories
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-500">
              <div className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No folders selected</p>
                <p className="text-sm text-slate-400 mt-1">
                  Click Add Folders to begin
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </Card>

      {isProcessing && (
        <div className="mx-2 mb-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-md border border-blue-200 dark:border-blue-700">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Processing...
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {progress.current} / {progress.total || "?"}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : "0%",
              }}
            ></div>
          </div>

          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span>Elapsed: {progress.elapsed_time}</span>
              <span>Remaining: {progress.remaining_time}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ {progress.success}
              </span>
              <span className="text-red-600 dark:text-red-400">
                ✗ {progress.fail}
              </span>
            </div>
          </div>
        </div>
      )}

      {stats && !isProcessing && (
        <Card className="mx-2 mb-2 p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-md bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border border-emerald-200 dark:border-emerald-700">
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {stats.total_ids}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                Processed
              </div>
            </div>
            <div className="p-2 rounded-md bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border border-emerald-200 dark:border-emerald-700">
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {stats.successed_ids}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                Successed
              </div>
            </div>
            <div className="p-2 rounded-md bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border border-red-200 dark:border-red-700">
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {stats.failed_ids}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                Failed
              </div>
            </div>
            <div className="p-2 rounded-md bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border border-red-200 dark:border-red-700">
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {stats.duplicated_files}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                Duplicated
              </div>
            </div>
            <div className="p-2 rounded-md bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 border border-indigo-200 dark:border-indigo-700">
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                {stats.process_time}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400">
                Duration
              </div>
            </div>
          </div>

          {stats.failed_ids > 0 && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFailedDetails(!showFailedDetails)}
                className="w-full justify-between bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/30"
              >
                Failed Files Details
                <Badge variant="destructive" className="bg-red-600">
                  {stats.failed_ids}
                </Badge>
              </Button>

              {showFailedDetails && (
                <ScrollArea className="h-[80px] mt-2 border rounded-md border-red-200 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10">
                  <div className="p-2">
                    {stats.failed_file_paths.map((path, index) => (
                      <div
                        key={index}
                        className="text-xs truncate py-0.5 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20 px-1 rounded"
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
