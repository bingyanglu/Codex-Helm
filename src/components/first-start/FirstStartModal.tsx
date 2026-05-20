import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Pill } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { FirstStartCandidate, FirstStartScanResult } from "@/types/firstStart";

export function Splash() {
  return (
    <div className="splash">
      <div className="splash-spinner-wrap">
        <span className="splash-spinner" />
      </div>
      <div className="splash-title">正在读取 Codex 现有配置…</div>
      <div className="splash-sub mono">~/.codex/config.toml · auth.json · env</div>
    </div>
  );
}

export function FirstStartModal({
  scan,
  onImport,
  onSkip,
  onAddManually
}: {
  scan: FirstStartScanResult;
  onImport: (candidates: FirstStartCandidate[]) => Promise<void>;
  onSkip: () => Promise<void>;
  onAddManually: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const defaultSelected = useMemo(
    () => new Set(scan.candidates.filter((candidate) => candidate.complete).map((candidate) => candidate.id)),
    [scan.candidates]
  );
  const [selectedIds, setSelectedIds] = useState(defaultSelected);

  const submitImport = async (candidates: FirstStartCandidate[]) => {
    setSaving(true);
    try {
      await onImport(candidates);
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      await onSkip();
    } finally {
      setSaving(false);
    }
  };

  const addManually = async () => {
    setSaving(true);
    try {
      await onAddManually();
    } finally {
      setSaving(false);
    }
  };

  if (scan.state === "detected") {
    const selected = scan.candidates.filter((candidate) => selectedIds.has(candidate.id));

    return (
      <Modal
        title="检测到已有的 Codex 配置"
        subtitle={
          <>
            从 <span className="mono">{scan.configPath ?? "~/.codex/config.toml"}</span> 读到{" "}
            {scan.candidates.length} 个服务、登录方式：
            {scan.authMode === "apikey" ? "API Key" : scan.authMode === "chatgpt" ? "官方账号" : "未登录"}。
          </>
        }
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={skip} disabled={saving}>
              什么也不导入
            </Button>
            <div className="spacer" />
            <Button
              variant="primary"
              onClick={() => submitImport(selected)}
              disabled={saving || selected.length === 0}
            >
              导入选中的 {selected.length} 个服务
            </Button>
          </>
        }
      >
        <div className="card candidate-list">
          {scan.candidates.map((candidate, index) => (
            <label key={candidate.id} className="candidate-row">
              <input
                type="checkbox"
                checked={selectedIds.has(candidate.id)}
                onChange={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(candidate.id)) next.delete(candidate.id);
                    else next.add(candidate.id);
                    return next;
                  });
                }}
              />
              <div className="candidate-copy">
                <div className="candidate-title">{candidate.name}</div>
                <div className="candidate-meta mono">
                  {candidate.baseUrl} · {candidate.model}
                </div>
              </div>
              {!candidate.complete ? <Pill tone="warn">信息不完整</Pill> : null}
              {index < scan.candidates.length - 1 ? <span className="candidate-divider" /> : null}
            </label>
          ))}
        </div>
        {scan.envKeys.length > 0 ? (
          <div className="info-strip">
            <Icon name="info" size={14} />
            还检测到环境变量 <span className="mono">{scan.envKeys.join(", ")}</span>，导入后会自动沿用。
          </div>
        ) : null}
      </Modal>
    );
  }

  if (scan.state === "partial") {
    return (
      <Modal
        title="检测到部分配置"
        subtitle={
          scan.envKeys.length > 0 ? (
            <>
              没有找到 <span className="mono">config.toml</span>，但环境变量里有{" "}
              <span className="mono">{scan.envKeys.join(", ")}</span>。要用它作为默认服务吗？
            </>
          ) : (
            "检测到本机已有部分 Codex 痕迹，但还没有完整的模型服务配置。"
          )
        }
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={skip} disabled={saving}>
              以后再说
            </Button>
            <div className="spacer" />
            <Button onClick={addManually} disabled={saving}>
              手动填写
            </Button>
            {scan.candidates[0]?.complete ? (
              <Button
                variant="primary"
                onClick={() => submitImport([scan.candidates[0]])}
                disabled={saving}
              >
                导入环境变量
              </Button>
            ) : null}
          </>
        }
      />
    );
  }

  return (
    <Modal
      title="欢迎使用 Codex Helm"
      subtitle="本机还没有任何 Codex 配置。添加一个模型服务就可以开始使用。"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={skip} disabled={saving}>
            以后再说
          </Button>
          <div className="spacer" />
          <Button variant="primary" onClick={addManually} disabled={saving}>
            添加我的第一个服务
          </Button>
        </>
      }
    >
      <div className="warm-note">
        需要准备：
        <ul>
          <li>
            一个模型服务的接入地址（类似 <span className="mono">https://api.xxx.com/v1</span>）
          </li>
          <li>该服务的 API 密钥</li>
        </ul>
      </div>
      {scan.candidates.length === 0 ? (
        <EmptyState
          icon={<Icon name="info" />}
          title="还没有可导入的服务"
          description="这一步不会阻止你继续，稍后也可以在“模型服务”里手动添加。"
        />
      ) : null}
    </Modal>
  );
}
