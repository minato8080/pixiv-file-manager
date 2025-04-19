import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type DialogCharaLabelHandle = {
  open: (items: string[], initialName: string) => void;
  close: () => void;
};

type Props = {
  onSubmit: (name: string, selectedFiles: string[]) => Promise<void>;
};

export const DialogCharaLabel = forwardRef<DialogCharaLabelHandle, Props>(
  (props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [characterName, setCharacterName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

    useImperativeHandle(ref, () => ({
      open: (items, initialName) => {
        setCharacterName(initialName);
        setSelectedFiles(items);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }));

    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        await props.onSubmit(characterName, selectedFiles);
        console.log("Character Name Submitted:", characterName);
        setIsOpen(false);
        setCharacterName("");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-blue-600">
              Enter Character Name
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Please enter the character name.</p>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Character name"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
            />
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
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
