import { Plus, Search, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ConfirmRunDialog from "./confirm-run-dialog";
import RuleForm from "./rule-form";
import RuleTable from "./rule-table";

import { TagFixRule } from "@/bindings/TagFixRule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputDropdown } from "@/src/components/input-dropdown-portal";
import { useDropdownStore } from "@/src/stores/dropdown-store";
import { useTagRulesStore } from "@/stores/tag-rules-store";

export default function TagManager() {
  const { rules, loadRules, addRule, updateRule, deleteRule, executeAll } =
    useTagRulesStore();
  const { uniqueTagList } = useDropdownStore();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [editing, setEditing] = useState<TagFixRule | null>(null);

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rules;
    const seachText = search.toLowerCase();
    return rules.filter(
      (rule) =>
        rule.src_tag.toLowerCase().includes(seachText) ||
        (rule.dst_tag ?? "").toLowerCase().includes(seachText)
    );
  }, [rules, search]);

  return (
    <main className="h-screen p-2 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputDropdown
              value={search}
              valueKey="tag"
              onChange={(v) => setSearch(v)}
              items={uniqueTagList}
              placeholder="Select tags..."
              inputClassName="pl-8 border-blue-200 dark:border-blue-800 h-8"
            />
          </div>

          {/* Run all rules */}
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setRunOpen(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            Run all
          </Button>

          {/* Add rule */}
          <Dialog open={addOpen} onOpenChange={(o) => setAddOpen(o)}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add rule
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Add rule</DialogTitle>
              </DialogHeader>
              <RuleForm
                onSubmit={async (payload) => {
                  await addRule(payload);
                  setAddOpen(false);
                }}
                submitLabel="Create"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Rules table */}
      <div className="border rounded mt-2">
        <RuleTable
          rules={filtered}
          onEdit={(r) => {
            setEditing(r);
            setEditOpen(true);
          }}
          onDelete={async (id) => {
            await deleteRule(id);
          }}
        />
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => (setEditOpen(o), !o && setEditing(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit rule</DialogTitle>
          </DialogHeader>
          {editing && (
            <RuleForm
              initial={editing}
              submitLabel="Save"
              onSubmit={async (payload) => {
                await updateRule({ ...editing, ...payload });
                setEditOpen(false);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Run-all dialog (confirmation + result) */}
      <ConfirmRunDialog
        open={runOpen}
        onOpenChange={(o) => setRunOpen(o)}
        onRun={executeAll}
      />
    </main>
  );
}
