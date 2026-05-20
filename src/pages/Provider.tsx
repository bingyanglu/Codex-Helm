import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, SectionHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useUiStore } from "@/stores/useUiStore";
import type { ProviderConnectivityResult, ProviderRecord } from "@/types/provider";

type ProviderModalState = { mode: "add" | "edit"; localId?: number };
type ProviderDraft = {
  providerId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsWebsockets: boolean;
};

const EMPTY_DRAFT: ProviderDraft = {
  providerId: "",
  name: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  supportsWebsockets: false
};

function normalizeProviderId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^api\./, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function draftFromProvider(provider: ProviderRecord | null): ProviderDraft {
  if (!provider) return EMPTY_DRAFT;
  return {
    providerId: provider.providerId,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
    supportsWebsockets: provider.supportsWebsockets
  };
}

function providerTitle(provider: ProviderRecord) {
  return provider.name || provider.providerId;
}

function nextIdFromDraft(draft: ProviderDraft) {
  if (draft.providerId) return draft.providerId;
  if (draft.name) return normalizeProviderId(draft.name);
  try {
    const parsed = new URL(draft.baseUrl);
    return normalizeProviderId(parsed.hostname.split(".")[0] ?? parsed.hostname);
  } catch {
    return "";
  }
}

function mapDraftToProvider(draft: ProviderDraft, existing?: ProviderRecord | null): ProviderRecord {
  const providerId = existing?.providerId || nextIdFromDraft(draft) || `p-${Date.now()}`;
  return {
    localId: existing?.localId ?? 0,
    providerId,
    name: draft.name || providerId,
    kind: "custom",
    baseUrl: draft.baseUrl,
    model: draft.model,
    apiKey: draft.apiKey,
    envKey: "",
    httpHeaders: existing?.httpHeaders ?? {},
    queryParams: existing?.queryParams ?? {},
    supportsWebsockets: draft.supportsWebsockets,
    active: existing?.active ?? false,
    enabled: true,
    lastValidatedAt: existing?.lastValidatedAt ?? null,
    lastValidationStatus: existing?.lastValidationStatus ?? "unknown"
  };
}

