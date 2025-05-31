import { mockIllustDetail, mockTagInfo, mockDbInfo } from "./mock-data";

export interface TagAssignment {
  seriesTag: string | null;
  characterTag: string | null;
}

export interface CollectSummary {
  id: string;
  seriesTag: string | null;
  characterTag: string | null;
  beforeCount: number;
  afterCount: number;
  newPath: string;
  isNewlyAdded: boolean;
}

export interface CollectStats {
  beforeUncollected: number;
  afterUncollected: number;
  totalAssigned: number;
}

// モックAPI関数
export const mockApi = {
  async assignTag(
    seriesTag: string | null,
    characterTag: string | null
  ): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const seriesText = seriesTag ?? "Unset";
    const characterText = characterTag ?? "Unset";
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
        seriesTag: string | null;
        characterTag: string | null;
      }
    >();
    const totalIllusts = mockIllustDetail.length;
    let assignedCount = 0;

    assignments.forEach((assignment) => {
      let illustCount = 0;

      if (assignment.seriesTag) {
        const seriesIllusts = mockTagInfo
          .filter((tagInfo) => tagInfo.tag === assignment.seriesTag)
          .map((tagInfo) => tagInfo.illust_id);
        illustCount += seriesIllusts.length;
      }

      if (assignment.characterTag) {
        const characterIllusts = mockTagInfo
          .filter((tagInfo) => tagInfo.tag === assignment.characterTag)
          .map((tagInfo) => tagInfo.illust_id);
        illustCount += characterIllusts.length;
      }

      const key = `${assignment.seriesTag ?? "null"}-${
        assignment.characterTag ?? "null"
      }`;

      combinationMap.set(key, {
        count: illustCount,
        seriesTag: assignment.seriesTag,
        characterTag: assignment.characterTag,
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
        seriesTag: null,
        characterTag: null,
        beforeCount: beforeUncollected,
        afterCount: afterUncollected,
        newPath: "temp/uncollected",
        isNewlyAdded: false,
      });
    }

    combinationMap.forEach((data, key) => {
      const isNewlyAdded = !previousIds.has(key);
      let newPath = "root";

      if (data.seriesTag && data.characterTag) {
        newPath = `root/${data.seriesTag}/${data.characterTag}`;
      } else if (data.seriesTag) {
        newPath = `root/${data.seriesTag}`;
      } else if (data.characterTag) {
        newPath = `root/${data.characterTag}`;
      }

      result.push({
        id: key,
        seriesTag: data.seriesTag,
        characterTag: data.characterTag,
        beforeCount: 0,
        afterCount: data.count,
        newPath,
        isNewlyAdded,
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
