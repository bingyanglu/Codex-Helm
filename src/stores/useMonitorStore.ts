import { create } from "zustand";
import { tauriInvoke } from "@/lib/tauri";
import type {
  MonitorLogEntry,
  MonitorLogsResponse,
  MonitorPeriodSummaries,
  MonitorQuota,
  MonitorSummary,
  MonitorTrendPoint
} from "@/types/monitor";

export type MonitorRangeDays = 1 | 7 | 30;

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "读取监控数据失败";
}

type MonitorStore = {
  rangeDays: MonitorRangeDays;
  summary: MonitorSummary | null;
  periodSummaries: MonitorPeriodSummaries;
  quota: MonitorQuota | null;
  trend: MonitorTrendPoint[];
  logs: MonitorLogEntry[];
  totalLogs: number;
  totalPages: number;
  currentPage: number;
  loading: boolean;
  error: string | null;
  setRangeDays: (rangeDays: MonitorRangeDays) => Promise<void>;
  setCurrentPage: (page: number) => Promise<void>;
  refresh: () => Promise<void>;
};

export const useMonitorStore = create<MonitorStore>((set, get) => ({
  rangeDays: 1,
  summary: null,
  periodSummaries: {
    today: null,
    sevenDays: null,
    thirtyDays: null,
    year: null
  },
  quota: null,
  trend: [],
  logs: [],
  totalLogs: 0,
  totalPages: 0,
  currentPage: 1,
  loading: false,
  error: null,
  setRangeDays: async (rangeDays) => {
    set({ rangeDays, currentPage: 1 });
    await get().refresh();
  },
  setCurrentPage: async (page) => {
    set({ currentPage: page });
    await get().refresh();
  },
  refresh: async () => {
    const { rangeDays, currentPage } = get();
    set({ loading: true, error: null });

    try {
      const [summary, today, sevenDays, thirtyDays, year, trend, logs, quota] = await Promise.all([
        tauriInvoke<MonitorSummary>("get_monitor_summary", { rangeDays }),
        tauriInvoke<MonitorSummary>("get_monitor_summary", { rangeDays: 1 }),
        tauriInvoke<MonitorSummary>("get_monitor_summary", { rangeDays: 7 }),
        tauriInvoke<MonitorSummary>("get_monitor_summary", { rangeDays: 30 }),
        tauriInvoke<MonitorSummary>("get_monitor_summary", { rangeDays: 365 }),
        tauriInvoke<MonitorTrendPoint[]>("get_monitor_trend", { rangeDays }),
        tauriInvoke<MonitorLogsResponse>("get_monitor_logs", {
          rangeDays,
          page: currentPage,
          pageSize: 10
        }),
        tauriInvoke<MonitorQuota>("get_monitor_quota").catch(() => null)
      ]);

      set({
        summary,
        periodSummaries: {
          today,
          sevenDays,
          thirtyDays,
          year
        },
        quota,
        trend,
        logs: logs.items,
        totalLogs: logs.total,
        totalPages: logs.totalPages,
        loading: false
      });
    } catch (error) {
      set({
        loading: false,
        error: readErrorMessage(error)
      });
    }
  }
}));
