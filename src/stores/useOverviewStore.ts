import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type { OverviewStatus } from "@/types/overview";

type OverviewStore = {
  status: OverviewStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const useOverviewStore = create<OverviewStore>((set) => ({
  status: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });

    try {
      const status = await tauriInvoke<OverviewStatus>("get_overview_status");
      set({ status, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "读取状态失败"
      });
    }
  }
}));
