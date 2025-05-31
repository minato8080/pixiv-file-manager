import { User } from "lucide-react";

import { DropdownButton } from "@/src/components/dropdown-button";
import { useDropdownStore } from "@/stores/dropdown-store";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";

export const DropdownAuthor = () => {
  const { selectedAuthor, setSelectedAuthor } = useTagsSearcherStore();
  const { authorDropdownItems } = useDropdownStore();

  return (
    <DropdownButton
      mode="single"
      ButtonIcon={<User className="h-4 w-4 mr-1 text-green-500" />}
      buttonText={"Author"}
      selectedItem={selectedAuthor}
      availableItems={authorDropdownItems}
      onClick={(item) => setSelectedAuthor(item)}
    />
  );
};
