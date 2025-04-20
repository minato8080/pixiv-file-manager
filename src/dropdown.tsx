import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type Item = {
  id: string;
  label: string;
  count?: number;
};

type DropdownProps<T> = DropdownSharedProps &
  (DropdownMultipleProps<T> | DropdownSingleProps<T>);

type DropdownSharedProps = {
  ButtonIcon: React.ReactElement;
  buttonText: string;
  buttonClassName?: string;
  placeholderText?: string;
  badgeClassName?: string;
};

type DropdownMultipleProps<T> = {
  mode: "multiple";
  selectedItem: T[];
  setSelectedItem: (param: T[]) => void;
};

type DropdownSingleProps<T> = {
  mode: "single";
  selectedItem: T | null;
  setSelectedItem: (param: T | null) => void;
};

export type DropdownHandle<T> = {
  addItem: (tag: T) => void;
  removeItem: (id: string) => void;
  setAvailableItems: React.Dispatch<React.SetStateAction<T[]>>;
  availableItems: T[];
};

function FilterDropdown<T extends Item>(
  {
    mode,
    ButtonIcon,
    buttonText,
    selectedItem,
    setSelectedItem,
    buttonClassName = "",
    placeholderText = "Filter...",
    badgeClassName = "",
  }: DropdownProps<T>,
  ref: React.Ref<DropdownHandle<T>>
) {
  // State
  const [availableItems, setAvailableItems] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");

  // Refs for dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Tag dropdown
      if (isOpen && !dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const addItem = (item: T) => {
    if (mode === "multiple") {
      setSelectedItem([...selectedItem, item]);
    } else {
      setSelectedItem(item);
    }
    setIsOpen(false);
  };

  // Remove tag from selected tags
  const removeItem = (id: string) => {
    if (mode === "multiple") {
      setSelectedItem(selectedItem.filter((param) => param.id !== id));
    } else {
      setSelectedItem(null);
    }
  };

  // Expose handlers to parent component
  useImperativeHandle(ref, () => ({
    addItem,
    removeItem,
    setAvailableItems,
    availableItems,
  }));

  // Filter available tags
  const filteredTags = availableItems.filter((tag) => tag.id.includes(filter));

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 bg-white dark:bg-gray-800 border shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {ButtonIcon}
        {buttonText}
        <ChevronDown className="h-4 w-4 ml-1" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden">
          <div className="p-2 border-b">
            <Input
              placeholder={placeholderText}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map((item) => (
                <button
                  key={item.id}
                  className={
                    "w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex justify-between items-center" +
                    buttonClassName
                  }
                  onClick={() => addItem(item)}
                >
                  <span className="truncate">{item.label}</span>
                  {item?.count && (
                    <Badge
                      className={
                        "ml-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" +
                        badgeClassName
                      }
                    >
                      +{item?.count}
                    </Badge>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-gray-500">Not found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ForwardedFilterDropdown = forwardRef(FilterDropdown) as <
  T extends Item
>(
  props: DropdownProps<T> & React.RefAttributes<DropdownHandle<T>>
) => React.ReactElement;
