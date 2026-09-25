import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { components } from "@client/schema";
import { fetchClient } from "@/client/api";
import { notifyErrorMessage } from "@/ui/notify";
import i18n from "@/i18n";

const TOKEN_KEY = "petlom_auth_token";
const USERNAME_KEY = "petlom_username";
const ROLE_KEY = "petlom_role";

export type Role = components["schemas"]["Role"];

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
};

/**
 * The stored role, defaulting to a full moderator.
 *
 * A session created before the role existed has a token and a username but no
 * role key, and its owner is by definition a moderator — treating that as the
 * lesser role would lock out everyone currently logged in.
 */
const readStoredRole = (): Role =>
  localStorage.getItem(ROLE_KEY) === "result_keeper"
    ? "result_keeper"
    : "moderator";

type AuthContextValue = {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
} & (
  | {
      isAuthenticated: true;
      isModerator: boolean;
      role: Role;
      token: string;
      username: string;
    }
  | {
      isAuthenticated: false;
      isModerator: false;
      role: null;
      token: null;
      username: null;
    }
);

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );
  const [role, setRole] = useState<Role>(readStoredRole);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded, not JSON.
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(ROLE_KEY, data.role);
    setToken(data.access_token);
    setUsername(username);
    setRole(data.role);
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUsername(null);
    setRole("moderator");
  };

  useEffect(() => {
    const middleware = {
      async onRequest({ request }: { request: Request }) {
        const stored = localStorage.getItem(TOKEN_KEY);
        if (stored) {
          request.headers.set("Authorization", `Bearer ${stored}`);
        }
        return request;
      },
      async onResponse({ response }: { response: Response }) {
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent("petlom:unauthorized"));
        }
        return response;
      },
    };
    fetchClient.use(middleware);
    return () => fetchClient.eject(middleware);
  }, []);

  useEffect(() => {
    const handler = () => {
      // Read from storage rather than the `token` state: this effect runs once,
      // so it would close over whatever the token was on mount. A 401 with no
      // token stored is an anonymous request, not an expired session.
      const wasLoggedIn = localStorage.getItem(TOKEN_KEY) !== null;
      clearStoredAuth();
      setToken(null);
      setUsername(null);
      setRole("moderator");
      if (wasLoggedIn) notifyErrorMessage(i18n.t("errors.sessionExpired"));
    };
    window.addEventListener("petlom:unauthorized", handler);
    return () => window.removeEventListener("petlom:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={
        token !== null && username !== null
          ? {
              isAuthenticated: true,
              isModerator: role === "moderator",
              role,
              token,
              username,
              login,
              logout,
            }
          : {
              isAuthenticated: false,
              isModerator: false,
              role: null,
              token: null,
              username: null,
              login,
              logout,
            }
      }
    >
      {children}
    </AuthContext.Provider>
  );
}

// standard pattern: hook and provider live together
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
