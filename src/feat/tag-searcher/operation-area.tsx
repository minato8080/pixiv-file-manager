import {
  CheckSquare,
  FolderInput,
  Square,
  Tag,
  Trash2,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";
import { useDialogDeleteStore } from "@/stores/dialog-delete-store";
import { useDialogEditStore } from "@/stores/dialog-edit-store";
import { useDialogLabelStore } from "@/stores/dialog-label-store";
import { useDialogMoveStore } from "@/stores/dialog-move-store";
import { useDropdownStore } from "@/stores/dropdown-store";

export const OperationArea = () => {
  const {
    searchResults,
    selectedFiles,
    setSelectedFiles,
    operationMode,
    isDeleting,
  } = useTagSearcherStore();

  // Select all items
  const selectAllItems = () => {
    setSelectedFiles(searchResults);
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedFiles([]);
  };

  // Handle move operation
  const handleMove = () => {
    if (selectedFiles.length === 0) return;
    const { openMoveFilesDialog } = useDialogMoveStore.getState();
    openMoveFilesDialog(selectedFiles);
  };

  // Handle delete operation
  const handleDelete = () => {
    if (selectedFiles.length === 0) return;
    useDialogDeleteStore
      .getState()
      .openDeleteFilesDialog(selectedFiles.map((p) => p.file_name));
  };

  // Handle label character name operation
  const handleLabel = (initialName?: string) => {
    if (selectedFiles.length === 0) return;
    const { uniqueCharacterList } = useDropdownStore.getState();
    const combinedSet = new Set([
      ...(uniqueCharacterList.map((iter) => iter.character) || []),
      ...selectedFiles.flatMap((iter) => iter.tags?.split(",") ?? []),
    ]);

    const combinedArray: string[] = Array.from(combinedSet);

    const uniqueCharacters = new Set(
      selectedFiles.map((file) => file.character)
    );

    const uniqueInitialName =
      uniqueCharacters.size === 1 ? Array.from(uniqueCharacters)[0] ?? "" : "";

    useDialogLabelStore
      .getState()
      .openLabelCharacterDialog(
        selectedFiles,
        initialName ?? uniqueInitialName,
        combinedArray
      );
  };

  const handleTagEditor = () => {
    if (selectedFiles.length > 0) {
      useDialogEditStore.getState().openEditTagsDialog(selectedFiles);
    }
  };

  return (
    <>
      {operationMode && searchResults.length > 0 && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={selectAllItems}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1 text-green-500" />
            Select All
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={deselectAllItems}
          >
            <Square className="h-3.5 w-3.5 mr-1 text-red-500" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={handleMove}
            disabled={selectedFiles.length === 0}
          >
            <FolderInput className="h-3.5 w-3.5 mr-1 text-blue-500" />
            Move
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={() => handleDelete()}
            disabled={selectedFiles.length === 0 || isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" />
            {isDeleting ? "Deleting..." : `Delete`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={() => handleLabel()}
            disabled={selectedFiles.length === 0 || isDeleting}
          >
            <User className="h-3.5 w-3.5 mr-1 text-purple-500" />
            {isDeleting ? "Labeling..." : `Who is`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white dark:bg-gray-800"
            onClick={handleTagEditor}
            disabled={selectedFiles.length === 0 || isDeleting}
          >
            <Tag className="h-3.5 w-3.5 mr-1 text-green-500" />
            {isDeleting ? "Tagging..." : `Edit Tag`}
          </Button>

          <div className="ml-auto text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedFiles.length} of {searchResults.length} selected
          </div>
        </>
      )}
    </>
  );
};
