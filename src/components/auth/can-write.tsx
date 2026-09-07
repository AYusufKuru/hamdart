"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import type { Resource } from "@/lib/auth/permissions";

/** Yazma yetkisi yoksa children render edilmez */
export function CanWrite({
  resource,
  children,
}: {
  resource: Resource;
  children: ReactNode;
}) {
  const { canWrite } = useAuth();
  if (!canWrite(resource)) return null;
  return <>{children}</>;
}
