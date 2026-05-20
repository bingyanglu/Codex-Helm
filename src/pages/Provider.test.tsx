import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderPage } from "./Provider";

const { providerStoreMock, uiState, providers } = vi.hoisted(() => {
  const providers = [
    {
      localId: 11,
      providerId: "jobmd",
      name: "Acme",
      kind: "custom" as const,
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
    },
    {
      localId: 12,
      providerId: "jobmd",
      name: "Beta",
      kind: "custom" as const,
      baseUrl: "https://beta.example.com/v1",
      model: "gpt-5.4",
      apiKey: "sk-beta-123456",
      envKey: "",
      httpHeaders: {},
      queryParams: {},
      supportsWebsockets: false,
      active: false,
      enabled: true,
      lastValidatedAt: null,
      lastValidationStatus: "unknown"
    }
  ];

  return {
    providers,
    providerStoreMock: {
      refresh: vi.fn(),
      saveProvider: vi.fn(),
      deleteProvider: vi.fn(),
      activateProvider: vi.fn(),
      restoreOfficialDefaults: vi.fn(),
      testProviderConnectivity: vi.fn(),
      validateProvider: vi.fn()
    },
    uiState: {
      providerModal: null as { mode: "add" | "edit"; localId?: number } | null,
      setProviderModal: vi.fn(),
      setToast: vi.fn(),
      setRestartNotice: vi.fn()
    }
  };
});

vi.mock("@/stores/useProviderStore", () => ({
  useProviderStore: () => ({
    providers,
    loading: false,
    error: null,
    ...providerStoreMock
  })
}));

vi.mock("@/stores/useOverviewStore", () => ({
  useOverviewStore: (selector: (state: { refresh: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ refresh: vi.fn() })
}));

vi.mock("@/stores/useUiStore", () => ({
  useUiStore: (selector: (state: typeof uiState) => unknown) => selector(uiState)
}));

beforeEach(() => {
  uiState.providerModal = null;
  providerStoreMock.refresh.mockClear();
  providerStoreMock.saveProvider.mockReset();
  providerStoreMock.deleteProvider.mockReset();
  providerStoreMock.activateProvider.mockReset();
  providerStoreMock.restoreOfficialDefaults.mockReset();
  providerStoreMock.testProviderConnectivity.mockReset();
  providerStoreMock.validateProvider.mockReset();
  uiState.setProviderModal.mockClear();
  uiState.setToast.mockClear();
  uiState.setRestartNotice.mockClear();
});

test("renders the current provider, saved services, add row and official-login disclosure", () => {
  render(<ProviderPage />);

  expect(screen.getByText("当前正在使用")).toBeInTheDocument();
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.getByText("其他保存的服务")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "添加模型服务分 2 步即可完成" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "想改用 Codex 官方账号登录？展开" })).toBeInTheDocument();
});

test("opens edit mode from the current provider action menu", async () => {
  const user = userEvent.setup();

  render(<ProviderPage />);
  await user.click(screen.getByRole("button", { name: "更多操作" }));
  await user.click(screen.getByRole("menuitem", { name: "修改设置" }));

  expect(uiState.setProviderModal).toHaveBeenCalledWith({ mode: "edit", localId: 11 });
});

test("shows restart notice after activating another provider", async () => {
  providerStoreMock.activateProvider.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);
  await user.click(within(screen.getByTestId("provider-row-12")).getByRole("button", { name: "启用" }));

  expect(providerStoreMock.activateProvider).toHaveBeenCalledWith(12);
  expect(uiState.setToast).toHaveBeenCalledWith("已切换到 Beta");
});

test("shows restart notice after switching back to official login from disclosure", async () => {
  providerStoreMock.restoreOfficialDefaults.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);
  await user.click(screen.getByRole("button", { name: "想改用 Codex 官方账号登录？展开" }));
  await user.click(screen.getByRole("button", { name: "改用官方登录" }));

  expect(providerStoreMock.restoreOfficialDefaults).toHaveBeenCalled();
  expect(uiState.setToast).toHaveBeenCalledWith("已切回官方登录配置");
});

