import { create } from "zustand";
import type { PageId } from "@/types/navigation";

type ProviderModalState = { mode: "add" | "edit"; localId?: number } | null;
type RestartNotice = { title: string; body: string } | null;

type UiState = {
  currentPage: PageId;
  toast: string | null;
  providerModal: ProviderModalState;
  authModalOpen: boolean;
  restartNotice: RestartNotice;
  setCurrentPage: (page: PageId) => void;
  setToast: (toast: string | null) => void;
  setProviderModal: (modal: ProviderModalState) => void;
  setAuthModalOpen: (open: boolean) => void;
  setRestartNotice: (notice: RestartNotice) => void;
};

export const useUiStore = create<UiState>((set) => ({
  currentPage: "overview",
  toast: null,
  providerModal: null,
  authModalOpen: false,
  restartNotice: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  setToast: (toast) => set({ toast }),
  setProviderModal: (providerModal) => set({ providerModal }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
  setRestartNotice: (restartNotice) => set({ restartNotice })
}));
