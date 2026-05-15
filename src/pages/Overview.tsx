import { useEffect } from "react";
import { StatusCard } from "@/components/common/StatusCard";
import { useOverviewStore } from "@/stores/useOverviewStore";

function formatMode(mode: string) {
  if (mode === "chatgpt") return "ChatGPT 登录";
  if (mode === "apikey") return "API Key";
  return "未登录";
}

export function OverviewPage() {
  const { status, loading, error, refresh } = useOverviewStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!status && loading) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">状态概览</h2>
        <div className="mt-4 text-sm text-[var(--color-text-secondary)]">正在读取状态...</div>
      </section>
    );
  }

  if (!status && error) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">状态概览</h2>
        <div className="mt-4 text-sm text-red-700">{error}</div>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">状态概览</h2>
        <div className="mt-4 text-sm text-[var(--color-text-secondary)]">暂无状态数据。</div>
      </section>
    );
  }

  return (
    <section className="space-y-4 p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">状态概览</h2>
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <div className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          当前登录模式
        </div>
        <div className="mt-2 text-lg font-medium text-[var(--color-text-primary)]">
          {formatMode(status.authMode)}
        </div>
        <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {status.authMode === "apikey" && status.activeProviderBaseUrl
            ? `API 服务：${status.activeProviderBaseUrl}`
            : `config: ${status.configPath}`}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatusCard
          label="Codex CLI"
          value={status.cli.installed ? "已安装" : "未安装"}
          subtext={`${status.cli.version ?? "unknown"} · ${status.cli.path ?? "not found"}`}
        />
        <StatusCard
          label="Codex App"
          value={status.app.installed ? "已安装" : "未安装"}
          subtext={`${status.app.version ?? "unknown"} · ${status.app.path ?? "not found"}`}
        />
        <StatusCard
          label="当前 Provider"
          value={status.activeProvider ?? "未设置"}
          subtext={`${status.model ?? "未设置"} · approval ${status.approvalPolicy ?? "未设置"}`}
        />
        <StatusCard
          label="Sandbox 模式"
          value={status.sandboxMode ?? "未设置"}
          subtext={status.configExists ? "全局配置已检测到" : "全局配置不存在"}
          tone={status.sandboxMode === "danger-full-access" ? "danger" : "default"}
        />
      </div>
    </section>
  );
}
