import { OperationArea } from "./operation-area";
import { TagArea } from "./tag-area";

import { cn } from "@/lib/utils";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const TagOperationWrapper = () => {
  const {
    searchResults,
    operationMode,
    selectedTags,
    selectedCharacter,
    selectedAuthor,
  } = useTagSearcherStore();

  const showTags: boolean =
    selectedTags.length > 0 || !!selectedCharacter || !!selectedAuthor;
  const showOperations = operationMode && searchResults.length > 0;

  return (
    <div className="flex gap-2 w-full">
      {showTags && (
        <div className="flex flex-wrap gap-1 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border flex-1">
          <TagArea />
        </div>
      )}
      {showOperations && (
        <div
          className={cn(
            "flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border",
            showTags ? "flex-1" : "w-full"
          )}
        >
          <OperationArea />
        </div>
      )}
    </div>
  );
};
