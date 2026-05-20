import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstStartModal } from "./FirstStartModal";
import type { FirstStartScanResult } from "@/types/firstStart";

const detectedScan: FirstStartScanResult = {
  state: "detected",
  handled: false,
  configExists: true,
  authExists: true,
  configPath: "~/.codex/config.toml",
  authMode: "apikey",
  envKeys: ["OPENAI_API_KEY"],
  lastActiveCustomProviderId: null,
  candidates: [
    {
      id: "jobmd",
      name: "jobmd",
      baseUrl: "http://cpa.host.dxy/v1",
      model: "gpt-5.4",
      apiKey: "sk-jobmd-123456",
      source: "~/.codex/config.toml",
      complete: true
    },
    {
      id: "openrouter",
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "claude-sonnet-4.5",
      apiKey: "sk-openrouter-123456",
      source: "~/.codex/config.toml",
      complete: true
    }
  ]
};

test("shows detected providers and supports multi-select import", async () => {
  const onImport = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(
    <FirstStartModal
      scan={detectedScan}
      onImport={onImport}
      onSkip={vi.fn()}
      onAddManually={vi.fn()}
    />
  );

  expect(screen.getByText("检测到已有的 Codex 配置")).toBeInTheDocument();
  expect(screen.getByText("jobmd")).toBeInTheDocument();
  expect(screen.getByText("openrouter")).toBeInTheDocument();
  await user.click(screen.getAllByRole("checkbox")[1]);
  await user.click(screen.getByRole("button", { name: "导入选中的 1 个服务" }));

  expect(onImport).toHaveBeenCalledWith([detectedScan.candidates[0]]);
});

test("shows partial state with env import and manual fallback", async () => {
  const onImport = vi.fn().mockResolvedValue(undefined);
  const onAddManually = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const partialScan: FirstStartScanResult = {
    ...detectedScan,
    state: "partial",
    configExists: false,
    authExists: false,
    configPath: null,
    candidates: [
      {
        id: "env",
        name: "OpenAI (环境变量)",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5",
        apiKey: "sk-env-1234",
        source: "OPENAI_API_KEY",
        complete: true
      }
    ]
  };

  render(
    <FirstStartModal scan={partialScan} onImport={onImport} onSkip={vi.fn()} onAddManually={onAddManually} />
  );

  expect(screen.getByText("检测到部分配置")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "导入环境变量" }));
  expect(onImport).toHaveBeenCalledWith([partialScan.candidates[0]]);

  await user.click(screen.getByRole("button", { name: "手动填写" }));
  expect(onAddManually).toHaveBeenCalled();
});

test("shows fresh state onboarding copy", () => {
  const freshScan: FirstStartScanResult = {
    ...detectedScan,
    state: "fresh",
    configExists: false,
    authExists: false,
    configPath: null,
    authMode: null,
    envKeys: [],
    candidates: []
  };

  render(<FirstStartModal scan={freshScan} onImport={vi.fn()} onSkip={vi.fn()} onAddManually={vi.fn()} />);

  expect(screen.getByText("欢迎使用 Codex Helm")).toBeInTheDocument();
  expect(screen.getByText("添加我的第一个服务")).toBeInTheDocument();
});
