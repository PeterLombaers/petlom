import { screen } from "@testing-library/react";
import { render } from "@/test-utils";
import { PlayerName } from "./PlayerName";

describe("PlayerName", () => {
  it("shows an active player as a plain name", () => {
    render(<PlayerName name="Alice" isActive />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("deleted")).not.toBeInTheDocument();
  });

  it("marks a deleted player", () => {
    render(<PlayerName name="Alice" isActive={false} />);
    expect(screen.getByText("Alice", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("deleted")).toBeInTheDocument();
  });
});
