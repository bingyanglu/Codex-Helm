import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useConfigStore } from "@/stores/useConfigStore";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useProviderStore, type RunMode } from "@/stores/useProviderStore";
import { useUiStore } from "@/stores/useUiStore";
import type { ConfigInput } from "@/types/config";
import type { ProviderRecord } from "@/types/provider";

function detectRunMode(active: ProviderRecord | null): RunMode {
  if (!active || active.kind === "builtin") return "official";
  if (active.requiresOpenaiAuth) return "mixed";
  return "apikey";
}

const MODE_META: Record<RunMode, { label: string; auth: string; route: string; needKey: boolean; desc: string }> = {
  official: {
    label: "官方登录",
    auth: "官方账号",
    route: "OpenAI 官方",
    needKey: false,
    desc: "使用 Codex / ChatGPT 官方账号，无需 API Key；请求直接发往 OpenAI 官方服务。",
  },
  mixed: {
    label: "混合 API",
    auth: "官方账号",
    route: "自定义 API",
    needKey: false,
    desc: "保留官方账号登录，将模型请求转发到自定义 API；适合使用中转代理且不想单独管理 Key 的场景。",
  },
  apikey: {
    label: "纯 API",
    auth: "API Key",
    route: "自定义 API",
    needKey: true,
    desc: "不使用官方登录，直接用 API Key 通过自定义服务调用模型；适合完全自建 API 的场景。",
  },
};

