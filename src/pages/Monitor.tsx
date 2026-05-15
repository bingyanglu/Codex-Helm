import { useEffect, type ReactNode } from "react";
import { Activity, BarChart3, CalendarDays, Clock3 } from "lucide-react";
import { useMonitorStore } from "@/stores/useMonitorStore";
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

function formatDuration(milliseconds: number) {
  if (!milliseconds || milliseconds <= 0) return "-";
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatSummaryValue(summary: MonitorSummary | null) {
  return summary ? formatCompactNumber(summary.totalTokens) : "--";
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

function quotaToneClass(value: number | null) {
  if (value === null) return "text-stone-400";
  if (value >= 80) return "text-emerald-600";
  if (value >= 50) return "text-amber-500";
  return "text-red-500";
}

function quotaFillClass(value: number | null) {
  if (value === null) return "bg-stone-300";
  if (value >= 80) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function buildQuotaRows(quota: MonitorQuota | null) {
  if (!quota || quota.windows.length === 0) {
    return [
      {
        id: "five-hour",
        label: "5 小时限额",
        remainingPercent: null,
        resetLabel: "-"
      },
      {
        id: "weekly",
        label: "周限额",
        remainingPercent: null,
        resetLabel: "-"
      }
    ];
  }

  return quota.windows;
}

function StatIcon({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-md border bg-white ${tone}`}>
      {children}
    </div>
  );
}

const RANGE_OPTIONS = [
  { value: 1, label: "今天" },
  { value: 7, label: "7 天" },
  { value: 30, label: "30 天" }
] as const;

export function MonitorPage() {
  const {
    rangeDays,
    summary,
    periodSummaries,
    quota,
    logs,
    totalLogs,
    totalPages,
    currentPage,
    loading,
    error,
    setRangeDays,
    setCurrentPage,
    refresh
  } = useMonitorStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const todaySummary = periodSummaries.today ?? (rangeDays === 1 ? summary : null);
  const sevenDaysSummary = periodSummaries.sevenDays ?? (rangeDays === 7 ? summary : null);
  const thirtyDaysSummary = periodSummaries.thirtyDays ?? (rangeDays === 30 ? summary : null);
  const yearSummary = periodSummaries.year;
  const quotaRows = buildQuotaRows(quota);

  return (
    <section className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">监控</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            自动使用当前激活模型服务的 API Key 拉取统计数据。
          </p>
        </div>

        <div className="flex gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`rounded-xl px-4 py-2 text-sm ${
                rangeDays === option.value
                  ? "bg-[var(--color-text-primary)] text-white"
                  : "border border-black/10 bg-white text-[var(--color-text-primary)]"
              }`}
              onClick={() => void setRangeDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              套餐
            </div>
            {quota?.planType ? (
              <div className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                {getPlanLabel(quota.planType)}
              </div>
            ) : null}
          </div>
          <div className="min-w-40 text-sm text-[var(--color-text-secondary)]">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              剩余额度
            </div>
            {!quota ? <div className="mt-2">当前 provider 未接入 quota 数据</div> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {quotaRows.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-black/5 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.label}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    {item.resetLabel === "-" ? "未接入" : `下次重置 ${item.resetLabel}`}
                  </div>
                </div>
                <div className={`text-2xl font-semibold ${quotaToneClass(item.remainingPercent)}`}>
                  {item.remainingPercent === null ? "--" : formatPercent(item.remainingPercent)}
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${quotaFillClass(item.remainingPercent)}`}
                  style={{ width: `${item.remainingPercent ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "今日消耗",
            value: formatSummaryValue(todaySummary),
            period: "今日",
            icon: <Clock3 className="h-3.5 w-3.5" />,
            tone: "border-blue-300 text-blue-500"
          },
          {
            label: "近 7 天消耗",
            value: formatSummaryValue(sevenDaysSummary),
            period: "近 7 天",
            icon: <BarChart3 className="h-3.5 w-3.5" />,
            tone: "border-emerald-300 text-emerald-500"
          },
          {
            label: "近 30 天消耗",
            value: formatSummaryValue(thirtyDaysSummary),
            period: "近 30 天",
            icon: <Activity className="h-3.5 w-3.5" />,
            tone: "border-orange-300 text-orange-500"
          },
          {
            label: "累计消耗（近一年）",
            value: formatSummaryValue(yearSummary),
            period: "近一年",
            icon: <CalendarDays className="h-3.5 w-3.5" />,
            tone: "border-slate-300 text-slate-500"
          }
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-black/10 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium text-slate-700">{item.label}</div>
              <StatIcon tone={item.tone}>{item.icon}</StatIcon>
            </div>
            <div className="mt-5 text-2xl font-semibold text-slate-900">{item.value}</div>
            <div className="mt-4 text-xs text-slate-500">{item.period}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-xs text-[var(--color-text-tertiary)]">总请求数</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {summary ? formatCompactNumber(summary.totalRequests) : "--"}
          </div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-xs text-[var(--color-text-tertiary)]">成功请求</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {summary ? formatCompactNumber(summary.successRequests) : "--"}
          </div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-xs text-[var(--color-text-tertiary)]">失败请求</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {summary ? formatCompactNumber(summary.failedRequests) : "--"}
          </div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-xs text-[var(--color-text-tertiary)]">成功率 / 总 Tokens</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {summary ? formatPercent(summary.successRate) : "--"}
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {summary ? formatCompactNumber(summary.totalTokens) : "--"}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            输入 {summary ? formatCompactNumber(summary.inputTokens) : "--"} / 输出{" "}
            {summary ? formatCompactNumber(summary.outputTokens) : "--"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">请求日志</div>
          <div className="text-xs text-[var(--color-text-tertiary)]">
            共 {formatCompactNumber(totalLogs)} 条
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--color-text-tertiary)]">
              <tr className="border-b border-black/5">
                <th className="py-3 pr-4 font-medium">时间</th>
                <th className="py-3 pr-4 font-medium">模型</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 pr-4 font-medium">输入</th>
                <th className="py-3 pr-4 font-medium">输出</th>
                <th className="py-3 pr-4 font-medium">总 Tokens</th>
                <th className="py-3 font-medium">总/首字耗时</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((item) => (
                <tr key={item.id} className="border-b border-black/5 text-[var(--color-text-primary)]">
                  <td className="py-3 pr-4 whitespace-nowrap">{item.timestamp}</td>
                  <td className="py-3 pr-4">{item.model}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        item.failed ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.failed ? "失败" : "成功"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{formatCompactNumber(item.input)}</td>
                  <td className="py-3 pr-4">{formatCompactNumber(item.output)}</td>
                  <td className="py-3 pr-4">{formatCompactNumber(item.totalTokens)}</td>
                  <td className="py-3">
                    {formatDuration(item.totalDurationMs)} / {formatDuration(item.firstTokenLatencyMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && !loading ? (
          <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-stone-50 p-6 text-sm text-[var(--color-text-secondary)]">
            暂无请求日志。
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-40"
              onClick={() => void setCurrentPage(currentPage - 1)}
            >
              上一页
            </button>
            <div className="text-sm text-[var(--color-text-secondary)]">
              第 {currentPage} / {totalPages} 页
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-40"
              onClick={() => void setCurrentPage(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
