import { useEffect } from "react";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Topbar } from "@/components/layout/Topbar";
import { MonitorPage } from "@/pages/Monitor";
import { OverviewPage } from "@/pages/Overview";
import { ProviderPage } from "@/pages/Provider";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useUiStore } from "@/stores/useUiStore";

const PAGE_TITLE = {
  overview: "状态概览",
  provider: "模型服务",
  monitor: "监控"
} as const;

export default function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const { status, refresh } = useOverviewStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (currentPage === "monitor" && status && !status.monitorAvailable) {
      setCurrentPage("overview");
    }
  }, [currentPage, setCurrentPage, status]);

  return (
    <div className="min-h-screen bg-[var(--color-background-tertiary)]">
      <div className="flex min-h-screen overflow-hidden bg-[var(--color-background-tertiary)]">
        <SidebarNav />
        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar title={PAGE_TITLE[currentPage]} />
          <div className="flex-1 overflow-y-auto">
            {currentPage === "overview" && <OverviewPage />}
            {currentPage === "provider" && <ProviderPage />}
            {currentPage === "monitor" && <MonitorPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
