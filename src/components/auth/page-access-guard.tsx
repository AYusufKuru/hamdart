"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getFirstAllowedPath,
  pathToResource,
} from "@/lib/auth/permissions";

/** Yetkisiz sayfayı render etmez; izinli ilk sayfaya yönlendirir. */
export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, canRead } = useAuth();
  const resource = pathToResource(pathname);
  const denied = Boolean(user && resource && !canRead(resource));

  useEffect(() => {
    if (loading && !user) return;
    if (!user || !resource || canRead(resource)) return;
    router.replace(`${getFirstAllowedPath(user.role)}?denied=1`);
  }, [loading, user, resource, canRead, router]);

  if (denied) return null;
  return <>{children}</>;
}
