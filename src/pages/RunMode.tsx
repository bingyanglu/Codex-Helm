import { useEffect } from "react";
import { SectionHeader } from "@/components/ui/Card";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useProviderStore, type RunMode } from "@/stores/useProviderStore";
import { useUiStore } from "@/stores/useUiStore";
import type { ProviderRecord } from "@/types/provider";

function detectRunMode(activeProvider: ProviderRecord | null): RunMode {
  if (!activeProvider || activeProvider.kind === "builtin") return "official";
  if (activeProvider.requiresOpenaiAuth) return "mixed";
  return "apikey";
}

function modeLabel(mode: RunMode) {
  if (mode === "official") return "官方登录";
  if (mode === "mixed") return "混合 API";
  return "纯 API";
}

function authSourceLabel(mode: RunMode) {
  if (mode === "official") return "官方账号";
  if (mode === "mixed") return "官方账号";
  return "API Key";
}

function apiRouteLabel(mode: RunMode) {
  if (mode === "official") return "OpenAI 官方";
  return "自定义 API";
}

function historyLabel(mode: RunMode) {
  if (mode === "official") return "openai";
  return "自定义";
}

export function RunModePage() {
  const providers = useProviderStore((s) => s.providers);
  const switchRunMode = useProviderStore((s) => s.switchRunMode);
  const refresh = useProviderStore((s) => s.refresh);
  const refreshOverview = useOverviewStore((s) => s.refresh);
  const setToast = useUiStore((s) => s.setToast);
  const setRestartNotice = useUiStore((s) => s.setRestartNotice);
  const setCurrentPage = useUiStore((s) => s.setCurrentPage);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeProvider = providers.find((p) => p.active) ?? null;
  const currentMode = detectRunMode(activeProvider);
  const customProviders = providers.filter((p) => p.kind === "custom");
  const hasCustom = customProviders.length > 0;

  const handleSwitch = async (mode: RunMode) => {
    if (mode === currentMode) return;

    if (mode !== "official" && !hasCustom) {
      setToast("请先在「模型服务」页面添加一个自定义 API 服务");
      setCurrentPage("provider");
      return;
    }

    try {
      await switchRunMode(mode);
      await refreshOverview();
      setToast(`已切换到${modeLabel(mode)}`);
      setRestartNotice({
        title: `已切换到${modeLabel(mode)}`,
        body: "必须先完全退出并重新启动 Codex，新的配置才会生效。"
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "切换失败");
    }
  };

  return (
    <section className="stack-lg">
      <div>
        <SectionHeader title="选择运行模式" />
        <div className="mode-grid">
          <button
            type="button"
            className={`mode-card ${currentMode === "official" ? "active" : ""}`}
            onClick={() => void handleSwitch("official")}
          >
            <strong>官方登录</strong>
            <span>使用 Codex / ChatGPT 官方账号，不需要 API Key；模型请求直接发往 OpenAI 官方。</span>
          </button>
          <button
            type="button"
            className={`mode-card ${currentMode === "mixed" ? "active" : ""}`}
            onClick={() => void handleSwitch("mixed")}
            disabled={!hasCustom}
            title={!hasCustom ? "请先添加自定义 API 服务" : undefined}
          >
            <strong>混合 API</strong>
            <span>保留官方账号登录，把模型请求转发到自定义 API；适合有中转代理但不想单独维护 Key 的场景。</span>
            {!hasCustom && <em className="mode-card-hint">需要先添加自定义服务</em>}
          </button>
          <button
            type="button"
            className={`mode-card ${currentMode === "apikey" ? "active" : ""}`}
            onClick={() => void handleSwitch("apikey")}
            disabled={!hasCustom}
            title={!hasCustom ? "请先添加自定义 API 服务" : undefined}
          >
            <strong>纯 API</strong>
            <span>不使用官方登录，直接用 API Key 通过自定义服务调用模型；适合完全自建 API 的场景。</span>
            {!hasCustom && <em className="mode-card-hint">需要先添加自定义服务</em>}
          </button>
        </div>
      </div>

      <div>
        <SectionHeader title="当前状态" />
        <div className="mode-status-grid">
          <div className="mode-status-item">
            <div className="mode-status-label">当前模式</div>
            <div className="mode-status-value">{modeLabel(currentMode)}</div>
          </div>
          <div className="mode-status-item">
            <div className="mode-status-label">认证方式</div>
            <div className="mode-status-value">{authSourceLabel(currentMode)}</div>
          </div>
          <div className="mode-status-item">
            <div className="mode-status-label">请求路由</div>
            <div className="mode-status-value">{apiRouteLabel(currentMode)}</div>
          </div>
          <div className="mode-status-item">
            <div className="mode-status-label">历史标识</div>
            <div className="mode-status-value mono">{historyLabel(currentMode)}</div>
          </div>
          <div className="mode-status-item">
            <div className="mode-status-label">当前 API 服务</div>
            <div className="mode-status-value">
              {activeProvider?.kind === "custom" ? (activeProvider.name || activeProvider.providerId) : "OpenAI 默认"}
            </div>
          </div>
          <div className="mode-status-item">
            <div className="mode-status-label">Base URL</div>
            <div className="mode-status-value mono">
              {activeProvider?.kind === "custom" ? activeProvider.baseUrl : "https://api.openai.com/v1"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="模式对比" />
        <div className="mode-compare">
          <div className="mode-compare-head">
            <span />
            <span>认证方式</span>
            <span>请求路由</span>
            <span>需要 Key</span>
          </div>
          {(["official", "mixed", "apikey"] as RunMode[]).map((mode) => (
            <div key={mode} className={`mode-compare-row ${currentMode === mode ? "active" : ""}`}>
              <span className="mode-compare-name">{modeLabel(mode)}</span>
              <span>{authSourceLabel(mode)}</span>
              <span>{apiRouteLabel(mode)}</span>
              <span>{mode === "apikey" ? "是" : "否"}</span>
            </div>
          ))}
        </div>
      </div>

      {!hasCustom && (
        <div className="info-strip">
          <span>混合 API 和纯 API 模式需要先在「模型服务」页面添加一个自定义 API 地址。</span>
          <button type="button" className="btn sm" onClick={() => setCurrentPage("provider")}>
            去添加
          </button>
        </div>
      )}
    </section>
  );
}