function Panel({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {detail && <div className="panel-sub">{detail}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

const EMPTY_DRAFT: ConfigInput = {
  model: "",
  modelProvider: "openai",
  approvalPolicy: "on-request",
  sandboxMode: "workspace-write",
  webSearch: "disabled",
  toolsViewImage: false,
  historyPersistence: "save-all",
  historyMaxBytes: 10485760,
};

export function RunModePage() {
  const providers = useProviderStore((s) => s.providers);
  const switchRunMode = useProviderStore((s) => s.switchRunMode);
  const refreshProviders = useProviderStore((s) => s.refresh);
  const { config, refresh: refreshConfig, saveConfig } = useConfigStore();
  const refreshOverview = useOverviewStore((s) => s.refresh);
  const setToast = useUiStore((s) => s.setToast);
  const setRestartNotice = useUiStore((s) => s.setRestartNotice);
  const setCurrentPage = useUiStore((s) => s.setCurrentPage);

  const [draft, setDraft] = useState<ConfigInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshProviders();
    void refreshConfig();
  }, [refreshProviders, refreshConfig]);

  useEffect(() => {
    if (config) {
      setDraft({
        model: config.model,
        modelProvider: config.modelProvider,
        approvalPolicy: config.approvalPolicy || "on-request",
        sandboxMode: config.sandboxMode || "workspace-write",
        webSearch: config.webSearch || "disabled",
        toolsViewImage: config.toolsViewImage,
        historyPersistence: config.historyPersistence || "save-all",
        historyMaxBytes: config.historyMaxBytes || 10485760,
      });
    }
  }, [config]);

  const activeProvider = providers.find((p) => p.active) ?? null;
  const currentMode = detectRunMode(activeProvider);
  const customProviders = providers.filter((p) => p.kind === "custom");
  const hasCustom = customProviders.length > 0;

  const handleSwitchMode = async (mode: RunMode) => {
    if (mode === currentMode) return;
    if (mode !== "official" && !hasCustom) {
      setToast("请先在「模型服务」页面添加一个自定义 API 服务");
      setCurrentPage("provider");
      return;
    }
    try {
      await switchRunMode(mode);
      await refreshOverview();
      setToast(`已切换到${MODE_META[mode].label}`);
      setRestartNotice({
        title: `已切换到${MODE_META[mode].label}`,
        body: "必须先完全退出并重新启动 Codex，新配置才会生效。",
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "切换失败");
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await saveConfig(draft);
      setToast("配置已保存");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const up = <T,>(key: keyof ConfigInput, val: T) => setDraft((d) => ({ ...d, [key]: val }));

  const activeBase = activeProvider?.kind === "custom" ? activeProvider.baseUrl : "https://api.openai.com/v1";
  const activeName = activeProvider?.kind === "custom" ? (activeProvider.name || activeProvider.providerId) : "OpenAI";

  return (
    <section className="stack-lg">

      {/* ── Panel 1: 运行模式 ── */}
      <Panel
        title="运行模式"
        detail={`当前：${MODE_META[currentMode].label} · 点击卡片即时切换`}
      >
        <div className="mode-grid">
          {(["official", "mixed", "apikey"] as RunMode[]).map((mode) => {
            const meta = MODE_META[mode];
            const disabled = mode !== "official" && !hasCustom;
            return (
              <button
                key={mode}
                type="button"
                className={`mode-card ${currentMode === mode ? "active" : ""}`}
                onClick={() => void handleSwitchMode(mode)}
                disabled={disabled}
                title={disabled ? "请先添加自定义 API 服务" : undefined}
              >
                <strong>{meta.label}</strong>
                <span>{meta.desc}</span>
                {disabled && <em className="mode-card-hint">需要先添加自定义服务</em>}
              </button>
            );
          })}
        </div>

        <div className="relay-grid">
          <div className="relay-metric">
            <div className="relay-metric-label">当前模式</div>
            <div className="relay-metric-value">{MODE_META[currentMode].label}</div>
          </div>
          <div className="relay-metric">
            <div className="relay-metric-label">认证方式</div>
            <div className="relay-metric-value">{MODE_META[currentMode].auth}</div>
          </div>
          <div className="relay-metric">
            <div className="relay-metric-label">请求路由</div>
            <div className="relay-metric-value">{MODE_META[currentMode].route}</div>
          </div>
          <div className="relay-metric">
            <div className="relay-metric-label">当前 API 服务</div>
            <div className="relay-metric-value">{activeName}</div>
          </div>
          <div className="relay-metric">
            <div className="relay-metric-label">Base URL</div>
            <div className="relay-metric-value mono">{activeBase}</div>
          </div>
          <div className="relay-metric">
            <div className="relay-metric-label">当前模型</div>
            <div className="relay-metric-value mono">{draft.model || config?.model || "—"}</div>
          </div>
        </div>

        {!hasCustom && (
          <div className="hint-line">
            <Icon name="info" size={14} />
            <span>混合 API 和纯 API 需要先添加自定义服务。</span>
            <button type="button" className="btn sm" onClick={() => setCurrentPage("provider")}>
              去添加
            </button>
          </div>
        )}
      </Panel>

      {/* ── Panel 2: 模型与配置 ── */}
      <Panel
        title="模型与配置"
        detail={config ? `~/.codex/config.toml · 备份：${config.backupPath || "尚未生成"}` : "写入 ~/.codex/config.toml"}
      >
        <div className="grid-2 mb-fields">
          <div className="field">
            <label htmlFor="cfg-model">默认模型</label>
            <input
              id="cfg-model"
              value={draft.model}
              onChange={(e) => up("model", e.target.value)}
              placeholder="如 gpt-5.5 / claude-sonnet-4.5"
            />
          </div>
          <div className="field">
            <label htmlFor="cfg-sandbox">沙盒模式</label>
            <select
              id="cfg-sandbox"
              value={draft.sandboxMode}
              onChange={(e) => up("sandboxMode", e.target.value)}
              className={draft.sandboxMode === "danger-full-access" ? "select-danger" : ""}
            >
              <option value="read-only">read-only</option>
              <option value="workspace-write">workspace-write</option>
              <option value="danger-full-access">danger-full-access ⚠</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cfg-approval">审批策略</label>
            <select id="cfg-approval" value={draft.approvalPolicy} onChange={(e) => up("approvalPolicy", e.target.value)}>
              <option value="on-request">on-request</option>
              <option value="never">never</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cfg-web">网络搜索</label>
            <select id="cfg-web" value={draft.webSearch} onChange={(e) => up("webSearch", e.target.value)}>
              <option value="disabled">disabled</option>
              <option value="cached">cached</option>
              <option value="live">live</option>
            </select>
          </div>
        </div>

        <label className="provider-check">
          <input
            type="checkbox"
            checked={draft.toolsViewImage}
            onChange={(e) => up("toolsViewImage", e.target.checked)}
          />
          <span>tools.view_image — 允许 Codex 查看图片</span>
        </label>

        <div className="panel-foot">
          <Button variant="primary" onClick={() => void handleSaveConfig()} disabled={saving}>
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </div>
      </Panel>

      {/* ── Panel 3: 模式对比 ── */}
      <Panel title="模式对比" detail="切换运行模式时实际改变的内容">
        <div className="mode-compare">
          <div className="mode-compare-head">
            <span />
            <span>认证方式</span>
            <span>请求路由</span>
            <span>需要 Key</span>
          </div>
          {(["official", "mixed", "apikey"] as RunMode[]).map((mode) => (
            <div
              key={mode}
              className={`mode-compare-row ${currentMode === mode ? "active" : ""}`}
              onClick={() => void handleSwitchMode(mode)}
              style={{ cursor: mode !== "official" && !hasCustom ? "not-allowed" : "pointer" }}
            >
              <span className="mode-compare-name">{MODE_META[mode].label}</span>
              <span>{MODE_META[mode].auth}</span>
              <span>{MODE_META[mode].route}</span>
              <span>{MODE_META[mode].needKey ? "是" : "否"}</span>
            </div>
          ))}
        </div>
      </Panel>

    </section>
  );
}
