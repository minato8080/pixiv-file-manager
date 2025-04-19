import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type DialogDeleteFilesHandle = {
  open: (items: string[]) => void;
  close: () => void;
};

type Props = {
  onSubmit: () => Promise<void>;
};

export const DialogDeleteFiles = forwardRef<DialogDeleteFilesHandle, Props>(
  (props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useImperativeHandle(ref, () => ({
      open: (files: string[]) => {
        setSelectedFiles(files);
        setIsOpen(true);
      },
      close: () => {
        setSelectedFiles(null);
        setIsOpen(false);
      },
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
            <DialogTitle className="text-red-600">
              Delete Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete {selectedFiles?.length ?? "0"}
              file(s)? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
