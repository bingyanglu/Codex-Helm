import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type {
  ProviderConnectivityResult,
  ProviderRecord,
  ProviderValidationResult
} from "@/types/provider";

type ProviderStore = {
  providers: ProviderRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveProvider: (provider: ProviderRecord) => Promise<ProviderRecord[]>;
  deleteProvider: (localId: number) => Promise<void>;
  activateProvider: (localId: number) => Promise<void>;
  restoreOfficialDefaults: () => Promise<void>;
  testProviderConnectivity: (provider: ProviderRecord) => Promise<ProviderConnectivityResult>;
  validateProvider: (provider: ProviderRecord) => Promise<ProviderValidationResult>;
};

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });

    try {
      const providers = await tauriInvoke<ProviderRecord[]>("list_providers");
      set({ providers, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "读取 Provider 失败"
      });
    }
  },
  saveProvider: async (provider) => {
    const providers = await tauriInvoke<ProviderRecord[]>("save_provider", { provider });
    set({ providers });
    return providers;
  },
  deleteProvider: async (localId) => {
    const providers = await tauriInvoke<ProviderRecord[]>("delete_provider", { localId });
    set({ providers });
  },
  activateProvider: async (localId) => {
    const providers = await tauriInvoke<ProviderRecord[]>("activate_provider", { localId });
    set({ providers });
  },
  restoreOfficialDefaults: async () => {
    const providers = await tauriInvoke<ProviderRecord[]>("restore_official_provider_defaults");
    set({ providers });
  },
  testProviderConnectivity: async (provider) => {
    return tauriInvoke<ProviderConnectivityResult>("test_provider_connectivity", { provider });
  },
  validateProvider: async (provider) => {
    return tauriInvoke<ProviderValidationResult>("validate_provider", { provider });
  }
}));
