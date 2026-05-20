import { render, screen } from "@testing-library/react";
import { Pill } from "@/components/ui/Card";

it("renders status pills with the reference tone class", () => {
  render(<Pill tone="ok">连通正常</Pill>);

  expect(screen.getByText("连通正常")).toHaveClass("pill", "ok");
});
