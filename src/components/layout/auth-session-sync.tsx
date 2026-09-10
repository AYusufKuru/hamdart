"use client";

import { useLayoutEffect } from "react";
import { type AuthUser, useAuth } from "@/lib/auth/auth-context";

/** Sunucuda doğrulanmış oturumu istemci menüsüne hemen yazar. */
export function AuthSessionSync({ user }: { user: AuthUser }) {
  const { hydrateUser } = useAuth();
  useLayoutEffect(() => {
    hydrateUser(user);
  }, [
    hydrateUser,
    user.userId,
    user.username,
    user.name,
    user.role,
    user.roleLabel,
    user.mustChangePassword,
  ]);
  return null;
}
