import { create } from "zustand";
import type { PageId } from "@/types/navigation";

type UiState = {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
};

export const useUiStore = create<UiState>((set) => ({
  currentPage: "overview",
  setCurrentPage: (page) => set({ currentPage: page })
}));
