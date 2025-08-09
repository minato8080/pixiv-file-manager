import { Users } from "lucide-react";

import { DropdownButton } from "@/src/components/dropdown-button";
import { useDropdownStore } from "@/stores/dropdown-store";
import { useTagSearcherStore } from "@/src/stores/tag-searcher-store";

export const DropdownCharacter = () => {
  const { selectedCharacter, setSelectedCharacter } = useTagSearcherStore();
  const { characterDropdownItems } = useDropdownStore();

  return (
    <DropdownButton
      mode="single"
      ButtonIcon={<Users className="h-4 w-4 mr-1 text-purple-500" />}
      buttonText={"Chara"}
      selectedItem={selectedCharacter}
      availableItems={characterDropdownItems}
      onClick={(item) => setSelectedCharacter(item)}
    />
  );
};
