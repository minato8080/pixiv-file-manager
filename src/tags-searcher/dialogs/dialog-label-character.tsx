import type React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "@/bindings/SearchResult";
import { AssociateInfo } from "@/bindings/AssociateInfo";
import { InputDropdown } from "../../input-dropdown";
import { useDialogLabelStore } from "@/stores/dialog-label-store";
import { useTagsSearcher } from "../../hooks/use-tags-searcher";

type DialogLabelCharaSubmitParams = {
  characterName: string;
  updateLinkedFiles: boolean;
  collectDir?: string;
};

export const DialogLabelCharacter = () => {
  // UI state management
  const {
    initialName,
    isLabelCharacterDialogOpen,
    labelCharacterDialogSelectedFiles,
    isLabelCharacterDialogSubmitting,
    availableCharacters,
    setAvailableCharacters,
    openLabelCharacterDialog,
    closeLabelCharacterDialog,
    setLabelCharacterDialogSubmitting,
  } = useDialogLabelStore();

  // Character management
  const [characterName, setCharacterName] = useState(""); // Current character name

  // File management
  const [isUpdateLinkedFiles, setIsUpdateLinkedFiles] = useState(false); // Whether to update linked files
  const [isChangeCollectPath, setIsChangeCollectPath] = useState(false); // Whether to set character path
  const [collectDir, setCollectDir] = useState(""); // Directory for saving files

  // 影響を受けるファイル数の状態
  const [namesToUpdate, setNamesToUpdate] = useState(0);
  const [pathsToUpdate, setPathsToUpdate] = useState(0);
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [associateInfo, setAssociateInfo] = useState<AssociateInfo | null>(
    null
  );

  const { fetchCharacters, handleSearch } = useTagsSearcher();

  // 最も頻度の高いパスを見つける関数
  const findMostCommonPath = (files: SearchResult[]): string => {
    if (!files.length) return "";

    // パスの出現回数をカウント
    const pathCounts: Record<string, number> = {};
    files.forEach((fiile) => {
      pathCounts[fiile.save_dir] = (pathCounts[fiile.save_dir] || 0) + 1;
    });

    let mostCommonPath = "";
    let highestCount = 0;

    Object.entries(pathCounts).forEach(([path, count]) => {
      if (count > highestCount) {
        mostCommonPath = path;
        highestCount = count;
      }
    });

    return mostCommonPath;
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

  // 登録名変更の影響を計算
  const calculateLabelChanges = () => {
    // キャラクター名が変更されるファイル数
    const nameChangeCount = labelCharacterDialogSelectedFiles.filter((file) => {
      return file.character !== characterName;
    }).length;

    if (associateInfo && isUpdateLinkedFiles) {
      // 関連ファイル数 (UpdateLinkedがONの場合のみ)
      const linkedCharaChangeCount = associateInfo.characters.reduce(
        (total, char) => {
          // characterが一致しない場合、変更対象としてカウント
          return total + (char.character !== characterName ? char.count : 0);
        },
        0
      );
      setNamesToUpdate(nameChangeCount + linkedCharaChangeCount);
    } else {
      setNamesToUpdate(nameChangeCount);
    }
  };

  // ファイル変更の影響を計算
  const calculatePathChanges = () => {
    // 選択されたファイルの中で、パスが変更されるもの
    const selectedPathChanges = labelCharacterDialogSelectedFiles.filter(
      (file) => {
        return file.save_dir !== collectDir;
      }
    ).length;
    if (associateInfo && isUpdateLinkedFiles) {
      // 保存パスが変更されるファイル数
      const linkedPathChangeCount = associateInfo.save_dirs.reduce(
        (total, dir) => {
          // save_dirが一致しない場合、変更対象としてカウント
          return total + (dir.save_dir !== collectDir ? dir.count : 0);
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

  // フォルダ選択ダイアログを開く
  const openFolderDialog = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folder for character files",
      });

      if (selected) {
        setCollectDir(selected);
      }
    } catch (error) {
      console.error("Failed to open folder dialog:", error);
    }
  };

  const onClose = () => {
    // 変数を初期化
    setCharacterName("");
    setAvailableCharacters([]);
    setIsUpdateLinkedFiles(false);
    setIsChangeCollectPath(false);
    setCollectDir("");
    setNamesToUpdate(0);
    setPathsToUpdate(0);
    setIsLoadingAssociations(false);
    setAssociateInfo(null);
  };

  const onOpen = () => {
    if (initialName) setCharacterName(initialName);

    // 保存パスの初期値を設定
    const mostCommonPath = findMostCommonPath(
      labelCharacterDialogSelectedFiles
    );
    setCollectDir(mostCommonPath);

    // 影響を受けるファイル数を計算
    setNamesToUpdate(labelCharacterDialogSelectedFiles.length);

    // 紐づけ更新の情報を取得
    void fetchAssociations(labelCharacterDialogSelectedFiles);
  };

  useEffect(() => {
    if (isLabelCharacterDialogOpen) {
      onOpen();
    } else {
      onClose();
    }
  }, [isLabelCharacterDialogOpen]);

  // キャラクター名入力変更時の処理
  useEffect(() => {
    calculateLabelChanges();
  }, [characterName, labelCharacterDialogSelectedFiles, associateInfo]);

  // 保存パス変更時の処理
  useEffect(() => {
    calculatePathChanges();
  }, [collectDir, labelCharacterDialogSelectedFiles, associateInfo]);

  // チェックボックス変更時の処理
  useEffect(() => {
    calculateLabelChanges();
    calculatePathChanges();
  }, [isUpdateLinkedFiles, isChangeCollectPath]);

  const confirmName = async ({
    characterName,
    updateLinkedFiles,
    collectDir,
  }: DialogLabelCharaSubmitParams) => {
    await invoke("label_character_name", {
      fileNames: labelCharacterDialogSelectedFiles.map((p) => p.file_name),
      characterName,
      updateLinkedFiles,
      collectDir,
    });
    await fetchCharacters();
    handleSearch();
  };

  const handleSubmit = async () => {
    setLabelCharacterDialogSubmitting(true);
    try {
      await confirmName({
        characterName: characterName,
        updateLinkedFiles: isUpdateLinkedFiles,
        collectDir: isChangeCollectPath ? collectDir : undefined,
      });
      onClose();
    } finally {
      setLabelCharacterDialogSubmitting(false);
    }
  };

  // 保存パスの変更ハンドラ
  const handleSavePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setCollectDir(newPath);
  };

  return (
    <Dialog
      open={isLabelCharacterDialogOpen}
      onOpenChange={(open) =>
        open ? openLabelCharacterDialog : closeLabelCharacterDialog
      }
    >
      <DialogContent
        aria-describedby="A dialog to label character."
        className="sm:max-w-md bg-white dark:bg-gray-900"
      >
        <DialogHeader>
          <DialogTitle className="text-blue-600">Character Label</DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          {/* キャラクター名入力 */}
          <div className="relative">
            <div className="border rounded-md p-2 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-1">
                Label Character Name:
              </p>

              <InputDropdown
                items={availableCharacters}
                valueKey={(item) => item}
                placeholder="Enter character name"
                value={characterName}
                onChange={setCharacterName}
                inputClassName="w-full"
              />

              {/* 関連キャラクター情報 */}
              {isUpdateLinkedFiles && associateInfo && (
                <>
                  {isUpdateLinkedFiles &&
                    associateInfo.characters.length > 0 && (
                      <div className="mt-1 max-h-6 overflow-auto">
                        <ScrollArea>
                          <div className="flex flex-wrap gap-1">
                            {associateInfo.characters.map((char, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100 text-xs"
                                onClick={() => setCharacterName(char.character)}
                              >
                                {`${char.character}: ${char.count}`}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>

          {/* 関連情報表示エリア */}
          {isChangeCollectPath && (
            <div className="border rounded-md p-2 bg-gray-50">
              {/* 保存パス設定エリア */}
              {isChangeCollectPath && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Save Path:
                  </p>
                  <div className="flex gap-1">
                    <Input
                      type="text"
                      placeholder="Enter save path"
                      value={collectDir}
                      onChange={handleSavePathChange}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => void openFolderDialog()}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 保存パス関連情報 */}
                  {isUpdateLinkedFiles &&
                    associateInfo &&
                    associateInfo.save_dirs.length > 0 && (
                      <div className="mt-1 max-h-6 overflow-auto">
                        <ScrollArea>
                          <div className="flex flex-wrap gap-1">
                            {associateInfo.save_dirs.map((dir, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100 text-xs"
                                onClick={() => {
                                  setCollectDir(dir.save_dir);
                                }}
                              >
                                {`${dir.save_dir.split("/").pop()}: ${
                                  dir.count
                                }`}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="setCharacterPath"
                checked={isChangeCollectPath}
                onCheckedChange={(checked) =>
                  setIsChangeCollectPath(checked === true)
                }
              />
              <Label htmlFor="setCharacterPath">Set character save path</Label>
            </div>
          </div>

          {/* 影響を受けるファイル数の表示 */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={`${
                isUpdateLinkedFiles
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {isLoadingAssociations
                ? "Loading..."
                : `${namesToUpdate} files will be renamed`}
            </Badge>
            <Badge
              variant="outline"
              className={`${
                isUpdateLinkedFiles
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {isLoadingAssociations
                ? "Loading..."
                : `${pathsToUpdate} files will be moved`}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={isLabelCharacterDialogSubmitting}
          >
            {isLabelCharacterDialogSubmitting ? "Submitting..." : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
DialogLabelCharacter.displayName = "DialogLabelChara";
