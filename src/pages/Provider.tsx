import { useEffect, useMemo, useState } from "react";
import { ProviderForm } from "@/components/provider/ProviderForm";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useProviderStore } from "@/stores/useProviderStore";
import type { ProviderRecord } from "@/types/provider";

const CUSTOM_PROVIDER_TEMPLATE: ProviderRecord = {
  id: "",
  name: "",
  kind: "custom",
  baseUrl: "",
  model: "",
  apiKey: "",
  envKey: "",
  httpHeaders: {},
  queryParams: {},
  supportsWebsockets: false,
  active: false,
  enabled: true,
  lastValidatedAt: null,
  lastValidationStatus: "unknown"
};

type ConnectivityBadge = {
  reachable: boolean;
  latencyMs: number;
};

type RestartNotice = {
  title: string;
  body: string;
};

export function ProviderPage() {
  const {
    providers,
    loading,
    error,
    refresh,
    saveProvider,
    deleteProvider,
    activateProvider,
    restoreOfficialDefaults,
    testProviderConnectivity,
    validateProvider
  } = useProviderStore();
  const refreshOverview = useOverviewStore((state) => state.refresh);
  const [message, setMessage] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [connectivityBadges, setConnectivityBadges] = useState<
    Record<string, ConnectivityBadge>
  >({});
  const [restartNotice, setRestartNotice] = useState<RestartNotice | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const customProviders = useMemo(
    () =>
      providers
        .filter((provider) => provider.kind === "custom")
        .sort(
          (left, right) =>
            Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)
        ),
    [providers]
  );

  const editingProvider =
    customProviders.find((provider) => provider.id === editingProviderId) ?? null;
  const formInitialValue = editingProvider ?? CUSTOM_PROVIDER_TEMPLATE;

  return (
    <section className="space-y-4 p-6">
      {restartNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {restartNotice.title}
            </div>
            <div className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              {restartNotice.body}
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
              必须先完全退出并重新启动 Codex 软件，新的配置才会生效。
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-[var(--color-text-primary)] px-4 py-2 text-sm text-white"
              onClick={() => setRestartNotice(null)}
            >
              我知道了
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-[var(--color-text-secondary)]">
        填写服务地址、模型名称和密钥，保存后点“测试是否可用”。测试通过后，再设为当前使用。
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-medium text-amber-950">使用官方登录</div>
        <div className="mt-1 text-sm text-amber-900">
          <div>
            如果你想改回官方账号登录，点击下面的按钮。系统会停止使用当前自定义服务，并清空当前模型设置，改回 Codex 官方默认模型。
          </div>
          <div className="mt-2 font-semibold text-amber-950">
            已保存的自定义服务信息不会删除。切换后，在 Codex 右下角设置中退出并重新登录个人账号；如果没有退出选项，直接登录即可。
          </div>
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm text-amber-950"
          onClick={async () => {
            await restoreOfficialDefaults();
            await refreshOverview();
            setEditingProviderId(null);
            setMessage("已恢复官方登录默认配置，当前模型也已清空并改回官方默认。下一步请在官方 Codex 客户端里完成登录。");
            setRestartNotice({
              title: "已切回官方登录配置",
              body: "当前自定义 API 配置已清空，模型也已恢复为 Codex 官方默认。"
            });
          }}
        >
          改用官方登录
        </button>
      </div>

      <div className="space-y-3">
        {customProviders.map((provider) => (
          <div
            key={provider.id}
            className={`rounded-2xl border bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)] ${
              provider.active ? "border-sky-300" : "border-black/5"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    {provider.name}
                  </div>
                  {provider.active ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">
                      当前使用
                    </span>
                  ) : null}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    自定义
                  </span>
                  {provider.supportsWebsockets ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                      WebSockets
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {provider.baseUrl}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {connectivityBadges[provider.id] ? (
                  <span
                    className={`rounded-xl border px-3 py-1.5 text-sm ${
                      connectivityBadges[provider.id].reachable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {connectivityBadges[provider.id].reachable ? "可用" : "不可用"}{" "}
                    {connectivityBadges[provider.id].latencyMs} ms
                  </span>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl border border-black/10 px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                  onClick={() => {
                    setEditingProviderId(provider.id);
                    setMessage(`已开始修改 ${provider.name}`);
                  }}
                >
                  修改
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-black/10 px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                  onClick={async () => {
                    await activateProvider(provider.id);
                    await refreshOverview();
                    setMessage(`已将 ${provider.name} 设为当前使用`);
                    setRestartNotice({
                      title: `已切换到 ${provider.name}`,
                      body: "当前 API 服务配置已经写入 Codex 全局配置。"
                    });
                  }}
                >
                  设为当前使用
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-black/10 px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                  onClick={async () => {
                    await validateProvider(provider);
                    const result = await testProviderConnectivity(provider);
                    setConnectivityBadges((current) => ({
                      ...current,
                      [provider.id]: {
                        reachable: result.reachable,
                        latencyMs: result.latencyMs
                      }
                    }));
                  }}
                >
                  测试是否可用
                </button>
                {provider.kind === "custom" ? (
                  <button
                    type="button"
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-700"
                    onClick={async () => {
                      await deleteProvider(provider.id);
                      setMessage(`${provider.name} 已删除`);
                    }}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ProviderForm
        initialValue={formInitialValue}
        isEditing={!!editingProvider}
        onCancelEdit={() => {
          setEditingProviderId(null);
          setMessage("已取消修改");
        }}
        onSubmit={async (provider) => {
          await validateProvider(provider);
          await saveProvider(provider);
          setEditingProviderId(null);
          setMessage(
            editingProvider
              ? `${provider.name || provider.id} 已保存`
              : `${provider.name || provider.id} 已添加`
          );
        }}
      />

      {!loading && customProviders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-sm text-[var(--color-text-secondary)]">
          还没有添加模型服务。你可以在下面填写服务地址、模型名称和密钥，保存后再测试是否可用。
        </div>
      ) : null}
    </section>
  );
}
