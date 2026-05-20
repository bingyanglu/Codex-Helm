import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Pill, SectionHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useOverviewStore } from "@/stores/useOverviewStore";
import { useUiStore } from "@/stores/useUiStore";
import type { OverviewStatus } from "@/types/overview";

type Issue = { key: "cli" | "provider" | "config"; label: string };

function buildIssues(status: OverviewStatus): Issue[] {
  const issues: Issue[] = [];
  if (!status.cli.installed) issues.push({ key: "cli", label: "Codex CLI 未安装" });
  if (!status.activeProvider) issues.push({ key: "provider", label: "尚未启用模型服务" });
  if (!status.configExists) issues.push({ key: "config", label: "全局配置缺失" });
  return issues;
}

function modeLabel(mode: OverviewStatus["authMode"]) {
  if (mode === "chatgpt") return "我订阅了 ChatGPT Plus / Pro / Codex 会员";
  if (mode === "apikey") return "我有 AI 服务的 API 密钥";
  return "还没有完成登录或配置";
}

function Hero({ status }: { status: OverviewStatus }) {
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const setAuthModalOpen = useUiStore((state) => state.setAuthModalOpen);
  const issues = buildIssues(status);
  const overall = issues.length === 0 ? "ok" : issues.length >= 2 ? "danger" : "warn";
  const primaryIssue = issues[0];

  const heroText =
    overall === "ok"
      ? {
          title: "一切就绪",
          sub: status.activeProvider
            ? `当前使用 ${status.activeProvider}（${status.model ?? "未设置模型"}）· 打开 Codex 即可开始`
            : "Codex 可以直接运行"
        }
      : overall === "warn"
        ? {
            title: `还有 ${issues.length} 项需要完成`,
            sub: "完成后即可正常使用 Codex"
          }
        : {
            title: `还有 ${issues.length} 项阻塞`,
            sub: "建议按下面的步骤逐项处理"
          };

  const handlePrimary = () => {
    if (primaryIssue?.key === "provider") {
      setCurrentPage("provider");
      return;
    }
    if (primaryIssue?.key === "cli") return;
    if (primaryIssue?.key === "config") return;
    setCurrentPage("provider");
  };

  return (
    <div className={`hero ${overall === "ok" ? "" : overall}`}>
      <div className={`hero-mark ${overall === "ok" ? "ok" : overall}`}>
        <Icon name={overall === "ok" ? "check" : "warn"} size={26} strokeWidth={2.2} />
      </div>
      <div className="hero-body">
        <div className="hero-title">{heroText.title}</div>
        <div className="hero-sub">{heroText.sub}</div>
      </div>
      <div className="hero-actions">
        {overall === "ok" ? (
          <>
            <Button onClick={() => setCurrentPage("provider")}>切换模型服务</Button>
            <Button variant="primary">打开 Codex</Button>
          </>
        ) : (
          <Button variant="primary" onClick={handlePrimary}>
            去处理「{primaryIssue?.label}」
          </Button>
        )}
        <Button size="sm" onClick={() => setAuthModalOpen(true)}>
          更改…
        </Button>
      </div>
    </div>
  );
}

function ChecklistRow({
  ok,
  name,
  desc,
  value,
  action
}: {
  ok: boolean;
  name: string;
  desc: string;
  value?: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="check">
      <div className={`check-icon ${ok ? "ok" : "warn"}`}>
        <Icon name={ok ? "check" : "warn"} size={13} strokeWidth={2.4} />
      </div>
      <div className="check-body">
        <div className="check-name">{name}</div>
        <div className="check-desc">{desc}</div>
      </div>
      <div className="check-value">{value ? <span className="mono">{value}</span> : null}</div>
      <div>{action}</div>
    </div>
  );
}

export function OverviewPage() {
  const { status, loading, error, refresh } = useOverviewStore();
  const setCurrentPage = useUiStore((state) => state.setCurrentPage);
  const setAuthModalOpen = useUiStore((state) => state.setAuthModalOpen);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!status && loading) {
    return (
      <EmptyState
        icon={<Icon name="refresh" />}
        title="正在读取状态"
        description="正在检查 Codex CLI、桌面应用、模型服务和全局配置。"
      />
    );
  }

  if (!status && error) {
    return <EmptyState icon={<Icon name="warn" />} title="读取状态失败" description={error} />;
  }

  if (!status) {
    return <EmptyState icon={<Icon name="info" />} title="暂无状态数据" description="点击右上角刷新重新检查本机环境。" />;
  }

  return (
    <section className="stack-lg">
      <Hero status={status} />

      <div>
        <SectionHeader title="环境检查" />
        <div className="checks">
          <ChecklistRow
            ok={status.cli.installed}
            name="Codex CLI"
            desc={status.cli.installed ? `命令行工具已就位（v${status.cli.version ?? "unknown"}）` : "未检测到 codex 命令"}
            value={status.cli.installed ? status.cli.version ?? "unknown" : null}
            action={!status.cli.installed ? <Button size="sm">查看安装步骤</Button> : undefined}
          />
          <ChecklistRow
            ok={status.app.installed}
            name="Codex 桌面应用"
            desc={status.app.installed ? `已安装 · ${status.app.path ?? "/Applications/Codex.app"}` : "未在常用路径找到"}
            value={status.app.installed ? status.app.version ?? "unknown" : null}
            action={!status.app.installed ? <Button size="sm">前往下载</Button> : undefined}
          />
          <ChecklistRow
            ok={Boolean(status.activeProvider)}
            name="模型服务"
            desc={status.activeProvider ? `当前使用 ${status.activeProvider}` : "未设置当前使用的服务"}
            value={status.activeProvider ? status.model ?? "未设置模型" : null}
            action={
              !status.activeProvider ? (
                <Button size="sm" onClick={() => setCurrentPage("provider")}>
                  去配置
                </Button>
              ) : undefined
            }
          />
          <ChecklistRow
            ok={status.configExists}
            name="全局配置"
            desc={status.configExists ? "已检测到 ~/.codex/config.toml" : "未找到 config.toml"}
            value={status.configExists ? "workspace-write" : null}
          />
        </div>
      </div>

      <div>
        <SectionHeader title="你怎么访问 AI 模型" />
        <Card tight className="auth-summary-card">
          <div className="auth-summary-icon">
            <Icon name="lock" size={18} />
          </div>
          <div className="auth-summary-copy">
            <div className="auth-summary-title-row">
              <span className="auth-summary-title">{modeLabel(status.authMode)}</span>
              <Pill tone={status.authMode === "logged_out" ? "warn" : "ok"}>当前</Pill>
            </div>
            <div className="auth-summary-desc">
              {status.authMode === "apikey"
                ? `接入的是「${status.activeProvider ?? "—"}」· 你在该服务商那里申请的密钥，按用量付费。`
                : "用网页或桌面客户端里的官方账号登录，不需要再手动填写 API 密钥。"}
            </div>
          </div>
          <Button size="sm" onClick={() => setAuthModalOpen(true)}>
            更改…
          </Button>
        </Card>
      </div>
    </section>
  );
}
