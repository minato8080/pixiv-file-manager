import { Filter } from "lucide-react";
import { FilterDropdown } from "../../dropdown";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";
import { useDropdownStore } from "../../stores/dropdown-store";
import { TagInfo } from "@/bindings/TagInfo";

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
    <FilterDropdown
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
