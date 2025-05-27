import { Label } from "@radix-ui/react-dropdown-menu";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder } from "lucide-react";
import { useEffect, useState } from "react";

import { useTagsSearcher } from "../../hooks/use-tags-searcher";

import { AssociateInfo } from "@/bindings/AssociateInfo";
import { SearchResult } from "@/bindings/SearchResult";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDialogMoveStore } from "@/stores/dialog-move-store";

export const DialogMoveFiles = () => {
  const {
    isMoveFilesDialogOpen,
    moveFilesDialogSelectedFiles,
    isMoveFilesDialogSubmitting,
    openMoveFilesDialog,
    closeMoveFilesDialog,
    setMoveFilesDialogSubmitting,
    reset,
  } = useDialogMoveStore();

  const [moveLinkedFiles, setMoveLinkedFiles] = useState(false);
  const [targetFolder, setTargetFolder] = useState("");
  const [pathsToUpdate, setPathsToUpdate] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<SearchResult[]>([]);
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [associateInfo, setAssociateInfo] = useState<AssociateInfo | null>(
    null
  );

  const { handleSearch } = useTagsSearcher();

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

  // ファイル変更の影響を計算
  const calculatePathChanges = () => {
    // 選択されたファイルの中で、パスが変更されるもの
    const selectedPathChanges = selectedFiles.filter((file) => {
      return file.save_dir !== targetFolder;
    }).length;
    if (associateInfo && moveLinkedFiles) {
      // 保存パスが変更されるファイル数
      const linkedPathChangeCount = associateInfo.save_dirs.reduce(
        (total, dir) => {
          // save_dirが一致しない場合、変更対象としてカウント
          return total + (dir.save_dir !== targetFolder ? dir.count : 0);
        },
        0
      );
      // 関連ファイルの中で、パスが変更されるもの
      setPathsToUpdate(selectedPathChanges + linkedPathChangeCount);
    } else {
      // 関連ファイルの中で、パスが変更されるもの
      setPathsToUpdate(selectedPathChanges);
    }
  };

  // 保存パス変更時の処理
  useEffect(() => {
    calculatePathChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveLinkedFiles, targetFolder, selectedFiles, associateInfo]);

  const onOpen = () => {
    void fetchAssociations(moveFilesDialogSelectedFiles);
    setPathsToUpdate(moveFilesDialogSelectedFiles.length);
  };
  const onClose = () => {
    reset();
    setMoveLinkedFiles(false);
    setTargetFolder("");
    setPathsToUpdate(0);
    setSelectedFiles([]);
    setMoveFilesDialogSubmitting(false);
    setIsLoadingAssociations(false);
    setAssociateInfo(null);
  };

  useEffect(() => {
    if (isMoveFilesDialogOpen) {
      onOpen();
    } else {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoveFilesDialogOpen]);

  // Handle folder selection
  const handleSelectFolder = async () => {
    try {
      // Function to select folders
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folders containing images",
      });

      if (selected) {
        setTargetFolder(selected);
      }
    } catch (error) {
      console.error("Error selecting folders:", error);
    }
  };

  // Confirm move operation
  const handleSubmit = async () => {
    setMoveFilesDialogSubmitting(true);
    if (!targetFolder) return;

    const fileNames = selectedFiles.map((p) => p.file_name);

    try {
      // Invoke to Rust backend
      await invoke("move_files", {
        fileNames,
        targetFolder,
        moveLinkedFiles,
      });
    } catch (error) {
      console.error("Error moving files:", error);
      return;
    } finally {
      // close Move Files dialog
      closeMoveFilesDialog();
    }

    // refresh
    handleSearch();
  };

  return (
    <Dialog
      open={isMoveFilesDialogOpen}
      onOpenChange={(open) =>
        open ? openMoveFilesDialog : closeMoveFilesDialog
      }
    >
      <DialogContent
        aria-describedby="A dialog to move files."
        className="sm:max-w-md bg-white dark:bg-gray-900"
      >
        <DialogHeader>
          <DialogTitle>Move {pathsToUpdate} files</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center space-x-2">
            <Input
              type="checkbox"
              id="moveAccompany"
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={moveLinkedFiles}
              onChange={(e) => setMoveLinkedFiles(e.target.checked)}
            />
            <label
              htmlFor="moveAccompany"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Move all related files
            </label>
            <Badge
              variant="outline"
              className="bg-red-50 text-red-600 border-red-200"
            >
              {isLoadingAssociations
                ? "Loading..."
                : `${associateInfo?.save_dirs.reduce(
                    (total, p) => total + p.count,
                    0
                  )} files linked`}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label>Destination Folder</Label>
            <div className="flex gap-2">
              <Input
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                placeholder="C:/Path/To/Destination"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                onClick={() => void handleSelectFolder()}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => closeMoveFilesDialog()}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isMoveFilesDialogSubmitting}
          >
            {isMoveFilesDialogSubmitting ? "Moving..." : "Move Files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
DialogMoveFiles.displayName = "DialogMoveFiles";
