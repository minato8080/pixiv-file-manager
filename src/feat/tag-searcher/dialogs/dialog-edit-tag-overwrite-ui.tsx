import { X, Plus, Edit, Check } from "lucide-react";
import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from "react";

import { TagState } from "./dialog-edit-tag";

import { EditTag } from "@/bindings/EditTag";
import { EditTagReq } from "@/bindings/EditTagReq";
import { SearchResult } from "@/bindings/SearchResult";
import { TagInfo } from "@/bindings/TagInfo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputDropdown } from "@/src/components/input-dropdown";

type OverwriteModeHandle = {
  close: () => void;
  getForm: () => EditTagReq;
};

type OverwriteModeProps = {
  selectedFiles: SearchResult[];
  uniqueTagList: TagInfo[];
};

export const OverwriteModeUI = forwardRef<
  OverwriteModeHandle,
  OverwriteModeProps
>(({ selectedFiles, uniqueTagList }, ref) => {
  const [tags, setTags] = useState<TagState[]>([]);
  const [selectedFileForTags, setSelectedFileForTags] = useState<string>("");
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = useState<string>("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [inputValue, setInputvalue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setTags([]);
    setSelectedFileForTags("");
    setEditingTagIndex(null);
    setEditingTagValue("");
  };

  const createForm = (): EditTagReq => {
    // In overwrite mode, apply the same tags to all files
    const finalTags = tags
      .filter((tag) => tag.status !== "deleted")
      .map((tag) => tag.value);

    const vec: EditTag[] = selectedFiles.map((file) => ({
      file_name: file.file_name,
      individual_tags: null,
    }));
    return { vec, overwrite_tags: finalTags };
  };
  // Extract all unique tags from selected files
  useEffect(() => {
    setAvailableTags(uniqueTagList.map((p) => p.tag));
  }, [uniqueTagList]);

  useEffect(() => {
    if (selectedFiles.length > 0) {
      // Default to the first file's tags
      const firstFileTags = selectedFiles[0].tags
        ? selectedFiles[0].tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      setTags(
        firstFileTags.map((tag) => ({ value: tag, status: "unchanged" }))
      );
      setSelectedFileForTags(`${selectedFiles[0].file_name}`);
    }
  }, [selectedFiles]);

  useImperativeHandle(ref, () => ({
    close: resetState,
    getForm: createForm,
  }));

  // Update tags when a different file is selected from the dropdown
  const handleFileTagsSelect = (fileName: string) => {
    setSelectedFileForTags(fileName);
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
      setTags(fileTags.map((tag) => ({ value: tag, status: "unchanged" })));
    }
  };

  // Handle tag deletion in overwrite mode
  const handleDeleteTag = (index: number) => {
    setTags((prevTags) => {
      // If the tag was newly added, remove it completely
      if (prevTags[index].status === "added") {
        return prevTags.filter((_, i) => i !== index);
      }
      // Otherwise mark it as deleted
      return prevTags.map((tag, i) =>
        i === index
          ? {
              ...tag,
              status: tag.status === "deleted" ? "unchanged" : "deleted",
            }
          : tag
      );
    });
  };

  // Start editing a tag
  const handleEditTag = (index: number) => {
    setEditingTagIndex(index);
    setEditingTagValue(tags[index].value);
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 0);
  };
  // Handle key press in edit input
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Handle key press in add tag input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTag();
    }
  };

  // Save edited tag
  const handleSaveEdit = () => {
    if (editingTagIndex !== null) {
      setTags((prevTags) =>
        prevTags.map((tag, i) =>
          i === editingTagIndex
            ? {
                value: editingTagValue,
                status: tag.value !== editingTagValue ? "edited" : "unchanged",
                originalValue:
                  tag.status === "unchanged" ? tag.value : tag.originalValue,
              }
            : tag
        )
      );
      setEditingTagIndex(null);
      setEditingTagValue("");
    }
  };

  // Add a new tag in overwrite mode
  const handleAddTag = () => {
    if (!tags.some((tag) => tag.value === inputValue)) {
      setTags((prevTags) => [
        ...prevTags,
        { value: inputValue, status: "added" },
      ]);
      setInputvalue("");
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTagIndex(null);
    setEditingTagValue("");
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 flex-1">
          <Label
            htmlFor="file-select"
            className="text-blue-600 whitespace-nowrap"
          >
            Select file:
          </Label>
          <Select
            value={selectedFileForTags}
            onValueChange={handleFileTagsSelect}
          >
            <SelectTrigger className="border-blue-200 dark:border-blue-800 h-8">
              <SelectValue placeholder="Select a file" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {selectedFiles.map((file) => (
                <SelectItem key={file.id} value={file.file_name}>
                  {file.file_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <InputDropdown
            items={availableTags}
            placeholder="Add new tag"
            value={inputValue}
            onChange={setInputvalue}
            onKeyDown={handleKeyDown}
            inputClassName="border-blue-200 dark:border-blue-800 h-8"
            dropdownClassName="h-30"
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

      <div className="flex flex-wrap gap-2 p-2 min-h-[80px] border rounded-md bg-slate-50 dark:bg-slate-800">
        {tags.map((tag, index) =>
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
              className={`
          h-7 flex items-center
          ${
            tag.status === "deleted"
              ? "line-through opacity-70 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
              : ""
          }
          ${
            tag.status === "edited"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              : ""
          }
          ${
            tag.status === "added"
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
              : ""
          }
          ${tag.status === "unchanged" ? "bg-slate-200 dark:bg-slate-700" : ""}
        `}
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
});
OverwriteModeUI.displayName = "OverwriteModeUI";
