import { render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: () => ({
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
  })
}));

test("renders the sidebar and default overview page", () => {
  render(<App />);

  expect(screen.getByText("Codex Helm")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "状态概览" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "状态概览" })).toBeInTheDocument();
});
