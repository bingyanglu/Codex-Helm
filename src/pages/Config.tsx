import { useEffect, useState } from "react";
import { ConfigForm } from "@/components/config/ConfigForm";
import { useConfigStore } from "@/stores/useConfigStore";
import { useProviderStore } from "@/stores/useProviderStore";

export function ConfigPage() {
  const { config, loading, error, refresh, saveConfig } = useConfigStore();
  const { providers, refresh: refreshProviders } = useProviderStore();
  const [tab, setTab] = useState<"form" | "raw">("form");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    void refreshProviders();
  }, [refresh, refreshProviders]);

  if (!config && loading) {
    return <section className="p-6 text-sm text-[var(--color-text-secondary)]">正在读取全局配置...</section>;
  }

  if (!config && error) {
    return <section className="p-6 text-sm text-red-700">{error}</section>;
  }

  if (!config) {
    return <section className="p-6 text-sm text-[var(--color-text-secondary)]">暂无全局配置。</section>;
  }

  const providerOptions = Array.from(new Set(providers.map((provider) => provider.providerId)));
  if (!providerOptions.includes(config.modelProvider) && config.modelProvider) {
    providerOptions.unshift(config.modelProvider);
  }
  if (providerOptions.length === 0) {
    providerOptions.push("openai");
  }

  return (
    <section className="space-y-4 p-6">
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-xl px-4 py-2 text-sm ${
            tab === "form"
              ? "bg-[var(--color-text-primary)] text-white"
              : "border border-black/10 bg-white text-[var(--color-text-primary)]"
          }`}
          onClick={() => setTab("form")}
        >
          表单视图
        </button>
        <button
          type="button"
          className={`rounded-xl px-4 py-2 text-sm ${
            tab === "raw"
              ? "bg-[var(--color-text-primary)] text-white"
              : "border border-black/10 bg-white text-[var(--color-text-primary)]"
          }`}
          onClick={() => setTab("raw")}
        >
          Raw TOML
        </button>
      </div>

      {tab === "form" ? (
        <ConfigForm
          initialValue={config}
          providerOptions={providerOptions}
          onSubmit={async (input) => {
            await saveConfig(input);
            setMessage("全局 config.toml 已保存，并已自动生成备份。");
          }}
        />
      ) : (
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">Raw TOML</div>
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            最近备份：{config.backupPath || "尚未生成"}
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 p-4 text-xs text-stone-100">
            {config.rawToml || "# 当前配置为空"}
          </pre>
        </div>
      )}
    </section>
  );
}
