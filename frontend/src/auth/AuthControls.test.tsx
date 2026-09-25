import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@/test-utils";
import { AuthControls } from "./AuthControls";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ useAuth: () => mockAuth() }));

const renderControls = () =>
  render(
    <MemoryRouter>
      <AuthControls />
    </MemoryRouter>,
  );

describe("AuthControls", () => {
  it("shows the account menu to a result keeper", () => {
    mockAuth.mockReturnValue({
      isAuthenticated: true,
      isModerator: false,
      username: "keeper",
      logout: vi.fn(),
    });
    renderControls();
    expect(screen.getByRole("button", { name: "keeper" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Login" }),
    ).not.toBeInTheDocument();
  });

  it("shows the account menu to a moderator", () => {
    mockAuth.mockReturnValue({
      isAuthenticated: true,
      isModerator: true,
      username: "boss",
      logout: vi.fn(),
    });
    renderControls();
    expect(screen.getByRole("button", { name: "boss" })).toBeInTheDocument();
  });

  it("shows a login button to an anonymous visitor", () => {
    mockAuth.mockReturnValue({
      isAuthenticated: false,
      isModerator: false,
      username: null,
      logout: vi.fn(),
    });
    renderControls();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });
});
