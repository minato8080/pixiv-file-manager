import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AuthorInfo } from "@/bindings/AuthorInfo";

export type SearchHistory = {
  id: string | null;
  tags: string[];
  character: string | null;
  author: AuthorInfo | null;
  timestamp: string;
  count: number;
};

type HistoryStore = {
  overwriteHistory: string[][];
  addOverwriteHistory: (tags: string[]) => void;
  searchHistory: SearchHistory[];
  addSearchHistory: (history: SearchHistory) => void;
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
      searchHistory: [],
      addSearchHistory: (history) => {
        const current = get().searchHistory;

        // 比較用キーを生成する関数（timestamp, count を除外）
        const makeKey = (h: SearchHistory) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { timestamp, count, ...rest } = h;
          return JSON.stringify(rest);
        };

        const key = makeKey(history);

        // 重複を除去して先頭に追加
        const updated = [
          history,
          ...current.filter((h) => makeKey(h) !== key),
        ].slice(0, 30);

        set({ searchHistory: updated });
      },
    }),
    { name: "history" }
  )
);
