import { render, screen } from "@testing-library/react";
import { OverviewPage } from "./Overview";

const { mockOverviewState } = vi.hoisted(() => ({
  mockOverviewState: {
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
  }
}));

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: () => mockOverviewState
}));

test("renders overview cards from store data", () => {
  mockOverviewState.status.authMode = "chatgpt";
  mockOverviewState.status.activeProviderBaseUrl = "https://api.openai.com/v1";
  render(<OverviewPage />);

  expect(screen.getByText("Codex CLI")).toBeInTheDocument();
  expect(screen.getByText("openai")).toBeInTheDocument();
  expect(screen.getByText("workspace-write")).toBeInTheDocument();
});

test("shows the active provider base url in api key mode", () => {
  mockOverviewState.status.authMode = "apikey";
  mockOverviewState.status.activeProvider = "jobmd";
  mockOverviewState.status.activeProviderBaseUrl = "http://8.222.84.224:5667/v1";

  render(<OverviewPage />);

  expect(screen.getByText("API 服务：http://8.222.84.224:5667/v1")).toBeInTheDocument();
});