function ProviderModal({
  modal,
  providers,
  draft,
  onDraftChange,
  onClose,
  onSaved
}: {
  modal: ProviderModalState;
  providers: ProviderRecord[];
  draft: ProviderDraft;
  onDraftChange: (draft: ProviderDraft) => void;
  onClose: () => void;
  onSaved: (message: string, notice: { title: string; body: string }) => void;
}) {
  const { saveProvider, activateProvider, testProviderConnectivity, validateProvider } = useProviderStore();
  const refreshOverview = useOverviewStore((state) => state.refresh);
  const editingProvider =
    modal.mode === "edit" && modal.localId != null
      ? providers.find((provider) => provider.localId === modal.localId) ?? null
      : null;
  const [step, setStep] = useState<1 | 2>(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nameTouched, setNameTouched] = useState(Boolean(draft.name));
  const [testResult, setTestResult] = useState<ProviderConnectivityResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStep(1);
    setShowAdvanced(false);
    setNameTouched(Boolean(draft.name || editingProvider?.name));
    setTestResult(null);
    // Reset only when switching modal identity; draft changes are handled by onDraftChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProvider, modal.mode]);

  useEffect(() => {
    if (nameTouched || !draft.baseUrl) return;
    try {
      const parsed = new URL(draft.baseUrl);
      const suggested = parsed.hostname.replace(/^api\./, "").split(".")[0] ?? "";
      if (!suggested) return;
      const providerId = editingProvider?.providerId || normalizeProviderId(suggested);
      if (draft.providerId === providerId && draft.name === suggested) return;
      onDraftChange({
        ...draft,
        providerId,
        name: suggested
      });
    } catch {
      // ignore invalid url while typing
    }
  }, [draft, draft.baseUrl, editingProvider?.providerId, nameTouched, onDraftChange]);

  const canNext = draft.baseUrl.startsWith("http") && draft.apiKey.trim().length > 4;
  const tested = Boolean(testResult?.reachable && testResult.authenticated);

  const update = (field: keyof ProviderDraft, value: string | boolean) => {
    if (field === "name") setNameTouched(true);
    onDraftChange({ ...draft, [field]: value });
    setTestResult(null);
  };

  const runTest = async () => {
    const provider = mapDraftToProvider(draft, editingProvider);
    setTesting(true);
    try {
      const validation = await validateProvider(provider);
      if (!validation.ok) {
        setTestResult({
          reachable: false,
          authenticated: false,
          latencyMs: 0,
          detail: validation.detail
        });
        return;
      }
      setTestResult(await testProviderConnectivity(provider));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const provider = mapDraftToProvider(draft, editingProvider);
    setSaving(true);
    try {
      const savedProviders = await saveProvider(provider);
      if (modal.mode === "add" || editingProvider?.active) {
        const localId =
          editingProvider?.localId ??
          savedProviders
            .filter((item) => item.kind === "custom" && item.providerId === provider.providerId)
            .sort((left, right) => right.localId - left.localId)[0]?.localId;
        if (localId) await activateProvider(localId);
      }
      await refreshOverview();
      const name = providerTitle(provider);
      onSaved(
        modal.mode === "add" ? `已添加并启用 ${name}` : `${name} 已保存`,
        modal.mode === "add" || editingProvider?.active
          ? { title: `已切换到 ${name}`, body: "当前 API 服务配置已经写入 Codex 全局配置。" }
          : { title: `${name} 已保存`, body: "模型服务配置已经更新。" }
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={modal.mode === "add" ? "添加模型服务" : "修改模型服务"}
      subtitle="填写一个 OpenAI 兼容的服务地址即可，测通后再启用。"
      width={640}
      closeOnScrim={false}
      onClose={onClose}
      footer={
        <>
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              上一步
            </Button>
          ) : null}
          <div className="spacer" />
          <Button onClick={onClose} disabled={saving}>
            取消
          </Button>
          {step === 1 ? (
            <Button variant="primary" onClick={() => setStep(2)} disabled={!canNext}>
              下一步
            </Button>
          ) : (
            <Button variant="primary" onClick={save} disabled={!tested || saving}>
              {modal.mode === "add" ? "完成并启用" : "保存修改"}
            </Button>
          )}
        </>
      }
    >
      <div className="steps">
        <div className={`step ${step === 1 ? "active" : "done"}`}>
          <span className="step-num">{step > 1 ? "✓" : "1"}</span>
          <span>服务地址与密钥</span>
        </div>
        <div className="step-bar" />
        <div className={`step ${step === 2 ? "active" : ""}`}>
          <span className="step-num">2</span>
          <span>选择模型并测试</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="provider-base-url">
              服务地址 <span className="hint">通常以 /v1 结尾</span>
            </label>
            <input
              id="provider-base-url"
              value={draft.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="field">
            <label htmlFor="provider-api-key">API 密钥</label>
            <input
              id="provider-api-key"
              type="password"
              value={draft.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              placeholder="sk-..."
            />
          </div>
          <button type="button" className="disclosure" onClick={() => setShowAdvanced((value) => !value)}>
            <Icon name="chevron" size={12} strokeWidth={2.2} />
            高级（重命名 / WebSocket）
          </button>
          {showAdvanced ? (
            <>
              <div className="field">
                <label htmlFor="provider-name">
                  显示名称 <span className="hint">默认从地址自动生成</span>
                </label>
                <input
                  id="provider-name"
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder={draft.name || "auto"}
                />
              </div>
              <label className="provider-check">
                <input
                  type="checkbox"
                  checked={draft.supportsWebsockets}
                  onChange={(event) => update("supportsWebsockets", event.target.checked)}
                />
                使用 WebSocket（仅当服务方明确要求时勾选）
              </label>
            </>
          ) : null}
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor="provider-model">默认模型</label>
            <input
              id="provider-model"
              value={draft.model}
              onChange={(event) => update("model", event.target.value)}
              placeholder="例如 gpt-5.5 / claude-sonnet-4.5"
            />
            <div className="field-help">Codex 会用这个模型作为默认；可以随时在 Codex 内切换。</div>
          </div>
          <div className="field">
            <Button onClick={runTest} disabled={testing || !draft.model.trim()}>
              {testing ? "测试中…" : "测试连通"}
            </Button>
          </div>
          {testing ? <div className="test-result loading">正在向 {draft.baseUrl} 发起测试请求…</div> : null}
          {testResult ? (
            <div className={`test-result ${tested ? "ok" : "err"}`}>
              <Icon name={tested ? "check" : "x"} size={16} strokeWidth={2.4} />
              {tested ? "连通成功 · 模型可调用" : testResult.detail || "连接不可用"}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

export function ProviderPage() {
  const {
    providers,
    error,
    refresh,
    deleteProvider,
    activateProvider,
    restoreOfficialDefaults,
    testProviderConnectivity,
    validateProvider
  } = useProviderStore();
  const refreshOverview = useOverviewStore((state) => state.refresh);
  const providerModal = useUiStore((state) => state.providerModal);
  const setProviderModal = useUiStore((state) => state.setProviderModal);
  const setToast = useUiStore((state) => state.setToast);
  const setRestartNotice = useUiStore((state) => state.setRestartNotice);
  const [connectivityBadges, setConnectivityBadges] = useState<Record<number, ProviderConnectivityResult>>({});
  const [openOfficial, setOpenOfficial] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [addDraft, setAddDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [editDrafts, setEditDrafts] = useState<Record<number, ProviderDraft>>({});

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const customProviders = useMemo(
    () =>
      providers
        .filter((provider) => provider.kind === "custom")
        .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)),
    [providers]
  );
  const activeCustomProvider = customProviders.find((provider) => provider.active) ?? null;
  const activeProvider = providers.find((provider) => provider.active) ?? null;
  const otherCustomProviders = customProviders.filter((provider) => provider.localId !== activeCustomProvider?.localId);
  const modalEditingProvider =
    providerModal?.mode === "edit" && providerModal.localId != null
      ? providers.find((provider) => provider.localId === providerModal.localId) ?? null
      : null;
  const modalDraft =
    providerModal?.mode === "edit" && providerModal.localId != null
      ? editDrafts[providerModal.localId] ?? draftFromProvider(modalEditingProvider)
      : addDraft;
  const setModalDraft = useCallback(
    (draft: ProviderDraft) => {
      if (providerModal?.mode === "edit" && providerModal.localId != null) {
        setEditDrafts((current) => ({ ...current, [providerModal.localId as number]: draft }));
      } else {
        setAddDraft(draft);
      }
    },
    [providerModal]
  );

  const testProvider = async (provider: ProviderRecord) => {
    await validateProvider(provider);
    const result = await testProviderConnectivity(provider);
    setConnectivityBadges((current) => ({ ...current, [provider.localId]: result }));
  };

  const activate = async (provider: ProviderRecord) => {
    await activateProvider(provider.localId);
    await refreshOverview();
    const name = providerTitle(provider);
    setToast(`已切换到 ${name}`);
    setRestartNotice({
      title: `已切换到 ${name}`,
      body: "当前 API 服务配置已经写入 Codex 全局配置。"
    });
  };

  const switchToOfficial = async () => {
    await restoreOfficialDefaults();
    await refreshOverview();
    setToast("已切回官方登录配置");
    setRestartNotice({
      title: "已切回官方登录配置",
      body: "当前自定义 API 配置已清空，模型也已恢复为 Codex 官方默认。"
    });
  };

  return (
    <section className="stack-lg">
      {error ? <div className="test-result err">{error}</div> : null}

      <div>
        <SectionHeader title="当前正在使用" />
        {activeCustomProvider ? (
          <div className="prov-current">
            <div className="prov-current-row">
              <div className="prov-name">{providerTitle(activeCustomProvider)}</div>
              <span className={`pill ${connectivityBadges[activeCustomProvider.localId]?.reachable ? "ok" : ""}`}>
                {connectivityBadges[activeCustomProvider.localId]?.reachable ? "连通正常" : "未测试"}
              </span>
              {activeCustomProvider.supportsWebsockets ? <span className="pill">WebSocket</span> : null}
              <div className="spacer" />
              <Button onClick={() => void testProvider(activeCustomProvider)}>测试连通</Button>
              <button
                type="button"
                className="icon-btn"
                aria-label="更多操作"
                onClick={() => setMenuOpen((value) => (value === activeCustomProvider.localId ? null : activeCustomProvider.localId))}
              >
                <Icon name="more" size={16} />
              </button>
              {menuOpen === activeCustomProvider.localId ? (
                <ActionMenu
                  className="provider-menu"
                  items={[
                    {
                      label: "修改设置",
                      icon: <Icon name="external" size={14} />,
                      onSelect: () => {
                        setMenuOpen(null);
                        setProviderModal({ mode: "edit", localId: activeCustomProvider.localId });
                      }
                    },
                    {
                      label: "删除",
                      icon: <Icon name="x" size={14} />,
                      danger: true,
                      onSelect: async () => {
                        setMenuOpen(null);
                        await deleteProvider(activeCustomProvider.localId);
                      }
                    }
                  ]}
                />
              ) : null}
            </div>
            <div className="prov-meta">
              <span>
                <span className="k">地址</span>
                <span className="mono">{activeCustomProvider.baseUrl}</span>
              </span>
              <span>
                <span className="k">标识</span>
                <span className="mono">{activeCustomProvider.providerId}</span>
              </span>
              <span>
                <span className="k">模型</span>
                <span className="mono">{activeCustomProvider.model}</span>
              </span>
              <span>
                <span className="k">密钥</span>
                <span className="mono">sk-••••{activeCustomProvider.apiKey.slice(-4)}</span>
              </span>
            </div>
          </div>
        ) : activeProvider ? (
          <div className="prov-current">
            <div className="prov-current-row">
              <div className="prov-name">官方登录 / ChatGPT 账号</div>
              <span className="pill ok">当前</span>
            </div>
            <div className="prov-meta">
              <span>当前使用 Codex 官方登录状态和默认 OpenAI 服务。</span>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Icon name="provider" />}
            title="还没有配置任何模型服务"
            description="添加一个 OpenAI 兼容的服务地址和 API 密钥，Codex Helm 会帮你测通后再启用。"
            actions={
              <Button variant="primary" onClick={() => setProviderModal({ mode: "add" })}>
                <Icon name="plus" size={14} />
                添加模型服务
              </Button>
            }
          />
        )}
      </div>

      {otherCustomProviders.length > 0 ? (
        <div>
          <SectionHeader title="其他保存的服务" />
          <Card className="provider-list-card">
            {otherCustomProviders.map((provider) => (
              <div key={provider.localId} className="prov-row" data-testid={`provider-row-${provider.localId}`}>
                <div className="provider-row-copy">
                  <div className="prov-name">{providerTitle(provider)}</div>
                  <div className="prov-url">{provider.providerId} · {provider.baseUrl}</div>
                </div>
                {provider.supportsWebsockets ? <span className="pill">WS</span> : null}
                <Button size="sm" onClick={() => activate(provider)}>
                  启用
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setProviderModal({ mode: "edit", localId: provider.localId })}>
                  修改
                </Button>
                <button type="button" className="icon-btn" aria-label={`删除 ${providerTitle(provider)}`} onClick={() => void deleteProvider(provider.localId)}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      <button type="button" className="add-row" onClick={() => setProviderModal({ mode: "add" })}>
        <Icon name="plus" size={16} />
        <span>添加模型服务</span>
        <span className="spacer" />
        <span className="add-row-note">分 2 步即可完成</span>
      </button>

      <div>
        <button type="button" className="disclosure" onClick={() => setOpenOfficial((value) => !value)}>
          <Icon name="chevron" size={12} strokeWidth={2.2} />
          想改用 Codex 官方账号登录？{openOfficial ? "收起" : "展开"}
        </button>
        {openOfficial ? (
          <div className="disclosure-body">
            切换后会停用当前自定义服务并清空模型设置，但已保存的服务配置不会删除，随时可以切回来。
            <div className="disclosure-actions">
              <Button size="sm" onClick={switchToOfficial}>
                改用官方登录
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {providerModal ? (
        <ProviderModal
          modal={providerModal}
          providers={providers}
          draft={modalDraft}
          onDraftChange={setModalDraft}
          onClose={() => setProviderModal(null)}
          onSaved={(message, notice) => {
            setToast(message);
            setRestartNotice(notice);
            if (providerModal.mode === "add") {
              setAddDraft(EMPTY_DRAFT);
            } else if (providerModal.localId != null) {
              setEditDrafts((current) => {
                const next = { ...current };
                delete next[providerModal.localId as number];
                return next;
              });
            }
            setProviderModal(null);
          }}
        />
      ) : null}
    </section>
  );
}
