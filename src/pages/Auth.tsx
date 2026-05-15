import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

function modeLabel(mode?: string | null) {
  if (mode === "chatgpt") return "ChatGPT 登录";
  if (mode === "apikey") return "API Key";
  return "未登录";
}

export function AuthPage() {
  const { loginStatus, loading, error, refresh } = useAuthStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-4 p-6">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        API Key 会以明文存储的方式保存在 <code>~/.codex-manager/settings.json</code> 中，程序会强制把文件权限设为 600。请不要分享这个文件，也不要把截图发到公开渠道。
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">Codex 当前登录状态</div>
        <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {loading && !loginStatus ? "正在读取..." : modeLabel(loginStatus?.mode)}
        </div>
        {loginStatus ? (
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{loginStatus.sourcePath}</div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-[var(--color-text-secondary)]">
        自定义 Provider 的 API Key 已合并到“模型服务”页面统一管理。这里仅用于查看 Codex 当前登录状态和明文存储风险提示。
      </div>
    </section>
  );
}
