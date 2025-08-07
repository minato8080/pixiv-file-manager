import { invoke } from "@tauri-apps/api/core";
import { ChevronDownIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { CollectSummary } from "@/bindings/CollectSummary";
import type { TagAssignment } from "@/bindings/TagAssignment";
import { TagInfo } from "@/bindings/TagInfo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { InputDropdown } from "@/src/components/input-dropdown-portal";
import { VirtualizedSelect as VirtualizedSelectGenerics } from "@/src/components/virtualized-select-generics";
import { useTagsOrganizerStore } from "@/src/stores/tags-organizer-store";

const VirtualizedSelect = VirtualizedSelectGenerics<TagInfo>;

const SERIES = "series";
const CHARACTER = "character";
type TagType = typeof SERIES | typeof CHARACTER;
const isHyphen = (...values: string[]) => values.every((v) => v === "-");

interface EditingState {
  id: number;
  field: TagType;
}

export const ResultArea = () => {
  const { collectSummary, setCollectSummary, setLoading, availableTagList } =
    useTagsOrganizerStore();

  const [filteredTagList, setFilteredTagList] = useState<TagInfo[]>([]);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");

  // Separate uncategorized items (both series and character are "-")
  const uncategorized = collectSummary.find((item) =>
    isHyphen(item.series, item.character)
  );

  // Group remaining items by series, treating "-" as null
  const categorizedItems = collectSummary.filter(
    (item) => !isHyphen(item.series, item.character)
  );

  const groupedBySeries = categorizedItems.reduce((acc, item) => {
    const series =
      isHyphen(item.series) || !item.series ? "Uncategorized" : item.series;
    if (!acc[series]) {
      acc[series] = [];
    }
    acc[series].push(item);
    return acc;
  }, {} as Record<string, CollectSummary[]>);

  const removeAssignment = async (item: CollectSummary) => {
    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("delete_collect", {
        assignment: item,
      });
      setCollectSummary(summary);
    } finally {
      setLoading(false);
    }
  };

  const updateItemField = async (
    itemId: number,
    field: TagType,
    value: string
  ) => {
    const index = collectSummary.findIndex((item) => item.id === itemId);
    if (index === -1) return;

    const updatedItem = {
      ...collectSummary[index],
      [field]: value === "" ? null : value,
    };

    const assignment: TagAssignment = {
      id: updatedItem.id,
      series: updatedItem.series,
      character: updatedItem.character,
    };

    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("assign_tag", {
        assignment,
      });
      setCollectSummary(summary);
    } finally {
      setLoading(false);
    }
  };

  const addCharacterToSeries = async (
    series: string,
    characterName: string
  ) => {
    const assignment: TagAssignment = {
      id: null,
      series: series,
      character: characterName || "-",
    };

    setLoading(true);
    try {
      const summary: CollectSummary[] = await invoke("assign_tag", {
        assignment,
      });
      setCollectSummary(summary);
      setNewCharacterName("");
    } finally {
      setLoading(false);
    }
  };

  const renderEditableField = (item: CollectSummary, field: TagType) => {
    const isEditing =
      editingState?.id === item.id && editingState?.field === field;
    const externalValue = item[field];

    const options =
      filteredTagList.length > 0 ? filteredTagList : availableTagList;

    if (isEditing) {
      return (
        <div className="w-50">
          <VirtualizedSelect
            value={externalValue}
            valueKey="tag"
            options={options}
            onChange={(value) => void updateItemField(item.id, field, value)}
            onClose={() => setEditingState(null)}
          />
        </div>
      );
    }

    const handleClick = () => {
      if (item.id === -1) return;

      const refresh = async () => {
        const relatedValue =
          collectSummary[item.id][field === CHARACTER ? SERIES : CHARACTER];
        if (relatedValue && !isHyphen(relatedValue)) {
          const list: TagInfo[] = await invoke("get_related_tags", {
            tag: relatedValue,
          });

          setFilteredTagList(list.length > 0 ? list : availableTagList);
        }
        setEditingState({ id: item.id, field });
      };
      void refresh();
    };

    return (
      <span
        className={`cursor-pointer hover:bg-gray-100 px-1 rounded text-xs whitespace-nowrap ${
          item.is_new ? "bg-blue-200" : ""
        }`}
        onClick={handleClick}
      >
        {externalValue}
      </span>
    );
  };

  const renderItemRow = (item: CollectSummary) => {
    const hasDifference = item.before_count !== item.after_count;

    return (
      <div
        key={item.id}
        className="grid grid-cols-16 gap-2 items-center py-1 px-4 hover:bg-gray-50 rounded text-sm"
      >
        <div className="col-span-3">{renderEditableField(item, SERIES)}</div>
        <div className="col-span-3">{renderEditableField(item, CHARACTER)}</div>
        <div className="col-span-1 text-right text-xs">{item.before_count}</div>
        <div className="col-span-1 text-right text-xs">
          <span
            className={`px-1 rounded ${
              hasDifference ? "bg-green-200 text-green-800 font-medium" : ""
            }`}
          >
            {item.after_count}
          </span>
        </div>
        <div className="col-span-7 text-xs text-gray-800 font-mono truncate">
          {item.new_path}
        </div>
        <div className="col-span-1 flex justify-center">
          {item.id !== -1 && (
            <Button
              onClick={() => void removeAssignment(item)}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 border rounded overflow-hidden flex flex-col">
      {/* Fixed Header */}
      <div className="bg-gray-100 border-b px-4 py-2 sticky top-0 z-20">
        <div className="grid grid-cols-16 gap-2 text-xs font-medium text-gray-700">
          <div className="col-span-3">Series</div>
          <div className="col-span-3">Character</div>
          <div className="col-span-1 text-right">Before</div>
          <div className="col-span-1 text-right">After</div>
          <div className="col-span-7 px-6">New Path</div>
          <div className="col-span-1 text-center">Operation</div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Uncategorized Items (Special Display) */}
        {uncategorized && (
          <div className="border-b bg-gray-50">
            <div className="px-4 py-2 grid grid-cols-16 gap-2 text-xs font-medium text-gray-600 bg-gray-100">
              <div className="col-span-3">Uncategorized</div>
              <div className="col-span-3"></div>
              <div className="col-span-1 text-right text-xs">
                {uncategorized.before_count}
              </div>
              <div className="col-span-1 text-right text-xs">
                <span
                  className={`px-1 rounded ${
                    uncategorized.before_count !== uncategorized.after_count
                      ? "bg-green-200 text-green-800 font-medium"
                      : ""
                  }`}
                >
                  {uncategorized.after_count}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Categorized Items (Accordion) */}
        <Accordion
          type="single"
          collapsible
          className="w-full"
          onValueChange={() => setNewCharacterName("")}
        >
          {Object.entries(groupedBySeries).map(([series, items]) => {
            const totalBefore = items.reduce(
              (sum, item) => sum + item.before_count,
              0
            );
            const totalAfter = items.reduce(
              (sum, item) => sum + item.after_count,
              0
            );
            const hasDifference = totalBefore !== totalAfter;

            return (
              <AccordionItem key={series} value={series} className="border-b">
                <AccordionTrigger className="px-4 py-2 hover:bg-gray-50 items-center [&>svg]:hidden">
                  <div className="grid grid-cols-16 gap-2 w-full text-xs font-medium">
                    <div className="col-span-3 text-left">
                      <span className="font-medium">{series}</span>
                      <span className="text-gray-500 ml-2">
                        ({items.length})
                      </span>
                    </div>
                    <div className="col-span-3"></div>
                    <div className="col-span-1 text-right">{totalBefore}</div>
                    <div className="col-span-1 text-right">
                      <span
                        className={`px-1 rounded ${
                          hasDifference
                            ? "bg-green-200 text-green-800 font-medium"
                            : "font-medium"
                        }`}
                      >
                        {totalAfter}
                      </span>
                    </div>
                    <div className="col-span-7"></div>
                    <div className="col-span-1 flex justify-end">
                      <ChevronDownIcon className="h-4 w-4" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    {/* Character Add UI */}
                    <div className="px-4">
                      <div className="bg-gray-50 p-2 rounded-lg border-2 border-dashed border-gray-300">
                        <div className="flex items-center gap-2">
                          <InputDropdown
                            value={newCharacterName}
                            valueKey="tag"
                            items={filteredTagList}
                            placeholder="Add new character"
                            onChange={setNewCharacterName}
                            onFocus={() => {
                              const refresh = async () => {
                                const list: TagInfo[] = await invoke(
                                  "get_related_tags",
                                  {
                                    tag: series,
                                  }
                                );

                                setFilteredTagList(
                                  list.length > 0 ? list : availableTagList
                                );
                              };
                              void refresh();
                            }}
                            inputClassName="h-8"
                            dropdownClassName="h-50"
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              void addCharacterToSeries(
                                series,
                                newCharacterName
                              )
                            }
                            className="h-7 px-2 text-xs bg-blue-500"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setNewCharacterName("")}
                            className="h-7 px-2 text-xs w-16"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Character List */}
                    {items.map((item) => renderItemRow(item))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};
