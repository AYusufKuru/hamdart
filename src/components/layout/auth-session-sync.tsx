"use client";

import { useLayoutEffect } from "react";
import { type AuthUser, useAuth } from "@/lib/auth/auth-context";

/** Sunucuda doğrulanmış oturumu istemci menüsüne hemen yazar. */
export function AuthSessionSync({ user }: { user: AuthUser }) {
  const { hydrateUser } = useAuth();
  const grantsKey = user.grants.map((g) => `${g.role}:${g.access}`).join(",");
  useLayoutEffect(() => {
    hydrateUser(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrateUser,
    user.userId,
    user.username,
    user.name,
    user.role,
    grantsKey,
    user.roleLabel,
    user.mustChangePassword,
  ]);
  return null;
}
