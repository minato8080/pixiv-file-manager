import { invoke } from "@tauri-apps/api/core";
import { useState, useRef, useEffect } from "react";

import { AddRemoveModeUI } from "./dialog-edit-tags-add-remove-ui";
import { OverwriteModeUI } from "./dialog-edit-tags-overwrite-ui";
import { useTagsSearcher } from "../../hooks/use-tags-searcher";

import { AssociateInfo } from "@/bindings/AssociateInfo";
import { EditTagReq } from "@/bindings/EditTagReq";
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
import { useDialogEditStore } from "@/stores/dialog-edit-store";
import { useDropdownStore } from "@/stores/dropdown-store";

export type TagState = {
  value: string;
  status: "unchanged" | "deleted" | "edited" | "added";
  originalValue?: string;
};

export type FileTagState = {
  fileId: number;
  fileName: string;
  tags: TagState[];
};

type EditTagsSubmitType = {
  editTagReq: EditTagReq;
  updateLinkedFiles: boolean;
};

type OverwriteModeHandle = {
  open: (items: SearchResult[]) => void;
  close: () => void;
  getForm: () => EditTagReq;
};

type AddRemoveModeHandle = {
  close: () => void;
  fileTagStates: FileTagState[];
  getForm: () => EditTagReq;
};

export const DialogEditTags = () => {
  const {
    isEditTagsDialogOpen,
    editTagsDialogSelectedFiles,
    isEditTagsDialogSubmitting,
    setEditTagsDialogSelectedFiles,
    closeEditTagsDialog,
    setEditTagsDialogSubmitting,
  } = useDialogEditStore();
  const { uniqueTagList } = useDropdownStore();

  const [isOverwriteMode, setIsOverwriteMode] = useState(false);

  // 影響を受けるファイル数の状態
  const [isUpdateLinkedFiles, setIsUpdateLinkedFiles] = useState(false); // Whether to update linked files
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [associateInfo, setAssociateInfo] = useState<AssociateInfo | null>(
    null
  );

  const overwriteModeUIRef = useRef<OverwriteModeHandle>(null);
  const addRemoveHandleRef = useRef<AddRemoveModeHandle>(null);

  const { fetchTags, handleSearch } = useTagsSearcher();

  const confirmTags = async (param: EditTagsSubmitType) => {
    await invoke("edit_tags", param);
    await fetchTags();
    handleSearch();
  };

  // 紐づけ更新の情報を取得
  const fetchAssociations = async (searchResult: SearchResult[]) => {
    setIsLoadingAssociations(true);
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
      setIsLoadingAssociations(false);
    }
  };

  const resetState = () => {
    setEditTagsDialogSelectedFiles([]);
    setIsOverwriteMode(false);
  };

  const close = () => {
    resetState();
    closeEditTagsDialog();
    overwriteModeUIRef.current?.close();
    addRemoveHandleRef.current?.close();
  };

  useEffect(() => {
    if (isEditTagsDialogOpen) {
      void fetchAssociations(editTagsDialogSelectedFiles);
    } else {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditTagsDialogOpen]);

  // Handle form submission
  const handleSubmit = async () => {
    setEditTagsDialogSubmitting(true);
    try {
      if (isOverwriteMode) {
        const form = overwriteModeUIRef.current?.getForm();
        if (form)
          await confirmTags({
            editTagReq: form,
            updateLinkedFiles: isUpdateLinkedFiles,
          });
      } else {
        const form = addRemoveHandleRef.current?.getForm();
        if (form)
          await confirmTags({
            editTagReq: form,
            updateLinkedFiles: isUpdateLinkedFiles,
          });
      }

      close();
    } finally {
      setEditTagsDialogSubmitting(false);
    }
  };

  return (
    <Dialog open={isEditTagsDialogOpen} onOpenChange={(b) => !b && close()}>
      <DialogContent
        aria-describedby="A dialog to edit tags."
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
                  {isLoadingAssociations
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
            <OverwriteModeUI
              ref={overwriteModeUIRef}
              selectedFiles={editTagsDialogSelectedFiles}
              uniqueTagList={uniqueTagList}
            />
          </div>
          <div className={isOverwriteMode ? "hidden" : ""}>
            <AddRemoveModeUI
              ref={addRemoveHandleRef}
              selectedFiles={editTagsDialogSelectedFiles}
              uniqueTagList={uniqueTagList}
            />
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {editTagsDialogSelectedFiles.length > 1
              ? `This will update tags for ${editTagsDialogSelectedFiles.length} files.`
              : "This will update tags for 1 file."}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} size="sm">
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={isEditTagsDialogSubmitting}
              className={
                isOverwriteMode
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }
              size="sm"
            >
              {isEditTagsDialogSubmitting ? "Saving..." : "Save Tags"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
DialogEditTags.displayName = "DialogEditTags";
