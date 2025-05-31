import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 検索可能なドロップダウンコンポーネント
export function DropdownInput({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && !dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(filter.toLowerCase())
  );

  const selectOption = (option: string) => {
    onValueChange(option);
    setIsOpen(false);
    setFilter("");
  };

  const clearSelection = () => {
    onValueChange("");
    setIsOpen(false);
    setFilter("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        className={cn("justify-between", className)}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 ml-1 shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b bg-white">
            <Input
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 bg-white"
            />
          </div>
          <div className="max-h-40 overflow-auto bg-white">
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-100 bg-white text-xs"
              onClick={clearSelection}
            >
              None
            </button>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 bg-white text-xs"
                  onClick={() => selectOption(option)}
                >
                  <span className="truncate">{option}</span>
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-gray-500 bg-white text-xs">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
