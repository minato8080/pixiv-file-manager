import { mockIllustDetail, mockTagInfo, mockDbInfo } from "./mock-data";

import { CollectSummary } from "@/bindings/CollectSummary";
import { TagAssignment } from "@/bindings/TagAssignment";

export interface CollectStats {
  beforeUncollected: number;
  afterUncollected: number;
  totalAssigned: number;
}

// モックAPI関数
export const mockApi = {
  async assignTag(
    series_tag: string | null,
    character_tag: string | null
  ): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const seriesText = series_tag ?? "Unset";
    const characterText = character_tag ?? "Unset";
    return {
      success: true,
      message: `Series tag "${seriesText}", Character tag "${characterText}" assigned`,
    };
  },

  async saveAssignments(
    assignments: TagAssignment[]
  ): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    localStorage.setItem("tagAssignments", JSON.stringify(assignments));
    return { success: true, message: "Assignment settings saved" };
  },

  async loadAssignments(): Promise<TagAssignment[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const saved = localStorage.getItem("tagAssignments");
    return saved ? (JSON.parse(saved) as TagAssignment[]) : [];
  },

  async getCollectSummary(
    assignments: TagAssignment[],
    previousSummary: CollectSummary[]
  ): Promise<{ summary: CollectSummary[]; stats: CollectStats }> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const combinationMap = new Map<
      string,
      {
        count: number;
        series_tag: string | null;
        character_tag: string | null;
      }
    >();
    const totalIllusts = mockIllustDetail.length;
    let assignedCount = 0;

    assignments.forEach((assignment) => {
      let illustCount = 0;

      if (assignment.series_tag) {
        const seriesIllusts = mockTagInfo
          .filter((tagInfo) => tagInfo.tag === assignment.series_tag)
          .map((tagInfo) => tagInfo.illust_id);
        illustCount += seriesIllusts.length;
      }

      if (assignment.character_tag) {
        const characterIllusts = mockTagInfo
          .filter((tagInfo) => tagInfo.tag === assignment.character_tag)
          .map((tagInfo) => tagInfo.illust_id);
        illustCount += characterIllusts.length;
      }

      const key = `${assignment.series_tag ?? "null"}-${
        assignment.character_tag ?? "null"
      }`;

      combinationMap.set(key, {
        count: illustCount,
        series_tag: assignment.series_tag,
        character_tag: assignment.character_tag,
      });

      assignedCount += illustCount;
    });

    const result: CollectSummary[] = [];
    const previousIds = new Set(previousSummary.map((item) => item.id));

    const beforeUncollected = totalIllusts;
    const afterUncollected = totalIllusts - assignedCount;

    if (afterUncollected > 0) {
      result.push({
        id: "uncollected",
        series_tag: null,
        character_tag: null,
        before_count: beforeUncollected,
        after_count: afterUncollected,
        new_path: "temp/uncollected",
        is_new: false,
      });
    }

    combinationMap.forEach((data, key) => {
      const isNew = !previousIds.has(key);
      let newPath = "root";

      if (data.series_tag && data.character_tag) {
        newPath = `root/${data.series_tag}/${data.character_tag}`;
      } else if (data.series_tag) {
        newPath = `root/${data.series_tag}`;
      } else if (data.character_tag) {
        newPath = `root/${data.character_tag}`;
      }

      result.push({
        id: key,
        series_tag: data.series_tag,
        character_tag: data.character_tag,
        before_count: 0,
        after_count: data.count,
        new_path: newPath,
        is_new: isNew,
      });
    });

    const stats: CollectStats = {
      beforeUncollected,
      afterUncollected,
      totalAssigned: assignedCount,
    };

    return { summary: result, stats };
  },

  async performCollect(): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      message: "Collection process completed (DB save & file move executed)",
    };
  },

  async setRoot(root: string): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockDbInfo.root = root;
    return { success: true, message: "Root path set successfully" };
  },

  async getRoot(): Promise<string | null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockDbInfo.root), 0);
    });
  },
};
