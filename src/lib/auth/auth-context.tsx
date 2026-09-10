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
import {
  canRead,
  canWrite,
  type Resource,
} from "@/lib/auth/permissions";
import { csrfHeader } from "@/lib/auth/csrf-client";
import { type AuthUser } from "@/lib/auth/user";

export type { AuthUser };
export { ROLE_LABELS } from "@/lib/auth/permissions";
export { toAuthUser } from "@/lib/auth/user";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hydrateUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
  canRead: (resource: Resource) => boolean;
  canWrite: (resource: Resource) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const requestId = useRef(0);

  const hydrateUser = useCallback((next: AuthUser) => {
    setUser(next);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    let lastError = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (id !== requestId.current) return;
        if (res.status === 401) {
          if (attempt < 2) {
            await sleep(250 * (attempt + 1));
            continue;
          }
          setUser((prev) => prev ?? null);
          return;
        }
        if (!res.ok) {
          lastError = true;
          await sleep(250 * (attempt + 1));
          continue;
        }
        const data = (await res.json()) as { user: AuthUser };
        setUser(data.user);
        lastError = false;
        return;
      } catch {
        lastError = true;
        await sleep(250 * (attempt + 1));
      } finally {
        window.clearTimeout(timer);
      }
    }

    if (id !== requestId.current) return;
    if (lastError) {
      // Geçici ağ/DB hatasında oturumu silme; menü boş kalmasın.
      return;
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => {
      setLoading(false);
    });
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
      hydrateUser,
      logout,
      canRead: (resource) => (user ? canRead(user.role, resource) : false),
      canWrite: (resource) => (user ? canWrite(user.role, resource) : false),
    }),
    [user, loading, refresh, hydrateUser, logout]
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
