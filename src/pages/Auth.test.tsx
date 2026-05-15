import { render, screen } from "@testing-library/react";
import { AuthPage } from "./Auth";

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => ({
    loginStatus: { mode: "chatgpt", maskedToken: null, sourcePath: "~/.codex/auth.json" },
    loading: false,
    refresh: vi.fn(),
    saveProviderKey: vi.fn(),
    deleteProviderKey: vi.fn(),
    validateProviderKey: vi.fn()
  })
}));

test("shows the plaintext warning on the auth page", () => {
  render(<AuthPage />);

  expect(screen.getByText(/~\/\.codex-manager\/settings\.json/)).toBeInTheDocument();
  expect(screen.getByText(/已合并到“模型服务”页面统一管理/)).toBeInTheDocument();
});
