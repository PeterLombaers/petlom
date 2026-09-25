import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils";
import { AuthProvider, useAuth } from "./AuthContext";

const TOKEN_KEY = "petlom_auth_token";
const USERNAME_KEY = "petlom_username";
const ROLE_KEY = "petlom_role";

function Probe() {
  const { isAuthenticated, isModerator, role, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">{`${isAuthenticated}|${isModerator}|${role}`}</span>
      <button onClick={() => login("keeper", "secret")}>log in</button>
      <button onClick={logout}>log out</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("stores the role from the login response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "t",
          token_type: "bearer",
          role: "result_keeper",
        }),
      ),
    );
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "log in" }));

    expect(localStorage.getItem(ROLE_KEY)).toBe("result_keeper");
    // Authenticated, but not a moderator: every gate outside the match table
    // reads `isModerator`.
    expect(state()).toBe("true|false|result_keeper");
  });

  it("treats a session that predates the role key as a moderator", () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USERNAME_KEY, "boss");
    renderProbe();
    expect(state()).toBe("true|true|moderator");
  });

  it("restores a stored result keeper session", () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USERNAME_KEY, "keeper");
    localStorage.setItem(ROLE_KEY, "result_keeper");
    renderProbe();
    expect(state()).toBe("true|false|result_keeper");
  });

  it("clears every key on logout", async () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USERNAME_KEY, "keeper");
    localStorage.setItem(ROLE_KEY, "result_keeper");
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "log out" }));

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USERNAME_KEY)).toBeNull();
    expect(localStorage.getItem(ROLE_KEY)).toBeNull();
    expect(state()).toBe("false|false|null");
  });

  it("clears every key when a request comes back unauthorized", () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USERNAME_KEY, "keeper");
    localStorage.setItem(ROLE_KEY, "result_keeper");
    renderProbe();
    act(() => {
      window.dispatchEvent(new CustomEvent("petlom:unauthorized"));
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USERNAME_KEY)).toBeNull();
    expect(localStorage.getItem(ROLE_KEY)).toBeNull();
    expect(state()).toBe("false|false|null");
  });
});
