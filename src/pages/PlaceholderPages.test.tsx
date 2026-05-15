import { render, screen } from "@testing-library/react";
import { SessionsPage } from "./Sessions";

test("renders the sessions placeholder message", () => {
  render(<SessionsPage />);

  expect(screen.getByText(/会话管理即将支持/)).toBeInTheDocument();
});
