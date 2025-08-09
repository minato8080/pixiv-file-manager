import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTagSearcher } from "@/src/hooks/use-tag-searcher";
import { useDialogDeleteStore } from "@/src/stores/dialog-delete-store";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const DialogDeleteFiles = () => {
  const {
    isDeleteFilesDialogOpen,
    deleteFilesDialogSelectedFiles,
    isDeleteFilesDialogSubmitting,
    openDeleteFilesDialog,
    closeDeleteFilesDialog,
    setDeleteFilesDialogSubmitting,
  } = useDialogDeleteStore();
  const { selectedFiles, searchResults, setSearchResults, setSelectedFiles } =
    useTagSearcherStore();

  const { fetchTags, fetchCharacters, fetchAuthors } = useTagSearcher();

  const handleDelete = async () => {
    setDeleteFilesDialogSubmitting(true);
    try {
      // Invoke to Rust backend
      await invoke("delete_files", {
        fileNames: deleteFilesDialogSelectedFiles,
      });

      // Remove deleted items from search results
      setSearchResults(
        searchResults.filter((result) => !selectedFiles.includes(result))
      );
      setSelectedFiles([]);
      void fetchTags();
      void fetchCharacters();
      void fetchAuthors();
    } catch (error) {
      console.error("Error deleting files:", error);
    } finally {
      closeDeleteFilesDialog();
    }
  };

  return (
    <Dialog
      open={isDeleteFilesDialogOpen}
      onOpenChange={(isOpen) =>
        isOpen ? openDeleteFilesDialog : closeDeleteFilesDialog
      }
    >
      <DialogContent
        aria-describedby="A dialog to delete files."
        className="sm:max-w-md bg-white dark:bg-gray-900"
      >
        <DialogHeader>
          <DialogTitle className="text-red-600">
            Delete Confirmation
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete{" "}
            {deleteFilesDialogSelectedFiles?.length ?? "0"}
            file(s)? This action cannot be undone.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => closeDeleteFilesDialog}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDelete()}
            disabled={isDeleteFilesDialogSubmitting}
          >
            {isDeleteFilesDialogSubmitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
DialogDeleteFiles.displayName = "DialogDeleteFiles";
