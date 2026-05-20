import { useEffect, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { NAV_ITEMS } from "@/types/navigation";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useUiStore } from "@/stores/useUiStore";

export function SidebarNav() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const { status, refresh } = useOverviewStore();

  useEffect(() => {
    if (!status) {
      void refresh();
    }
  }, [status, refresh]);

  const sections = useMemo(() => Array.from(new Set(NAV_ITEMS.map((item) => item.section))), []);
  const issueCount = status
    ? [!status.cli.installed, !status.activeProvider, !status.configExists].filter(Boolean).length
    : 0;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-title">Codex Helm</div>
        <div className="brand-sub">本地配置与会话管理</div>
      </div>

      {sections.map((section) => (
        <div key={section}>
          <div className="nav-group-label">{section}</div>
          <div className="stack">
            {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${currentPage === item.id ? "active" : ""}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <span className="nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span>{item.label}</span>
                {item.id === "overview" && issueCount > 0 ? <span className="nav-badge">{issueCount}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="sidebar-foot">v0.1 · macOS</div>
    </aside>
  );
}
