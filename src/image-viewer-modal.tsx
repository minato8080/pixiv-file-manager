import { useState, useEffect, useCallback } from "react";

import { Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { SearchResult } from "@/bindings/SearchResult";

interface ImageViewerModalProps {
  searchResults: SearchResult[];
  selectedItem: string | null; // file_name as key
  onClose: () => void;
  onDelete: (item: SearchResult) => void;
}

export function ImageViewerModal({
  searchResults,
  selectedItem,
  onClose,
  onDelete,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // Find the index of the selected item
  useEffect(() => {
    if (selectedItem && searchResults.length > 0) {
      const index = searchResults.findIndex(
        (item) => item.file_name === selectedItem
      );
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [selectedItem, searchResults]);

  const currentItem = searchResults[currentIndex];

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
  }, [searchResults.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
  }, [searchResults.length]);

  const handleDelete = useCallback(() => {
    if (currentItem) {
      onDelete(currentItem);
    }
  }, [currentItem, onDelete]);

  const close = () => {
    setCurrentIndex(-1);
    onClose();
  };

  // Keyboard event handler - only active when modal is open
  useEffect(() => {
    // Only add event listeners if the modal is open
    if (!selectedItem) return;

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
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePrevious, handleNext, handleDelete, onClose, selectedItem]);

  if (!currentItem) return null;

  return (
    <Dialog open={!!selectedItem} onOpenChange={(open) => !open && close()}>
      <DialogContent className="p-0 border border-gray-200 shadow-lg rounded-lg overflow-hidden bg-gray-50 backdrop-blur-md bg-opacity-95 max-w-5xl">
        <div className="flex flex-col h-full">
          {/* Title bar with controls in top-right */}
          <div className="flex items-center justify-between p-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">{currentItem.file_name}</span>
              <span className="text-gray-400">•</span>
              <span>{`${currentIndex + 1} / ${searchResults.length}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
              <Button
                autoFocus={true}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-gray-100"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Main content area */}
          <div className="relative flex-1 flex items-center justify-center bg-[#f3f3f3] dark:bg-[#1f1f1f] overflow-hidden">
            {/* Navigation buttons */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-sm z-10"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Previous</span>
            </Button>

            {/* Image with fixed height and variable width */}
            <div className="relative h-[600px] flex items-center justify-center p-4 select-none">
              <img
                src={currentItem.thumbnail_url || "/placeholder.svg"}
                alt={currentItem.file_name}
                className="h-full max-w-full object-contain"
                style={{ userSelect: "none" }}
                onDoubleClick={(e) => e.preventDefault()}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-sm z-10"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Next</span>
            </Button>
          </div>

          {/* Simple footer with minimal info */}
          <div className="p-2 bg-white border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                {currentItem.author.author_name}
                {currentItem.character && (
                  <span className="text-gray-500 ml-2">
                    • {currentItem.character}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
