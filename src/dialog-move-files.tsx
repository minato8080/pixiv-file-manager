import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-dropdown-menu";
import { Folder } from "lucide-react";

export type DialogMoveFilesHandle = {
  open: (items: string[], initialName: string) => void;
  close: () => void;
};

type Props = {
  onSubmit: () => Promise<void>;
  onClick: () => Promise<void>;
};

export const DialogMoveFiles = forwardRef<DialogMoveFilesHandle, Props>(
  (props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [targetFolder, setTargetFolder] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useImperativeHandle(ref, () => ({
      open: (files: string[]) => {
        setSelectedFiles(files);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }));

    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        await props.onSubmit();
        setIsOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Move {selectedFiles.length} files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Destination Folder</Label>
              <div className="flex gap-2">
                <Input
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  placeholder="C:/Path/To/Destination"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  onClick={props.onClick}
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Moving..." : "Move Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
