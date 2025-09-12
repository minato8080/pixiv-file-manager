import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { ControlArea } from "./control-area";
import { DialogDeleteFiles } from "./dialogs/dialog-delete-files";
import { DialogEditTag } from "./dialogs/dialog-edit-tag";
import { DialogLabelCharacter } from "./dialogs/dialog-label-character";
import { DialogMoveFiles } from "./dialogs/dialog-move-files";
import { ImageViewerModal } from "./image-viewer-modal";
import { OperationArea } from "./operation-area";
import { TagsSearcherResultArea } from "./result-area";
import { TagArea } from "./tag-area";

import { VIEW_MODE_KEYS } from "@/src/constants";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export default function TagSearcher() {
  const { searchResults, currentViewMode, setCurrentViewMode } =
    useTagSearcherStore();

  const { fetchTags, fetchCharacters, fetchAuthors, quickReload } =
    useTagSearcherStore();

  // Call handlers to fetch data using useEffect
  useEffect(() => {
    void fetchTags();
    void fetchCharacters();
    void fetchAuthors();
    const unlisten = listen<null>("update_db", () => {
      void fetchTags();
      void fetchCharacters();
      void fetchAuthors();
      void quickReload();
    });
    return () => {
      void unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add keyboard and mouse wheel event listeners for view mode switching
  useEffect(() => {
    const changeViewMode = (step: number) => {
      const currentIndex = VIEW_MODE_KEYS.indexOf(currentViewMode);
      if (currentIndex === -1) return;
      const nextIndex = Math.min(
        VIEW_MODE_KEYS.length - 1,
        Math.max(0, currentIndex + step)
      );
      if (nextIndex !== currentIndex) {
        setCurrentViewMode(VIEW_MODE_KEYS[nextIndex]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        changeViewMode(-1); // 大きく
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        changeViewMode(1); // 小さく
      }
    };

    let wheelAccum = 0;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      wheelAccum += e.deltaY;

      const threshold = 100; // 感度しきい値
      if (wheelAccum >= threshold) {
        changeViewMode(1);
        wheelAccum = 0;
      } else if (wheelAccum <= -threshold) {
        changeViewMode(-1);
        wheelAccum = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [currentViewMode, setCurrentViewMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Compact search controls with more color */}
      <ControlArea />

      {/* Selected Tags */}
      <TagArea />

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
      <DialogEditTag />

      {/* Image Viewer */}
      <ImageViewerModal />
    </div>
  );
}
