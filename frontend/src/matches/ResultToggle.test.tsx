import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import ResultToggle from "@/matches/ResultToggle";

describe("ResultToggle", () => {
  it("renders all four options", () => {
    render(<ResultToggle result={null} setResult={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "1-0" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "½-½" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "0-1" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "---" })).toBeInTheDocument();
  });

  it("marks the No Result button as selected when result is null", () => {
    render(<ResultToggle result={null} setResult={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "---" })).toBeChecked();
  });

  it("marks the correct button as selected for a given result", () => {
    render(<ResultToggle result="1-0" setResult={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "1-0" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "½-½" })).not.toBeChecked();
  });

  it("calls setResult with the clicked value", async () => {
    const user = userEvent.setup();
    const setResult = vi.fn();
    render(<ResultToggle result={null} setResult={setResult} />);
    await user.click(screen.getByRole("radio", { name: "½-½" }));
    expect(setResult).toHaveBeenCalledWith("1/2-1/2");
  });

  it("calls setResult with null when clicking the '---' button", async () => {
    const user = userEvent.setup();
    const setResult = vi.fn();
    render(<ResultToggle result="0-1" setResult={setResult} />);
    await user.click(screen.getByRole("radio", { name: "---" }));
    expect(setResult).toHaveBeenCalledWith(null);
  });
});
