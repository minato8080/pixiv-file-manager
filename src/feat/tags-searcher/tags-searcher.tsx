import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { ControlArea } from "./control-area";
import { DialogDeleteFiles } from "./dialogs/dialog-delete-files";
import { DialogEditTags } from "./dialogs/dialog-edit-tags";
import { DialogLabelCharacter } from "./dialogs/dialog-label-character";
import { DialogMoveFiles } from "./dialogs/dialog-move-files";
import { ImageViewerModal } from "./image-viewer-modal";
import { OperationArea } from "./operation-area";
import { TagsSearcherResultArea } from "./result-area";
import { TagsArea } from "./tags-area";

import { VIEW_MODES, ViewModeKey } from "@/src/constants";
import { useTagsSearcher } from "@/src/hooks/use-tags-searcher";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";

export default function TagsSearcher() {
  const { searchResults, currentViewMode, setCurrentViewMode } =
    useTagsSearcherStore();

  const { fetchTags, fetchCharacters, fetchAuthors, fetchSearchHistory } =
    useTagsSearcher();

  // Call handlers to fetch data using useEffect
  useEffect(() => {
    void fetchTags();
    void fetchCharacters();
    void fetchAuthors();
    void fetchSearchHistory();
    const unlisten = listen<null>("update_db", () => {
      void fetchTags();
      void fetchCharacters();
      void fetchAuthors();
    });
    return () => {
      void unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add keyboard and mouse wheel event listeners for view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Plus/Minus to change view mode
      if (e.ctrlKey) {
        const viewModeKeys = Object.keys(VIEW_MODES) as ViewModeKey[];
        const currentIndex = viewModeKeys.indexOf(currentViewMode);

        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          const nextIndex = Math.min(viewModeKeys.length - 1, currentIndex + 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Ctrl + Mouse wheel to change view mode
      if (e.ctrlKey) {
        e.preventDefault();
        const viewModeKeys = Object.keys(VIEW_MODES) as ViewModeKey[];
        const currentIndex = viewModeKeys.indexOf(currentViewMode);
        if (e.deltaY < 0) {
          // Scroll up - larger icons
          const nextIndex = Math.max(0, currentIndex - 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        } else {
          // Scroll down - smaller icons
          const nextIndex = Math.min(viewModeKeys.length - 1, currentIndex + 1);
          setCurrentViewMode(viewModeKeys[nextIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Compact search controls with more color */}
      <ControlArea />

      {/* Selected Tags */}
      <TagsArea />

      {/* Operation Controls */}
      <OperationArea />

      {/* Results Area */}
      <TagsSearcherResultArea />

      {/* Add status bar at the bottom */}
      {searchResults.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 p-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div>{searchResults.length} items</div>
        </div>
      )}

      {/* Move Dialog */}
      <DialogMoveFiles />

      {/* Delete Confirmation Dialog */}
      <DialogDeleteFiles />

      {/* Character Name Input Dialog */}
      <DialogLabelCharacter />

      {/* Edit Tags Dialog */}
      <DialogEditTags />

      {/* Image Viewer */}
      <ImageViewerModal />
    </div>
  );
}
