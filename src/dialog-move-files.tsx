import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Label } from "@radix-ui/react-dropdown-menu";
import { Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AssociateInfo } from "@/bindings/AssociateInfo";
import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "@/bindings/SearchResult";
import { open } from "@tauri-apps/plugin-dialog";

export type DialogMoveFilesHandle = {
  open: (items: SearchResult[]) => void;
  close: () => void;
  targetFolder: string;
  setTargetFolder: (folder: string) => void;
};

export type DialogMoveFilesSubmitParams = {
  moveLinkedFiles: boolean;
};
type Props = {
  onSubmit: (params: DialogMoveFilesSubmitParams) => Promise<void>;
};

export const DialogMoveFiles = forwardRef<DialogMoveFilesHandle, Props>(
  (props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [moveLinkedFiles, setMoveLinkedFiles] = useState(false);
    const [targetFolder, setTargetFolder] = useState("");
    const [pathsToUpdate, setPathsToUpdate] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState<SearchResult[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
    const [associateInfo, setAssociateInfo] = useState<AssociateInfo | null>(
      null
    );

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
    }, [moveLinkedFiles, targetFolder, selectedFiles, associateInfo]);

    useImperativeHandle(ref, () => ({
      open: (items: SearchResult[]) => {
        setSelectedFiles(items);
        setIsOpen(true);
        fetchAssociations(items);
        setPathsToUpdate(items.length);
      },
      close: () => {
        setIsOpen(false);
        setMoveLinkedFiles(false);
        setTargetFolder("");
        setPathsToUpdate(0);
        setSelectedFiles([]);
        setIsSubmitting(false);
        setIsLoadingAssociations(false);
        setAssociateInfo(null);
      },
      targetFolder,
      setTargetFolder,
    }));

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

    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        await props.onSubmit({ moveLinkedFiles });
        setIsOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
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
                  onClick={handleSelectFolder}
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Moving..." : "Move Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
DialogMoveFiles.displayName = "DialogMoveFiles";
