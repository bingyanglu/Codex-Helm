import { render, screen } from "@testing-library/react";
import App from "./App";

const overviewState = {
  status: {
    cli: { installed: true, version: "0.5.1", path: "/usr/local/bin/codex", detail: "PATH" },
    app: { installed: true, version: "1.2.0", path: "/Applications/Codex.app", detail: "bundle" },
    authMode: "chatgpt",
    activeProvider: "openai",
    activeProviderBaseUrl: "https://api.openai.com/v1",
    monitorAvailable: false,
    model: "gpt-5.5",
    sandboxMode: "workspace-write",
    approvalPolicy: "on-request",
    configPath: "~/.codex/config.toml",
    configExists: true,
    configLastModified: "1715680000"
  },
  loading: false,
  error: null,
  refresh: vi.fn()
};

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: (selector?: (state: typeof overviewState) => unknown) =>
    selector ? selector(overviewState) : overviewState
}));

const providerState = {
  providers: [],
  loading: false,
  error: null,
  refresh: vi.fn()
};

vi.mock("@/stores/useProviderStore", () => ({
  useProviderStore: (selector?: (state: typeof providerState) => unknown) =>
    selector ? selector(providerState) : providerState
}));

const monitorState = {
  refresh: vi.fn()
};

vi.mock("@/stores/useMonitorStore", () => ({
  useMonitorStore: (selector?: (state: typeof monitorState) => unknown) =>
    selector ? selector(monitorState) : monitorState
}));

const firstStartState = {
  scan: {
    state: "fresh" as const,
    handled: true,
    candidates: [],
    configExists: false,
    authExists: false,
    configPath: null,
    authMode: null,
    envKeys: [],
    lastActiveCustomProviderId: null
  },
  loading: false,
  scanImport: vi.fn(),
  importCandidates: vi.fn(),
  markHandled: vi.fn()
};

vi.mock("@/stores/useFirstStartStore", () => ({
  useFirstStartStore: (selector?: (state: typeof firstStartState) => unknown) =>
    selector ? selector(firstStartState) : firstStartState
}));

test("renders the sidebar and default overview page", () => {
  render(<App />);

  expect(screen.getByText("Codex Helm")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "概览" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "模型服务" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "用量监控" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "状态概览" })).not.toBeInTheDocument();
  expect(document.querySelector(".topbar-title")).toHaveTextContent("概览");
});
