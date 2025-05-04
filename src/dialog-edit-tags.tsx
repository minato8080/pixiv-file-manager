import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SearchResult } from "@/bindings/SearchResult";
import { EditTagReq } from "@/bindings/EditTagReq";
import { OverwriteModeUI } from "./dialog-edit-tags-overwrite-ui";
import { AddRemoveModeUI } from "./dialog-edit-tags-add-remove-ui";

export type DialogEditTagsHandle = {
  open: (items: SearchResult[]) => void;
  close: () => void;
};

export type TagState = {
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
