"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canRead,
  canWrite,
  type Resource,
  type Role,
  ROLE_LABELS,
} from "@/lib/auth/permissions";
import { csrfHeader } from "@/lib/auth/csrf-client";

export type AuthUser = {
  userId: string;
  username: string;
  name: string;
  role: Role;
  roleLabel: string;
  mustChangePassword: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  canRead: (resource: Resource) => boolean;
  canWrite: (resource: Resource) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { ...csrfHeader() },
    });
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      logout,
      canRead: (resource) => (user ? canRead(user.role, resource) : false),
      canWrite: (resource) => (user ? canWrite(user.role, resource) : false),
    }),
    [user, loading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth AuthProvider içinde kullanılmalıdır");
  }
  return ctx;
}

export { ROLE_LABELS };
