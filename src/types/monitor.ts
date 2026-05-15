export type MonitorSummary = {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  successRate: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
};

export type MonitorPeriodSummaries = {
  today: MonitorSummary | null;
  sevenDays: MonitorSummary | null;
  thirtyDays: MonitorSummary | null;
  year: MonitorSummary | null;
};

export type MonitorTrendPoint = {
  key: string;
  label: string;
  title: string;
  input: number;
  output: number;
  total: number;
};

export type MonitorLogEntry = {
  id: string;
  timestamp: string;
  model: string;
  failed: boolean;
  input: number;
  output: number;
  totalTokens: number;
  totalDurationMs: number;
  firstTokenLatencyMs: number;
};

export type MonitorLogsResponse = {
  items: MonitorLogEntry[];
  total: number;
  totalPages: number;
};

export type MonitorQuotaWindow = {
  id: string;
  label: string;
  remainingPercent: number | null;
  resetLabel: string;
};

export type MonitorQuota = {
  planType: string | null;
  windows: MonitorQuotaWindow[];
};
