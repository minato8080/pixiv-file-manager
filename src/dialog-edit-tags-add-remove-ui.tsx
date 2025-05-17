import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchResult } from "@/bindings/SearchResult";
import { EditTagReq } from "@/bindings/EditTagReq";
import { FileTagState } from "./dialog-edit-tags";
import { InputDropdown } from "./input-dropdown";
import { TagInfo } from "@/bindings/TagInfo";
import { EditTag } from "@/bindings/EditTag";

type AddRemoveModeHandle = {
  close: () => void;
  getForm: () => EditTagReq;
};

type AddRemoveModeProps = {
  selectedFiles: SearchResult[];
  uniqueTagList: TagInfo[];
};

export const AddRemoveModeUI = forwardRef<
  AddRemoveModeHandle,
  AddRemoveModeProps
>(({ selectedFiles, uniqueTagList }, ref) => {
  const [fileTagStates, setFileTagStates] = useState<FileTagState[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagsToAdd, setTagsToAdd] = useState<string>("");
  const [tagsToRemove, setTagsToRemove] = useState<string>("");
  const [allExistingTags, setAllExistingTags] = useState<string[]>([]);

  // Extract all unique tags from selected files
  useEffect(() => {
    setAvailableTags(uniqueTagList.map((p) => p.tag));
  }, [uniqueTagList]);

  // Extract all unique tags from selected files
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const uniqueTags = new Set<string>();

      selectedFiles.forEach((file) => {
        if (file.tags) {
          file.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .forEach((tag) => uniqueTags.add(tag));
        }
      });

      setAllExistingTags(Array.from(uniqueTags).sort());
    }
  }, [selectedFiles]);

  // Initialize file tag states for add/remove mode
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const initialFileTagStates = selectedFiles.map((file) => ({
        fileId: file.id,
        fileName: file.file_name,
        tags: file.tags
          ? file.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag) => ({ value: tag, status: "unchanged" as const }))
          : [],
      }));

      setFileTagStates(initialFileTagStates);
    }
  }, [selectedFiles]);

  const resetState = () => {
    setFileTagStates([]);
    setTagsToAdd("");
    setTagsToRemove("");
    setAllExistingTags([]);
  };

  const createForm = (): EditTagReq => {
    const vec: EditTag[] = fileTagStates.map((fileState) => ({
      file_name: fileState.fileName,
      individual_tags: fileState.tags
        .filter((tag) => tag.status !== "deleted")
        .map((tag) => tag.value),
    }));
    return { vec, overwrite_tags: null };
  };

  useImperativeHandle(ref, () => ({
    close: resetState,
    getForm: () => createForm(),
  }));

  // Add tags in add/remove mode
  const handleAddTagsToAll = () => {
    if (tagsToAdd) {
      const tagsArray = tagsToAdd
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      setTagsToAdd("");

      // Update each file's tags
      setFileTagStates((prevFileTagStates) =>
        prevFileTagStates.map((fileState) => ({
          ...fileState,
          tags: [
            ...fileState.tags,
            ...tagsArray
              .filter((tag) => !fileState.tags.some((t) => t.value === tag))
              .map((tag) => ({ value: tag, status: "added" as const })),
          ],
        }))
      );

      setAllExistingTags((prevTags) => [...prevTags, tagsToAdd]);
    }
  };

  // Remove tags in add/remove mode
  const handleRemoveTagsFromAll = () => {
    if (tagsToRemove) {
      const tagsArray = tagsToRemove
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      setTagsToRemove("");

      // Mark tags for removal in all files
      setFileTagStates((prevFileTagStates) =>
        prevFileTagStates.map((fileState) => ({
          ...fileState,
          tags: fileState.tags.map((tag) =>
            tagsArray.includes(tag.value) ? { ...tag, status: "deleted" } : tag
          ),
        }))
      );
      setAllExistingTags((prevTags) =>
        prevTags.filter((tag) => tag !== tagsToRemove)
      );
    }
  };

  // Handle key press in add tag input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTagsToAll();
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800">
        <div className="space-y-1">
          <Label className="text-green-600 text-xs">
            Add tags to all files:
          </Label>
          <div className="flex space-x-1">
            <InputDropdown
              items={availableTags}
              valueKey={(item) => item}
              placeholder="Add new tag"
              value={tagsToAdd}
              onChange={setTagsToAdd}
              onKeyDown={handleKeyDown}
              inputClassName="border-green-200 dark:border-green-800 h-8"
              dropdownClassName="h-50"
            />
            <Button
              onClick={handleAddTagsToAll}
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white h-8 px-2"
            >
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-red-600 text-xs">
            Remove tags from all files:
          </Label>
          <div className="flex space-x-1">
            <Select onValueChange={setTagsToRemove}>
              <SelectTrigger className="border-red-200 dark:border-red-800  w-full">
                <SelectValue placeholder="Select a tag to remove" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {allExistingTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleRemoveTagsFromAll}
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white h-8 px-2"
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-2 space-y-2">
          {fileTagStates.map((fileState) => (
            <Card
              key={fileState.fileId}
              className="border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <CardHeader className="py-1 px-3 bg-slate-100 dark:bg-slate-800">
                <CardTitle className="text-xs font-medium">
                  {fileState.fileName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 p-1 min-h-[40px] border rounded-md bg-slate-50 dark:bg-slate-800">
                  {fileState.tags.map((tag, index) => (
                    <Badge
                      key={`after-${fileState.fileId}-${index}`}
                      variant="secondary"
                      className={`
                      h-5 text-xs
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
                      ${
                        tag.status === "unchanged"
                          ? "bg-slate-200 dark:bg-slate-700"
                          : ""
                      }
                    `}
                    >
                      {tag.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
AddRemoveModeUI.displayName = "AddRemoveModeUI";
