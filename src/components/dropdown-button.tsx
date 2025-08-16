import { ChevronDown } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import { useTagSearcherStore } from "../stores/tag-searcher-store";
import { getNumber, getString, inferObjKey } from "../types/type-guard-util";
import { LimitedKeyOf } from "../types/util-types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DropdownProps<T> = DropdownSharedProps<T> &
  (DropdownMultipleProps<T> | DropdownSingleProps<T>);

type DropdownSharedProps<T> = {
  ButtonIcon: React.ReactElement;
  buttonText: string;
  buttonClassName?: string;
  placeholderText?: string;
  badgeClassName?: string;
  availableItems: T[];
  valueKey: LimitedKeyOf<T, string | number>;
  labelKey: LimitedKeyOf<T, string>;
};

type DropdownMultipleProps<T> = {
  mode: "multiple";
  selectedItem: T[];
  onClick: (item: T[]) => void;
};

type DropdownSingleProps<T> = {
  mode: "single";
  selectedItem: T | null;
  onClick: (item: T) => void;
};

export type DropdownHandle<T> = {
  addItem: (tag: T) => void;
};

export function DropdownButton<T>({
  mode,
  ButtonIcon,
  buttonText,
  selectedItem,
  buttonClassName = "",
  placeholderText = "Filter...",
  badgeClassName = "",
  availableItems,
  onClick,
  valueKey,
  labelKey,
}: DropdownProps<T>) {
  const { searchResults } = useTagSearcherStore();

  // State
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

  useEffect(() => setFilter(""), [searchResults]);

  const addItem = (item: T) => {
    if (mode === "multiple") {
      onClick([...selectedItem, item]);
    } else {
      onClick(item);
    }
    setIsOpen(false);
  };

  // Filter available tags
  const filteredTags = availableItems.filter((item) =>
    inferObjKey(item, labelKey, (obj, key) =>
      (
        getString(obj, key)?.toLowerCase() ?? getNumber(obj, key)?.toString()
      )?.includes(filter.toLowerCase())
    )
  );

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
              filteredTags.map((item) => {
                const value =
                  inferObjKey(item, valueKey, (obj, key) =>
                    getString(obj, key)
                  ) ?? "";
                const label =
                  inferObjKey(item, labelKey, (obj, key) =>
                    getString(obj, key)
                  ) ?? value;
                return (
                  <button
                    key={value}
                    className={
                      "w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex justify-between items-start" +
                      buttonClassName
                    }
                    onClick={() => addItem(item)}
                  >
                    {inferObjKey(item, "count", (obj, key) => (
                      <div className="flex justify-between items-start gap-2 text-xs w-full">
                        <span className="flex-1">{label}</span>
                        <Badge
                          className={
                            "ml-1 flex-shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" +
                            badgeClassName
                          }
                        >
                          {getNumber(obj, key)}
                        </Badge>
                      </div>
                    )) ?? label}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-gray-500">Not found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
