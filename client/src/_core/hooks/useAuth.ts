import { startLogin } from "@/const";
import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  authId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { user?: AuthUser | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível validar sua sessão.");
      setUser(data.user ?? null);
      return data.user ?? null;
    } catch (authError) {
      const normalized = authError instanceof Error ? authError : new Error("Não foi possível validar sua sessão.");
      setError(normalized);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.href = redirectPath;
    else startLogin();
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    refresh,
    logout,
  };
}
