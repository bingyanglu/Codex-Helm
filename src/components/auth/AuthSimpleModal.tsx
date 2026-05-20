import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useProviderStore } from "@/stores/useProviderStore";
import type { AuthMode } from "@/types/auth";

export function AuthSimpleModal({
  currentMode,
  lastActiveCustomProviderId,
  onClose,
  onChanged,
  onNeedProvider
}: {
  currentMode: AuthMode;
  lastActiveCustomProviderId?: number | null;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNeedProvider?: () => void;
}) {
  const { providers, activateProvider, restoreOfficialDefaults } = useProviderStore();
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const activeCustomProvider = providers.find((provider) => provider.kind === "custom" && provider.active);
  const deterministicProvider = lastActiveCustomProviderId
    ? providers.find((provider) => provider.kind === "custom" && provider.localId === lastActiveCustomProviderId)
    : activeCustomProvider;
  const apiProvider =
    deterministicProvider &&
    deterministicProvider.enabled &&
    deterministicProvider.baseUrl &&
    deterministicProvider.model
      ? deterministicProvider
      : null;

  const choose = async (next: "oauth" | "apikey") => {
    if (saving) return;

    if (next === "oauth") {
      if (currentMode === "chatgpt") {
        onClose();
        return;
      }
      setSaving(true);
      try {
        await restoreOfficialDefaults();
        onChanged("已改为订阅账号登录");
        onClose();
      } finally {
        setSaving(false);
      }
      return;
    }

    if (currentMode === "apikey") {
      onClose();
      return;
    }

    if (!apiProvider) {
      onNeedProvider?.();
      onClose();
      return;
    }

    setSaving(true);
    try {
      await activateProvider(apiProvider.localId);
      onChanged("已改为 API 密钥登录");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const choices = [
    {
      key: "oauth" as const,
      title: "我订阅了 ChatGPT Plus / Pro / Codex 会员",
      sub: "用那个账号扫码登录即可，不需要填密钥"
    },
    {
      key: "apikey" as const,
      title: "我有 AI 服务的 API 密钥",
      sub: "比如公司给的内部接入点，或 OpenAI / DeepSeek / OpenRouter 等"
    }
  ];

  return (
    <Modal title="哪一句更像你?" subtitle="选一句，我们帮你安排后面的事。" width={500} onClose={onClose}>
      <div className="stack">
        {choices.map((choice) => {
          const isCurrent =
            (choice.key === "oauth" && currentMode === "chatgpt") ||
            (choice.key === "apikey" && currentMode === "apikey");

          return (
            <button
              key={choice.key}
              type="button"
              className="auth-option"
              onClick={() => void choose(choice.key)}
              disabled={saving}
            >
              <div className="auth-option-copy">
                <div className="auth-option-title-row">
                  <span className="auth-option-title">{choice.title}</span>
                  {isCurrent ? <span className="pill ok">你现在用的是这个</span> : null}
                </div>
                <div className="auth-option-sub">{choice.sub}</div>
              </div>
              <Icon name="chevron" size={14} color="var(--text-3)" />
            </button>
          );
        })}

        <button type="button" className="help-toggle" onClick={() => setHelpOpen((value) => !value)}>
          <Icon name="info" size={13} />
          这些是什么意思?{helpOpen ? " 收起" : " 点我看看"}
        </button>

        {helpOpen ? (
          <div className="warm-note help-note">
            <div>
              <strong>订阅账号</strong>：你在 `chatgpt.com` 能登录进去聊天的账号，而且付了月费。
            </div>
            <div>
              <strong>API 密钥</strong>：一串以 <span className="mono">sk-</span> 开头的字符串，公司 IT、
              同事发给你的，或你在服务商网站上生成的。
            </div>
            <div className="muted">两者都能用，点错了随时能改回来。</div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
