import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFileOrganizerStore } from "@/src/stores/file-organizer-store";
import { useCommonStore } from "@/stores/common-store";

export const SyncResultsDialog = () => {
  const { loading } = useCommonStore();
  const {
    selectedItems,
    setSelectedItems,
    syncResults,
    syncDialogOpen,
    setSyncDialogOpen,
    deleteSelectedItems,
  } = useFileOrganizerStore();
  const [error, setError] = useState("");

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === syncResults.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(syncResults.map((_, index) => index)));
    }
  };

  const handleClose = () => {
    setError("");
    setSyncDialogOpen(false);
  };

  return (
    <Dialog open={syncDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle>Sync Database Results</DialogTitle>
          <DialogDescription>
            {!loading &&
              `Found ${syncResults.length} items to potentially delete. Select items
            to remove from the database.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Processing...</span>
            </div>
          )}

          {!loading && syncResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.size === syncResults.length}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium">
                  Select All ({selectedItems.size}/{syncResults.length})
                </Label>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {syncResults.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      id={`item-${index}`}
                      checked={selectedItems.has(index)}
                      onCheckedChange={() => toggleItemSelection(index)}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">
                        ID: {item.illust_id} (Suffix: {item.suffix})
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 truncate">
                        {item.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && syncResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No items found to delete.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => void deleteSelectedItems()}
            disabled={selectedItems.size === 0 || loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete Selected ({selectedItems.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
