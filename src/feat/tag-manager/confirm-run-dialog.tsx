import { useState } from "react";

import { ExecuteResult } from "@/bindings/ExecuteResult";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: () => Promise<ExecuteResult>;
  error?: string;
};

/**
 * A single dialog used both as confirmation and as a result viewer.
 * No toast; results are shown in-place.
 */
export default function ConfirmRunDialog({ open, onOpenChange, onRun }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  async function handleRun() {
    setResult(null);
    setRunning(true);
    try {
      const res = await onRun();
      setResult(res);
    } catch (e) {
      console.log(e);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setResult(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>{result ? "Completed" : "Run all rules?"}</DialogTitle>
          {!result && (
            <DialogDescription>
              Apply all rules in order. This cannot be undone.
            </DialogDescription>
          )}
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Replace</span>
              <span className="font-semibold">{result.replaced}</span>
            </div>
            <div className="flex justify-between">
              <span>Delete</span>
              <span className="font-semibold">{result.deleted}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span>Total</span>
              <span className="font-bold">{result.total_updated}</span>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={running}
              onClick={() => void handleRun()}
            >
              {running ? "Running..." : "Run"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
