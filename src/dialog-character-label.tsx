import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type DialogCharaLabelHandle = {
  open: (
    items: string[],
    initialName: string,
    availableCharacters?: string[]
  ) => void;
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
    const [availableCharacters, setAvailableCharacters] = useState<string[]>(
      []
    );
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredCharacters, setFilteredCharacters] = useState<string[]>([]);
    const [isComposing, setIsComposing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const close = () => {
      setIsOpen(false);
      setShowDropdown(false);
    };

    useImperativeHandle(ref, () => ({
      open: (items, initialName, characters = []) => {
        setCharacterName(initialName);
        setSelectedFiles(items);
        setAvailableCharacters(characters);
        setFilteredCharacters(characters);
        setIsOpen(true);
      },
      close,
    }));

    useEffect(() => {
      // Only filter characters when not in IME composition
      if (!isComposing) {
        if (characterName) {
          setFilteredCharacters(
            availableCharacters.filter((char) =>
              char.toLowerCase().includes(characterName.toLowerCase())
            )
          );
        } else {
          setFilteredCharacters(availableCharacters);
        }
      }
    }, [characterName, availableCharacters, isComposing]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          (dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            inputRef.current &&
            !inputRef.current.contains(event.target as Node)) ||
          (!dropdownRef.current?.contains(event.target as Node) &&
            document.contains(event.target as Node))
        ) {
          setShowDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
      const nextFocused = event.relatedTarget as Node | null;

      if (!nextFocused || !containerRef.current?.contains(nextFocused)) {
        setShowDropdown(false);
      }
    };

    const handleSubmit = async () => {
      setIsSubmitting(true);
      try {
        await props.onSubmit(characterName, selectedFiles);
        console.log("Character Name Submitted:", characterName);
        close();
        setCharacterName("");
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleSelectCharacter = (character: string) => {
      setCharacterName(character);
      setShowDropdown(false);
      inputRef.current?.focus();
    };

    const handleCompositionStart = () => {
      setIsComposing(true);
    };

    const handleCompositionEnd = () => {
      setIsComposing(false);
      // Update filtered characters after composition ends
      if (characterName) {
        setFilteredCharacters(
          availableCharacters.filter((char) =>
            char.toLowerCase().includes(characterName.toLowerCase())
          )
        );
      } else {
        setFilteredCharacters(availableCharacters);
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
            <div
              className="relative mt-2"
              ref={containerRef}
              tabIndex={-1}
              onBlur={handleBlur}
            >
              <input
                ref={inputRef}
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter character name"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                onClick={() => !isComposing && setShowDropdown(true)}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
              />

              {showDropdown &&
                !isComposing &&
                filteredCharacters.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-sm max-h-60 overflow-auto"
                  >
                    {filteredCharacters.map((character) => (
                      <div
                        key={character}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSelectCharacter(character)}
                      >
                        {character}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
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
DialogCharaLabel.displayName = "DialogCharaLabel";
