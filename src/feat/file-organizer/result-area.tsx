import { invoke } from "@tauri-apps/api/core";
import { Edit3, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { CollectSummary } from "@/bindings/CollectSummary";
import { TagAssignment } from "@/bindings/TagAssignment";
import { Button } from "@/components/ui/button";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import { VirtualizedSelect } from "@/src/components/virtualized-select";
import { useTagsOrganizerStore } from "@/src/stores/tags-organizer-store";

interface EditingState {
  id: number;
  field: "series_tag" | "character_tag";
}

export const ResultArea = ({
  removeAssignment,
}: {
  removeAssignment: (itemId: number) => Promise<void>;
}) => {
  const { unassignedTags, collectSummary, setCollectSummary } =
    useTagsOrganizerStore();

  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const updateItemField = async (
    itemId: number,
    field: "series_tag" | "character_tag",
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
      series_tag: updatedItem.series_tag,
      character_tag: updatedItem.character_tag,
    };

    const summary: CollectSummary[] = await invoke("assign_tag", {
      assignment,
    });
    setCollectSummary(summary);
  };

  const renderEditableField = (
    item: CollectSummary,
    field: "series_tag" | "character_tag"
  ) => {
    const isEditing =
      editingState?.id === item.id && editingState?.field === field;
    const value = item[field];

    if (isEditing) {
      return (
        <div className="relative" ref={anchorRef}>
          <VirtualizedSelect
            value={value ?? "__unset__"}
            options={unassignedTags}
            onChange={(newValue) =>
              void updateItemField(item.id, field, newValue)
            }
            onClose={() => {
              setEditingState(null);
            }}
            anchorRef={anchorRef}
          />
        </div>
      );
    }

    return (
      <span
        className={`cursor-pointer hover:bg-gray-100 px-1 rounded text-xs whitespace-nowrap ${
          item.is_new ? "bg-blue-200 text-blue-800" : ""
        } ${!value ? "text-gray-400" : ""} ${
          field === "series_tag" ? "text-blue-700" : "text-green-700"
        }`}
        onClick={() =>
          item.id !== -1 && setEditingState({ id: item.id, field })
        }
      >
        {value ?? "-"}
        {item.id !== -1 && <Edit3 className="w-2 h-2 inline ml-1" />}
      </span>
    );
  };

  return (
    <div className="flex-1  border rounded overflow-hidden">
      <div className="h-full overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-100">
            <TableRow>
              <TableHead className="text-xs py-1 min-w-32">Series</TableHead>
              <TableHead className="text-xs py-1 min-w-32">Character</TableHead>
              <TableHead className="text-xs py-1 text-right w-20">
                Before
              </TableHead>
              <TableHead className="text-xs py-1 text-right w-20">
                After
              </TableHead>
              <TableHead className="text-xs py-1 min-w-48">New Path</TableHead>
              <TableHead className="text-xs py-1 w-12">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collectSummary.map((item) => (
              <TableRow key={item.id} className="hover:bg-gray-50">
                <TableCell className="py-0.5" id={item.id.toString()}>
                  {renderEditableField(item, "series_tag")}
                </TableCell>
                <TableCell className="py-0.5" id={item.id.toString()}>
                  {renderEditableField(item, "character_tag")}
                </TableCell>
                <TableCell className="text-xs text-right py-0.5">
                  {item.before_count}
                </TableCell>
                <TableCell className="text-xs text-right py-0.5">
                  <span
                    className={
                      item.after_count > 0 ? "text-green-700 font-medium" : ""
                    }
                  >
                    {item.after_count}
                  </span>
                </TableCell>
                <TableCell className="text-xs py-0.5 text-gray-800 font-mono whitespace-nowrap">
                  {item.new_path}
                </TableCell>
                <TableCell className="py-0.5">
                  {item.id !== -1 && (
                    <Button
                      onClick={() => void removeAssignment(item.id)}
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
