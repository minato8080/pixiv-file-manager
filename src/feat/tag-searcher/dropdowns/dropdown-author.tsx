import { User } from "lucide-react";

import { DropdownButton } from "@/src/components/dropdown-button";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";
import { useDropdownStore } from "@/stores/dropdown-store";

export const DropdownAuthor = () => {
  const { selectedAuthor, setSelectedAuthor } = useTagSearcherStore();
  const { authorDropdownItems } = useDropdownStore();

  return (
    <DropdownButton
      mode="single"
      ButtonIcon={<User className="h-4 w-4 mr-1 text-green-500" />}
      buttonText={"Author"}
      selectedItem={selectedAuthor}
      availableItems={authorDropdownItems}
      onClick={(item) => setSelectedAuthor(item)}
      valueKey="author_id"
      labelKey="author_name"
    />
  );
};
