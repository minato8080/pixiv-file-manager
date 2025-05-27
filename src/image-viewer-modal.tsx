"use client";

import { useState, useEffect, useCallback } from "react";

import { Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogDeleteStore } from "@/stores/dialog-delete-store";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";
import { SimpleModal } from "./simple-modal";

export function ImageViewerModal() {
  const { searchResults, selectedImage, setSelectedImage } =
    useTagsSearcherStore();
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const { setSelectedFiles } = useTagsSearcherStore();
  const { openDeleteFilesDialog } = useDialogDeleteStore();

  // Find the index of the selected item
  useEffect(() => {
    if (selectedImage && searchResults.length > 0) {
      const index = searchResults.findIndex(
        (item) => item.file_name === selectedImage
      );
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [selectedImage, searchResults]);

  const currentItem = searchResults[currentIndex];

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
  }, [searchResults.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
  }, [searchResults.length]);

  const handleDelete = useCallback(() => {
    if (currentItem) {
      // Handle delete operation
      setSelectedFiles([currentItem]);
      openDeleteFilesDialog([currentItem.file_name]);
    }
  }, [currentItem]);

  const close = () => {
    setCurrentIndex(-1);
    setSelectedImage(null);
  };

  // Keyboard event handler - only active when modal is open
  useEffect(() => {
    // Only add event listeners if the modal is open
    if (!selectedImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "Delete":
          handleDelete();
          break;
        case "Escape":
          setSelectedImage(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handlePrevious,
    handleNext,
    handleDelete,
    selectedImage,
    setSelectedImage,
  ]);

  if (!currentItem) return null;

  return (
    <SimpleModal isOpen={!!selectedImage} onClose={close}>
      <div className="p-0 border  shadow-lg rounded-lg overflow-hidden bg-gray-900 backdrop-blur-md bg-opacity-95 max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]">
        <div className="flex flex-col h-full">
          {/* Title bar with controls in top-right */}
          <div className="flex items-center justify-between p-2 bg-gray-800 border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-200">
              <span className="font-medium">{currentItem.file_name}</span>
              <span className="text-gray-500">•</span>
              <span>{`${currentIndex + 1} / ${searchResults.length}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-red-900 hover:text-red-400 bg-gray-500"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
              <Button
                autoFocus={true}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-gray-700 bg-gray-500"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Main content area */}
          <div className="relative flex-1 flex items-center justify-center bg-[#1f1f1f] overflow-hidden h-full">
            {/* Navigation buttons */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 h-10 w-10 rounded-full bg-gray-500 hover:bg-black/70 shadow-sm z-10"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Previous</span>
            </Button>

            {/* Fullscreen image container */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center p-4 select-none">
              <img
                src={currentItem.thumbnail_url || "/placeholder.svg"}
                alt={currentItem.file_name}
                className="max-h-full max-w-full object-contain"
                style={{ userSelect: "none" }}
                onDoubleClick={(e) => e.preventDefault()}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 h-10 w-10 rounded-full bg-gray-500 hover:bg-black/70 shadow-sm z-10"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Next</span>
            </Button>
          </div>

          {/* Simple footer with minimal info */}
          <div className="p-2 bg-gray-800 border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-200">
                {currentItem.author.author_name}
                {currentItem.character && (
                  <span className="text-gray-400 ml-2">
                    • {currentItem.character}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}
