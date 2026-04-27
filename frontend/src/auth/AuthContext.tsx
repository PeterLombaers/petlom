import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchClient } from "@/client/api";

const TOKEN_KEY = "petlom_auth_token";
const USERNAME_KEY = "petlom_username";

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isModerator: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem(USERNAME_KEY)
  );

  const login = async (username: string, password: string) => {
    const res = await fetch("http://localhost:8000/auth/login", {
      method: "POST",
      // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded, not JSON.
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USERNAME_KEY, username);
    setToken(data.access_token);
    setUsername(username);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
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
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
      setToken(null);
      setUsername(null);
    };
    window.addEventListener("petlom:unauthorized", handler);
    return () => window.removeEventListener("petlom:unauthorized", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, username, isModerator: token !== null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
