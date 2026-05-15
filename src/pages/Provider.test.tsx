import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderPage } from "./Provider";

const providerStoreMock = vi.hoisted(() => ({
  activateProvider: vi.fn(),
  restoreOfficialDefaults: vi.fn(),
  testProviderConnectivity: vi.fn(),
  validateProvider: vi.fn()
}));

vi.mock("@/stores/useProviderStore", () => ({
  useProviderStore: () => ({
    providers: [
      {
        id: "acme",
        name: "Acme",
        kind: "custom",
        baseUrl: "https://example.com/v1",
        model: "gpt-5.5",
        apiKey: "sk-acme-123456",
        envKey: "",
        httpHeaders: {},
        queryParams: {},
        supportsWebsockets: true,
        active: true,
        enabled: true,
        lastValidatedAt: null,
        lastValidationStatus: "unknown"
      }
    ],
    loading: false,
    refresh: vi.fn(),
    saveProvider: vi.fn(),
    deleteProvider: vi.fn(),
    activateProvider: providerStoreMock.activateProvider,
    restoreOfficialDefaults: providerStoreMock.restoreOfficialDefaults,
    testProviderConnectivity: providerStoreMock.testProviderConnectivity,
    validateProvider: providerStoreMock.validateProvider
  })
}));

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: (selector: (state: { refresh: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({
      refresh: vi.fn()
    })
}));

test("renders only custom providers and the custom form", () => {
  render(<ProviderPage />);

  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.getByText("WebSockets")).toBeInTheDocument();
  expect(
    screen.getByText("填写服务地址、模型名称和密钥，保存后点“测试是否可用”。测试通过后，再设为当前使用。")
  ).toBeInTheDocument();
  expect(screen.getByText("当前使用")).toBeInTheDocument();
  expect(screen.getByText("自定义")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /设为当前使用/i })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("服务标识，例如 jobmd")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("默认模型，例如 gpt-5.5")).toBeInTheDocument();
  expect(screen.getByText("使用官方登录")).toBeInTheDocument();
  expect(
    screen.getByText("如果你想改回官方账号登录，点击下面的按钮。系统会停止使用当前自定义服务，并清空当前模型设置，改回 Codex 官方默认模型。")
  ).toBeInTheDocument();
  expect(
    screen.getByText("已保存的自定义服务信息不会删除。切换后，在 Codex 右下角设置中退出并重新登录个人账号；如果没有退出选项，直接登录即可。")
  ).toHaveClass("font-semibold", "text-amber-950");
  expect(screen.getByRole("button", { name: "改用官方登录" })).toBeInTheDocument();
});

test("loads an existing provider into the form when editing", async () => {
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.click(screen.getByRole("button", { name: "修改" }));

  expect(screen.getByDisplayValue("acme")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
  expect(screen.getByDisplayValue("https://example.com/v1")).toBeInTheDocument();
  expect(screen.getByDisplayValue("gpt-5.5")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "是否使用 WebSockets" })).toBeChecked();
});

test("shows restart notice after activating an api provider", async () => {
  providerStoreMock.activateProvider.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.click(screen.getByRole("button", { name: "设为当前使用" }));

  expect(await screen.findByText("已切换到 Acme")).toBeInTheDocument();
  expect(
    screen.getByText("必须先完全退出并重新启动 Codex 软件，新的配置才会生效。")
  ).toBeInTheDocument();
});

test("restart notice does not link to dialog sync after activating provider", async () => {
  providerStoreMock.activateProvider.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.click(screen.getByRole("button", { name: "设为当前使用" }));

  expect(await screen.findByText("已切换到 Acme")).toBeInTheDocument();
  const restartNotice = screen
    .getByText("必须先完全退出并重新启动 Codex 软件，新的配置才会生效。")
    .closest("div")?.parentElement;

  expect(screen.queryByText(/同步/)).not.toBeInTheDocument();
  expect(within(restartNotice as HTMLElement).getAllByRole("button")).toHaveLength(1);
});

test("shows restart notice after switching back to official login", async () => {
  providerStoreMock.restoreOfficialDefaults.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.click(screen.getByRole("button", { name: "改用官方登录" }));

  expect(await screen.findByText("已切回官方登录配置")).toBeInTheDocument();
  expect(
    screen.getByText("必须先完全退出并重新启动 Codex 软件，新的配置才会生效。")
  ).toBeInTheDocument();
});

test("shows connectivity status and latency before the edit action", async () => {
  providerStoreMock.validateProvider.mockResolvedValue({ ok: true, detail: "ok" });
  providerStoreMock.testProviderConnectivity.mockResolvedValue({
    reachable: true,
    authenticated: true,
    latencyMs: 85,
    detail: "ok"
  });
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.click(screen.getByRole("button", { name: "测试是否可用" }));

  const latency = await screen.findByText("可用 85 ms");
  expect(latency).toBeInTheDocument();
  expect(latency.compareDocumentPosition(screen.getByRole("button", { name: "修改" }))).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
});
