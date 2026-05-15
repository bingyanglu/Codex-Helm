import { render, screen } from "@testing-library/react";
import { ConfigPage } from "./Config";

vi.mock("@/stores/useConfigStore", () => ({
  useConfigStore: () => ({
    config: {
      model: "gpt-5.5",
      modelProvider: "openai",
      approvalPolicy: "on-request",
      sandboxMode: "workspace-write",
      webSearch: "live",
      toolsViewImage: true,
      historyPersistence: "save-all",
      historyMaxBytes: 1048576,
      rawToml: "model = \"gpt-5.5\"",
      backupPath: ""
    },
    loading: false,
    refresh: vi.fn(),
    saveConfig: vi.fn()
  })
}));

vi.mock("@/stores/useProviderStore", () => ({
  useProviderStore: () => ({
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        kind: "builtin",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.5",
        apiKey: "",
        envKey: "OPENAI_API_KEY",
        httpHeaders: {},
        queryParams: {},
        supportsWebsockets: false,
        active: true,
        enabled: true,
        lastValidatedAt: null,
        lastValidationStatus: "unknown"
      }
    ],
    refresh: vi.fn()
  })
}));

test("renders the global config form and raw preview tab", () => {
  render(<ConfigPage />);

  expect(screen.getByDisplayValue("gpt-5.5")).toBeInTheDocument();
  expect(screen.getByText(/Raw TOML/i)).toBeInTheDocument();
});
