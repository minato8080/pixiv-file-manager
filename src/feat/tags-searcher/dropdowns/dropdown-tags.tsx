import { Filter } from "lucide-react";

import { TagInfo } from "@/bindings/TagInfo";
import { DropdownButton } from "@/src/components/dropdown-button";
import { useDropdownStore } from "@/stores/dropdown-store";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";

export const DropdownTags = () => {
  const { selectedTags, setSelectedTags } = useTagsSearcherStore();
  const { tagDropdownItems } = useDropdownStore();

  const applyTag = (items: TagInfo[]) => {
    const uniqueItems = items.filter(
      (item, index, self) => index === self.findIndex((t) => t.tag === item.tag)
    );
    setSelectedTags(uniqueItems.map((item) => ({ ...item })));
  };

  return (
    <DropdownButton
      mode="multiple"
      ButtonIcon={<Filter className="h-4 w-4 mr-1 text-blue-500" />}
      buttonText={"Tag"}
      selectedItem={selectedTags.map((tag) => ({
        id: tag.tag,
        ...tag,
      }))}
      availableItems={tagDropdownItems.map((tag) => ({ id: tag.tag, ...tag }))}
      onClick={applyTag}
    />
  );
};
