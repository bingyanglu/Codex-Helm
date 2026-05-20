import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthSimpleModal } from "./AuthSimpleModal";

const providerStoreMock = vi.hoisted(() => ({
  activateProvider: vi.fn(),
  restoreOfficialDefaults: vi.fn()
}));

vi.mock("@/stores/useProviderStore", () => ({
  useProviderStore: () => ({
    providers: [
      {
        localId: 7,
        providerId: "jobmd",
        name: "jobmd",
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
    ],
    activateProvider: providerStoreMock.activateProvider,
    restoreOfficialDefaults: providerStoreMock.restoreOfficialDefaults
  })
}));

test("shows the plain-language auth choices", () => {
  render(<AuthSimpleModal currentMode="apikey" onClose={vi.fn()} onChanged={vi.fn()} />);

  expect(screen.getByText("哪一句更像你?")).toBeInTheDocument();
  expect(screen.getByText("我订阅了 ChatGPT Plus / Pro / Codex 会员")).toBeInTheDocument();
  expect(screen.getByText("我有 AI 服务的 API 密钥")).toBeInTheDocument();
  expect(screen.getByText("你现在用的是这个")).toBeInTheDocument();
});

test("switches to official login from the plain-language choice", async () => {
  providerStoreMock.restoreOfficialDefaults.mockResolvedValue(undefined);
  const onChanged = vi.fn();
  const user = userEvent.setup();

  render(<AuthSimpleModal currentMode="apikey" onClose={vi.fn()} onChanged={onChanged} />);
  await user.click(screen.getByRole("button", { name: /我订阅了 ChatGPT Plus \/ Pro \/ Codex 会员/ }));

  expect(providerStoreMock.restoreOfficialDefaults).toHaveBeenCalled();
  expect(onChanged).toHaveBeenCalledWith("已改为订阅账号登录");
});

test("uses the deterministic last active custom provider for api key mode", async () => {
  providerStoreMock.activateProvider.mockResolvedValue(undefined);
  const onChanged = vi.fn();
  const user = userEvent.setup();

  render(
    <AuthSimpleModal
      currentMode="chatgpt"
      lastActiveCustomProviderId={7}
      onClose={vi.fn()}
      onChanged={onChanged}
    />
  );
  await user.click(screen.getByRole("button", { name: /我有 AI 服务的 API 密钥/ }));

  expect(providerStoreMock.activateProvider).toHaveBeenCalledWith(7);
  expect(onChanged).toHaveBeenCalledWith("已改为 API 密钥登录");
});
