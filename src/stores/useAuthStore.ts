import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type { AuthStatus } from "@/types/auth";
import type { ProviderConnectivityResult, ProviderRecord } from "@/types/provider";

type AuthStore = {
  loginStatus: AuthStatus | null;
  providers: ProviderRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveProviderKey: (providerId: string, apiKey: string) => Promise<void>;
  deleteProviderKey: (providerId: string) => Promise<void>;
  validateProviderKey: (providerId: string) => Promise<ProviderConnectivityResult>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  loginStatus: null,
  providers: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });

    try {
      const [loginStatus, providers] = await Promise.all([
        tauriInvoke<AuthStatus>("get_auth_status"),
        tauriInvoke<ProviderRecord[]>("list_providers")
      ]);
      set({ loginStatus, providers, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "读取认证状态失败"
      });
    }
  },
  saveProviderKey: async (providerId, apiKey) => {
    const current = get().providers.find((provider) => provider.id === providerId);
    if (!current) {
      throw new Error(`Provider ${providerId} 不存在`);
    }

    const providers = await tauriInvoke<ProviderRecord[]>("save_provider", {
      provider: {
        ...current,
        apiKey
      }
    });
    set({ providers });
  },
  deleteProviderKey: async (providerId) => {
    const current = get().providers.find((provider) => provider.id === providerId);
    if (!current) {
      throw new Error(`Provider ${providerId} 不存在`);
    }

    const providers = await tauriInvoke<ProviderRecord[]>("save_provider", {
      provider: {
        ...current,
        apiKey: ""
      }
    });
    set({ providers });
  },
  validateProviderKey: async (providerId) => {
    const current = get().providers.find((provider) => provider.id === providerId);
    if (!current) {
      throw new Error(`Provider ${providerId} 不存在`);
    }

    return tauriInvoke<ProviderConnectivityResult>("validate_provider_key", {
      provider: current
    });
  }
}));
