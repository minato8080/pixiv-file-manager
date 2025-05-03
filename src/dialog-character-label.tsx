import type React from "react";
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from "react";
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
import { SearchResult } from "@/bindings/SearchResult";
import { open } from "@tauri-apps/plugin-dialog";
import { AssociateInfo } from "@/bindings/AssociateInfo";
import { invoke } from "@tauri-apps/api/core";

export type DialogCharaLabelHandle = {
  open: (
    items: SearchResult[],
    initialName: string,
    availableCharacters?: string[]
  ) => void;
  close: () => void;
};
export type DialogCharaLabelSubmitParams = {
  characterName: string;
  updateLinkedFiles: boolean;
  collectDir?: string;
};
type Props = {
  onSubmit: (params: DialogCharaLabelSubmitParams) => Promise<void>;
};

export const DialogCharaLabel = forwardRef<DialogCharaLabelHandle, Props>(
  (props, ref) => {
    // UI state management
    const [isOpen, setIsOpen] = useState(false); // Dialog open state
    const [showDropdown, setShowDropdown] = useState(false); // Dropdown visibility
    const [isSubmitting, setIsSubmitting] = useState(false); // Submission state
    const [isComposing, setIsComposing] = useState(false); // IME composition state

    // Character management
    const [characterName, setCharacterName] = useState(""); // Current character name
    const [availableCharacters, setAvailableCharacters] = useState<string[]>(
      []
    ); // List of available characters
    const [filteredCharacters, setFilteredCharacters] = useState<string[]>([]); // Filtered characters based on input

    // File management
    const [selectedFiles, setSelectedFiles] = useState<SearchResult[]>([]); // Files selected for operation
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

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const savePathInputRef = useRef<HTMLInputElement>(null);

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
      const nameChangeCount = selectedFiles.filter((file) => {
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
      const selectedPathChanges = selectedFiles.filter((file) => {
        return file.save_dir !== collectDir;
      }).length;
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

    const close = () => {
      // 変数を初期化
      setIsOpen(false);
      setShowDropdown(false);
      setIsSubmitting(false);
      setIsComposing(false);
      setCharacterName("");
      setAvailableCharacters([]);
      setFilteredCharacters([]);
      setSelectedFiles([]);
      setIsUpdateLinkedFiles(false);
      setIsChangeCollectPath(false);
      setCollectDir("");
      setNamesToUpdate(0);
      setPathsToUpdate(0);
      setIsLoadingAssociations(false);
      setAssociateInfo(null);
    };

    useImperativeHandle(ref, () => ({
      open: (items, initialName, characters = []) => {
        setCharacterName(initialName);
        setSelectedFiles(items);
        setAvailableCharacters(characters);
        setFilteredCharacters(characters);

        // 保存パスの初期値を設定
        const mostCommonPath = findMostCommonPath(items);
        setCollectDir(mostCommonPath);

        // 影響を受けるファイル数を計算
        setNamesToUpdate(items.length);

        // 紐づけ更新の情報を取得
        fetchAssociations(items);

        setIsOpen(true);
      },
      close,
    }));

    useEffect(() => {
      // Only filter characters when not in IME composition
      if (!isComposing) {
        if (characterName) {
          setFilteredCharacters(
            availableCharacters.filter((char) =>
              char.toLowerCase().includes(characterName.toLowerCase())
            )
          );
        } else {
          setFilteredCharacters(availableCharacters);
        }
      }
    }, [characterName, availableCharacters, isComposing]);

    // キャラクター名入力変更時の処理
    useEffect(() => {
      calculateLabelChanges();
    }, [characterName, selectedFiles, associateInfo]);

    // 保存パス変更時の処理
    useEffect(() => {
      calculatePathChanges();
    }, [collectDir, selectedFiles, associateInfo]);

    // チェックボックス変更時の処理
    useEffect(() => {
      calculateLabelChanges();
      calculatePathChanges();
    }, [isUpdateLinkedFiles, isChangeCollectPath]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          (dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            inputRef.current &&
            !inputRef.current.contains(event.target as Node)) ||
          (!dropdownRef.current?.contains(event.target as Node) &&
            document.contains(event.target as Node))
        ) {
          setShowDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        await props.onSubmit({
          characterName: characterName,
          updateLinkedFiles: isUpdateLinkedFiles,
          collectDir: isChangeCollectPath ? collectDir : undefined,
        });
        close();
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
      const nextFocused = event.relatedTarget as Node | null;

      if (!nextFocused || !containerRef.current?.contains(nextFocused)) {
        setShowDropdown(false);
      }
    };

    const handleSelectCharacter = (character: string) => {
      setCharacterName(character);
      setShowDropdown(false);
      inputRef.current?.focus();
    };

    const handleCompositionStart = () => {
      setIsComposing(true);
    };

    const handleCompositionEnd = () => {
      setIsComposing(false);
      // Update filtered characters after composition ends
      if (characterName) {
        setFilteredCharacters(
          availableCharacters.filter((char) =>
            char.toLowerCase().includes(characterName.toLowerCase())
          )
        );
      } else {
        setFilteredCharacters(availableCharacters);
      }
    };

    // キャラクター名の変更ハンドラ
    const handleCharacterNameChange = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const newName = e.target.value;
      setCharacterName(newName);
    };

    // 保存パスの変更ハンドラ
    const handleSavePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPath = e.target.value;
      setCollectDir(newPath);
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Character Label</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {/* キャラクター名入力 */}
            <div
              className="relative"
              ref={containerRef}
              tabIndex={-1}
              onBlur={handleBlur}
            >
              <div className="border rounded-md p-2 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Label Character Name:
                </p>
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter character name"
                  value={characterName}
                  onChange={handleCharacterNameChange}
                  onClick={() => !isComposing && setShowDropdown(true)}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  className="w-full"
                />

                {showDropdown &&
                  !isComposing &&
                  filteredCharacters.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-sm max-h-60 overflow-auto"
                    >
                      {filteredCharacters.map((character) => (
                        <div
                          key={character}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSelectCharacter(character)}
                        >
                          {character}
                        </div>
                      ))}
                    </div>
                  )}
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
                                  onClick={() =>
                                    setCharacterName(char.character)
                                  }
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
                        ref={savePathInputRef}
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
                        onClick={openFolderDialog}
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
                <Label htmlFor="setCharacterPath">
                  Set character save path
                </Label>
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
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
DialogCharaLabel.displayName = "DialogCharaLabel";
