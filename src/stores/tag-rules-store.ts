import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { ExecuteResult } from "@/bindings/ExecuteResult";
import { TagFixRule } from "@/bindings/TagFixRule";
import { TagFixRuleAction } from "@/bindings/TagFixRuleAction";
import { TagInfo } from "@/bindings/TagInfo";

/**
 * Directly use Tauri invoke from app code.
 * In browser (no Tauri), fall back to a tiny in-memory mock so the page still works.
 */

type Store = {
  rules: TagFixRule[];
  usingTagList: TagInfo[];
  loading: boolean;
  // actions
  loadRules: () => Promise<void>;
  addRule: (payload: {
    src_tag: string;
    dst_tag: string | null;
    action_type: TagFixRuleAction;
  }) => Promise<void>;
  updateRule: (rule: {
    id: number;
    src_tag: string;
    dst_tag: string | null;
    action_type: TagFixRuleAction;
  }) => Promise<void>;
  deleteRule: (id: number) => Promise<void>;
  executeAll: () => Promise<ExecuteResult>;
};

/* --------------------------------- Store ---------------------------------- */

export const useTagRulesStore = create<Store>((set, get) => ({
  rules: [],
  usingTagList: [],
  loading: false,

  loadRules: async () => {
    set({ loading: true });
    try {
      const rules = await invoke<TagFixRule[]>("get_tag_fix_rules");
      set({ rules });
      const usingTagList = await invoke<TagInfo[]>("get_using_fix_rule_tags");
      set({ usingTagList });
    } catch (e) {
      console.log(e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  addRule: async (payload) => {
    try {
      // Basic validation here too (UI also validates)
      if (
        !payload.src_tag ||
        (!payload.dst_tag && payload.action_type !== "delete")
      ) {
        throw new Error("Invalid rule");
      }
      await invoke("add_tag_fix_rule", {
        srcTag: payload.src_tag,
        dstTag: payload.dst_tag,
        actionType: payload.action_type,
      });
      await get().loadRules();
    } catch (e) {
      console.log(e);
    }
  },

  updateRule: async (rule) => {
    try {
      await invoke("update_tag_fix_rule", {
        id: rule.id,
        srcTag: rule.src_tag,
        dstTag: rule.dst_tag,
        actionType: rule.action_type,
      });
      await get().loadRules();
    } catch (e) {
      console.log(e);
    }
  },

  deleteRule: async (id) => {
    try {
      await invoke("delete_tag_fix_rule", { id });
      await get().loadRules();
    } catch (e) {
      console.log(e);
    }
  },

  executeAll: async () => {
    try {
      const res = await invoke<ExecuteResult>("execute_tag_fixes");
      // Reload rules table just in case timestamps change elsewhere (not required here)
      await get().loadRules();
      return res;
    } catch (e) {
      console.log(e);
      throw e;
    }
  },
}));
