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
        totalRequests: 1_240,
        successRequests: 1_210,
        failedRequests: 30,
        successRate: 97.5,
        totalTokens: 124_000_000,
        inputTokens: 123_000_000,
        outputTokens: 1_000_000
      },
      year: {
        totalRequests: 1_240,
        successRequests: 1_210,
        failedRequests: 30,
        successRate: 97.5,
        totalTokens: 124_000_000,
        inputTokens: 123_000_000,
        outputTokens: 1_000_000
      }
    },
    trend: [
      { key: "10", label: "10:00", title: "10:00", input: 14_000_000, output: 571_006, total: 14_571_006 },
      { key: "11", label: "11:00", title: "11:00", input: 21_000_000, output: 166_760, total: 21_166_760 },
      { key: "12", label: "12:00", title: "12:00", input: 24_000_000, output: 369_766, total: 24_369_766 }
    ],
    logs: [
      {
        id: "1",
        timestamp: "2026-05-14 12:00:00",
        model: "gpt-5.5",
        failed: false,
        input: 104_232,
        output: 422,
        totalTokens: 104_654,
        totalDurationMs: 1200,
        firstTokenLatencyMs: 200
      }
    ],
    totalLogs: 1_240,
    totalPages: 1,
    currentPage: 1,
    quota: {
      planType: "pro",
      windows: [
        {
          id: "five-hour",
          label: "5 小时限额",
          remainingPercent: 76,
          resetLabel: "05/15 18:00"
        },
        {
          id: "weekly",
          label: "周限额",
          remainingPercent: 23,
          resetLabel: "05/19 00:00"
        }
      ]
    },
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

test("renders monitor metrics using compact K and M units", () => {
  render(<MonitorPage />);

  expect(screen.getByText("总请求数")).toBeInTheDocument();
  expect(screen.getByText("963")).toBeInTheDocument();
  expect(screen.getAllByText("105M")).toHaveLength(2);
  expect(screen.getAllByText("124M")).toHaveLength(3);
  expect(screen.getByText("输入 104M / 输出 423K")).toBeInTheDocument();
  expect(screen.getByText("共 1.2K 条")).toBeInTheDocument();
  expect(screen.getByText("104K")).toBeInTheDocument();
  expect(screen.getByText("422")).toBeInTheDocument();
});

test("does not render the token trend chart", () => {
  const { container } = render(<MonitorPage />);

  expect(screen.queryByText("Token 趋势")).not.toBeInTheDocument();
  expect(screen.queryByTestId("token-trend-html-chart")).not.toBeInTheDocument();
  expect(container.querySelector('[data-testid="token-trend-line-segment"]')).not.toBeInTheDocument();
  expect(container.querySelector(".h-44.w-12")).not.toBeInTheDocument();
});

test("renders total and first-token duration in one log column", () => {
  render(<MonitorPage />);

  expect(screen.getByText("总/首字耗时")).toBeInTheDocument();
  expect(screen.queryByText("总耗时")).not.toBeInTheDocument();
  expect(screen.getByText("1.2s / 0.2s")).toBeInTheDocument();
});

test("adds quota and period consumption content from the monitoring reference", () => {
  render(<MonitorPage />);

  expect(screen.getByText("套餐")).toBeInTheDocument();
  expect(screen.getByText("Pro 20x")).toBeInTheDocument();
  expect(screen.getByText("剩余额度")).toBeInTheDocument();
  expect(screen.getByText("5 小时限额")).toBeInTheDocument();
  expect(screen.getByText("周限额")).toBeInTheDocument();
  expect(screen.getByText("76%")).toBeInTheDocument();
  expect(screen.getByText("23%")).toBeInTheDocument();
  expect(screen.getByText("下次重置 05/15 18:00")).toBeInTheDocument();
  expect(screen.getByText("下次重置 05/19 00:00")).toBeInTheDocument();
  expect(screen.getByText("今日消耗")).toBeInTheDocument();
  expect(screen.getByText("近 7 天消耗")).toBeInTheDocument();
  expect(screen.getByText("近 30 天消耗")).toBeInTheDocument();
  expect(screen.getByText("累计消耗（近一年）")).toBeInTheDocument();
});
