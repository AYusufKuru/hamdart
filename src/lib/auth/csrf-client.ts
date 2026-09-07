/** İstemci: CSRF çerezini okuyup istek başlığına koyar. */

import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth/csrf-constants";

export function readCsrfTokenFromDocument(): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name !== CSRF_COOKIE) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

export function csrfHeader(): Record<string, string> {
  const token = readCsrfTokenFromDocument();
  return token ? { [CSRF_HEADER]: token } : {};
}