test("guided provider modal uses the two-step flow and requires a successful test before finishing", async () => {
  uiState.providerModal = { mode: "add" };
  providerStoreMock.validateProvider.mockResolvedValue({ ok: true, detail: "ok" });
  providerStoreMock.testProviderConnectivity.mockResolvedValue({
    reachable: true,
    authenticated: true,
    latencyMs: 92,
    detail: "ok"
  });
  providerStoreMock.saveProvider.mockResolvedValue([
    ...providers,
    {
      localId: 13,
      providerId: "cpa",
      name: "cpa",
      kind: "custom",
      baseUrl: "http://cpa.host.dxy/v1",
      model: "gpt-5.4",
      apiKey: "sk-jobmd-123456",
      envKey: "",
      httpHeaders: {},
      queryParams: {},
      supportsWebsockets: false,
      active: false,
      enabled: true,
      lastValidatedAt: null,
      lastValidationStatus: "unknown"
    }
  ]);
  providerStoreMock.activateProvider.mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<ProviderPage />);

  await user.type(screen.getByLabelText(/服务地址/), "http://cpa.host.dxy/v1");
  await user.type(screen.getByLabelText("API 密钥"), "sk-jobmd-123456");
  await user.click(screen.getByRole("button", { name: "下一步" }));
  await user.type(screen.getByLabelText("默认模型"), "gpt-5.4");
  expect(screen.getByRole("button", { name: "完成并启用" })).toBeDisabled();
  await user.click(screen.getAllByRole("button", { name: "测试连通" })[1]);
  expect(await screen.findByText("连通成功 · 模型可调用")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "完成并启用" }));

  expect(providerStoreMock.saveProvider).toHaveBeenCalledWith(
    expect.objectContaining({
      baseUrl: "http://cpa.host.dxy/v1",
      model: "gpt-5.4",
      providerId: "cpa",
      name: "cpa"
    })
  );
  expect(providerStoreMock.activateProvider).toHaveBeenCalledWith(13);
});

test("add provider modal does not treat records without localId as edit targets", async () => {
  const originalLocalId = providers[0].localId;
  // Simulates stale records from an older bridge shape during migration.
  delete (providers[0] as Partial<(typeof providers)[number]>).localId;
  uiState.providerModal = { mode: "add" };
  const user = userEvent.setup();

  render(<ProviderPage />);
  await user.type(screen.getByLabelText(/服务地址/), "http://cpa.host.dxy/v1");

  expect(screen.getByRole("dialog", { name: /添加模型服务/ })).toBeInTheDocument();
  expect(screen.getByLabelText(/服务地址/)).toHaveValue("http://cpa.host.dxy/v1");
  expect(screen.getByLabelText("API 密钥")).toHaveValue("");

  providers[0].localId = originalLocalId;
});

test("add provider modal keeps unsaved advanced draft after close and reopen", async () => {
  uiState.providerModal = { mode: "add" };
  uiState.setProviderModal.mockImplementation((modal) => {
    uiState.providerModal = modal;
  });
  const user = userEvent.setup();

  const view = render(<ProviderPage />);
  await user.type(screen.getByLabelText(/服务地址/), "http://cpa.host.dxy/v1");
  await user.type(screen.getByLabelText("API 密钥"), "sk-jobmd-123456");
  await user.click(screen.getByRole("button", { name: /高级/ }));
  await user.clear(screen.getByLabelText(/显示名称/));
  await user.type(screen.getByLabelText(/显示名称/), "jobmd-key-a");

  expect(screen.getByRole("dialog", { name: /添加模型服务/ })).toBeInTheDocument();
  expect(screen.getByLabelText(/显示名称/)).toHaveValue("jobmd-key-a");

  await user.click(screen.getByRole("button", { name: "关闭" }));
  view.rerender(<ProviderPage />);
  uiState.providerModal = { mode: "add" };
  view.rerender(<ProviderPage />);
  await user.click(screen.getByRole("button", { name: /高级/ }));

  expect(screen.getByLabelText(/服务地址/)).toHaveValue("http://cpa.host.dxy/v1");
  expect(screen.getByLabelText("API 密钥")).toHaveValue("sk-jobmd-123456");
  expect(screen.getByLabelText(/显示名称/)).toHaveValue("jobmd-key-a");
  uiState.setProviderModal.mockReset();
});
