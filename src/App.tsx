import { useEffect } from "react";
import { AuthSimpleModal } from "@/components/auth/AuthSimpleModal";
import { FirstStartModal, Splash } from "@/components/first-start/FirstStartModal";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Topbar } from "@/components/layout/Topbar";
import { RestartNoticeModal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { MonitorPage } from "@/pages/Monitor";
import { OverviewPage } from "@/pages/Overview";
import { ProviderPage } from "@/pages/Provider";
import { useFirstStartStore } from "@/stores/useFirstStartStore";
import { useMonitorStore } from "@/stores/useMonitorStore";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useUiStore } from "@/stores/useUiStore";

const PAGE_TITLE = {
  overview: "概览",
  provider: "模型服务",
  monitor: "用量监控"
} as const;

export default function App() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const toast = useUiStore((state) => state.toast);
  const setToast = useUiStore((state) => state.setToast);
  const setProviderModal = useUiStore((state) => state.setProviderModal);
  const authModalOpen = useUiStore((state) => state.authModalOpen);
  const setAuthModalOpen = useUiStore((state) => state.setAuthModalOpen);
  const restartNotice = useUiStore((state) => state.restartNotice);
  const setRestartNotice = useUiStore((state) => state.setRestartNotice);
  const overviewStatus = useOverviewStore((state) => state.status);
  const refreshOverview = useOverviewStore((state) => state.refresh);
  const refreshProviders = useProviderStore((state) => state.refresh);
  const refreshMonitor = useMonitorStore((state) => state.refresh);
  const firstStartScan = useFirstStartStore((state) => state.scan);
  const firstStartLoading = useFirstStartStore((state) => state.loading);
  const scanFirstStart = useFirstStartStore((state) => state.scanImport);
  const importFirstStart = useFirstStartStore((state) => state.importCandidates);
  const markFirstStartHandled = useFirstStartStore((state) => state.markHandled);

  useEffect(() => {
    void refreshOverview();
    void scanFirstStart();
  }, [refreshOverview, scanFirstStart]);

  const handleRefresh = () => {
    if (currentPage === "overview") void refreshOverview();
    if (currentPage === "provider") void refreshProviders();
    if (currentPage === "monitor") void refreshMonitor();
  };

  return (
    <div className="app-shell">
      <SidebarNav />
      <main className="main">
        <Topbar
          title={PAGE_TITLE[currentPage]}
          onRefresh={handleRefresh}
        />
        <div className="content">
          {currentPage === "overview" && <OverviewPage />}
          {currentPage === "provider" && <ProviderPage />}
          {currentPage === "monitor" && <MonitorPage />}
        </div>
        <Toast msg={toast} onDone={() => setToast(null)} />
        {firstStartLoading && !firstStartScan ? <Splash /> : null}
        {firstStartScan && !firstStartScan.handled ? (
          <FirstStartModal
            scan={firstStartScan}
            onImport={async (candidates) => {
              await importFirstStart(candidates);
              const count = candidates.length;
              const label =
                count === 1 ? candidates[0]?.name || candidates[0]?.id || "模型服务" : `${count} 个服务`;
              setToast(`已导入 ${label}`);
              setRestartNotice({
                title: `已导入 ${label}`,
                body: "现有模型服务已写入 Codex 全局配置。"
              });
              void refreshOverview();
              void refreshProviders();
              if (candidates.length === 0) {
                setProviderModal({ mode: "add" });
                setCurrentPage("provider");
              }
            }}
            onSkip={async () => {
              await markFirstStartHandled();
              setToast("已跳过导入");
            }}
            onAddManually={async () => {
              await markFirstStartHandled();
              setCurrentPage("provider");
              setProviderModal({ mode: "add" });
            }}
          />
        ) : null}
        {authModalOpen && overviewStatus ? (
          <AuthSimpleModal
            currentMode={overviewStatus.authMode}
            lastActiveCustomProviderId={firstStartScan?.lastActiveCustomProviderId}
            onClose={() => setAuthModalOpen(false)}
            onChanged={(message) => {
              setToast(message);
              setRestartNotice({
                title: message,
                body: "必须先完全退出并重新启动 Codex 软件，新的配置才会生效。"
              });
              void refreshOverview();
              void refreshProviders();
            }}
            onNeedProvider={() => {
              setCurrentPage("provider");
              setProviderModal({ mode: "add" });
              setToast("请先添加一个 API 密钥服务");
            }}
          />
        ) : null}
        {restartNotice ? (
          <RestartNoticeModal
            title={restartNotice.title}
            body={restartNotice.body}
            onClose={() => setRestartNotice(null)}
          />
        ) : null}
      </main>
    </div>
  );
}
