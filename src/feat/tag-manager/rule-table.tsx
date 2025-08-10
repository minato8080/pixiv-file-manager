import { Pencil, Trash2 } from "lucide-react";

import { TagFixRule } from "@/bindings/TagFixRule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  loading?: boolean;
  rules: TagFixRule[];
  onEdit: (rule: TagFixRule) => void;
  onDelete: (id: number) => Promise<void>;
};

const actionLabel = {
  replace: "Replace",
  delete: "Delete",
} as const;

export default function RuleTable({ loading, rules, onEdit, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[26%]">Source Tag</TableHead>
          <TableHead className="w-[26%]">Destination Tag</TableHead>
          <TableHead className="w-[16%]">Action</TableHead>
          <TableHead className="w-[22%]">Created At</TableHead>
          <TableHead className="w-[10%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              Loading...
            </TableCell>
          </TableRow>
        ) : rules.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No rules
            </TableCell>
          </TableRow>
        ) : (
          rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="font-mono">{rule.src_tag}</TableCell>
              <TableCell className="font-mono">{rule.dst_tag ?? "-"}</TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    "border-0",
                    rule.action_type === "replace" &&
                      "bg-amber-100 text-amber-900 hover:bg-amber-100",
                    rule.action_type === "delete" &&
                      "bg-rose-100 text-rose-900 hover:bg-rose-100"
                  )}
                >
                  {actionLabel[rule.action_type]}
                </Badge>
              </TableCell>
              <TableCell>{rule.created_at}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit"
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => onEdit(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => void onDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
