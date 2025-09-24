import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { AddRemoveModeUI } from "./dialog-edit-tag-add-remove-ui";
import { OverwriteModeUI } from "./dialog-edit-tag-overwrite-ui";

import { AssociateInfo } from "@/bindings/AssociateInfo";
import { SearchResult } from "@/bindings/SearchResult";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCommonStore } from "@/src/stores/common-store";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";
import { useDialogEditStore } from "@/stores/dialog-edit-store";
import { useDropdownStore } from "@/stores/dropdown-store";

export const DialogEditTag = () => {
  const {
    isEditTagsDialogOpen,
    isOverwriteMode,
    isUpdateLinkedFiles,
    associateInfo,
    closeEditTagsDialog,
    setAvailableTags,
    createAddRemoveForm,
    createOverwriteForm,
    setIsOverwriteMode,
    setIsUpdateLinkedFiles,
    setAssociateInfo,
  } = useDialogEditStore();
  const { loading, setLoading } = useCommonStore();
  const { uniqueTagList } = useDropdownStore();
  const { selectedFiles, fetchTags, quickReload } = useTagSearcherStore();

  // Extract all unique tags from selected files
  useEffect(() => {
    setAvailableTags(uniqueTagList.map((p) => p.tag));
  }, [setAvailableTags, uniqueTagList]);

  // 紐づけ更新の情報を取得
  const fetchAssociations = async (searchResult: SearchResult[]) => {
    setLoading(true);
    try {
      const result: AssociateInfo = await invoke("get_associated_info", {
        fileNames: searchResult.map((p) => p.file_name),
      });

      if (result) {
        setAssociateInfo(result);
      }
    } catch (error) {
      console.error("Failed to fetch associations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEditTagsDialogOpen) {
      void fetchAssociations(selectedFiles);
    } else {
      closeEditTagsDialog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditTagsDialogOpen]);

  // Handle form submission
  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isOverwriteMode) {
        const form = createOverwriteForm();
        await invoke("overwrite_tags", {
          fileNames: form.fileNames,
          tags: form.tags,
          updateLinkedFiles: isUpdateLinkedFiles,
        });
        await fetchTags();
        await quickReload();
      } else {
        const form = createAddRemoveForm();
        await invoke("add_remove_tags", {
          editTags: form,
          updateLinkedFiles: isUpdateLinkedFiles,
        });
        await fetchTags();
        await quickReload();
      }

      closeEditTagsDialog();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isEditTagsDialogOpen}
      onOpenChange={(b) => !b && closeEditTagsDialog()}
    >
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white"
      >
        <DialogHeader>
          <DialogTitle
            className={isOverwriteMode ? "text-blue-600" : "text-green-600"}
          >
            Edit Tags
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3 overflow-auto scroll-hidden">
          <div className="flex items-center space-x-2 p-2 rounded-lg">
            <Switch
              id="mode-switch"
              checked={isOverwriteMode}
              onCheckedChange={setIsOverwriteMode}
              className={
                isOverwriteMode
                  ? "data-[state=checked]:bg-blue-500"
                  : "data-[state=unchecked]:bg-green-500"
              }
            />
            <Label htmlFor="mode-switch" className="font-medium">
              {isOverwriteMode ? "Overwrite Mode" : "Add/Remove Mode"}
            </Label>
            {/* チェックボックスエリア */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateLinkedFiles"
                  checked={isUpdateLinkedFiles}
                  onCheckedChange={(checked) =>
                    setIsUpdateLinkedFiles(checked === true)
                  }
                />
                <Label
                  htmlFor="updateLinkedFiles"
                  className="text-red-600 font-medium"
                >
                  Update linked files
                </Label>
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-600 border-red-200"
                >
                  {loading
                    ? "Loading..."
                    : `${associateInfo?.characters.reduce(
                        (total, p) => total + p.count,
                        0
                      )} files linked`}
                </Badge>
              </div>
            </div>
          </div>

          {/* Main UI */}
          <div className={isOverwriteMode ? "" : "hidden"}>
            <OverwriteModeUI />
          </div>
          <div className={isOverwriteMode ? "hidden" : ""}>
            <AddRemoveModeUI />
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {`This will update tags for ${selectedFiles.length} files.`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeEditTagsDialog} size="sm">
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={loading}
              className={
                isOverwriteMode
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }
              size="sm"
            >
              {loading ? "Saving..." : "Save Tags"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
DialogEditTag.displayName = "DialogEditTags";
