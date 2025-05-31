import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTagsSearcherStore } from "@/stores/tags-searcher-store";

export const SearchConditionSwitch = () => {
  const { searchCondition, setSearchCondition } = useTagsSearcherStore();

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-md border shadow-sm w-[100px] justify-center">
      <Switch
        id="search-condition"
        checked={searchCondition === "OR"}
        onCheckedChange={(checked) =>
          setSearchCondition(checked ? "OR" : "AND")
        }
        className={searchCondition === "OR" ? "bg-green-500" : "bg-blue-500"}
      />
      <Label htmlFor="search-condition" className="font-medium w-8 text-center">
        {searchCondition}
      </Label>
    </div>
  );
};
