import { create } from "zustand";

type CommonStore = {
  loading: boolean;
  setLoading: (state: boolean) => void;
};

export const useCommonStore = create<CommonStore>((set) => ({
  loading: false,
  setLoading: (state: boolean) => set({ loading: state }),
}));
