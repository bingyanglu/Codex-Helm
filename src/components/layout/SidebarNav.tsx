import { useEffect, useMemo } from "react";
import { NAV_ITEMS } from "@/types/navigation";
import { useUiStore } from "@/stores/useUiStore";
import { useOverviewStore } from "@/stores/useOverviewStore";

export function SidebarNav() {
  const currentPage = useUiStore((state) => state.currentPage);
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const { status, refresh } = useOverviewStore();

  useEffect(() => {
    if (!status) {
      void refresh();
    }
  }, [status, refresh]);

  const visibleItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.id === "monitor") {
          return status?.monitorAvailable ?? false;
        }
        return true;
      }),
    [status]
  );
  const sections = Array.from(new Set(visibleItems.map((item) => item.section)));

  return (
    <aside className="w-[220px] shrink-0 border-r border-black/5 bg-[var(--color-background-secondary)]">
      <div className="border-b border-black/5 px-4 py-4">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">Codex Helm</div>
        <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">本地配置与会话管理</div>
      </div>
      <div className="space-y-4 p-3">
        {sections.map((section) => (
          <div key={section}>
            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">{section}</div>
            <div className="space-y-1">
              {visibleItems.filter((item) => item.section === section).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition ${
                    currentPage === item.id
                      ? "bg-white font-medium text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-white/70 hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
