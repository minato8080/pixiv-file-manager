import React, { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputDropdown } from "@/src/components/input-dropdown";
import { useDialogEditStore } from "@/src/stores/dialog-edit-store";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const AddRemoveModeUI = () => {
  const {
    fileTagStates,
    availableTags,
    tagToAdd,
    allExistingTags,
    setFileTagStates,
    setTagToAdd,
    setTagToRemove,
    setAllExistingTags,
    addTagsToAll,
    removeTagsFromAll,
  } = useDialogEditStore();
  const { selectedFiles } = useTagSearcherStore();

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
  }, [selectedFiles, setAllExistingTags]);

  // Initialize file tag states for add/remove mode
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const initialFileTagStates = selectedFiles.map((file) => ({
        fileId: file.illust_id,
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
  }, [selectedFiles, setFileTagStates]);

  // Handle key press in add tag input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addTagsToAll();
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
              placeholder="Add new tag"
              value={tagToAdd}
              onChange={setTagToAdd}
              onKeyDown={handleKeyDown}
              inputClassName="border-green-200 dark:border-green-800 h-8"
              dropdownClassName="max-h-50"
            />
            <Button
              onClick={addTagsToAll}
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
            <Select onValueChange={setTagToRemove}>
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
              onClick={removeTagsFromAll}
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
};
AddRemoveModeUI.displayName = "AddRemoveModeUI";
