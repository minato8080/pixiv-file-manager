// useFormStoreから必要な項目をピックアップして使う
import { X, Users, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTagsSearcherStore } from "@/src/stores/tags-searcher-store";

export const TagsArea = () => {
  const {
    selectedTags,
    setSelectedTags,
    selectedCharacter,
    setSelectedCharacter,
    selectedAuthor,
    setSelectedAuthor,
  } = useTagsSearcherStore();

  // Remove tag from selected tags
  const removeItem = (tag: string) => {
    setSelectedTags(selectedTags.filter((param) => param.tag !== tag));
  };

  if (selectedTags.length > 0 || selectedCharacter || selectedAuthor)
    return (
      <div className="flex flex-wrap gap-1 mb-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.tag}
            className="pl-2 h-6 flex items-center gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200"
          >
            {tag.tag}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full"
              onClick={() => removeItem(tag.tag)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}

        {selectedCharacter && (
          <Badge className="pl-2 h-6 flex items-center gap-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200">
            <Users className="h-3 w-3 mr-1" />
            {selectedCharacter.character}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full"
              onClick={() => setSelectedCharacter(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {selectedAuthor && (
          <Badge className="pl-2 h-6 flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200">
            <User className="h-3 w-3 mr-1" />
            {selectedAuthor.author_name}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full"
              onClick={() => setSelectedAuthor(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>
    );

  return null;
};
