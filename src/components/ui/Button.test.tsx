import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

it("renders the reference primary small button classes", () => {
  render(
    <Button variant="primary" size="sm">
      保存
    </Button>
  );

  expect(screen.getByRole("button", { name: "保存" })).toHaveClass("btn", "primary", "sm");
});
