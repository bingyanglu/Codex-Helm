import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type { ConfigInput, ConfigView } from "@/types/config";

type ConfigStore = {
  config: ConfigView | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveConfig: (input: ConfigInput) => Promise<void>;
};

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });

    try {
      const config = await tauriInvoke<ConfigView>("get_global_config");
      set({ config, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "读取配置失败"
      });
    }
  },
  saveConfig: async (input) => {
    const config = await tauriInvoke<ConfigView>("save_global_config", { input });
    set({ config });
  }
}));
