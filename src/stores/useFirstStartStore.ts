import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type { FirstStartCandidate, FirstStartImportResult, FirstStartScanResult } from "@/types/firstStart";

type FirstStartState = {
  scan: FirstStartScanResult | null;
  loading: boolean;
  error: string | null;
  scanImport: () => Promise<void>;
  importCandidates: (candidates: FirstStartCandidate[]) => Promise<FirstStartImportResult>;
  markHandled: () => Promise<void>;
};

export const useFirstStartStore = create<FirstStartState>((set) => ({
  scan: null,
  loading: false,
  error: null,
  scanImport: async () => {
    set({ loading: true, error: null });
    try {
      const scan = await tauriInvoke<FirstStartScanResult>("scan_first_start_import");
      set({ scan, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "扫描现有配置失败" });
    }
  },
  importCandidates: async (candidates) => {
    const result = await tauriInvoke<FirstStartImportResult>("import_first_start_provider", {
      input: { candidates }
    });
    set((state) => ({
      scan: state.scan ? { ...state.scan, handled: true } : state.scan
    }));
    return result;
  },
  markHandled: async () => {
    await tauriInvoke<void>("mark_first_start_import_handled");
    set((state) => ({
      scan: state.scan ? { ...state.scan, handled: true } : state.scan
    }));
  }
}));
