import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from "react";
import { X, Plus, Edit, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export type DialogEditTagsHandle = {
  open: (items: SearchResult[]) => void;
  close: () => void;
};

type TagState = {
  value: string;
  status: "unchanged" | "deleted" | "edited" | "added";
  originalValue?: string;
};

export type FileTagState = {
  fileId: number;
  fileName: string;
  tags: TagState[];
};

type Props = {
  onSubmit: (form: EditTagReq[]) => Promise<void>;
};

type OverwriteModeHandle = {
  open: (items: SearchResult[]) => void;
  close: () => void;
  getForm: () => EditTagReq[];
};

type AddRemoveModeHandle = {
  close: () => void;
  fileTagStates: FileTagState[];
  getForm: () => EditTagReq[];
};

const OverwriteModeUI = forwardRef<
  OverwriteModeHandle,
  { selectedFiles: SearchResult[] }
>(({ selectedFiles }, ref) => {
  const [tags, setTags] = useState<TagState[]>([]);
  const [selectedFileForTags, setSelectedFileForTags] = useState<string | null>(
    null
  );
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = useState<string>("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setTags([]);
    setSelectedFileForTags(null);
    setEditingTagIndex(null);
    setEditingTagValue("");
  };

  const createForm = (): EditTagReq[] => {
    // In overwrite mode, apply the same tags to all files
    const finalTags = tags
      .filter((tag) => tag.status !== "deleted")
      .map((tag) => tag.value);

    const form: EditTagReq[] = selectedFiles.map((file) => ({
      file_name: file.file_name,
      tags: finalTags,
    }));
    return form;
  };

  useImperativeHandle(ref, () => ({
    open: (items) => {
      if (items.length > 0) {
        // Default to the first file's tags
        const firstFileTags = items[0].tags
          ? items[0].tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];
        setTags(
          firstFileTags.map((tag) => ({ value: tag, status: "unchanged" }))
        );
        setSelectedFileForTags(`${items[0].file_name}`);
      }
    },
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
    if (addInputRef.current?.value) {
      const newTag = addInputRef.current.value.trim();
      if (newTag && !tags.some((tag) => tag.value === newTag)) {
        setTags((prevTags) => [
          ...prevTags,
          { value: newTag, status: "added" },
        ]);
        addInputRef.current.value = "";
      }
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
            value={selectedFileForTags || ""}
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
          <Input
            ref={addInputRef}
            placeholder="Add new tag"
            onKeyDown={handleKeyDown}
            className="border-blue-200 dark:border-blue-800 h-8"
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

const AddRemoveModeUI = forwardRef<
  AddRemoveModeHandle,
  { selectedFiles: SearchResult[] }
>(({ selectedFiles }, ref) => {
  const [fileTagStates, setFileTagStates] = useState<FileTagState[]>([]);
  const [tagsToAdd, setTagsToAdd] = useState<string>("");
  const [tagsToRemove, setTagsToRemove] = useState<string>("");
  const [allExistingTags, setAllExistingTags] = useState<string[]>([]);

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

  useImperativeHandle(ref, () => ({
    close: resetState,
    fileTagStates,
    getForm: () =>
      fileTagStates.map((fileState) => ({
        file_name: fileState.fileName,
        tags: fileState.tags
          .filter((tag) => tag.status !== "deleted")
          .map((tag) => tag.value),
      })),
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800">
        <div className="space-y-1">
          <Label className="text-green-600 text-xs">
            Add tags to all files:
          </Label>
          <div className="flex space-x-1">
            <Input
              value={tagsToAdd}
              onChange={(e) => setTagsToAdd(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="border-green-200 dark:border-green-800 h-8"
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
              <CardContent className="p-2 grid grid-cols-2 gap-2">
                <div className="flex flex-wrap gap-1 p-1 min-h-[40px] border rounded-md bg-slate-50 dark:bg-slate-800">
                  {fileState.tags
                    .filter((tag) => tag.status !== "added")
                    .map((tag, index) => (
                      <Badge
                        key={`before-${fileState.fileId}-${index}`}
                        variant="secondary"
                        className="bg-slate-200 dark:bg-slate-700 h-5 text-xs"
                      >
                        {tag.originalValue || tag.value}
                      </Badge>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1 p-1 min-h-[40px] border rounded-md bg-slate-50 dark:bg-slate-800">
                  {fileState.tags
                    .filter((tag) => tag.status !== "deleted")
                    .map((tag, index) => (
                      <Badge
                        key={`after-${fileState.fileId}-${index}`}
                        variant="secondary"
                        className={`
                      h-5 text-xs
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

export const DialogEditTags = forwardRef<DialogEditTagsHandle, Props>(
  (props, ref) => {
    const [selectedFiles, setSelectedFiles] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOverwriteMode, setIsOverwriteMode] = useState(false);

    const overwriteModeUIRef = useRef<OverwriteModeHandle>(null);
    const addRemoveHandleRef = useRef<AddRemoveModeHandle>(null);

    const resetState = () => {
      setSelectedFiles([]);
      setIsOverwriteMode(false);
    };

    const close = () => {
      resetState();
      setIsOpen(false);
      overwriteModeUIRef.current?.close();
      addRemoveHandleRef.current?.close();
    };

    useImperativeHandle(ref, () => ({
      open: (items) => {
        setSelectedFiles(items);
        setIsOpen(true);
        overwriteModeUIRef.current?.open(items);
      },
      close,
    }));

    // Handle form submission
    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        if (isOverwriteMode) {
          const form = overwriteModeUIRef.current?.getForm();
          if (form) await props.onSubmit(form);
        } else {
          const form = addRemoveHandleRef.current?.getForm();
          if (form) await props.onSubmit(form);
        }

        close();
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={(b) => !b && close()}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle
              className={isOverwriteMode ? "text-blue-600" : "text-green-600"}
            >
              Edit Tags
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3 overflow-y-auto">
            <div className="flex items-center space-x-2 p-2 rounded-lg">
              <Switch
                id="mode-switch"
                checked={isOverwriteMode}
                onCheckedChange={setIsOverwriteMode}
                className={
                  isOverwriteMode
                    ? "data-[state=checked]:bg-blue-500"
                    : "data-[state=unchecked]:bg-green-500"
                }
              />
              <Label htmlFor="mode-switch" className="font-medium">
                {isOverwriteMode ? "Overwrite Mode" : "Add/Remove Mode"}
              </Label>
            </div>

            {/* Main UI */}
            <div className={isOverwriteMode ? "" : "hidden"}>
              <OverwriteModeUI
                ref={overwriteModeUIRef}
                selectedFiles={selectedFiles}
              />
            </div>
            <div className={isOverwriteMode ? "hidden" : ""}>
              <AddRemoveModeUI
                ref={addRemoveHandleRef}
                selectedFiles={selectedFiles}
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {selectedFiles.length > 1
                ? `This will update tags for ${selectedFiles.length} files.`
                : "This will update tags for 1 file."}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={close} size="sm">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={
                  isOverwriteMode
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }
                size="sm"
              >
                {isSubmitting ? "Saving..." : "Save Tags"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
DialogEditTags.displayName = "DialogEditTags";
