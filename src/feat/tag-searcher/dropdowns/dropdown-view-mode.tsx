import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VIEW_MODES, ViewModeKey } from "@/src/constants";
import { useOutsideClose } from "@/src/hooks/useOutsideClose";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const DropdownViewMode = () => {
  const {
    currentViewMode,
    setCurrentViewMode,
    isViewModeDropdownOpen,
    setIsViewModeDropdownOpen,
  } = useTagSearcherStore();
  const dropdownRef = useOutsideClose<HTMLDivElement>({
    onClose: () => setIsViewModeDropdownOpen(false),
    enabled: isViewModeDropdownOpen,
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 bg-white dark:bg-gray-800"
        onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
      >
        {VIEW_MODES[currentViewMode].icon}
        <ChevronDown className="h-4 w-4 ml-1" />
      </Button>

      {isViewModeDropdownOpen && (
        <div className="absolute z-50 right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border overflow-hidden">
          {Object.entries(VIEW_MODES).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => {
                setCurrentViewMode(key as ViewModeKey);
                setIsViewModeDropdownOpen(false);
              }}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                currentViewMode === key
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : ""
              }`}
            >
              {mode.icon}
              <span>{mode.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
