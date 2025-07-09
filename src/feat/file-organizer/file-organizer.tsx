import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Settings, Save, Plus, FolderOpen } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { mockApi } from "./mock-api";
import { ResultArea } from "./result-area";

import { CollectSummary } from "@/bindings/CollectSummary";
import { GeneralResponse } from "@/bindings/GeneralResponse";
import { TagAssignment } from "@/bindings/TagAssignment";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputDropdown } from "@/src/components/input-dropdown";
import { useDropdownStore } from "@/src/stores/dropdown-store";
import { useTagsOrganizerStore } from "@/src/stores/tags-organizer-store";

export default function FileOrganizer() {
  const { unassignedTags, setCollectSummary, setUnassignedTags } =
    useTagsOrganizerStore();

  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [selectedSeriesTag, setSelectedSeriesTag] = useState<string>("");
  const [selectedCharacterTag, setSelectedCharacterTag] = useState<string>("");
  const [isChangeRoot, setIsChangeRoot] = useState(false);
  const [rootPath, setRootPath] = useState("");
  const [loading, setLoading] = useState(false);

  const maxCount = useRef(0);

  const { uniqueTagList } = useDropdownStore();

  useEffect(() => {
    const usedSeriesTags = tagAssignments
      .map((a) => a.series_tag)
      .filter(Boolean);
    const usedCharacterTags = tagAssignments
      .map((a) => a.character_tag)
      .filter(Boolean);
    const unassignedTags = uniqueTagList
      .filter(
        (tag) =>
          !usedSeriesTags.includes(tag.tag) &&
          !usedCharacterTags.includes(tag.tag)
      )
      .map((tag) => tag.tag);
    setUnassignedTags(unassignedTags);
  }, [setUnassignedTags, tagAssignments, uniqueTagList]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const root: string | null = await invoke("get_root");
        if (!root) {
          setIsChangeRoot(true);
        } else {
          setRootPath(root);
        }
        await loadSummary();
      } finally {
        setLoading(false);
      }
    };

    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("load_assignments");
      maxCount.current =
        Math.max(...summary.map((item) => item.after_count)) + 1;
      console.log("summary:", summary);
      setCollectSummary(summary);
    } finally {
      setLoading(false);
    }
  };

  const addAssignment = async () => {
    if (!selectedSeriesTag && !selectedCharacterTag) {
      return;
    }

    setLoading(true);
    try {
      const assignment: TagAssignment = {
        id: (maxCount.current += 1),
        series_tag: selectedSeriesTag || null,
        character_tag: selectedCharacterTag || null,
      };
      const summary: CollectSummary[] = await invoke("assign_tag", {
        assignment,
      });
      setCollectSummary(summary);
      setSelectedSeriesTag("");
      setSelectedCharacterTag("");
    } finally {
      setLoading(false);
    }
  };

  const removeAssignment = async (itemId: number) => {
    setLoading(true);
    try {
      const assignment: TagAssignment = {
        id: itemId,
        series_tag: null,
        character_tag: null,
      };
      const summary: CollectSummary[] = await invoke("assign_tag", {
        assignment,
      });
      setCollectSummary(summary);
      setSelectedSeriesTag("");
      setSelectedCharacterTag("");
    } finally {
      setLoading(false);
    }
  };

  const saveAssignments = async () => {
    setLoading(true);
    try {
      await mockApi.saveAssignments(tagAssignments);
    } finally {
      setLoading(false);
    }
  };

  const performCollect = async () => {
    if (tagAssignments.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const result = await mockApi.performCollect();
      if (result.success) {
        setTagAssignments([]);
        const { summary } = await mockApi.getCollectSummary([], []);
        setCollectSummary(summary);
      }
    } finally {
      setLoading(false);
    }
  };

  const setRoot = async () => {
    if (!rootPath.trim()) {
      return;
    }

    setLoading(true);
    try {
      const result: GeneralResponse = await invoke("set_root", {
        root: rootPath,
      });
      if (result.success) {
        setIsChangeRoot(false);
        void loadSummary();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to select folders
  const selectFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select folders containing images",
      });
      if (!selected) return;
      setRootPath(selected[0]);
    } catch (error) {
      console.error("Error selecting folders:", error);
    }
  };

  return (
    <div className="h-screen p-2 flex flex-col">
      {/* 上部コントロール */}
      <div className="flex gap-4 mb-2">
        <div className="items-center gap-3  p-2 rounded border">
          {/* ルート設定 */}
          <div className="flex items-center gap-3 pb-2">
            <Settings className="w-3 h-3 text-orange-600" />
            <Checkbox
              id="change-root"
              checked={isChangeRoot}
              onCheckedChange={(checked) => setIsChangeRoot(checked === true)}
            />
            <Label htmlFor="change-root" className="text-xs">
              Change Root
            </Label>
            <Button
              onClick={() => void selectFolders()}
              disabled={loading || !isChangeRoot}
              className="flex items-center h-6 bg-green-600 hover:bg-green-700"
            >
              <FolderOpen className="h-2 w-2" />
            </Button>
            <Button
              onClick={() => void setRoot()}
              disabled={loading || !isChangeRoot}
              size="sm"
              className="h-6 text-xs bg-orange-600 hover:bg-orange-700"
            >
              Set
            </Button>
          </div>
          <Input
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder=""
            className="text-xs h-6 w-80"
            disabled={!isChangeRoot}
          />{" "}
        </div>

        {/* タグ振り分け - プルダウン上にラベル */}
        <div className="p-2 rounded border">
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <Label className="text-xs text-blue-700 mb-1">Series</Label>
              <InputDropdown
                value={selectedSeriesTag}
                onChange={setSelectedSeriesTag}
                items={unassignedTags}
                placeholder="Select tag"
                valueKey={(item) => item}
                inputClassName="border-blue-200 dark:border-blue-800 h-8"
              />
            </div>

            <div className="flex flex-col">
              <Label className="text-xs text-green-700 mb-1">Character</Label>
              <InputDropdown
                value={selectedCharacterTag}
                onChange={setSelectedCharacterTag}
                items={unassignedTags}
                placeholder="Select tag"
                valueKey={(item) => item}
                inputClassName="border-green-200 dark:border-green-800 h-8"
              />
            </div>

            <Button
              onClick={() => void addAssignment()}
              disabled={
                (!selectedSeriesTag && !selectedCharacterTag) || loading
              }
              size="sm"
              className="text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>

            <Button
              onClick={() => void saveAssignments()}
              disabled={loading || tagAssignments.length === 0}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>

            <Button
              onClick={() => void performCollect()}
              disabled={loading || tagAssignments.length === 0}
              size="sm"
              className="text-xs bg-purple-600 hover:bg-purple-700"
            >
              Execute
            </Button>
          </div>
        </div>
      </div>
      <ResultArea removeAssignment={removeAssignment} />
    </div>
  );
}
