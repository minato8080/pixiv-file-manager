import { useEffect, useState } from "react";

import { TagFixRule } from "@/bindings/TagFixRule";
import { TagFixRuleAction } from "@/bindings/TagFixRuleAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  initial?: Partial<TagFixRule>;
  onSubmit: (data: {
    src_tag: string;
    dst_tag: string | null;
    action_type: TagFixRuleAction;
  }) => Promise<void>;
  submitLabel?: string;
};

export default function RuleForm({
  initial,
  onSubmit,
  submitLabel = "Save",
}: Props) {
  const [src, setSrc] = useState(initial?.src_tag ?? "");
  const [dst, setDst] = useState(initial?.dst_tag ?? "");
  const [action, setAction] = useState<TagFixRuleAction>(
    initial?.action_type ?? "replace"
  );
  const [submitting, setSubmitting] = useState(false);

  const disabledDst = action === "delete";

  useEffect(() => {
    if (disabledDst) setDst("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabledDst]);

  function validate() {
    const errs: string[] = [];
    if (!src.trim()) errs.push("Source tag is required.");
    if (!action) errs.push("Action is required.");
    if (action !== "delete" && !dst.trim())
      errs.push("Destination tag is required.");
    if (
      action !== "delete" &&
      src.trim() &&
      dst.trim() &&
      src.trim() === dst.trim()
    ) {
      errs.push("Source and destination must be different.");
    }
    return errs;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="src_tag">Source Tag</Label>
        <Input
          id="src_tag"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          placeholder="e.g., girl"
          autoFocus
          autoComplete="off"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="action_type">Action</Label>
        <Select
          value={action}
          onValueChange={(v) => setAction(v as TagFixRuleAction)}
        >
          <SelectTrigger id="action_type">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="replace">Replace</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="dst_tag" className={cn(disabledDst && "opacity-50")}>
          Destination Tag
        </Label>
        <Input
          id="dst_tag"
          value={dst}
          onChange={(e) => setDst(e.target.value)}
          placeholder="e.g., woman"
          disabled={disabledDst}
          autoComplete="off"
        />
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white"
          disabled={submitting}
          onClick={
            void (async () => {
              const errs = validate();
              if (errs.length) {
                // Show inline error by throwing; store will capture and expose via lastError
                throw new Error(errs.join(" / "));
              }
              try {
                setSubmitting(true);
                await onSubmit({
                  src_tag: src.trim(),
                  dst_tag: disabledDst ? null : dst.trim(),
                  action_type: action,
                });
              } finally {
                setSubmitting(false);
              }
            })()
          }
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
