import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import ResultToggle from "@components/ResultToggle";

describe("ResultToggle", () => {
  it("renders all four toggle buttons", () => {
    render(<ResultToggle result={null} setResult={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "White Win" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Black Win" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No Result" }),
    ).toBeInTheDocument();
  });

  it("marks the No Result button as selected when result is null", () => {
    render(<ResultToggle result={null} setResult={vi.fn()} />);
    expect(screen.getByRole("button", { name: "No Result" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks the correct button as selected for a given result", () => {
    render(<ResultToggle result="1-0" setResult={vi.fn()} />);
    expect(screen.getByRole("button", { name: "White Win" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Draw" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls setResult with the clicked value", async () => {
    const user = userEvent.setup();
    const setResult = vi.fn();
    render(<ResultToggle result={null} setResult={setResult} />);
    await user.click(screen.getByRole("button", { name: "Draw" }));
    expect(setResult).toHaveBeenCalledWith("1/2-1/2");
  });

  it("calls setResult with null when clicking the already-selected button", async () => {
    const user = userEvent.setup();
    const setResult = vi.fn();
    render(<ResultToggle result="1-0" setResult={setResult} />);
    await user.click(screen.getByRole("button", { name: "White Win" }));
    expect(setResult).toHaveBeenCalledWith(null);
  });

  it("calls setResult with null when clicking the No Result button", async () => {
    const user = userEvent.setup();
    const setResult = vi.fn();
    render(<ResultToggle result="0-1" setResult={setResult} />);
    await user.click(screen.getByRole("button", { name: "No Result" }));
    expect(setResult).toHaveBeenCalledWith(null);
  });
});
