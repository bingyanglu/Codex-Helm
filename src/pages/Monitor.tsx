import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Pill, ProgressBar, SectionHeader, SegmentedControl } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useMonitorStore, type MonitorRangeDays } from "@/stores/useMonitorStore";
import type { MonitorQuota, MonitorSummary } from "@/types/monitor";

function formatCompactNumber(value: number) {
  const rounded = Math.round(value);
  const absValue = Math.abs(rounded);
  if (absValue >= 1_000_000) {
    const amount = rounded / 1_000_000;
    return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(amount >= 10 ? 0 : 1)}M`;
  }
  if (absValue >= 1_000) {
    const amount = rounded / 1_000;
    return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(amount >= 10 ? 0 : 1)}K`;
  }
  return new Intl.NumberFormat("zh-CN").format(rounded);
}

function formatSummaryValue(summary: MonitorSummary | null) {
  return summary ? formatCompactNumber(summary.totalRequests) : "--";
}

function getPlanLabel(planType: string | null) {
  switch (planType?.trim().toLowerCase()) {
    case "pro":
      return "Pro 20x";
    case "plus":
      return "Plus";
    case "team":
      return "Team";
    case "free":
      return "Free";
    default:
      return planType?.trim() || "--";
  }
}

function buildQuotaRows(quota: MonitorQuota | null) {
  if (!quota || quota.windows.length === 0) {
    return [
      { id: "five-hour", label: "近 5 小时", remainingPercent: null, resetLabel: "-" },
      { id: "weekly", label: "本周", remainingPercent: null, resetLabel: "-" }
    ];
  }
  return quota.windows;
}

const RANGE_OPTIONS: Array<{ value: MonitorRangeDays; label: string }> = [
  { value: 1, label: "今天" },
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" }
];

function Metric({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <Card tight className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{foot}</div>
    </Card>
  );
}

export function MonitorPage() {
  const { rangeDays, summary, periodSummaries, quota, logs, totalLogs, loading, error, setRangeDays, refresh } =
    useMonitorStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasAnyData = Boolean(quota) || Boolean(summary) || logs.length > 0 || totalLogs > 0;
  const quotaRows = buildQuotaRows(quota);
  const todaySummary = periodSummaries.today ?? (rangeDays === 1 ? summary : null);
  const sevenDaysSummary = periodSummaries.sevenDays ?? (rangeDays === 7 ? summary : null);
  const thirtyDaysSummary = periodSummaries.thirtyDays ?? (rangeDays === 30 ? summary : null);
  const yearSummary = periodSummaries.year;

  if (!loading && !error && !hasAnyData) {
    return (
      <section className="stack-lg">
        <div className="section-h">
          <h2>用量概览</h2>
          <SegmentedControl value={rangeDays} options={RANGE_OPTIONS} onChange={(value) => void setRangeDays(value)} />
        </div>
        <EmptyState
          icon={<Icon name="chart" />}
          title="当前服务暂未提供用量数据"
          description={
            <>
              当前服务没有接入用量统计接口。
              <br />
              如果你使用支持 quota 的服务（如官方账号或部分代理），切换后这里会自动出现今日 / 周 / 月用量。
            </>
          }
          actions={
            <>
              <Button>查看支持的服务</Button>
              <Button variant="ghost">了解工作原理</Button>
            </>
          }
        />
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <div className="section-h">
        <h2>用量概览</h2>
        <SegmentedControl value={rangeDays} options={RANGE_OPTIONS} onChange={(value) => void setRangeDays(value)} />
      </div>
      {error ? <div className="test-result err">{error}</div> : null}

      <div className="grid-2">
        {quotaRows.map((item) => (
          <Card key={item.id}>
            <div className="card-h">
              <h3>{item.label}</h3>
              <Pill tone={item.remainingPercent !== null && item.remainingPercent >= 80 ? "ok" : "warn"}>
                {item.remainingPercent === null ? "--" : `${item.remainingPercent}%`}
              </Pill>
            </div>
            <div className="quota-amount-row">
              <span className="quota-amount">
                {item.remainingPercent === null ? "--" : item.remainingPercent}
              </span>
              <span className="quota-amount-sub">
                {item.id === "weekly" ? `/ 100 % 本周` : `/ 100 % 近 5 小时`}
              </span>
            </div>
            <ProgressBar value={item.remainingPercent ?? 0} warn={Boolean(item.remainingPercent !== null && item.remainingPercent < 50)} />
            <div className="metric-foot">{item.resetLabel === "-" ? "未接入" : `下次重置 ${item.resetLabel}`}</div>
          </Card>
        ))}
      </div>

      <div>
        <SectionHeader title="详细消耗" meta={`套餐 ${getPlanLabel(quota?.planType ?? null)}`} />
        <div className="grid-4">
          <Metric label="今日消耗" value={formatSummaryValue(todaySummary)} foot="次请求" />
          <Metric label="近 7 天" value={formatSummaryValue(sevenDaysSummary)} foot="次请求" />
          <Metric label="近 30 天" value={formatSummaryValue(thirtyDaysSummary)} foot="次请求" />
          <Metric label="累计（近一年）" value={formatSummaryValue(yearSummary)} foot="次请求" />
        </div>
        <div className="grid-4 metrics-secondary">
          <Metric label="成功率" value={summary ? `${Math.round(summary.successRate)}%` : "--"} foot="当前范围" />
          <Metric label="失败请求" value={summary ? formatCompactNumber(summary.failedRequests) : "--"} foot="当前范围" />
          <Metric label="输入 tokens" value={summary ? formatCompactNumber(summary.inputTokens) : "--"} foot="当前范围" />
          <Metric label="输出 tokens" value={summary ? formatCompactNumber(summary.outputTokens) : "--"} foot="当前范围" />
        </div>
      </div>
    </section>
  );
}
