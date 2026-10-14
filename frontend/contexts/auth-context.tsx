"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services";
import { clearToken, getToken, setToken } from "@/lib/token";
import { toApiError } from "@/lib/api-error";
import type { LoginRequest, RegisterRequest, User } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** Non-null when the initial /auth/me call failed for a non-auth reason. */
  sessionError: string | null;
  login: (payload: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Merge partial user data after a profile update. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const initialized = useRef(false);

  const setUser = useCallback((next: User) => setUserState(next), []);

  /** Resolve the session on mount if a token exists. */
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      setStatus("unauthenticated");
      setSessionError(null);
      return;
    }
    try {
      const me = await auth.getMe();
      setUserState(me);
      setStatus("authenticated");
      setSessionError(null);
    } catch (error) {
      const err = toApiError(error);
      if (err.status === 401 || err.status === 403) {
        clearToken();
        setUserState(null);
        setStatus("unauthenticated");
        setSessionError(null);
      } else {
        // Token exists but backend unreachable — treat as signed out,
        // but explain why so pages can show a connection error.
        setUserState(null);
        setStatus("unauthenticated");
        setSessionError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: LoginRequest): Promise<User> => {
      const res = await auth.login(payload);
      if (!res.access_token) {
        throw toApiError(new Error("The server did not return an access token."));
      }
      setToken(res.access_token);
      const resolved = await auth.resolveSession(res);
      setUserState(resolved);
      setStatus("authenticated");
      setSessionError(null);
      return resolved;
    },
    []
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<User> => {
      const res = await auth.register(payload);
      if (!res.access_token) {
        // Backend created the account but doesn't auto-login — send the
        // user to sign in rather than faking a session.
        throw Object.assign(new Error("ACCOUNT_CREATED"), {
          name: "AccountCreatedError",
        });
      }
      setToken(res.access_token);
      const resolved = await auth.resolveSession(res);
      setUserState(resolved);
      setStatus("authenticated");
      setSessionError(null);
      return resolved;
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUserState(null);
    setStatus("unauthenticated");
    setSessionError(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionError, login, register, logout, refresh, setUser }),
    [user, status, sessionError, login, register, logout, refresh, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
