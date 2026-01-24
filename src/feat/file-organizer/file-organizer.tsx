import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Database, Play, ArrowBigRightDash } from "lucide-react";
import { useState, useEffect } from "react";

import { ResultArea } from "./result-area";
import { SyncResultsDialog } from "./sync-results-dialog";

import type { CollectSummary } from "@/bindings/CollectSummary";
import type { TagAssignment } from "@/bindings/TagAssignment";
import type { TagInfo } from "@/bindings/TagInfo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputDropdown } from "@/src/components/input-dropdown";
import { useCommonStore } from "@/stores/common-store";
import { useFileOrganizerStore } from "@/stores/file-organizer-store";

export default function FileOrganizer() {
  const { loading, setLoading } = useCommonStore();
  const {
    setCollectSummary,
    availableTagList,
    setAvailableTagList,
    syncDB,
    loadSummary,
  } = useFileOrganizerStore();

  const [selectedSeriesTag, setSelectedSeriesTag] = useState<string>("");
  const [selectedCharacterTag, setSelectedCharacterTag] = useState<string>("");
  const [isChangeRoot, setIsChangeRoot] = useState(false);
  const [characterRoot, setCharacterRoot] = useState("");
  const [authorRoot, setAuthorRoot] = useState("");
  const [filteredSeriesTagList, setFilteredSeriesTagList] = useState<TagInfo[]>(
    []
  );
  const [filteredCharacterTagList, setFilteredCharacterTagList] = useState<
    TagInfo[]
  >([]);

  useEffect(() => {
    setFilteredSeriesTagList(availableTagList);
    setFilteredCharacterTagList(availableTagList);
  }, [setFilteredCharacterTagList, setFilteredSeriesTagList, availableTagList]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const root: string | null = await invoke("get_character_root");
        const author: string | null = await invoke("get_author_root");
        if (root) {
          setCharacterRoot(root);
        }
        if (author) {
          setAuthorRoot(author);
        }
        await loadSummary();
        const tags = await invoke<TagInfo[]>("get_available_unique_tags");
        setAvailableTagList(tags);
      } catch (error) {
        console.error("Error initialize file-organizer:", error);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
    const unlisten = listen<null>("update_db", () => {
      void initialize();
    });
    return () => {
      void unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAssignment = async () => {
    if (!selectedSeriesTag && !selectedCharacterTag) {
      return;
    }

    setLoading(true);
    try {
      const assignment: TagAssignment = {
        id: null,
        series: selectedSeriesTag || null,
        character: selectedCharacterTag || null,
      };
      const summary: CollectSummary[] = await invoke("assign_collect", {
        assignment,
      });
      setCollectSummary(summary);
      if (!selectedCharacterTag) {
        void onChangeSeriesPulldown("");
      }
      void onChangeCharacterPulldown("");
    } finally {
      setLoading(false);
    }
  };

  const performCollect = async () => {
    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("perform_collect");
      setCollectSummary(summary);
    } finally {
      setLoading(false);
    }
  };

  const setRoot = async () => {
    if (!characterRoot.trim()) {
      return;
    }

    setLoading(true);
    try {
      await invoke("set_root", {
        characterRoot: characterRoot,
        authorRoot: authorRoot,
      });
      setIsChangeRoot(false);
      void loadSummary();
    } finally {
      setLoading(false);
    }
  };

  const selectFolders = async (): Promise<string | null> => {
    try {
      return await open({
        directory: true,
        multiple: false,
        title: "Select folders containing images",
      });
    } catch (error) {
      console.error("Error selecting folders:", error);
      return null;
    }
  };

  const onChangeSeriesPulldown = async (value: string) => {
    setSelectedSeriesTag(value);
    try {
      const list: TagInfo[] = await invoke("get_related_tags", { tag: value });
      setFilteredCharacterTagList(list.length > 0 ? list : availableTagList);
    } catch (error) {
      console.error(error);
    }
  };

  const onChangeCharacterPulldown = async (value: string) => {
    setSelectedCharacterTag(value);
    try {
      const list: TagInfo[] = await invoke("get_related_tags", { tag: value });
      setFilteredSeriesTagList(list.length > 0 ? list : availableTagList);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-screen p-2 flex flex-col min-h-0">
      {/* 上部コントロール */}
      <div className="flex gap-2 mb-2">
        {/* ルート設定 */}
        <div className="items-center gap-3 p-2 rounded border">
          <Label className="text-xs mb-2">Collection Root Settings</Label>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="change-root"
              checked={isChangeRoot}
              onCheckedChange={(checked) => setIsChangeRoot(checked === true)}
            />
            <Label htmlFor="change-root" className="text-xs">
              Change Root
            </Label>
            <Button
              onClick={() => void setRoot()}
              disabled={loading || !isChangeRoot}
              size="sm"
              className="text-xs bg-orange-600 hover:bg-orange-700"
            >
              <ArrowBigRightDash />
              Update
            </Button>
          </div>
          <div className="flex gap-2 mb-2">
            <Label className="text-xs w-12">character</Label>
            <Input
              value={characterRoot}
              onChange={(e) => setCharacterRoot(e.target.value)}
              onDoubleClick={() =>
                void selectFolders().then((selected) =>
                  setCharacterRoot(selected ?? "")
                )
              }
              placeholder=""
              className="text-xs h-6 w-85"
              disabled={!isChangeRoot}
            />
          </div>
          <div className="flex gap-2">
            <Label className="text-xs w-12">author</Label>
            <Input
              value={authorRoot}
              onChange={(e) => setAuthorRoot(e.target.value)}
              onDoubleClick={() =>
                void selectFolders().then((selected) =>
                  setAuthorRoot(selected ?? "")
                )
              }
              placeholder=""
              className="text-xs h-6 w-85"
              disabled={!isChangeRoot}
            />
          </div>
        </div>

        {/* タグ振り分け - プルダウン上にラベル */}
        <div className="p-2 rounded border">
          <Label className="text-xs mb-2">Character Collect Operation</Label>
          <div className="flex items-center gap-2 pb-2">
            <Button
              onClick={() => void addAssignment()}
              disabled={
                (!selectedSeriesTag && !selectedCharacterTag) || loading
              }
              size="sm"
              className="text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Plus />
              Add item
            </Button>

            <Button
              onClick={() => void performCollect()}
              disabled={loading}
              size="sm"
              className="text-xs bg-purple-600 hover:bg-purple-700"
            >
              <Play />
              Execute
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <Label className="text-xs text-blue-700 mb-1">Series</Label>
              <InputDropdown
                value={selectedSeriesTag}
                valueKey="tag"
                onChange={(v) => void onChangeSeriesPulldown(v)}
                items={filteredSeriesTagList}
                placeholder="Select tag"
                inputClassName="border-blue-200 dark:border-blue-800 h-8 w-50"
              />
            </div>

            <div className="flex flex-col">
              <Label className="text-xs text-green-700 mb-1">Character</Label>
              <InputDropdown
                value={selectedCharacterTag}
                valueKey="tag"
                onChange={(v) => void onChangeCharacterPulldown(v)}
                items={filteredCharacterTagList}
                placeholder="Select tag"
                inputClassName="border-green-200 dark:border-green-800 h-8 w-50"
              />
            </div>
          </div>
        </div>

        {/* DB管理 */}
        <div className="p-2 rounded border">
          <Label className="text-xs mb-2">Database Control</Label>
          <Button
            onClick={() => void syncDB()}
            disabled={loading}
            size="sm"
            className="text-xs bg-purple-600 hover:bg-purple-700"
          >
            <Database />
            Sync DB
          </Button>
        </div>
      </div>
      <ResultArea />

      <SyncResultsDialog />
    </div>
  );
}
