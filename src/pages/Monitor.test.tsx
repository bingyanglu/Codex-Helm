import { render, screen } from "@testing-library/react";
import { MonitorPage } from "./Monitor";

const { mockMonitorState } = vi.hoisted(() => ({
  mockMonitorState: {
    rangeDays: 1,
    summary: {
      totalRequests: 963,
      successRequests: 958,
      failedRequests: 5,
      successRate: 99.5,
      totalTokens: 104_655_319,
      inputTokens: 104_232_698,
      outputTokens: 422_621
    },
    periodSummaries: {
      today: {
        totalRequests: 963,
        successRequests: 958,
        failedRequests: 5,
        successRate: 99.5,
        totalTokens: 104_655_319,
        inputTokens: 104_232_698,
        outputTokens: 422_621
      },
      sevenDays: {
        totalRequests: 1_240,
        successRequests: 1_210,
        failedRequests: 30,
        successRate: 97.5,
        totalTokens: 124_000_000,
        inputTokens: 123_000_000,
        outputTokens: 1_000_000
      },
      thirtyDays: {
        totalRequests: 4_127,
        successRequests: 4_120,
        failedRequests: 7,
        successRate: 99.8,
        totalTokens: 188_000_000,
        inputTokens: 184_000_000,
        outputTokens: 4_000_000
      },
      year: {
        totalRequests: 38_201,
        successRequests: 38_150,
        failedRequests: 51,
        successRate: 99.8,
        totalTokens: 488_000_000,
        inputTokens: 470_000_000,
        outputTokens: 18_000_000
      }
    },
    quota: {
      planType: "pro",
      windows: [
        { id: "five-hour", label: "近 5 小时", remainingPercent: 62, resetLabel: "05/15 18:00" },
        { id: "weekly", label: "本周", remainingPercent: 24, resetLabel: "05/19 00:00" }
      ]
    },
    trend: [],
    logs: [],
    totalLogs: 0,
    totalPages: 0,
    currentPage: 1,
    loading: false,
    error: null,
    setRangeDays: vi.fn(),
    setCurrentPage: vi.fn(),
    refresh: vi.fn()
  }
}));

vi.mock("@/stores/useMonitorStore", () => ({
  useMonitorStore: () => mockMonitorState
}));

test("renders quota first and hides the detailed request log table", () => {
  render(<MonitorPage />);

  expect(screen.getByText("用量概览")).toBeInTheDocument();
  expect(screen.getByText("近 5 小时")).toBeInTheDocument();
  expect(screen.getByText("本周")).toBeInTheDocument();
  expect(screen.getByText("详细消耗")).toBeInTheDocument();
  expect(screen.queryByText("请求日志")).not.toBeInTheDocument();
  expect(screen.queryByText("总/首字耗时")).not.toBeInTheDocument();
});

test("uses an explanatory empty state when there is no quota summary or logs", () => {
  mockMonitorState.quota = null;
  mockMonitorState.summary = null;
  mockMonitorState.periodSummaries = { today: null, sevenDays: null, thirtyDays: null, year: null };
  mockMonitorState.logs = [];
  mockMonitorState.totalLogs = 0;

  render(<MonitorPage />);

  expect(screen.getByText("当前服务暂未提供用量数据")).toBeInTheDocument();
  expect(screen.getByText("查看支持的服务")).toBeInTheDocument();
  expect(screen.queryByText("详细消耗")).not.toBeInTheDocument();
});
