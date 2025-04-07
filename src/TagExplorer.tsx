"use client"

import { useState, useEffect } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow  } from '@tauri-apps/api/window';
import { FolderOpen, Search, AlertCircle, Clock, X, ChevronRight, ChevronDown } from "lucide-react"

interface ProcessStats {
  total_files: number
  failed_files: number
  processing_time_ms: number
  failed_file_paths: string[]
}

export default function TagExplorer() {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [showResults, setShowResults] = useState(false)
  const [showFailedDetails, setShowFailedDetails] = useState(false)
  const [stats, setStats] = useState<ProcessStats>({
    total_files: 0,
    failed_files: 0,
    processing_time_ms: 0,
    failed_file_paths: [],
  })

  // Function to select folders
  const selectFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select folders containing images",
      })

      if (Array.isArray(selected)) {
        setSelectedFolders(selected)
      } else if (selected !== null) {
        setSelectedFolders([selected])
      }
    } catch (error) {
      console.error("Error selecting folders:", error)
    }
  }

  // Function to start processing
  const startProcessing = async () => {
    if (selectedFolders.length === 0) return

    setIsProcessing(true)
    setProgress({ current: 0, total: 0 })

    try {
      const result = await invoke<ProcessStats>("process_capture_tags_info", {
        folders: selectedFolders,
      })
      console.log("処理結果:", result)

      setStats(result)
      setShowResults(true)
    } catch (error) {
      console.error("Error processing tags:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Mock function to update progress (would be called from Rust)
  useEffect(() => {
    const mockProgressListener = (event: any) => {
      if (event.payload && event.payload.type === "progress") {
        setProgress({
          current: event.payload.current,
          total: event.payload.total,
        })
      }
    }

    // In a real app, you'd listen to events from Rust
    getCurrentWindow().listen('tag-progress', mockProgressListener)

    // return () => {
    //   getCurrentWindow().unlisten('tag-progress', mockProgressListener)
    // }
  }, [])

  // Close the results dialog
  const closeResults = () => {
    setShowResults(false)
    setShowFailedDetails(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Image Tag Explorer</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Select folders to extract and process image tags</p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Folder selection */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Selected Folders</h2>
            <button
              onClick={selectFolders}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              <FolderOpen size={18} />
              Select Folders
            </button>
          </div>

          {selectedFolders.length > 0 ? (
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {selectedFolders.map((folder, index) => (
                  <li key={index} className="px-3 py-2 text-sm truncate" title={folder}>
                    {folder}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-md p-8 text-center text-gray-500">
              No folders selected. Click "Select Folders" to begin.
            </div>
          )}
        </div>

        {/* Processing controls */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Process Tags</h2>
            <button
              onClick={startProcessing}
              disabled={isProcessing || selectedFolders.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md disabled:opacity-50"
            >
              <Search size={18} />
              {isProcessing ? "Processing..." : "Start Processing"}
            </button>
          </div>

          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Processing images...</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "0%" }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Dialog */}
      {showResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Processing Results</h3>
              <button onClick={closeResults} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Search size={20} className="text-blue-500 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Files Processed</p>
                    <p className="font-semibold">{stats.total_files}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                    <AlertCircle size={20} className="text-red-500 dark:text-red-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Failed Files</p>
                    <p className="font-semibold">{stats.failed_files}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                    <Clock size={20} className="text-green-500 dark:text-green-300" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Processing Time</p>
                    <p className="font-semibold">{(stats.processing_time_ms / 1000).toFixed(2)} seconds</p>
                  </div>
                </div>
              </div>

              {stats.failed_files > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowFailedDetails(!showFailedDetails)}
                    className="flex items-center gap-2 w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {showFailedDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span>Failed Files Details</span>
                    <span className="ml-auto bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-xs px-2 py-1 rounded-full">
                      {stats.failed_files}
                    </span>
                  </button>

                  {showFailedDetails && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {stats.failed_file_paths.map((path, index) => (
                          <li key={index} className="px-3 py-2 text-sm truncate" title={path}>
                            {path}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={closeResults} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

