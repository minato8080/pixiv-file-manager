import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Settings, Trash2, Save, Plus, Edit3, FolderOpen } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { mockApi } from "./mock-api";

import { CollectSummary } from "@/bindings/CollectSummary";
import { GeneralResponse } from "@/bindings/GeneralResponse";
import { TagAssignment } from "@/bindings/TagAssignment";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InputDropdown } from "@/src/components/input-dropdown";
import { useDropdownStore } from "@/src/stores/dropdown-store";

interface EditingState {
  id: number;
  field: "series_tag" | "character_tag";
}

export default function FileOrganizer() {
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [collectSummary, setCollectSummary] = useState<CollectSummary[]>([]);
  const [selectedSeriesTag, setSelectedSeriesTag] = useState<string>("");
  const [selectedCharacterTag, setSelectedCharacterTag] = useState<string>("");
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [isChangeRoot, setIsChangeRoot] = useState(false);
  const [rootPath, setRootPath] = useState("");
  const [loading, setLoading] = useState(false);
  const maxCount = useRef(0);

  const { uniqueTagList } = useDropdownStore();
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

  const saveAssignments = async () => {
    setLoading(true);
    try {
      await mockApi.saveAssignments(tagAssignments);
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

  const updateItemField = async (
    itemId: number,
    field: "series_tag" | "character_tag",
    value: string
  ) => {
    const newItem = collectSummary.find((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    if (!newItem) return;

    setCollectSummary((prev) => [...prev, newItem]);
    const assignment: TagAssignment = {
      id: newItem.id,
      series_tag: newItem.series_tag,
      character_tag: newItem.character_tag,
    };
    console.log(newItem, assignment, field, value);
    await invoke("assign_tag", {
      assignment,
    });
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

  const renderEditableField = (
    item: CollectSummary,
    field: "series_tag" | "character_tag"
  ) => {
    const isEditing =
      editingState?.id === item.id && editingState?.field === field;
    const value = item[field];
    const options = unassignedTags;

    if (isEditing) {
      return (
        <Select
          value={value ?? "__unset__"}
          onValueChange={(newValue) =>
            void updateItemField(item.id, field, newValue)
          }
          onOpenChange={(open) => {
            if (!open) setEditingState(null);
          }}
          open={true}
        >
          <SelectTrigger className="h-5 text-xs min-w-32">
            <SelectValue placeholder="Unset" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="__unset__">Unset</SelectItem>
            {options.map((tag) => (
              <SelectItem key={tag} value={tag} className="text-xs">
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <span
        className={`cursor-pointer hover:bg-gray-100 px-1 rounded text-xs whitespace-nowrap ${
          item.is_new ? "bg-blue-200 text-blue-800" : ""
        } ${!value ? "text-gray-400" : ""} ${
          field === "series_tag" ? "text-blue-700" : "text-green-700"
        }`}
        onClick={() =>
          item.id !== -1 && setEditingState({ id: item.id, field })
        }
      >
        {value ?? "-"}
        {item.id !== -1 && <Edit3 className="w-2 h-2 inline ml-1" />}
      </span>
    );
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

      {/* 振り分け状況一覧 */}
      <div className="flex-1  border rounded overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-100">
              <TableRow>
                <TableHead className="text-xs py-1 min-w-32">Series</TableHead>
                <TableHead className="text-xs py-1 min-w-32">
                  Character
                </TableHead>
                <TableHead className="text-xs py-1 text-right w-20">
                  Before
                </TableHead>
                <TableHead className="text-xs py-1 text-right w-20">
                  After
                </TableHead>
                <TableHead className="text-xs py-1 min-w-48">
                  New Path
                </TableHead>
                <TableHead className="text-xs py-1 w-12">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectSummary.map((item) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="py-0.5">
                    {renderEditableField(item, "series_tag")}
                  </TableCell>
                  <TableCell className="py-0.5">
                    {renderEditableField(item, "character_tag")}
                  </TableCell>
                  <TableCell className="text-xs text-right py-0.5">
                    {item.before_count}
                  </TableCell>
                  <TableCell className="text-xs text-right py-0.5">
                    <span
                      className={
                        item.after_count > 0 ? "text-green-700 font-medium" : ""
                      }
                    >
                      {item.after_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-0.5 text-gray-800 font-mono whitespace-nowrap">
                    {item.new_path}
                  </TableCell>
                  <TableCell className="py-0.5">
                    {item.id !== -1 && (
                      <Button
                        onClick={() => void removeAssignment(item.id)}
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
