import { render, screen } from "@testing-library/react";
import { OverviewPage } from "./Overview";

const { mockOverviewState, mockUiState, makeStatus } = vi.hoisted(() => {
  const makeStatus = () => ({
    cli: { installed: true, version: "0.5.1", path: "/usr/local/bin/codex", detail: "PATH" },
    app: { installed: true, version: "1.2.0", path: "/Applications/Codex.app", detail: "bundle" },
    authMode: "apikey" as const,
    activeProvider: "jobmd",
    activeProviderBaseUrl: "http://cpa.host.dxy/v1",
    monitorAvailable: false,
    model: "gpt-5.4",
    sandboxMode: "workspace-write",
    approvalPolicy: "on-request",
    configPath: "~/.codex/config.toml",
    configExists: true,
    configLastModified: "1715680000"
  });

  return {
    makeStatus,
    mockOverviewState: {
      status: makeStatus(),
      loading: false,
      error: null,
      refresh: vi.fn()
    },
    mockUiState: {
      setCurrentPage: vi.fn(),
      setAuthModalOpen: vi.fn()
    }
  };
});

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: () => mockOverviewState
}));

vi.mock("@/stores/useUiStore", () => ({
  useUiStore: (selector: (state: typeof mockUiState) => unknown) => selector(mockUiState)
}));

beforeEach(() => {
  mockOverviewState.status = makeStatus();
});

test("shows the ready hero when all key checks pass", () => {
  render(<OverviewPage />);

  expect(screen.getByText("一切就绪")).toBeInTheDocument();
  expect(screen.getAllByText(/当前使用 jobmd/).length).toBeGreaterThan(0);
});

test("shows a blocker count when critical setup is missing", () => {
  mockOverviewState.status = {
    ...makeStatus(),
    cli: { installed: false, version: null, path: null, detail: null },
    activeProvider: null,
    configExists: false
  };

  render(<OverviewPage />);

  expect(screen.getByText("还有 3 项阻塞")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "去处理「Codex CLI 未安装」" })).toBeInTheDocument();
});

test("renders checklist rows and the plain-language auth section", () => {
  render(<OverviewPage />);

  expect(screen.getByText("环境检查")).toBeInTheDocument();
  expect(screen.getByText("Codex CLI")).toBeInTheDocument();
  expect(screen.getByText("Codex 桌面应用")).toBeInTheDocument();
  expect(screen.getByText("模型服务")).toBeInTheDocument();
  expect(screen.getByText("全局配置")).toBeInTheDocument();
  expect(screen.getByText("你怎么访问 AI 模型")).toBeInTheDocument();
  expect(screen.getByText("我有 AI 服务的 API 密钥")).toBeInTheDocument();
});
