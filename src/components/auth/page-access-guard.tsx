"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { canOpenPage, getFirstAllowedPath } from "@/lib/auth/permissions";

/** Yetkisiz sayfayı render etmez; izinli ilk sayfaya yönlendirir. */
export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const denied = Boolean(user && !canOpenPage(user, pathname));

  useEffect(() => {
    if (loading && !user) return;
    if (!user || canOpenPage(user, pathname)) return;
    router.replace(`${getFirstAllowedPath(user)}?denied=1`);
  }, [loading, user, pathname, router]);

  if (denied) return null;
  return <>{children}</>;
}
