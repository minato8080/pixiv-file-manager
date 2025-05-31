import { Settings, Trash2, Save, Plus, Edit3 } from "lucide-react";
import { useState, useEffect } from "react";

import { DropdownInput } from "../dropdown-input";
import { CollectSummary, mockApi, TagAssignment } from "./mock-api";
import { getAvailableTags } from "./mock-data";

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

interface EditingState {
  id: string;
  field: "seriesTag" | "characterTag";
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

  const availableTags = getAvailableTags();
  const usedSeriesTags = tagAssignments.map((a) => a.seriesTag).filter(Boolean);
  const usedCharacterTags = tagAssignments
    .map((a) => a.characterTag)
    .filter(Boolean);
  const unassignedTags = availableTags.filter(
    (tag) => !usedSeriesTags.includes(tag) && !usedCharacterTags.includes(tag)
  );

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const root = await mockApi.getRoot();
        if (!root) {
          setIsChangeRoot(true);
        } else {
          setRootPath(root);
        }

        const savedAssignments = await mockApi.loadAssignments();
        setTagAssignments(savedAssignments);

        const { summary } = await mockApi.getCollectSummary(
          savedAssignments,
          []
        );
        setCollectSummary(summary);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const updateSummary = async () => {
    setLoading(true);
    try {
      const { summary } = await mockApi.getCollectSummary(
        tagAssignments,
        collectSummary
      );
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
      const seriesTag = selectedSeriesTag || null;
      const characterTag = selectedCharacterTag || null;

      const result = await mockApi.assignTag(seriesTag, characterTag);
      if (result.success) {
        setTagAssignments((prev) => [...prev, { seriesTag, characterTag }]);
        setSelectedSeriesTag("");
        setSelectedCharacterTag("");
      }
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

  const removeAssignment = (itemId: string) => {
    const item = collectSummary.find((s) => s.id === itemId);
    if (item) {
      setTagAssignments((prev) =>
        prev.filter(
          (a) =>
            !(
              a.seriesTag === item.seriesTag &&
              a.characterTag === item.characterTag
            )
        )
      );
    }
  };

  const updateItemField = (
    itemId: string,
    field: "seriesTag" | "characterTag",
    value: string
  ) => {
    const item = collectSummary.find((s) => s.id === itemId);
    if (item) {
      const newValue = value === "__unset__" ? null : value;
      setTagAssignments((prev) =>
        prev.map((a) => {
          if (
            a.seriesTag === item.seriesTag &&
            a.characterTag === item.characterTag
          ) {
            return {
              ...a,
              [field]: newValue,
            };
          }
          return a;
        })
      );
      setEditingState(null);
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
      const result = await mockApi.setRoot(rootPath);
      if (result.success) {
        setIsChangeRoot(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void updateSummary();
  }, [tagAssignments]);

  const renderEditableField = (
    item: CollectSummary,
    field: "seriesTag" | "characterTag"
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
            updateItemField(item.id, field, newValue)
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
            {options.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <span
        className={`cursor-pointer hover:bg-gray-100 px-1 rounded text-xs whitespace-nowrap ${
          item.isNewlyAdded ? "bg-blue-200 text-blue-800" : ""
        } ${!value ? "text-gray-400" : ""} ${
          field === "seriesTag" ? "text-blue-700" : "text-green-700"
        }`}
        onClick={() =>
          item.id !== "uncollected" && setEditingState({ id: item.id, field })
        }
      >
        {value ?? "-"}
        {item.id !== "uncollected" && <Edit3 className="w-2 h-2 inline ml-1" />}
      </span>
    );
  };

  return (
    <div className="h-screen p-2 bg-gray-50 flex flex-col">
      {/* 上部コントロール */}
      <div className="flex gap-4 mb-2">
        {/* ルート設定 */}
        <div className="flex items-center gap-3 bg-white p-2 rounded border">
          <Settings className="w-3 h-3 text-orange-600" />
          <Checkbox
            id="change-root"
            checked={isChangeRoot}
            onCheckedChange={(checked) => setIsChangeRoot(checked === true)}
          />
          <Label htmlFor="change-root" className="text-xs">
            Change Root
          </Label>
          <Input
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder=""
            className="text-xs h-6 w-40"
            disabled={!isChangeRoot}
          />
          <Button
            onClick={() => void setRoot}
            disabled={loading}
            size="sm"
            className="h-6 text-xs bg-orange-600 hover:bg-orange-700"
          >
            Set
          </Button>
        </div>

        {/* タグ振り分け - プルダウン上にラベル */}
        <div className="bg-white p-2 rounded border">
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <Label className="text-xs text-blue-700 mb-1">Series</Label>
              <DropdownInput
                value={selectedSeriesTag}
                onValueChange={setSelectedSeriesTag}
                options={unassignedTags}
                placeholder="Select tag"
                className="h-6 text-xs w-28"
              />
            </div>

            <div className="flex flex-col">
              <Label className="text-xs text-green-700 mb-1">Character</Label>
              <DropdownInput
                value={selectedCharacterTag}
                onValueChange={setSelectedCharacterTag}
                options={unassignedTags}
                placeholder="Select tag"
                className="h-6 text-xs w-28"
              />
            </div>

            <Button
              onClick={() => void addAssignment()}
              disabled={
                (!selectedSeriesTag && !selectedCharacterTag) || loading
              }
              size="sm"
              className="h-6 text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>

            <Button
              onClick={() => void saveAssignments()}
              disabled={loading || tagAssignments.length === 0}
              size="sm"
              variant="outline"
              className="h-6 text-xs"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>

            <Button
              onClick={() => void performCollect()}
              disabled={loading || tagAssignments.length === 0}
              size="sm"
              className="h-6 text-xs bg-purple-600 hover:bg-purple-700"
            >
              Execute
            </Button>
          </div>
        </div>
      </div>

      {/* 振り分け状況一覧 */}
      <div className="flex-1 bg-white border rounded overflow-hidden">
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
                    {renderEditableField(item, "seriesTag")}
                  </TableCell>
                  <TableCell className="py-0.5">
                    {renderEditableField(item, "characterTag")}
                  </TableCell>
                  <TableCell className="text-xs text-right py-0.5">
                    {item.beforeCount}
                  </TableCell>
                  <TableCell className="text-xs text-right py-0.5">
                    <span
                      className={
                        item.afterCount > 0 ? "text-green-700 font-medium" : ""
                      }
                    >
                      {item.afterCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-0.5 text-gray-800 font-mono whitespace-nowrap">
                    {item.newPath}
                  </TableCell>
                  <TableCell className="py-0.5">
                    {item.id !== "uncollected" && (
                      <Button
                        onClick={() => removeAssignment(item.id)}
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
