import { X, Plus, Edit, Check, History, File } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputDropdown } from "@/src/components/input-dropdown";
import { useDialogEditStore } from "@/src/stores/dialog-edit-store";
import { useHistoryStore } from "@/src/stores/history-store";

export const OverwriteModeUI = () => {
  const {
    selectedFiles,
    overwriteTags,
    editingTagIndex,
    editingTagValue,
    availableTags,
    tagToOverwrite,
    setOverwriteTags,
    setEditingTagIndex,
    setEditingTagValue,
    setTagToOverwrite,
  } = useDialogEditStore();

  const { overwriteHistory } = useHistoryStore();

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFiles.length > 0) {
      // Default to the first file's tags
      setOverwriteTags([]);
    }
  }, [selectedFiles, setOverwriteTags]);

  const handleFileTagsSelect = (fileName: string) => {
    const selectedFile = selectedFiles.find(
      (file) => file.file_name === fileName
    );
    if (selectedFile) {
      const fileTags = selectedFile.tags
        ? selectedFile.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      setOverwriteTags(
        fileTags.map((tag) => ({ value: tag, status: "unchanged" }))
      );
    }
  };

  const handleDeleteTag = (index: number) => {
    if (overwriteTags[index].status === "added") {
      setOverwriteTags(overwriteTags.filter((_, i) => i !== index));
    } else {
      setOverwriteTags(
        overwriteTags.map((tag, i) =>
          i === index
            ? {
                ...tag,
                status: tag.status === "deleted" ? "unchanged" : "deleted",
              }
            : tag
        )
      );
    }
  };

  const handleEditTag = (index: number) => {
    setEditingTagIndex(index);
    setEditingTagValue(overwriteTags[index].value);
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 0);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTag();
    }
  };

  const handleSaveEdit = () => {
    if (editingTagIndex !== null) {
      setOverwriteTags(
        overwriteTags.map((tag, i) =>
          i === editingTagIndex
            ? {
                value: editingTagValue,
                status: tag.value !== editingTagValue ? "edited" : "unchanged",
              }
            : tag
        )
      );
      setEditingTagIndex(null);
      setEditingTagValue("");
    }
  };

  const handleAddTag = () => {
    if (!overwriteTags.some((tag) => tag.value === tagToOverwrite)) {
      setOverwriteTags([
        ...overwriteTags,
        { value: tagToOverwrite, status: "added" },
      ]);
      setTagToOverwrite("");
    }
  };

  const handleCancelEdit = () => {
    setEditingTagIndex(null);
    setEditingTagValue("");
  };

  const handleLoadFromHistory = (historyIndex: string) => {
    const index = Number.parseInt(historyIndex);
    if (index >= 0 && index < overwriteHistory.length) {
      const historicalTags = overwriteHistory[index];
      setOverwriteTags(
        historicalTags.map((v) => ({ value: v, status: "added" }))
      );
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex flex-nowrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4" />
          <Select onValueChange={handleFileTagsSelect}>
            <SelectTrigger className="border-blue-200 dark:border-blue-800 h-8">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {selectedFiles.map((file) => (
                <SelectItem key={file.illust_id} value={file.file_name}>
                  {file.file_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <Select onValueChange={handleLoadFromHistory}>
            <SelectTrigger className="border-blue-200 dark:border-blue-800 h-8 w-38">
              <SelectValue placeholder="Load History" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {overwriteHistory.map((historyEntry, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {`${historyEntry[0]} + ${historyEntry.length - 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <InputDropdown
            items={availableTags}
            placeholder="Add new tag"
            value={tagToOverwrite}
            onChange={setTagToOverwrite}
            onKeyDown={handleKeyDown}
            inputClassName="border-blue-200 dark:border-blue-800 h-8"
            dropdownClassName="max-h-60"
          />
          <Button
            onClick={handleAddTag}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white h-8 px-2"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start content-start gap-2 p-2 min-h-53 border rounded-md bg-slate-50 dark:bg-slate-800">
        {overwriteTags.map((tag, index) =>
          editingTagIndex === index ? (
            <div
              key={index}
              className="flex items-center bg-blue-100 dark:bg-blue-900 rounded-md p-1 h-7"
            >
              <Input
                ref={editInputRef}
                value={editingTagValue}
                onChange={(e) => setEditingTagValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="h-5 w-32 border-blue-300 dark:border-blue-700 px-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-blue-600 p-0"
                onClick={handleSaveEdit}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-red-600 p-0"
                onClick={handleCancelEdit}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Badge
              key={index}
              variant="secondary"
              className={`h-7 flex items-center ${
                tag.status === "deleted"
                  ? "line-through opacity-70 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  : ""
              } ${
                tag.status === "edited"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : ""
              } ${
                tag.status === "added"
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                  : ""
              } ${
                tag.status === "unchanged"
                  ? "bg-slate-200 dark:bg-slate-700"
                  : ""
              }`}
            >
              {tag.value}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:text-blue-600 p-0"
                onClick={() => handleEditTag(index)}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:text-red-600 p-0"
                onClick={() => handleDeleteTag(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )
        )}
      </div>
    </div>
  );
};
OverwriteModeUI.displayName = "OverwriteModeUI";
