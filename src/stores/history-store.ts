import { create } from "zustand";
import { persist } from "zustand/middleware";

type HistoryStore = {
  overwriteHistory: string[][];
  addOverwriteHistory: (tags: string[]) => void;
};

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      overwriteHistory: [],
      addOverwriteHistory: (tags: string[]) => {
        const current = get().overwriteHistory;

        // stringify で比較用キーを作成
        const key = JSON.stringify(tags);

        // 重複を除去して先頭に追加
        const updated = [
          tags,
          ...current.filter((h) => JSON.stringify(h) !== key),
        ].slice(0, 30);

        set({ overwriteHistory: updated });
      },
    }),
    { name: "history" }
  )
);
